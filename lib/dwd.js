'use strict';
const {select} = require('../homebridge-ui/public/station');
const {estimateLux} = require('./weather');
const {responseText}=require('./http');
const columns = {temperature:'dry_bulb_temperature_at_2_meter_above_ground',humidity:'relative_humidity',windSpeed:'mean_wind_speed_during last_10_min_at_10_meters_above_ground',windGusts:'maximum_wind_speed_last_hour'};
function parseDwd(text, station, now=Date.now()) {
  const rows = text.trim().split(/\r?\n/).map(line => line.split(';').map(v=>v.trim()));
  const [headers, units] = rows;
  if (!headers || units?.[0] !== station.id) throw new Error('DWD-Stationskennung stimmt nicht überein.');
  const indexes = Object.fromEntries(Object.entries(columns).map(([key, name])=>[key,headers.indexOf(name)]));
  for (const [key, i] of Object.entries(indexes)) {
    if (i < 2 || units[i] !== (key==='temperature'?'Grad C':key==='humidity'?'%':'km/h')) throw new Error('DWD-Spalte oder Einheit fehlt: '+key);
  }
  const radiationIndex=headers.indexOf('global_radiation_last_hour');
  const cloudIndex=headers.indexOf('cloud_cover_total');
  const precipitationIndex=headers.indexOf('precipitation_amount_last_hour');
  const reports = [];
  for (const row of rows.slice(3)) {
    const date = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(row[0]);
    const clock = /^(\d{2}):(\d{2})$/.exec(row[1]);
    if (!date || !clock) continue;
    const iso = `20${date[3]}-${date[2]}-${date[1]}T${clock[1]}:${clock[2]}:00.000Z`;
    const time = Date.parse(iso);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== iso || time > now+60000) continue;
    const values = {};
    for (const [key, i] of Object.entries(indexes)) {
      const raw=row[i];
      if (!raw || !/^-?\d+(?:[.,]\d+)?$/.test(raw)) continue;
      const v=Number(raw.replace(',','.'));
      const min=key==='temperature'?-100:0,max=key==='temperature'?70:key==='humidity'?100:500;
      if (Number.isFinite(v) && v>=min && v<=max) values[key]=v;
    }
    const rawRadiation=row[radiationIndex];
    const rawCloud=row[cloudIndex];
    const rawPrecipitation=row[precipitationIndex];
    if(precipitationIndex>=2&&units[precipitationIndex]==='mm'&&/^\d+(?:[.,]\d+)?$/.test(rawPrecipitation||'')){const amount=Number(rawPrecipitation.replace(',','.'));if(amount<=500)values.precipitation=amount;}
    if(cloudIndex>=2&&units[cloudIndex]==='%'&&/^\d+(?:[.,]\d+)?$/.test(rawCloud||'')){const cloud=Number(rawCloud.replace(',','.'));if(cloud<=100)values.cloudCover=cloud;}
    if (radiationIndex>=2 && units[radiationIndex]==='W/m2' && /^\d+(?:[.,]\d+)?$/.test(rawRadiation || '')) {
      const radiation=Number(rawRadiation.replace(',','.'));
      if (radiation<=2000) values.illuminance=estimateLux(radiation);
    }
    reports.push({time, values,precipitationTime:Number.isFinite(values.precipitation)?time:null,station, source: `DWD ${station.name} (${station.id}), ${station.distance.toFixed(1)} km, Windmesshöhe ${station.windHeight} m`});
  }
  reports.sort((a,b)=>b.time-a.time);
  if (!reports.length) throw new Error('Kein gültiger DWD-Beobachtungszeitpunkt.');
  // Missing newest values remain unavailable; older observations are never substituted.
  return reports[0];
}
async function fetchDwd(config, signal, fetcher=fetch) {
  const station=select(config);
  const response=await fetcher(`https://opendata.dwd.de/weather/weather_reports/poi/${station.id}-BEOB.csv`,{signal,redirect:'error'});
  if (!response.ok) throw new Error(`DWD HTTP ${response.status}`);
  const text=await responseText(response,1000000);
  if (text.length>1000000) throw new Error('DWD-Antwort zu groß.');
  return parseDwd(text,station);
}
module.exports={parseDwd,fetchDwd};
