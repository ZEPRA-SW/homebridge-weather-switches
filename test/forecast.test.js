'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {zipSync,strToU8}=require('fflate');
const F=require('../lib/forecast'),{parse,fetchWeather,urlFor}=require('../lib/weather'),{parseDwd}=require('../lib/dwd');
const {validate,CONSENT_VERSION}=require('../homebridge-ui/public/config');
const {Rule}=require('../lib/rules');
const hour=3600000,now=Date.UTC(2026,10,2,6,15),config={latitude:52.52,longitude:13.41,dwdMaxDistance:100,forecastStaleAfter:43200};
function mosmix(values={}){
  const times=Array.from({length:10},(_,i)=>Date.UTC(2026,10,2,7+i));
  const series={TTT:Array(10).fill(273.15),Td:Array(10).fill(270.15),FF:Array(10).fill(10),FX1:Array(10).fill(20),N:Array(10).fill(80),...values};
  return `<kml xmlns:dwd="https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd"><Document><ExtendedData><dwd:ProductDefinition><dwd:ProductID>MOSMIX</dwd:ProductID><dwd:IssueTime>2026-11-02T03:00:00.000Z</dwd:IssueTime><dwd:ForecastTimeSteps>${times.map(t=>`<dwd:TimeStep>${new Date(t).toISOString()}</dwd:TimeStep>`).join('')}</dwd:ForecastTimeSteps></dwd:ProductDefinition></ExtendedData><Placemark><name>10384</name><description>BERLIN-TEMPELHOF</description><Point><coordinates>13.4,52.47,50</coordinates></Point><ExtendedData>${Object.entries(series).filter(([,v])=>v!==null).map(([key,list])=>`<dwd:Forecast dwd:elementName="${key}"><dwd:value>${list.join(' ')}</dwd:value></dwd:Forecast>`).join('')}</ExtendedData></Placemark></Document></kml>`;
}
const condition=(extra={})=>({metric:'windSpeed',source:'forecast',aggregation:'max',forecastStartHours:0,forecastEndHours:6,...extra});
test('MOSMIX parses station, issue/validity times, Kelvin and m/s, total cloud and derived humidity',()=>{
  const f=F.parseMosmix(mosmix(),'10384',config,now),v=f.rows[0].values;
  assert.equal(f.rows.length,10);assert.equal(f.issuedAt,Date.UTC(2026,10,2,3));assert.equal(f.station.id,'10384');assert.ok(f.station.distance>5&&f.station.distance<6);
  assert.equal(v.temperature,0);assert.equal(v.windSpeed,36);assert.equal(v.windGusts,72);assert.equal(v.cloudCover,80);assert.ok(v.humidity>70&&v.humidity<90);
});
test('MOSMIX rejects wrong station, invalid dates, XML entities and incomplete arrays; missing values are not zero',()=>{
  const missing=F.parseMosmix(mosmix({FF:Array(10).fill('-'),N:null,Neff:Array(10).fill(100)}),'10384',config,now);
  assert.equal(missing.rows[0].values.windSpeed,undefined);assert.equal(missing.rows[0].values.cloudCover,undefined);
  assert.throws(()=>F.parseMosmix(mosmix(),'99999',config,now));
  assert.throws(()=>F.parseMosmix('<!DOCTYPE x>'+mosmix(),'10384',config,now));
  assert.throws(()=>F.parseMosmix(mosmix({TTT:[273]}),'10384',config,now));
  assert.throws(()=>F.parseMosmix(mosmix().replace('03:00:00.000Z','23:00:00.000Z'),'10384',config,now));
});
test('KMZ accepts one bounded KML and rejects ambiguous or oversized archives',()=>{
  const zip=zipSync({'station.kml':strToU8(mosmix())});assert.equal(F.parseKmz(zip,'10384',config,now).station.id,'10384');
  assert.throws(()=>F.parseKmz(zipSync({'a.kml':strToU8(mosmix()),'b.kml':strToU8(mosmix())}),'10384',config,now));
  assert.throws(()=>F.parseKmz(new Uint8Array(2000001),'10384',config,now));
});
test('forecast window max/min/mean and next-hour target selection use complete hourly coverage',()=>{
  const f=F.parseMosmix(mosmix({FF:[1,2,3,4,5,6,7,8,9,10]}),'10384',config,now);
  assert.equal(F.forecastInput(condition(),f,config,now).value,21.6);
  assert.equal(F.forecastInput(condition({aggregation:'min'}),f,config,now).value,3.6);
  assert.ok(Math.abs(F.forecastInput(condition({aggregation:'mean'}),f,config,now).value-12.6)<1e-9);
  const at=F.forecastInput(condition({aggregation:'at'}),f,config,now);assert.equal(at.validFrom,Date.UTC(2026,10,2,13));assert.equal(at.validTo,at.validFrom);assert.equal(at.value,25.2);
  const later=F.forecastInput(condition({forecastStartHours:2,forecastEndHours:4}),f,config,now);assert.equal(later.validFrom,Date.UTC(2026,10,2,9));assert.equal(later.value,14.4);
});
test('stale issue time, a missing hourly value, missing horizon and rolling windows become unavailable',()=>{
  const f=F.parseMosmix(mosmix(),'10384',config,now);
  assert.equal(F.forecastInput(condition(),f,{...config,forecastStaleAfter:3600},now).reason,'stale');
  delete f.rows[1].values.windSpeed;assert.equal(F.forecastInput(condition(),f,config,now).reason,'missing');
  assert.equal(F.forecastInput(condition({forecastEndHours:72}),f,config,now).available,false);
  assert.equal(F.forecastInput(condition(),null,config,now).available,false);
});
test('Open-Meteo forecast units, grid and null values are kept distinct from current values',()=>{
  const data={hourly:{time:[now/1000+2700,now/1000+6300],temperature_2m:[10,null],relative_humidity_2m:[60,65],wind_speed_10m:[20,25],wind_gusts_10m:[30,40],cloud_cover:[80,90]},hourly_units:{time:'unixtime',temperature_2m:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h',wind_gusts_10m:'km/h',cloud_cover:'%'}};
  const f=F.parseOpenForecast(data,now);assert.equal(f.issuedAt,null);assert.equal(f.fetchedAt,now);assert.equal(f.rows[1].values.temperature,undefined);assert.equal(f.rows[0].values.cloudCover,80);
  data.hourly.time[1]++;assert.throws(()=>F.parseOpenForecast(data,now));
});
test('combined Open-Meteo request is consent gated and retains valid forecast when current data is malformed',async()=>{
  const cfg=validate({...require('../example.config.json'),openMeteoPrivateConsent:true,_openMeteoConsentVersion:CONSENT_VERSION,switches:[{id:'f',name:'F',conditions:[{...condition(),operator:'above',threshold:20,releaseThreshold:15}]}]});
  const data={current:{},hourly:{time:[now/1000+2700],wind_speed_10m:[20]},hourly_units:{time:'unixtime',wind_speed_10m:'km/h'}};
  let calls=0;const response=await fetchWeather(cfg,undefined,async()=>{calls++;return {ok:true,text:async()=>JSON.stringify(data)};});
  assert.equal(calls,1);assert.ok(response.currentError);assert.equal(response.forecast.rows[0].values.windSpeed,20);assert.ok(urlFor(cfg).searchParams.get('hourly').includes('cloud_cover'));
  cfg.openMeteoPrivateConsent=false;await assert.rejects(fetchWeather(cfg,undefined,async()=>{calls++;}));assert.equal(calls,1);
});
test('current cloud cover uses explicit percent, DWD missing cloud remains missing',()=>{
  const d={current:{time:now/1000,temperature_2m:10,relative_humidity_2m:70,wind_speed_10m:0,wind_gusts_10m:5,cloud_cover:100},current_units:{time:'unixtime',temperature_2m:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h',wind_gusts_10m:'km/h',cloud_cover:'%'}};
  assert.equal(parse(d,now).values.cloudCover,100);d.current.cloud_cover=null;assert.equal(parse(d,now).values.cloudCover,undefined);
  const header='surface observations;Parameter description;dry_bulb_temperature_at_2_meter_above_ground;relative_humidity;mean_wind_speed_during last_10_min_at_10_meters_above_ground;maximum_wind_speed_last_hour;cloud_cover_total\n10384;Unit;Grad C;%;km/h;km/h;%\nDatum;Zeit;t;h;w;g;n\n02.11.26;06:00;10;70;0;5;';
  assert.equal(parseDwd(header+'100',{id:'10384',name:'Test',distance:0,windHeight:10},now).values.cloudCover,100);
  assert.equal(parseDwd(header+'---',{id:'10384',name:'Test',distance:0,windHeight:10},now).values.cloudCover,undefined);
});
test('mixed condition values still apply per-condition hysteresis and AND/OR rules',()=>{
  const c=validate({...require('../example.config.json'),switches:[{id:'mixed',name:'Mixed',conditions:[{metric:'temperature',operator:'above',threshold:20,releaseThreshold:18},{...condition({metric:'cloudCover'}),operator:'above',threshold:70,releaseThreshold:60}]}]}).switches[0];
  const rule=new Rule(c);assert.equal(rule.evaluate([22,80],now),true);assert.equal(rule.evaluate([19,65],now+1000),true);assert.equal(rule.evaluate([17,80],now+2000),false);
});
test('forecast defaults, source and whole-hour horizon limits are validated, including example',()=>{
  const cfg=validate(require('../example.forecast.config.json'));assert.equal(cfg.provider,'dwd');assert.equal(cfg.forecastStaleAfter,43200);
  const base=()=>({...require('../example.config.json'),switches:[{id:'f',name:'F',conditions:[{source:'forecast',metric:'cloudCover',operator:'above',threshold:80,releaseThreshold:60}]}]});
  const c=validate(base()).switches[0].conditions[0];assert.equal(c.aggregation,'max');assert.equal(c.forecastStartHours,0);assert.equal(c.forecastEndHours,6);
  for(const patch of [{forecastEndHours:73},{forecastStartHours:6,forecastEndHours:6},{forecastStartHours:1.5},{aggregation:'sum'},{source:'unknown'},{threshold:101}]){const input=base();Object.assign(input.switches[0].conditions[0],patch);assert.throws(()=>validate(input));}
});
test('streamed responses stop at the byte limit and declared oversized bodies are rejected before reading',async()=>{
  const {responseBytes}=require('../lib/http');let cancelled=false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4));controller.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}});
  await assert.rejects(responseBytes(new Response(stream),5),/groß/);assert.equal(cancelled,true);
  await assert.rejects(responseBytes({headers:{get:()=>100},body:{getReader(){throw Error('must not read');}}},5),/groß/);
  assert.equal((await responseBytes(new Response('ok'),5)).toString(),'ok');
});


