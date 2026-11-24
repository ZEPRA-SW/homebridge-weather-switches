'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {ShellyWeatherClient,localNamespace,hostUrl}=require('../lib/shelly-weather');
const {currentInput}=require('../lib/inputs');
const {validate}=require('../homebridge-ui/public/config');
const local={enabled:true,host:'192.0.2.1',shellyDeviceId:'shelly-test-aabbccddeeff',deviceComponent:'bthomedevice:200',staleAfter:120,pollInterval:15,password:'test-password'};
const config=()=>validate({...require('../example.config.json'),localStation:local});
const reply=data=>({ok:true,status:200,text:async()=>JSON.stringify(data)});
function components(){const time=Date.now()/1000-5,addr='aa:bb:cc:dd:ee:01';return [{key:'bthomedevice:200',config:{addr},status:{paired:true}},...[['207',69,0,12],['213',68,0,4],['218',68,1,8],['240',5,0,12000],['250',32,0,1]].map(([id,obj_id,idx,value])=>({key:'bthomesensor:'+id,config:{addr,obj_id,idx},status:{value,last_updated_ts:time}}))];}
test('Shelly reader verifies host before RPC, follows pagination and reads only selected BTHome device',async()=>{
  const requests=[],all=components(),client=new ShellyWeatherClient(local,async(url,options)=>{
    requests.push({url,options});if(url.pathname==='/shelly')return reply({id:local.shellyDeviceId,gen:3});
    const body=JSON.parse(options.body);assert.equal(body.method,'Shelly.GetComponents');assert.deepEqual(body.params.include,['config','status']);assert.equal(body.params.dynamic_only,true);
    return reply({id:body.id,result:{total:all.length,components:all.slice(body.params.offset,body.params.offset+2)}});
  });
  const result=await client.read();assert.equal(requests.length,4);assert.equal(requests[0].url.pathname,'/shelly');assert.equal(result.values.temperature,12);assert.equal(result.values.windSpeed,14.4);assert.equal(result.values.windGusts,28.8);assert.equal(result.values.illuminance,12000);assert.equal(result.values.raining,1);assert.equal(result.values.precipitation,undefined);
  assert.ok(requests.every(r=>r.options.redirect==='error'));assert.ok(requests.every(r=>!String(r.options.body||'').includes(local.password)));
});
test('wrong hardware identity blocks all component requests; RPC writes are refused',async()=>{
  let calls=0;const client=new ShellyWeatherClient(local,async()=>{calls++;return reply({id:'other-device',gen:3});});await assert.rejects(client.read(),/Host-ID/);assert.equal(calls,1);await assert.rejects(client.rpc('Switch.Set',{}),/nicht zum Lesen/);assert.equal(calls,1);
});

