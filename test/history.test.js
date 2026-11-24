'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {HistoryStore,readHistory,clearHistory,databasePath,locationKey}=require('../lib/history');
const H=require('../homebridge-ui/public/history-view');
const {startStatusServer,requestStatus}=require('../lib/status-ipc');
const config={provider:'open-meteo',latitude:52.52,longitude:13.41,dwdMaxDistance:100,enableHistory:true,historyRetentionDays:365};
const DAY=86400000,now=Math.floor(Date.now()/3600000)*3600000;
function tmp(t){
  const root=path.resolve(__dirname,'../.preview');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'history-test-'));
  t.after(()=>{if(!dir.startsWith(root+path.sep))throw Error('Unexpected test path');fs.rmSync(dir,{recursive:true,force:true});});return dir;
}
const sample=(time=now)=>({time,source:'Open-Meteo',values:{temperature:12,humidity:70,windSpeed:30,windGusts:50}});
const snapshot=(time=now)=>({running:true,enableHistory:true,historyRetentionDays:365,locationName:'Test location',provider:'open-meteo',weatherTime:time,staleAfter:1800,switches:[{id:'wind',name:'Wind',state:true,available:true}]});
const record=(state=true,available=true)=>({config:{id:'wind',name:'Wind'},rule:{state},unavailable:!available});
test('persistent raw weather and switch events survive restart; no historical values restored as live',t=>{
  const filename=databasePath(tmp(t));let store=new HistoryStore(filename,config,now-1000);
  store.sample(sample(),now);store.event(record(),now);store.heartbeat(snapshot(),now);store.close(now+1000);
  let data=readHistory(filename,'day',now+2000);assert.equal(data.connection,'offline');assert.equal(data.samples.length,1);assert.equal(data.events.length,1);
  store=new HistoryStore(filename,config,now+3000);store.heartbeat({...snapshot(),weatherTime:null,values:{},switches:[]},now+3000);
  assert.equal(store.historyStartedAt,now-1000);
  data=readHistory(filename,'day',now+4000);assert.equal(data.fresh,false);assert.equal(data.samples.length,1);assert.equal(data.current.weatherTime,null);store.close(now+5000);
});
test('weekly raw history and older hourly means, min/max/count, selected periods and location isolation',t=>{
  const filename=databasePath(tmp(t)),store=new HistoryStore(filename,config,now-40*DAY);
  store.sample(sample(now-8*DAY),now-8*DAY);store.sample({...sample(now-8*DAY+600000),values:{temperature:20}},now-8*DAY+600000);
  store.sample(sample(now),now);store.heartbeat(snapshot(),now);
  const month=readHistory(filename,'month',now);assert.equal(month.samples.length,0);
  const row=month.hourly.find(r=>r.metric==='temperature'&&r.time===now-8*DAY);assert.equal(row.mean,16);assert.equal(row.min,12);assert.equal(row.max,20);assert.equal(row.count,2);
  assert.equal(readHistory(filename,'week',now).samples.length,1);
  const other={...snapshot(),ns:locationKey({...config,longitude:1})};assert.equal(readHistory(filename,'year',now,other).hourly.length,0);store.close(now);
});
test('repeated weather timestamps replace revised values without duplicating hourly counts',t=>{
  const filename=databasePath(tmp(t)),store=new HistoryStore(filename,config,now);
  store.sample(sample(),now);store.sample({...sample(),values:{temperature:20,windSpeed:40}},now+1);store.heartbeat(snapshot(),now+1);
  const data=readHistory(filename,'month',now+2);assert.equal(data.hourly.find(r=>r.metric==='temperature').mean,20);assert.equal(data.hourly.find(r=>r.metric==='temperature').count,1);assert.equal(data.hourly.some(r=>r.metric==='humidity'),false);store.close(now+3);
});
test('retention boundaries and shorter retention after restart remove old raw/hourly/events automatically',t=>{
  const filename=databasePath(tmp(t));let store=new HistoryStore(filename,config,now-10*DAY);
  store.sample(sample(now-2*DAY),now-2*DAY);store.event(record(),now-2*DAY);store.heartbeat(snapshot(),now);store.close(now);
  store=new HistoryStore(filename,{...config,historyRetentionDays:1},now+1);
  store.sample(sample(now-DAY+1),now+1);store.heartbeat({...snapshot(),historyRetentionDays:1},now+1);
  const data=readHistory(filename,'year',now+1);assert.ok(data.samples.every(r=>r.time>=now-DAY+1));assert.ok(data.hourly.every(r=>r.time>=now-DAY+1));assert.ok(data.events.every(r=>r.time>=now-DAY+1));
  assert.equal(readHistory(filename,'week',now+1).samples.length,1);assert.equal(data.events[0].reason,'boundary');store.close(now+2);
});
test('clear removes all raw, aggregate and transition history; CSV becomes header only and recording can continue',t=>{
  const dir=tmp(t),filename=databasePath(dir),settings=path.join(dir,'config.json');fs.writeFileSync(settings,'unchanged');
  const store=new HistoryStore(filename,config,now-1000);store.sample(sample(),now);store.event(record(),now);store.heartbeat(snapshot(),now);
  store.clear(now+10);store.heartbeat(snapshot(),now+10);
  assert.equal(store.historyStartedAt,now+10);
  const data=readHistory(filename,'year',now+20);assert.equal(data.samples.length+data.hourly.length+data.events.length,0);assert.equal(H.csv(data).trim().split('\r\n').length,1);assert.equal(fs.readFileSync(settings,'utf8'),'unchanged');
  store.sample(sample(now+60000),now+60000);store.event(record(false),now+60000);store.close(now+60001);
  assert.equal(readHistory(filename,'day',now+60002).samples.length,1);
  clearHistory(filename);assert.equal(readHistory(filename,'year',now+60003).events.length,0);
});
test('missing database with live status performs no persistent history writes, read-only history stays unchanged when disabled',t=>{
  const dir=tmp(t),filename=databasePath(dir),live={...snapshot(),enableHistory:false,ns:locationKey(config)};
  const empty=readHistory(filename,'day',now,live);assert.equal(empty.connection,'online');assert.equal(empty.current.enableHistory,false);assert.equal(fs.existsSync(filename),false);
  const store=new HistoryStore(filename,config,now);store.sample(sample(),now);store.heartbeat(snapshot(),now);store.close(now+1);
  const before=fs.statSync(filename).mtimeMs;const data=readHistory(filename,'day',now+2,live);assert.equal(data.samples.length,1);assert.equal(fs.statSync(filename).mtimeMs,before);
});
test('session gaps, offline/stale current data and timeline carry-in remain honest',t=>{
  const filename=databasePath(tmp(t)),store=new HistoryStore(filename,config,now-100000);
  store.event(record(),now-100000);store.heartbeat(snapshot(now-4000000),now-100000);
  const data=readHistory(filename,'day',now);assert.equal(data.connection,'offline');assert.equal(data.fresh,false);
  const segments=H.intervals(data,'wind');assert.equal(segments.length,0); // no interval may extend beyond the last confirmed heartbeat
  store.close(now);
});
test('CSV preserves times, units, quotes and line breaks while blocking formula injection',()=>{
  const data={samples:[{...sample(),received:now,temperature:-2,humidity:70,windSpeed:30,source:'DWD'}],hourly:[],events:[{time:now,switchId:'wind',name:'=SUM(A1)\n"quoted"',state:1,available:1}],current:{locationName:'@location'},from:now-DAY};
  const text=H.csv(data);assert.match(text,/UTC/);assert.match(text,/km\/h/);assert.match(text,/"-2"/);assert.match(text,/"'=SUM\(A1\)\n""quoted"""/);assert.match(text,/'@location/);
});
test('local IPC returns actual runtime snapshot without a database and supports explicit clear requests',async t=>{
  const dir=tmp(t);let clears=0;const server=await startStatusServer(dir,action=>action==='clear'?{cleared:++clears>0}:{...snapshot(),enableHistory:false});
  try{const live=await requestStatus(dir);assert.equal(live.switches[0].state,true);assert.equal(live.enableHistory,false);assert.equal(fs.existsSync(databasePath(dir)),false);assert.equal((await requestStatus(dir,'clear')).cleared,true);assert.equal(clears,1);}
  finally{await new Promise(resolve=>server.close(resolve));}
});
test('storage row caps remove oldest entries and report truncation',()=>{
  const {LIMITS}=require('../lib/history'),store=new HistoryStore(':memory:',config,now);
  store.db.exec('BEGIN');const insert=store.db.prepare('INSERT INTO events(ns,time,session,switchId,name,state,available,reason) VALUES(?,?,?,?,?,?,?,?)');
  for(let i=0;i<LIMITS.events+2;i++)insert.run(store.ns,now-i,store.session,'wind','Wind',i%2,1,'rule');
  store.db.exec('COMMIT');store.prune(now);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM events').get().n,LIMITS.events);assert.ok(store.db.prepare("SELECT value FROM meta WHERE key='limitedAt'").get());
  const pages=store.db.prepare('PRAGMA page_count').get().page_count;store.clear(now);assert.ok(store.db.prepare('PRAGMA page_count').get().page_count<pages);store.close(now);
});
test('real Homebridge custom-UI server bridges local status, persisted history and confirmed deletion',async t=>{
  const {fork}=require('node:child_process');const dir=tmp(t),filename=databasePath(dir),store=new HistoryStore(filename,config,now-1000);
  store.sample(sample(),now);store.event(record(),now);store.heartbeat(snapshot(),now);
  const server=await startStatusServer(dir,action=>{
    if(action==='clear'){store.clear(Date.now());store.heartbeat(snapshot(),Date.now());return {cleared:true};}
    return {...snapshot(),weatherTime:Date.now(),ns:store.ns,session:store.session,updatedAt:Date.now()};
  });
  const child=fork(path.resolve(__dirname,'../homebridge-ui/server.js'),[],{env:{...process.env,HOMEBRIDGE_STORAGE_PATH:dir},stdio:['ignore','pipe','pipe','ipc']});
  const waitFor=predicate=>new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{child.off('message',handler);reject(Error('UI server timeout'));},8000);
    const handler=message=>{if(predicate(message)){clearTimeout(timeout);child.off('message',handler);resolve(message);}};child.on('message',handler);
  });
  let sequence=0;const call=async(path,body)=>{const requestId=String(++sequence),promise=waitFor(m=>m.action==='response'&&m.payload.requestId===requestId);child.send({action:'request',requestId,path,body});return (await promise).payload;};
  try{
    await waitFor(m=>m.action==='ready');
    const response=await call('/history',{period:'day'});assert.equal(response.success,true);assert.equal(response.data.connection,'online');assert.equal(response.data.samples.length,1);
    assert.equal((await call('/clear-history',{})).success,false);assert.equal((await call('/history',{period:'day'})).data.events.length,1);
    assert.equal((await call('/clear-history',{confirmed:true})).success,true);
    const empty=(await call('/history',{period:'year'})).data;assert.equal(empty.hourly.length+empty.samples.length+empty.events.length,0);
    assert.equal((await call('/history',{period:'invalid'})).success,false);
  }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));await new Promise(resolve=>server.close(resolve));store.close();}
});
test('forecast rule traces persist separately, aggregate latest values by rule and clear with observations',t=>{
  const filename=databasePath(tmp(t)),store=new HistoryStore(filename,config,now);
  const input={index:0,source:'forecast',metric:'windSpeed',aggregation:'max',startHours:0,endHours:6,value:50,available:true,sourceName:'DWD MOSMIX Test',issuedAt:now-3600000,fetchedAt:now,validFrom:now+3600000,validTo:now+6*3600000};
  const rec={...record(),inputs:[input]};store.sample(sample(),now);store.forecastInputs([rec],now);input.value=60;store.forecastInputs([rec],now+1000);store.event(rec,now+1000);store.heartbeat(snapshot(),now+1000);
  let data=readHistory(filename,'day',now+2000);assert.equal(data.forecastInputs.length,1);assert.equal(data.forecastInputs[0].value,60);assert.equal(data.forecastInputs[0].min,50);assert.equal(data.forecastInputs[0].max,60);assert.equal(data.forecastInputs[0].count,2);assert.equal(data.samples[0].windSpeed,30);
  const text=H.csv(data);assert.match(text,/Prognose-Regelwert/);assert.match(text,/Vorhersage/);assert.match(text,/Aktuell/);assert.equal(data.events[0].inputs[0].value,60);
  input.metric='cloudCover';input.value=80;store.forecastInputs([rec],now+2000);data=readHistory(filename,'day',now+3000);assert.equal(data.forecastInputs.length,2);
  store.clear(now+4000);store.heartbeat(snapshot(),now+4000);data=readHistory(filename,'year',now+5000);assert.equal(data.forecastInputs.length,0);assert.equal(H.csv(data).trim().split('\r\n').length,1);store.close(now+5000);
});
test('0.2 history schema migrates additively without changing old values; disabled reads require no migration',t=>{
  const {DatabaseSync}=require('node:sqlite'),filename=databasePath(tmp(t));fs.mkdirSync(path.dirname(filename),{recursive:true});const db=new DatabaseSync(filename),ns=locationKey(config);
  db.exec(`CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE samples(ns TEXT,time INTEGER,received INTEGER,source TEXT,temperature REAL,humidity REAL,windSpeed REAL,windGusts REAL,illuminance REAL,PRIMARY KEY(ns,time));CREATE TABLE hourly(ns TEXT,time INTEGER,metric TEXT,total REAL,count INTEGER,min REAL,max REAL,PRIMARY KEY(ns,time,metric));CREATE TABLE events(id INTEGER PRIMARY KEY,ns TEXT,time INTEGER,session TEXT,switchId TEXT,name TEXT,state INTEGER,available INTEGER,reason TEXT);CREATE TABLE sessions(id TEXT PRIMARY KEY,ns TEXT,start INTEGER,last INTEGER,end INTEGER);`);
  db.prepare('INSERT INTO samples VALUES(?,?,?,?,?,?,?,?,?)').run(ns,now,now,'DWD',12,70,30,50,null);db.prepare('INSERT INTO meta VALUES(?,?)').run('current',JSON.stringify({...snapshot(),ns}));db.close();
  assert.equal(readHistory(filename,'day',now).samples[0].windSpeed,30);const before=fs.statSync(filename).mtimeMs;assert.equal(readHistory(filename,'day',now).forecastInputs.length,0);assert.equal(fs.statSync(filename).mtimeMs,before);
  const store=new HistoryStore(filename,config,now+1);store.sample({...sample(now+60000),precipitationTime:now,values:{cloudCover:80,precipitation:2.5}},now+60000);store.heartbeat(snapshot(now+60000),now+60000);
  const data=readHistory(filename,'day',now+60001);assert.equal(data.samples[0].windSpeed,30);assert.equal(data.samples[0].cloudCover,null);assert.equal(data.samples[0].precipitation,null);assert.equal(data.samples[1].cloudCover,80);assert.equal(data.samples[1].precipitation,2.5);assert.equal(data.samples[1].precipitationTime,now);assert.ok(H.csv(data).includes('Niederschlag'));store.close(now+60002);
});


