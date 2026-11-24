'use strict';
const {XMLParser,XMLValidator}=require('fast-xml-parser');
const {unzipSync}=require('fflate');
const {select,distance}=require('../homebridge-ui/public/station');
const {responseBytes}=require('./http');
const fields={temperature:'temperature_2m',humidity:'relative_humidity_2m',windSpeed:'wind_speed_10m',windGusts:'wind_gusts_10m',cloudCover:'cloud_cover',precipitation:'precipitation'};
function validValue(metric,value){
  const min=metric==='temperature'?-100:0,max=metric==='temperature'?70:['humidity','cloudCover'].includes(metric)?100:500;
  return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
}
function hasForecast(config){return (config.switches||[]).some(s=>s.conditions.some(c=>c.source==='forecast'));}
function parseOpenForecast(data,now=Date.now()){
  const h=data?.hourly,u=data?.hourly_units;
  if(!Array.isArray(h?.time)||h.time.length<1||h.time.length>400||u?.time!=='unixtime')throw Error('Ungültige Open-Meteo-Prognose.');
  const rows=h.time.map((seconds,i)=>{
    if(!Number.isFinite(seconds)||!Number.isInteger(seconds)||i&&seconds-h.time[i-1]!==3600)throw Error('Ungültiges Prognose-Zeitraster.');
    const values={};
    for(const [metric,field]of Object.entries(fields)){
      const unit=metric==='precipitation'?'mm':metric==='temperature'?'°C':['humidity','cloudCover'].includes(metric)?'%':'km/h',v=h[field]?.[i];
      if(u[field]===unit&&validValue(metric,v))values[metric]=v;
    }
    return {time:seconds*1000,values};
  });
  return {issuedAt:null,fetchedAt:now,source:'Open-Meteo',rows};
}
function parseMosmix(xml,id,config,now=Date.now()){
  if(typeof xml!=='string'||xml.length>4000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Ungültiges MOSMIX-XML.');
  const document=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,processEntities:false}).parse(xml)?.kml?.Document;
  const product=document?.ExtendedData?.ProductDefinition,point=document?.Placemark;
  if(!product||Array.isArray(point)||String(point?.name)!==id||product.ProductID!=='MOSMIX')throw Error('MOSMIX-Produkt oder Vorhersagepunkt stimmt nicht überein.');
  const issuedAt=Date.parse(product.IssueTime);
  if(!Number.isFinite(issuedAt)||issuedAt>now+60000)throw Error('Ungültige MOSMIX-Ausgabezeit.');
  const times=[product.ForecastTimeSteps?.TimeStep].flat().map(t=>Date.parse(t));
  if(!times.length||times.length>300||times.some((t,i)=>!Number.isFinite(t)||i&&t-times[i-1]!==3600000))throw Error('Ungültiges MOSMIX-Zeitraster.');
  const arrays={};
  for(const f of [point.ExtendedData?.Forecast].flat()){
    if(!f)continue;const key=f['@_elementName'];if(!['TTT','Td','FF','FX1','N','RR1c'].includes(key))continue;
    if(arrays[key])throw Error('Doppelte MOSMIX-Wettergröße.');
    const tokens=String(f.value??'').trim().split(/\s+/);if(tokens.length!==times.length)throw Error('Unvollständige MOSMIX-Wertereihe.');
    arrays[key]=tokens.map(v=>/^-?\d+(?:\.\d+)?$/.test(v)?Number(v):null);
  }
  const rows=times.map((time,i)=>{
    const values={};
    for(const [metric,key,convert]of [['temperature','TTT',v=>v-273.15],['windSpeed','FF',v=>v*3.6],['windGusts','FX1',v=>v*3.6],['cloudCover','N',v=>v],['precipitation','RR1c',v=>v]]){
      const raw=arrays[key]?.[i];if(typeof raw!=='number')continue;const value=convert(raw);if(validValue(metric,value))values[metric]=value;
    }
    const temperature=values.temperature,rawDew=arrays.Td?.[i];
    if(Number.isFinite(temperature)&&typeof rawDew==='number'){
      const dew=rawDew-273.15;
      if(dew>=-100&&dew<=temperature+0.2){const humidity=Math.min(100,100*Math.exp(17.5043*dew/(241.2+dew)-17.5043*temperature/(241.2+temperature)));if(validValue('humidity',humidity))values.humidity=humidity;}
    }
    return {time,values};
  });
  const coordinates=String(point.Point?.coordinates||'').split(',').map(Number),station={id,name:String(point.description||id),longitude:coordinates[0],latitude:coordinates[1]};
  if(!Number.isFinite(station.latitude)||Math.abs(station.latitude)>90||!Number.isFinite(station.longitude)||Math.abs(station.longitude)>180)throw Error('Ungültige MOSMIX-Koordinaten.');
  station.distance=distance(config,station);
  if(station.distance>(config.dwdMaxDistance??100))throw Error('MOSMIX-Punkt außerhalb der maximalen Entfernung.');
  return {issuedAt,fetchedAt:now,source:`DWD MOSMIX ${station.name} (${id}), ${station.distance.toFixed(1)} km`,station,rows};
}
function parseKmz(bytes,id,config,now=Date.now()){
  if(bytes.length>2000000)throw Error('MOSMIX-Antwort zu groß.');
  let accepted=0;
  const files=unzipSync(bytes,{filter:file=>{
    if(!file.name.toLowerCase().endsWith('.kml'))return false;
    if(++accepted>1||file.originalSize>4000000)throw Error('Ungültiges MOSMIX-Archiv.');
    return true;
  }});
  const entries=Object.values(files);if(entries.length!==1||entries[0].length>4000000)throw Error('Ungültiges MOSMIX-Archiv.');
  const head=Buffer.from(entries[0].subarray(0,150)).toString('ascii');
  const xml=new TextDecoder(/encoding=["']ISO-8859-1/i.test(head)?'iso-8859-1':'utf-8',{fatal:true}).decode(entries[0]);
  return parseMosmix(xml,id,config,now);
}
async function fetchMosmix(config,signal,fetcher=fetch){
  const id=config.dwdForecastStation||select(config).id;
  const url=`https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/${id}/kml/MOSMIX_L_LATEST_${id}.kmz`;
  const response=await fetcher(url,{signal,redirect:'error'});if(!response.ok)throw Error(`MOSMIX HTTP ${response.status}`);
  return parseKmz(new Uint8Array(await responseBytes(response,2000000)),id,config);
}
function forecastInput(condition,forecast,config,now=Date.now()){
  const result={source:'forecast',metric:condition.metric,aggregation:condition.aggregation,available:false,value:null,startHours:condition.forecastStartHours,endHours:condition.forecastEndHours,
    sourceName:forecast?.source||'',issuedAt:forecast?.issuedAt??null,fetchedAt:forecast?.fetchedAt??null};
  const ageBase=forecast?.issuedAt??forecast?.fetchedAt;
  if(!forecast||!Number.isFinite(ageBase)||now-ageBase>config.forecastStaleAfter*1000||ageBase>now+60000){result.reason='stale';return result;}
  const hour=3600000,from=now+condition.forecastStartHours*hour,to=now+condition.forecastEndHours*hour;
  const wanted=[];
  if(condition.aggregation==='at')wanted.push(Math.ceil(to/hour)*hour);
  else for(let time=Math.floor(from/hour)*hour+hour;time<=to;time+=hour)wanted.push(time);
  result.validFrom=wanted[0]??null;result.validTo=wanted.at(-1)??null;
  if(condition.metric==='precipitation'&&Number.isFinite(result.validFrom))result.validFrom-=hour;
  const lookup=new Map(forecast.rows.map(row=>[row.time,row.values[condition.metric]])),values=wanted.map(time=>lookup.get(time));
  if(!wanted.length||values.some(v=>!validValue(condition.metric,v))){result.reason='missing';return result;}
  result.value=condition.aggregation==='sum'?values.reduce((a,b)=>a+b,0):condition.aggregation==='min'?Math.min(...values):condition.aggregation==='mean'?values.reduce((a,b)=>a+b,0)/values.length:condition.aggregation==='at'?values[0]:Math.max(...values);
  result.available=true;return result;
}
module.exports={fields,hasForecast,validValue,parseOpenForecast,parseMosmix,parseKmz,fetchMosmix,forecastInput};