test('unpaired WS90 RPC values reach local rules; stale values still activate weather backup',async()=>{
  const all=components();all[0].status.paired=false;
  const client=new ShellyWeatherClient(local,async(url,options)=>url.pathname==='/shelly'
    ?reply({id:local.shellyDeviceId,gen:3})
    :reply({id:JSON.parse(options.body).id,result:{total:all.length,components:all}}));
  const station=await client.read(),cfg=config(),now=Date.now();
  const condition={metric:'windSpeed',dataSource:'prefer-local'};
  const weather={time:now,values:{windSpeed:50}};
  const live=currentInput(condition,weather,station,cfg,now);
  assert.equal(live.origin,'local');assert.equal(live.value,14.4);assert.ok(!live.fallback);
  const later=now+121000;weather.time=later;
  const backup=currentInput(condition,weather,station,cfg,later);
  assert.equal(backup.origin,'weather');assert.equal(backup.value,50);assert.equal(backup.fallback,true);
  assert.equal(currentInput({...condition,dataSource:'local'},weather,station,cfg,later).available,false);
});
test('Shelly Digest SHA-256 authenticates without putting the password in requests',async()=>{
  let challenged=false,authenticated=0;const all=components(),sha=value=>createHash('sha256').update(value).digest('hex');
  const client=new ShellyWeatherClient(local,async(url,options)=>{
    if(!challenged){challenged=true;return {ok:false,status:401,headers:{get:()=> 'Digest realm="test",nonce="abc",algorithm=SHA-256,qop="auth"'}};}
    const fields={};for(const m of options.headers.Authorization.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g))fields[m[1]]=m[2]??m[3];
    assert.equal(fields.response,sha(`${sha('admin:test:'+local.password)}:abc:${fields.nc}:${fields.cnonce}:auth:${sha(options.method+':'+url.pathname)}`));assert.ok(!options.headers.Authorization.includes(local.password));authenticated++;
    if(url.pathname==='/shelly')return reply({id:local.shellyDeviceId,gen:3});const body=JSON.parse(options.body);return reply({id:body.id,result:{total:all.length,components:all}});
  });await client.read();assert.equal(authenticated,2);
});
test('Shelly malformed, oversized and incomplete component responses stop with bounded errors',async()=>{
  for(const page of [{total:1001,components:[]},{total:2,components:[]},{total:2,components:[{key:'same'},{key:'same'}]}]){
    const client=new ShellyWeatherClient(local,async(url,options)=>url.pathname==='/shelly'?reply({id:local.shellyDeviceId,gen:3}):reply({id:JSON.parse(options.body).id,result:page}));await assert.rejects(client.read(),/Komponentenliste/);
  }
  const tooLarge=new ShellyWeatherClient(local,async()=>({ok:true,text:async()=> 'x'.repeat(500001)}));await assert.rejects(tooLarge.read(),/zu große/);
});
test('local request aborts promptly and addresses cannot contain credentials or paths',async()=>{
  for(const host of ['http://user:pass@example.test','http://example.test/path','http://example.test/?password=x','ftp://example.test',''])assert.throws(()=>hostUrl(host));
  assert.equal(hostUrl('192.0.2.1:8080').port,'8080');const controller=new AbortController();controller.abort();let calls=0;await assert.rejects(new ShellyWeatherClient(local,async()=>{calls++;}).read(controller.signal));assert.equal(calls,0);
});
test('local configuration defaults off, validates identity and maps optional nonconsecutive sensor IDs',()=>{
  assert.equal(validate(require('../example.config.json')).localStation.enabled,false);
  const cfg=config();assert.equal(cfg.localStation.enabled,true);
  const c=validate({...require('../example.config.json'),localStation:{...local,deviceComponent:'200',windSpeedComponent:'213',windGustsComponent:'bthomesensor:218'}});assert.equal(c.localStation.deviceComponent,'bthomedevice:200');assert.equal(c.localStation.sensorComponents.windSpeed,'bthomesensor:213');assert.equal(c.localStation.sensorComponents.windGusts,'bthomesensor:218');
  for(const patch of [{host:''},{shellyDeviceId:''},{deviceComponent:'invalid'},{pollInterval:1},{staleAfter:1},{windSpeedComponent:'invalid'}])assert.throws(()=>validate({...require('../example.config.json'),localStation:{...local,...patch}}));
});
test('source choice selects local or provider explicitly and fallback applies only to missing/stale local metrics',()=>{
  const now=Date.now(),cfg=config(),weather={time:now,source:'Open-Meteo',values:{windSpeed:50,temperature:20}},station={source:'Shelly WS90',values:{windSpeed:10,temperature:12},metricTimes:{windSpeed:now,temperature:now-121000}};
  assert.equal(currentInput({metric:'windSpeed'},weather,station,cfg,now).value,50);
  assert.equal(currentInput({metric:'windSpeed',dataSource:'local'},weather,station,cfg,now).value,10);
  assert.equal(currentInput({metric:'windSpeed',dataSource:'prefer-local'},weather,station,cfg,now).origin,'local');
  const fallback=currentInput({metric:'temperature',dataSource:'prefer-local'},weather,station,cfg,now);assert.equal(fallback.value,20);assert.equal(fallback.origin,'weather');assert.equal(fallback.fallback,true);assert.equal(fallback.fallbackReason,'stale');
  const missing=currentInput({metric:'cloudCover',dataSource:'prefer-local'},weather,station,cfg,now);assert.equal(missing.available,false);assert.equal(missing.value,null);
  assert.equal(currentInput({metric:'windSpeed',dataSource:'local'},null,station,cfg,now).available,true);
});
test('backup cannot rejuvenate old provider data or use disabled, future or absent local data',()=>{
  const now=Date.now(),cfg=config(),weather={time:now-cfg.staleAfter*1000-1,values:{windSpeed:30}},station={values:{windSpeed:0},metricTimes:{windSpeed:now+61000}};
  const c={metric:'windSpeed',dataSource:'prefer-local'};assert.equal(currentInput(c,weather,station,cfg,now).available,false);
  station.metricTimes.windSpeed=now;assert.equal(currentInput(c,weather,station,cfg,now).value,0);assert.equal(currentInput(c,weather,station,cfg,now).origin,'local');
  cfg.localStation.enabled=false;assert.equal(currentInput(c,weather,station,cfg,now).available,false);assert.equal(currentInput({...c,dataSource:'local'},weather,station,cfg,now).reason,'disabled');
});
test('local archive namespace is separate and stable across weather provider changes',()=>{
  const cfg=config(),key=localNamespace(cfg);assert.equal(localNamespace({...cfg,provider:'dwd'}),key);assert.notEqual(localNamespace({...cfg,localStation:{...local,deviceComponent:'bthomedevice:201'}}),key);assert.ok(key.startsWith('local:'));
});


test('forecast sources remain provider-only; local light and rain state use suitable threshold limits',()=>{
  const base=condition=>({...require('../example.config.json'),localStation:local,switches:[{id:'local',name:'Local',conditions:[{operator:'above',threshold:1,releaseThreshold:0,...condition}]}]});
  assert.throws(()=>validate(base({source:'forecast',dataSource:'local',metric:'windSpeed'})));
  assert.throws(()=>validate(base({source:'forecast',metric:'illuminance'})));
  assert.throws(()=>validate(base({metric:'raining',threshold:2})));
  assert.equal(validate(base({metric:'illuminance',dataSource:'local',threshold:500000})).switches[0].conditions[0].threshold,500000);
  const disabled=base({metric:'windSpeed',dataSource:'prefer-local'});disabled.localStation={enabled:false};assert.equal(validate(disabled).localStation.enabled,false);
});
