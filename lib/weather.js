'use strict';
const {hasForecast,parseOpenForecast}=require('./forecast');
const {assertOpenMeteoConsent}=require('../homebridge-ui/public/config');
const {responseText}=require('./http');
const {setTimeout:delay}=require('node:timers/promises');
const fields = {temperature: 'temperature_2m', humidity: 'relative_humidity_2m', windSpeed: 'wind_speed_10m', windGusts: 'wind_gusts_10m'};
function urlFor(config) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  const wantsLight=config.showLightSensor||(config.switches||[]).some(s=>s.conditions.some(c=>c.metric==='illuminance'&&c.source!=='forecast'&&c.dataSource!=='local'));
  url.search = new URLSearchParams({latitude: config.latitude, longitude: config.longitude,
    current: [...Object.values(fields),'cloud_cover', ...(wantsLight ? ['shortwave_radiation_instant'] : [])].join(','), temperature_unit: 'celsius', wind_speed_unit: 'kmh', timeformat: 'unixtime', timezone: 'GMT'}).toString();
  url.searchParams.set('hourly',(hasForecast(config)?[...Object.values(fields),'cloud_cover','precipitation']:['precipitation']).join(','));
  url.searchParams.set('past_hours','2');url.searchParams.set('forecast_hours',hasForecast(config)?'96':'1');
  return url;
}
function parse(data, now = Date.now()) {
  const c = data?.current, u = data?.current_units;
  if (!c || !Number.isFinite(c.time) || u?.time !== 'unixtime') throw new Error('Ungültiger Wetterzeitstempel.');
  const time = c.time * 1000;
  if (time > now + 60000) throw new Error('Wetterdaten liegen in der Zukunft.');
  const values = {};
  for (const [key, field] of Object.entries(fields)) {
    const v = c[field], unit = key === 'temperature' ? '°C' : key === 'humidity' ? '%' : 'km/h';
    const min = key === 'temperature' ? -100 : 0, max = key === 'temperature' ? 70 : key === 'humidity' ? 100 : 500;
    if (u[field] !== unit || typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`Ungültiger Wetterwert oder Einheit: ${field}`);
    values[key] = v;
  }
  const radiation=c.shortwave_radiation_instant;
  if(u.cloud_cover==='%'&&typeof c.cloud_cover==='number'&&c.cloud_cover>=0&&c.cloud_cover<=100)values.cloudCover=c.cloud_cover;
  if (u.shortwave_radiation_instant === 'W/m²' && typeof radiation === 'number' && Number.isFinite(radiation) && radiation>=0 && radiation<=2000) values.illuminance=estimateLux(radiation);
  const hourly=data.hourly,units=data.hourly_units;
  let precipitationTime=null;
  if(units?.time==='unixtime'&&units.precipitation==='mm'&&Array.isArray(hourly?.time)){
    const times=hourly.time.map((seconds,index)=>({time:typeof seconds==='number'?seconds*1000:NaN,index})).filter(r=>Number.isFinite(r.time)&&r.time<=time&&r.time%3600000===0).sort((a,b)=>b.time-a.time);
    const latest=times[0],value=hourly.precipitation?.[latest?.index];
    if(latest&&time-latest.time<3600000&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=500){values.precipitation=value;precipitationTime=latest.time;}
  }
  return {time, values,precipitationTime};
}
// Global daylight efficacy approximation, Littlefair (1985), DOI 10.1177/14771535850170040401.
// HAP LightSensor supports 0.0001..100000 lux; artificial and moon light are not modelled.
function estimateLux(radiation) { return Math.max(0.0001,Math.min(100000,radiation*105)); }
async function fetchWeather(config, signal, fetcher = fetch, {beforeRequest,wait=milliseconds=>delay(milliseconds,undefined,{signal})}={}) {
  assertOpenMeteoConsent(config);
  let response;
  for(let attempt=0;attempt<2;attempt++){
    signal?.throwIfAborted();assertOpenMeteoConsent(config);beforeRequest?.();signal?.throwIfAborted();
    let failure;
    try{response=await fetcher(urlFor(config),{signal,redirect:'error',headers:{Accept:'application/json'}});}
    catch{signal?.throwIfAborted();failure=Error('Open-Meteo-Abruf fehlgeschlagen.');}
    if(!failure&&(!response||typeof response.ok!=='boolean'))throw Error('Ungültige Wetterantwort.');
    if(response?.ok)break;
    let pause=2000;
    if(!failure){
      failure=Error(`Wetterdienst HTTP ${response.status}`);
      if(![502,503,504].includes(response.status))throw failure;
      const retryAfter=response.headers?.get('retry-after');
      if(retryAfter){const time=/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Date.parse(retryAfter)-Date.now();if(Number.isFinite(time))pause=Math.max(pause,time);}
      await response.body?.cancel?.();
    }
    if(attempt||pause>5000)throw failure;
    assertOpenMeteoConsent(config);beforeRequest?.();await wait(pause);response=undefined;
  }
  const body = await responseText(response,100000);
  if (body.length > 100000) throw new Error('Wetterantwort zu groß.');
  const data=JSON.parse(body);let sample;
  try{sample=parse(data);}catch(e){if(!hasForecast(config))throw e;sample={currentError:e.message};}
  if(hasForecast(config)){try{sample.forecast=parseOpenForecast(data);}catch(e){sample.forecastError=e.message;}}
  return sample;
}
module.exports = {urlFor, parse, fetchWeather, estimateLux};
