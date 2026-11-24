'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDwd,fetchDwd}=require('../lib/dwd');
const {select,distance}=require('../homebridge-ui/public/station');
const {estimateLux,parse,urlFor}=require('../lib/weather');
const station=select({latitude:52.52,longitude:13.41});
const now=Date.UTC(2026,10,2,5,50);
const csv=()=>`surface observations;Parameter description;dry_bulb_temperature_at_2_meter_above_ground;relative_humidity;mean_wind_speed_during last_10_min_at_10_meters_above_ground;maximum_wind_speed_last_hour;global_radiation_last_hour
${station.id};Unit;Grad C;%;km/h;km/h;W/m2
Datum;Uhrzeit (UTC);Temperatur;Relative Feuchte;Wind;Windboen;Strahlung
02.11.26;05:00;-2,4;87;0;12;10,5
02.11.26;04:00;2;90;15;30;20`;
test('nearest station matches Berlin; explicit WMO ID and distance guard',()=>{
  assert.equal(station.id,'10384');assert.ok(station.distance>5 && station.distance<7);
  assert.equal(select({latitude:52.52,longitude:13.41,dwdStation:'10488',dwdMaxDistance:500}).id,'10488');
  assert.throws(()=>select({latitude:35,longitude:139}));
  assert.throws(()=>select({latitude:52.52,longitude:13.41,dwdStation:'99999'}));
  assert.ok(distance({latitude:0,longitude:0},{latitude:0,longitude:180})>20000);
});
test('DWD header parsing, UTC, decimal comma and real zero wind',()=>{
  const result=parseDwd(csv(),station,now);
  assert.equal(result.time,Date.UTC(2026,10,2,5));
  assert.equal(result.values.temperature,-2.4);assert.equal(result.values.windSpeed,0);
  assert.equal(result.values.illuminance,1102.5);assert.match(result.source,/Berlin-Tempelhof/);
});
test('newest incomplete observation never borrows old values',()=>{
  const result=parseDwd(csv().replace('-2,4;87;0;12;10,5','---;;-999;---;---'),station,now);
  assert.deepEqual(result.values,{});assert.equal(result.time,Date.UTC(2026,10,2,5));
  assert.throws(()=>parseDwd(csv().replace(station.id+';Unit','99999;Unit'),station,now));
  assert.throws(()=>parseDwd(csv().replace('km/h','m/s'),station,now));
});
test('CSV ordering independent; invalid/future dates discarded',()=>{
  const text=csv()+'\n02.11.26;06:00;20;20;20;20;20\n31.11.26;01:00;20;20;20;20;20';
  assert.equal(parseDwd(text,station,now).values.temperature,-2.4);
});
test('DWD HTTP errors and cancellation',async()=>{
  await assert.rejects(fetchDwd({latitude:52.52,longitude:13.41},undefined,async()=>({ok:false,status:404})),/404/);
  const signal=AbortSignal.abort();await assert.rejects(fetchDwd({latitude:52.52,longitude:13.41},signal,async(_url,o)=>o.signal.throwIfAborted()));
});
test('light estimate limits, missing radiation, separate opt-in request',()=>{
  assert.equal(estimateLux(0),0.0001);assert.equal(estimateLux(1000),100000);
  const config={latitude:0,longitude:0};assert.ok(!urlFor(config).search.includes('radiation'));
  assert.ok(urlFor({...config,showLightSensor:true}).search.includes('shortwave_radiation_instant'));
  const d={current:{time:now/1000,temperature_2m:10,relative_humidity_2m:70,wind_speed_10m:2,wind_gusts_10m:5,shortwave_radiation_instant:100},current_units:{time:'unixtime',temperature_2m:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h',wind_gusts_10m:'km/h',shortwave_radiation_instant:'W/m²'}};
  assert.equal(parse(d,now).values.illuminance,10500);
  d.current.shortwave_radiation_instant=null;assert.equal(parse(d,now).values.illuminance,undefined);
});
