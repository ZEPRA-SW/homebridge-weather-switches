'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {urlFor,parse,fetchWeather} = require('../lib/weather');
const {CONSENT_VERSION}=require('../homebridge-ui/public/config');
const now = 1800000000000;
const response = () => ({current:{time:now/1000,temperature_2m:-12,relative_humidity_2m:80,wind_speed_10m:30,wind_gusts_10m:50},current_units:{time:'unixtime',temperature_2m:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h',wind_gusts_10m:'km/h'}});
test('global coordinates use same endpoint and explicit units and unix time', () => {
  for (const [latitude,longitude] of [[52.52,13.41],[35.68,139.69],[-33.45,-70.66],[40.71,-74]]) {
    const u = urlFor({latitude,longitude}); assert.equal(u.host,'api.open-meteo.com');
    assert.equal(u.searchParams.get('longitude'),String(longitude)); assert.equal(u.searchParams.get('timeformat'),'unixtime');
    assert.ok(u.searchParams.get('current').includes('wind_gusts_10m'));
  }
});
test('parsing preserves subzero values, rejects missing/null/bad units/future timestamps', () => {
  assert.equal(parse(response(),now).values.temperature,-12);
  for (const patch of [d=>d.current.temperature_2m=null,d=>d.current.relative_humidity_2m=101,d=>d.current.wind_speed_10m=-1,d=>d.current.time+=120,d=>d.current_units.wind_speed_10m='m/s',d=>delete d.current.wind_gusts_10m]) {
    const d=response();patch(d);assert.throws(()=>parse(d,now));
  }
});
test('HTTP failures, malformed JSON, oversized response and abort propagate', async () => {
  const cfg={latitude:0,longitude:0,openMeteoPrivateConsent:true,_openMeteoConsentVersion:CONSENT_VERSION};
  await assert.rejects(fetchWeather(cfg,undefined,async()=>({ok:false,status:429})),/429/);
  await assert.rejects(fetchWeather(cfg,undefined,async()=>({ok:true,text:async()=>'{'})));
  await assert.rejects(fetchWeather(cfg,undefined,async()=>({ok:true,text:async()=>'x'.repeat(100001)})),/groß/);
  const signal=AbortSignal.abort();
  await assert.rejects(fetchWeather(cfg,signal,async(_url,opts)=>{opts.signal.throwIfAborted();}));
});

const approved={latitude:0,longitude:0,openMeteoPrivateConsent:true,_openMeteoConsentVersion:CONSENT_VERSION};
function validResponse(){const data=response();data.current.time=Math.floor(Date.now()/1000);return {ok:true,text:async()=>JSON.stringify(data)};}
test('temporary HTTP gateway/service failures retry once and recover with the provider timestamp',async()=>{
  for(const status of [502,503,504]){
    let calls=0,cancelled=0;const waits=[],reply=validResponse(),result=await fetchWeather(approved,undefined,async()=>++calls===1?{ok:false,status,body:{cancel:async()=>{cancelled++;}}}:reply,{wait:async ms=>waits.push(ms)});
    assert.equal(calls,2);assert.equal(cancelled,1);assert.deepEqual(waits,[2000]);assert.equal(result.time,JSON.parse(await reply.text()).current.time*1000);
  }
});
test('repeated 503 stops after two attempts; longer Retry-After avoids an immediate retry',async()=>{
  let calls=0;await assert.rejects(fetchWeather(approved,undefined,async()=>{calls++;return {ok:false,status:503};},{wait:async()=>{}}),/503/);assert.equal(calls,2);
  calls=0;await assert.rejects(fetchWeather(approved,undefined,async()=>{calls++;return {ok:false,status:503,headers:{get:()=> '60'}};},{wait:async()=>{throw Error('must not wait');}}),/503/);assert.equal(calls,1);
  calls=0;const waits=[];await fetchWeather(approved,undefined,async()=>++calls===1?{ok:false,status:503,headers:{get:()=> '3'}}:validResponse(),{wait:async ms=>waits.push(ms)});assert.deepEqual(waits,[3000]);
});
test('client errors and malformed successful responses never retry',async()=>{
  for(const status of [400,401,403,404,429]){let calls=0;await assert.rejects(fetchWeather(approved,undefined,async()=>{calls++;return {ok:false,status};},{wait:async()=>{throw Error('must not wait');}}),new RegExp(String(status)));assert.equal(calls,1);}
  let calls=0;await assert.rejects(fetchWeather(approved,undefined,async()=>{calls++;return {ok:true,text:async()=>'{'};},{wait:async()=>{throw Error('must not wait');}}));assert.equal(calls,1);
});
test('network failure can recover once, with consent rechecked before the next request',async()=>{
  let calls=0,checks=0;await fetchWeather(approved,undefined,async()=>{if(++calls===1)throw Error('network');return validResponse();},{beforeRequest:()=>{checks++;},wait:async()=>{}});assert.equal(calls,2);assert.ok(checks>=2);
  const cfg={...approved};calls=0;await assert.rejects(fetchWeather(cfg,undefined,async()=>{calls++;return {ok:false,status:503};},{wait:async()=>{cfg.openMeteoPrivateConsent=false;}}),/Zustimmung/);assert.equal(calls,1);
});
test('abort during retry delay stops immediately without another request',async()=>{
  const controller=new AbortController();let calls=0;
  const pending=fetchWeather(approved,controller.signal,async()=>{calls++;return {ok:false,status:503};});setImmediate(()=>controller.abort());await assert.rejects(pending);assert.equal(calls,1);
});


test('completed-hour precipitation stays valid through a full hour of fresh 15-minute weather updates',()=>{
  const {weatherValueFresh}=require('../homebridge-ui/public/config'),{currentInput}=require('../lib/inputs'),base=Date.UTC(2026,10,4,0),hour=3600000;
  for(let minute=0;minute<1440;minute++){
    const now=base+minute*60000,time=Math.floor(now/900000)*900000,precipitationTime=Math.floor(time/hour)*hour,sample={time,precipitationTime,values:{precipitation:0}};
    assert.equal(weatherValueFresh(sample,'precipitation',1800,now),true,'minute '+minute);
    assert.equal(currentInput({metric:'precipitation'},sample,null,{provider:'open-meteo',staleAfter:1800},now).available,true,'minute '+minute);
  }
});
test('hourly precipitation still expires on provider outage, missing latest hour or future interval',()=>{
  const {weatherValueFresh}=require('../homebridge-ui/public/config'),now=Date.UTC(2026,10,4,12,45),hour=3600000;
  assert.equal(weatherValueFresh({time:now,precipitationTime:now-45*60000},'precipitation',1800,now),true);
  assert.equal(weatherValueFresh({time:now-1800001,precipitationTime:now-45*60000},'precipitation',1800,now),false);
  assert.equal(weatherValueFresh({time:now,precipitationTime:now-hour},'precipitation',1800,now),false);
  assert.equal(weatherValueFresh({time:now},'precipitation',1800,now),false);
  assert.equal(weatherValueFresh({time:now+30000,precipitationTime:now+30000},'precipitation',1800,now),false);
  assert.equal(weatherValueFresh({time:now-1800001},'temperature',1800,now),false);
});