test('precipitation uses completed hourly Open-Meteo amounts, not current 15-minute values',()=>{
  const d={current:{time:now/1000,temperature_2m:10,relative_humidity_2m:70,wind_speed_10m:0,wind_gusts_10m:5,precipitation:99},current_units:{time:'unixtime',temperature_2m:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h',wind_gusts_10m:'km/h'},hourly:{time:[now/1000-4500,now/1000-900,now/1000+2700],precipitation:[4,0,8]},hourly_units:{time:'unixtime',precipitation:'mm'}};
  assert.equal(parse(d,now).values.precipitation,0);assert.equal(parse(d,now).precipitationTime,now-900000);
  d.hourly.precipitation[1]=null;assert.equal(parse(d,now).values.precipitation,undefined);
  d.hourly.precipitation[1]=2.5;d.hourly_units.precipitation='inch';assert.equal(parse(d,now).values.precipitation,undefined);
  d.hourly_units.precipitation='mm';d.hourly.time.splice(1,1);d.hourly.precipitation.splice(1,1);assert.equal(parse(d,now).values.precipitation,undefined);
  const url=urlFor({latitude:0,longitude:0});assert.equal(url.searchParams.get('hourly'),'precipitation');assert.equal(url.searchParams.get('past_hours'),'2');
});
test('DWD observation precipitation accepts zero and decimal comma, never fills missing amounts',()=>{
  const header='surface;parameters;dry_bulb_temperature_at_2_meter_above_ground;relative_humidity;mean_wind_speed_during last_10_min_at_10_meters_above_ground;maximum_wind_speed_last_hour;precipitation_amount_last_hour\n10384;units;Grad C;%;km/h;km/h;mm\nDatum;Zeit;t;h;w;g;r\n02.11.26;06:00;10;70;0;5;';
  const station={id:'10384',name:'Test',distance:0,windHeight:10};
  assert.equal(parseDwd(header+'0',station,now).values.precipitation,0);assert.equal(parseDwd(header+'2,5',station,now).values.precipitation,2.5);
  const missing=parseDwd(header+'---\n02.11.26;05:00;10;70;0;5;12',station,now);assert.equal(missing.values.precipitation,undefined);assert.equal(missing.precipitationTime,null);
  assert.equal(parseDwd(header.replace(';mm',';cm')+'2',station,now).values.precipitation,undefined);
});
test('MOSMIX hourly precipitation sums real amounts with explicit interval bounds and no missing-as-zero',()=>{
  const f=F.parseMosmix(mosmix({RR1c:[0,1,2,3,4,5,6,7,8,9]}),'10384',config,now),c=condition({metric:'precipitation',aggregation:'sum'});
  const input=F.forecastInput(c,f,config,now);assert.equal(input.value,15);assert.equal(input.validFrom,Date.UTC(2026,10,2,6));assert.equal(input.validTo,Date.UTC(2026,10,2,12));
  assert.equal(F.forecastInput({...c,aggregation:'max'},f,config,now).value,5);
  assert.equal(F.forecastInput({...c,aggregation:'mean'},f,config,now).value,2.5);
  delete f.rows[1].values.precipitation;assert.equal(F.forecastInput(c,f,config,now).available,false);
});
test('Open-Meteo forecast precipitation requires millimeters and keeps null or negative missing',()=>{
  const d={hourly:{time:[now/1000+2700,now/1000+6300],precipitation:[0,2]},hourly_units:{time:'unixtime',precipitation:'mm'}};
  assert.equal(F.parseOpenForecast(d,now).rows[0].values.precipitation,0);assert.equal(F.parseOpenForecast(d,now).rows[1].values.precipitation,2);
  d.hourly.precipitation=[null,-1];assert.ok(F.parseOpenForecast(d,now).rows.every(r=>r.values.precipitation===undefined));
  d.hourly.precipitation=[1,2];d.hourly_units.precipitation='inch';assert.ok(F.parseOpenForecast(d,now).rows.every(r=>r.values.precipitation===undefined));
});
test('only precipitation forecasts accept sum; thresholds retain hysteresis and bounded totals',()=>{
  const base=()=>({...require('../example.config.json'),switches:[{id:'rain',name:'Rain',conditions:[{metric:'precipitation',source:'forecast',aggregation:'sum',operator:'above',threshold:5,releaseThreshold:2}]}]});
  const cfg=validate(base()),rule=new Rule(cfg.switches[0]);assert.equal(rule.evaluate([6],now),true);assert.equal(rule.evaluate([3],now+1000),true);assert.equal(rule.evaluate([1],now+2000),false);
  let c=base();c.switches[0].conditions[0].threshold=36001;assert.throws(()=>validate(c));c=base();c.switches[0].conditions[0].metric='windSpeed';assert.throws(()=>validate(c));
});
