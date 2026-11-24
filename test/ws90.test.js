'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {inspectWs90}=require('../lib/ws90');
const now=Date.UTC(2026,10,2,10),addr='aa:bb:cc:dd:ee:01';
const config={shellyDeviceId:'shelly-test-aabbccddeeff',deviceComponent:'bthomedevice:200',staleAfter:120};
const sensor=(id,obj_id,value,idx=0,extra={})=>({key:'bthomesensor:'+id,config:{addr,obj_id,idx},status:{value,last_updated_ts:now/1000-10},...extra});
function snapshot(){return {info:{id:config.shellyDeviceId,mac:'AA:BB:CC:DD:EE:FF'},components:[{key:config.deviceComponent,config:{addr},status:{paired:true}},sensor(207,0x45,12.3),sensor(209,0x2e,70),sensor(213,0x44,4),sensor(218,0x44,8,1),sensor(240,0x05,12345),sensor(250,0x20,1),sensor(260,0x5f,45.6)]};}
test('WS90 maps nonconsecutive component IDs and decoded units via address and object/index',()=>{
  const result=inspectWs90(snapshot(),config,now);
  assert.deepEqual(result.values,{temperature:12.3,humidity:70,windSpeed:14.4,windGusts:28.8,illuminance:12345});
  assert.equal(result.sensors.temperature,'bthomesensor:207');assert.equal(result.sensors.humidity,'bthomesensor:209');assert.equal(result.metricTimes.windGusts,now-10000);
});

test('WS90 accepts fresh unpaired advertisements without changing values or measurement times',()=>{
  const data=snapshot(),expected=inspectWs90(data,config,now);
  data.components[0].status.paired=false;
  assert.deepEqual(inspectWs90(data,config,now),expected);
});

test('WS90 unpaired status does not bypass sensor freshness, sensor faults or device faults',()=>{
  const data=snapshot();data.components[0].status.paired=false;
  data.components.find(c=>c.key==='bthomesensor:207').status.last_updated_ts=(now-121000)/1000;
  data.components.find(c=>c.key==='bthomesensor:209').status.errors=['decrypt_failed'];
  const result=inspectWs90(data,config,now);
  assert.equal(result.unavailable.temperature,'stale');assert.equal(result.unavailable.humidity,'error');
  assert.equal(result.values.windSpeed,14.4);
  data.components[0].status.errors=['decrypt_failed'];assert.throws(()=>inspectWs90(data,config,now));
});
test('WS90 rejects wrong host, missing device and invalid component configuration',()=>{
  const data=snapshot();assert.throws(()=>inspectWs90(data,{...config,shellyDeviceId:'another-device'},now));
  assert.throws(()=>inspectWs90(data,{...config,deviceComponent:'bthomedevice:999'},now));
  assert.throws(()=>inspectWs90(data,{...config,sensorComponents:{temperature:'http://example.invalid'}},now));
  assert.equal(inspectWs90(data,{...config,shellyDeviceId:'aabbccddeeff'},now).values.temperature,12.3);
});
test('WS90 never uses other Bluetooth devices or host-internal temperature',()=>{
  const data=snapshot();data.components.push(sensor(300,0x45,99,0,{config:{addr:'aa:bb:cc:dd:ee:02',obj_id:0x45,idx:0}}),{key:'temperature:0',status:{value:80}});
  assert.equal(inspectWs90(data,config,now).values.temperature,12.3);
  data.components=data.components.filter(c=>c.key!=='bthomesensor:207');assert.equal(inspectWs90(data,config,now).values.temperature,undefined);
});
test('WS90 stale, future and missing timestamps affect only their own weather values',()=>{
  const data=snapshot();data.components.find(c=>c.key==='bthomesensor:207').status.last_updated_ts=(now-121000)/1000;
  data.components.find(c=>c.key==='bthomesensor:209').status={value:70};data.components.find(c=>c.key==='bthomesensor:218').status.last_updated_ts=(now+61000)/1000;
  const result=inspectWs90(data,config,now);assert.equal(result.values.temperature,undefined);assert.equal(result.values.humidity,undefined);assert.equal(result.values.windGusts,undefined);assert.equal(result.values.windSpeed,14.4);assert.equal(result.unavailable.temperature,'stale');
});
test('WS90 duplicate sensors require an explicit sensor ID instead of arbitrary selection',()=>{
  const data=snapshot();data.components.push(sensor(301,0x45,20));assert.equal(inspectWs90(data,config,now).unavailable.temperature,'ambiguous');
  assert.equal(inspectWs90(data,{...config,sensorComponents:{temperature:'bthomesensor:301'}},now).values.temperature,20);
  assert.equal(inspectWs90(data,{...config,sensorComponents:{temperature:'bthomesensor:209'}},now).values.temperature,undefined);
});
test('WS90 raw precipitation and rain status never masquerade as hourly precipitation',()=>{
  const result=inspectWs90(snapshot(),config,now);assert.equal(result.extras.precipitationRaw,45.6);assert.equal(result.extras.raining,true);assert.equal(result.values.precipitation,undefined);
  const data=snapshot();data.components.find(c=>c.key==='bthomesensor:250').status.value='false';assert.equal(inspectWs90(data,config,now).extras.raining,undefined);
});
test('WS90 rejects device faults, invalid numbers and out-of-range values while preserving real zero',()=>{
  const data=snapshot();data.components.find(c=>c.key==='bthomesensor:213').status.value=0;data.components.find(c=>c.key==='bthomesensor:209').status.value=101;
  data.components.find(c=>c.key==='bthomesensor:207').status.value=NaN;const result=inspectWs90(data,config,now);assert.equal(result.values.windSpeed,0);assert.equal(result.values.temperature,undefined);assert.equal(result.values.humidity,undefined);
  data.components[0].status.errors=['timeout'];assert.throws(()=>inspectWs90(data,config,now));
});