test('local and provider measurements at the same time are archived separately and exported with actual origin',t=>{
  const filename=databasePath(tmp(t)),store=new HistoryStore(filename,config,now),localNs='local:test-device';
  store.sample(sample(),now);store.sample({time:now,source:'Shelly WS90',values:{temperature:4,windSpeed:10,illuminance:15000,raining:1}},now,localNs);
  const status={...snapshot(),localStation:{enabled:true,ns:localNs,sample:{source:'Shelly WS90'}}};store.heartbeat(status,now);
  let data=readHistory(filename,'day',now+1000);assert.equal(data.samples.length,1);assert.equal(data.localSamples.length,1);assert.equal(data.samples[0].temperature,12);assert.equal(data.localSamples[0].temperature,4);assert.equal(data.localSamples[0].illuminance,15000);
  const rows=H.csv(data).split('\r\n').filter(row=>row.includes('Lokale Stationsmessung'));assert.ok(rows.length>=4);assert.ok(rows.every(row=>!row.includes('opendata.dwd.de')&&!row.includes('open-meteo.com')));
  data=readHistory(filename,'month',now+1000);assert.equal(data.hourly.find(row=>row.metric==='temperature').mean,12);assert.equal(data.localHourly.find(row=>row.metric==='temperature').mean,4);
  store.clear(now+2000);store.heartbeat(status,now+2000);data=readHistory(filename,'day',now+3000);assert.equal(data.samples.length+data.localSamples.length,0);store.close(now+4000);
});
