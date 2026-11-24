'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
const {validate}=require('../homebridge-ui/public/config');
const {WeatherPlatform}=require('..');
const source=path.resolve(__dirname,'../homebridge-ui/public');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const example=()=>structuredClone(require('../example.config.json'));

test('time zone defaults to Berlin, accepts worldwide IANA zones and rejects invalid or offset values',()=>{
  const unset=example();delete unset.timeZone;
  assert.equal(validate(unset).timeZone,'Europe/Berlin');assert.equal(unset.timeZone,undefined);
  for(const timeZone of ['Europe/Berlin','America/New_York','Asia/Tokyo','Pacific/Auckland','UTC','Etc/GMT+5'])assert.equal(validate({...unset,timeZone}).timeZone,timeZone);
  for(const timeZone of ['',42,{},[],true,'Europe/Not_A_Zone',' Europe/Berlin','Europe/Berlin ','+01:00','GMT+0200'])assert.throws(()=>validate({...unset,timeZone}),/IANA/);
});

function fixture(timeZone){
  // The two endpoints straddle Berlin's spring DST transition.
  const from=Date.UTC(2026,2,29,0,30),to=Date.UTC(2026,2,29,1,30),weatherTime=to-1000;
  const currentInput={index:0,source:'current',origin:'local',metric:'temperature',available:true,value:12,sourceName:'Shelly WS90',validTo:to-2000};
  const forecastInput={index:1,source:'forecast',metric:'windGusts',aggregation:'max',available:true,value:30,sourceName:'DWD MOSMIX',issuedAt:from+1000,fetchedAt:from+2000,validFrom:to+3600000,validTo:to+7200000};
  return {connection:'online',fresh:true,from,to,period:'day',current:{running:true,session:'s',timeZone,provider:'dwd',source:'DWD',locationName:'Example',weatherTime,precipitationTime:to-1800000,staleAfter:7200,enableHistory:true,historyRetentionDays:365,historyStartedAt:from+3000,values:{temperature:12,precipitation:0},localStation:{enabled:true,staleAfter:120,sample:{values:{temperature:12},metricTimes:{temperature:to-3000},sensors:{}}},switches:[{id:'wind',name:'Wind',state:true,available:true,inputs:[currentInput,forecastInput]}]},samples:[{time:from,received:from+1000,temperature:8,source:'DWD'},{time:to,received:to,temperature:12,source:'DWD'}],hourly:[],localSamples:[],localHourly:[],forecastInputs:[],events:[{id:1,time:from,session:'s',switchId:'wind',name:'Wind',state:1,available:1}],sessions:[{id:'s',start:from,last:to,end:null}]};
}
async function status(t,data){
  const dom=new JSDOM('<html lang="en-GB"><body><button id="view-settings"></button><button id="view-status"></button><section id="settings-view"></section><section id="status-view"></section></body></html>',{runScripts:'outside-only',url:'http://localhost/'});
  const w=dom.window;t.after(()=>w.close());w.homebridge={request:async()=>structuredClone(data)};
  for(const file of ['i18n.js','config.js','history-view.js','status.js'])w.eval(fs.readFileSync(path.join(source,file),'utf8'));
  const translate=(key,values)=>w.WeatherI18n.translate('en',key,values);
  w.WeatherStatus.mount({t:translate});w.document.getElementById('view-status').click();await tick();
  return {w,translate,view:w.document.getElementById('status-view')};
}
for(const timeZone of ['Europe/Berlin','America/New_York'])test(`status, forecast context and chart labels use runtime zone ${timeZone}; CSV remains UTC`,async t=>{
  const data=fixture(timeZone),{w,view,translate}=await status(t,data);
  const formatted=time=>new Date(time).toLocaleString('en-GB',{timeZone,timeZoneName:'short'});
  const chartText=[...view.querySelectorAll('svg text')].map(n=>n.textContent);
  assert.ok(chartText.includes(formatted(data.from)));assert.ok(chartText.includes(formatted(data.to)));
  const times=[data.current.weatherTime,data.current.precipitationTime-3600000,data.current.precipitationTime,data.current.historyStartedAt,data.current.localStation.sample.metricTimes.temperature,...data.current.switches[0].inputs.flatMap(input=>[input.issuedAt,input.fetchedAt,input.validFrom,input.validTo].filter(Number.isFinite))];
  for(const time of times)assert.ok(view.textContent.includes(formatted(time)),formatted(time));
  if(timeZone==='Europe/Berlin'){
    assert.match(formatted(data.from),/\b0?1:30:00/);assert.match(formatted(data.to),/\b0?3:30:00/);
    const offset=new Intl.DateTimeFormat('en',{timeZone,timeZoneName:'shortOffset'});
    assert.match(offset.format(data.from),/GMT\+1/);assert.match(offset.format(data.to),/GMT\+2/);
  }
  const csv=w.WeatherHistory.csv(data,translate);assert.ok(csv.includes(new Date(data.from).toISOString()));assert.ok(csv.includes('UTC'));
});

test('status from older runtimes without a time zone retains the Berlin default',async t=>{
  const data=fixture();delete data.current.timeZone;const {view}=await status(t,data);
  const expected=new Date(data.to).toLocaleString('en-GB',{timeZone:'Europe/Berlin',timeZoneName:'short'});
  assert.ok([...view.querySelectorAll('svg text')].some(n=>n.textContent===expected));
});

test('runtime status publishes configured time zone without changing UTC sample timestamps',()=>{
  const config={...example(),timeZone:'Asia/Tokyo'},platform=new WeatherPlatform({error:assert.fail,warn(){},info(){}},config,{on(){}});
  const time=Date.UTC(2026,2,29,1,30);platform.sample={time,values:{temperature:12}};platform.publishStatus(time);
  assert.equal(platform.currentStatus.timeZone,'Asia/Tokyo');assert.equal(platform.currentStatus.weatherTime,time);
  assert.equal(platform.currentStatus.latitude,config.latitude);assert.equal(platform.currentStatus.longitude,config.longitude);
});
