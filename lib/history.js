'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const DAY=86400000,RAW_RETENTION=7*DAY;
const LIMITS={samples:20000,hourly:50000,events:100000,sessions:10000,forecast_inputs:100000};
const METRICS={temperature:'°C',humidity:'%',windSpeed:'km/h',windGusts:'km/h',illuminance:'lux',cloudCover:'%',precipitation:'mm',raining:''};
function locationKey(c){return crypto.createHash('sha256').update(JSON.stringify([c.provider,c.latitude,c.longitude,c.dwdStation||'',c.dwdMaxDistance,...(c.dwdForecastStation?[c.dwdForecastStation]:[])])).digest('hex').slice(0,24);}
function databasePath(storage){return path.join(storage,'weather-switches','history.sqlite');}
function openDatabase(filename,readOnly=false){
  const {DatabaseSync}=require('node:sqlite');
  if(!readOnly&&filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  const db=new DatabaseSync(filename,{readOnly});
  if(!readOnly&&filename!==':memory:')fs.chmodSync(filename,0o600);
  db.exec('PRAGMA busy_timeout=2000');return db;
}
class HistoryStore{
  constructor(filename,config,now=Date.now()){
    this.db=openDatabase(filename);this.ns=locationKey(config);this.config=config;this.session=crypto.randomUUID();
    this.retention=(config.historyRetentionDays??365)*DAY;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA journal_size_limit=4194304;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS samples(ns TEXT,time INTEGER,received INTEGER,source TEXT,temperature REAL,humidity REAL,windSpeed REAL,windGusts REAL,illuminance REAL,PRIMARY KEY(ns,time));
      CREATE TABLE IF NOT EXISTS hourly(ns TEXT,time INTEGER,metric TEXT,total REAL,count INTEGER,min REAL,max REAL,PRIMARY KEY(ns,time,metric));
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,ns TEXT,time INTEGER,session TEXT,switchId TEXT,name TEXT,state INTEGER,available INTEGER,reason TEXT);
      CREATE INDEX IF NOT EXISTS event_time ON events(ns,time); CREATE INDEX IF NOT EXISTS event_switch ON events(ns,switchId,time);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,ns TEXT,start INTEGER,last INTEGER,end INTEGER);
      CREATE INDEX IF NOT EXISTS session_time ON sessions(ns,start);
      CREATE TABLE IF NOT EXISTS forecast_inputs(ns TEXT,time INTEGER,switchId TEXT,conditionIndex INTEGER,metric TEXT,value REAL,min REAL,max REAL,count INTEGER,details TEXT,ruleKey TEXT,PRIMARY KEY(ns,time,switchId,ruleKey));`);
    if(!this.db.prepare('PRAGMA table_info(samples)').all().some(c=>c.name==='cloudCover'))this.db.exec('ALTER TABLE samples ADD COLUMN cloudCover REAL');
    for(const name of ['precipitation','precipitationTime','raining'])if(!this.db.prepare('PRAGMA table_info(samples)').all().some(c=>c.name===name))this.db.exec(`ALTER TABLE samples ADD COLUMN ${name} REAL`);
    if(!this.db.prepare('PRAGMA table_info(events)').all().some(c=>c.name==='inputs'))this.db.exec('ALTER TABLE events ADD COLUMN inputs TEXT');
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,NULL)').run(this.session,this.ns,now,now);
    this.startedAt=now;
    const start=this.db.prepare('SELECT value FROM meta WHERE key=?').get('start:'+this.ns);
    this.historyStartedAt=start?JSON.parse(start.value):now;
    if(!start)this.db.prepare('INSERT INTO meta VALUES(?,?)').run('start:'+this.ns,JSON.stringify(now));
    this.prune(now);
  }
  sample(sample,received=Date.now(),ns=this.ns){
    const v=sample.values;
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const existing=this.db.prepare('SELECT time FROM samples WHERE ns=? AND time=?').get(ns,sample.time);
      this.db.prepare(`INSERT OR REPLACE INTO samples(ns,time,received,source,precipitationTime,${Object.keys(METRICS).join(',')}) VALUES(${Array(5+Object.keys(METRICS).length).fill('?').join(',')})`).run(ns,sample.time,received,sample.source||'Open-Meteo',sample.precipitationTime??null,...Object.keys(METRICS).map(k=>Number.isFinite(v[k])?v[k]:null));
      const hour=Math.floor(sample.time/3600000)*3600000;
      if(existing){
        for(const key of Object.keys(METRICS)){
          const stats=this.db.prepare(`SELECT SUM(${key}) AS total,COUNT(${key}) AS count,MIN(${key}) AS min,MAX(${key}) AS max FROM samples WHERE ns=? AND time>=? AND time<?`).get(ns,hour,hour+3600000);
          if(stats.count)this.db.prepare('INSERT OR REPLACE INTO hourly VALUES(?,?,?,?,?,?,?)').run(ns,hour,key,stats.total,stats.count,stats.min,stats.max);
          else this.db.prepare('DELETE FROM hourly WHERE ns=? AND time=? AND metric=?').run(ns,hour,key);
        }
      }else{
        const add=this.db.prepare(`INSERT INTO hourly VALUES(?,?,?,?,?,?,?) ON CONFLICT(ns,time,metric) DO UPDATE SET total=total+excluded.total,count=count+1,min=MIN(min,excluded.min),max=MAX(max,excluded.max)`);
        for(const key of Object.keys(METRICS))if(Number.isFinite(v[key]))add.run(ns,hour,key,v[key],1,v[key],v[key]);
      }
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    this.prune(received);
  }
  event(record,now=Date.now()){
    this.db.prepare('INSERT INTO events(ns,time,session,switchId,name,state,available,reason,inputs) VALUES(?,?,?,?,?,?,?,?,?)').run(this.ns,now,this.session,record.config.id,record.config.name,record.rule.state?1:0,record.unavailable?0:1,record.unavailable?'failure':'rule',JSON.stringify(record.inputs||[]));
    this.eventCount=(this.eventCount||0)+1;if(this.eventCount%1000===0)this.prune(now);
  }
  forecastInputs(records,now=Date.now()){
    if(!records.some(r=>(r.inputs||[]).some(i=>i.source==='forecast')))return;
    const time=Math.floor(now/3600000)*3600000;
    const statement=this.db.prepare(`INSERT INTO forecast_inputs VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(ns,time,switchId,ruleKey) DO UPDATE SET value=excluded.value,min=CASE WHEN excluded.min IS NULL THEN min WHEN min IS NULL THEN excluded.min ELSE MIN(min,excluded.min) END,max=CASE WHEN excluded.max IS NULL THEN max WHEN max IS NULL THEN excluded.max ELSE MAX(max,excluded.max) END,count=count+excluded.count,details=excluded.details`);
    this.db.exec('BEGIN IMMEDIATE');
    try{
      for(const r of records)for(const input of r.inputs||[])if(input.source==='forecast'){
        const value=input.available?input.value:null;
        const key=JSON.stringify([input.index,input.metric,input.aggregation,input.startHours,input.endHours,input.sourceName]);
        statement.run(this.ns,time,r.config.id,input.index,input.metric,value,value,value,input.available?1:0,JSON.stringify({...input,evaluatedAt:now,switchName:r.config.name}),key);
      }
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    this.prune(now);
  }
  heartbeat(snapshot,now=Date.now()){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('UPDATE sessions SET last=? WHERE id=?').run(now,this.session);
      this.db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run('current',JSON.stringify({...snapshot,ns:this.ns,session:this.session,startedAt:this.startedAt,updatedAt:now}));
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    if(!this.lastPrune||now-this.lastPrune>=3600000){this.prune(now);this.lastPrune=now;this.db.exec('PRAGMA wal_checkpoint(PASSIVE)');}
  }
  prune(now=Date.now()){
    const cutoff=now-this.retention;
    this.db.prepare('DELETE FROM samples WHERE time<?').run(now-Math.min(RAW_RETENTION,this.retention));
    this.db.prepare('DELETE FROM hourly WHERE time<?').run(cutoff);
    this.db.prepare('DELETE FROM forecast_inputs WHERE time<?').run(cutoff);
    // Preserve known continuity at the retention boundary, without retaining old timestamps.
    const anchors=this.db.prepare(`SELECT e.* FROM events e JOIN sessions s ON s.id=e.session WHERE e.time<? AND s.last>=? AND e.id=(SELECT e2.id FROM events e2 WHERE e2.ns=e.ns AND e2.switchId=e.switchId AND e2.time<? ORDER BY e2.time DESC,e2.id DESC LIMIT 1)`).all(cutoff,cutoff,cutoff);
    for(const e of anchors)this.db.prepare('INSERT INTO events(ns,time,session,switchId,name,state,available,reason,inputs) VALUES(?,?,?,?,?,?,?,?,?)').run(e.ns,cutoff,e.session,e.switchId,e.name,e.state,e.available,'boundary',e.inputs||null);
    this.db.prepare('DELETE FROM events WHERE time<?').run(cutoff);
    this.db.prepare('DELETE FROM sessions WHERE last<?').run(cutoff);
    for(const [table,limit] of Object.entries(LIMITS)){
      const key=table==='sessions'?'start':'time';
      const count=this.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
      if(count>limit){
        this.db.prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} ORDER BY ${key},rowid LIMIT ?)`).run(count-limit);
        this.db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run('limitedAt',JSON.stringify(now));
      }
    }
  }
  close(now=Date.now()){
    if(!this.db)return;
    this.db.prepare('UPDATE sessions SET end=?,last=? WHERE id=?').run(now,now,this.session);
    const row=this.db.prepare("SELECT value FROM meta WHERE key='current'").get();
    if(row){const snapshot=JSON.parse(row.value);if(snapshot.session===this.session){snapshot.running=false;snapshot.updatedAt=now;this.db.prepare("UPDATE meta SET value=? WHERE key='current'").run(JSON.stringify(snapshot));}}
    this.prune(now);this.db.close();this.db=null;
  }
  clear(now=Date.now()){
    clearDatabase(this.db);
    this.startedAt=now;this.session=crypto.randomUUID();
    this.historyStartedAt=now;this.db.prepare('INSERT INTO meta VALUES(?,?)').run('start:'+this.ns,JSON.stringify(now));
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,NULL)').run(this.session,this.ns,now,now);
  }
}
function clearDatabase(db){
  db.exec('BEGIN IMMEDIATE');
  try{for(const table of ['samples','hourly','events','sessions','meta','forecast_inputs'])if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))db.exec(`DELETE FROM ${table}`);db.exec('COMMIT');}
  catch(e){db.exec('ROLLBACK');throw e;}
  db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM;');
}
function clearHistory(filename){if(!fs.existsSync(filename))return;const db=openDatabase(filename);try{clearDatabase(db);}finally{db.close();}}
const PERIODS={day:DAY,week:7*DAY,month:31*DAY,year:366*DAY};
function readHistory(filename,period='day',now=Date.now(),liveCurrent=null){
  if(!Object.hasOwn(PERIODS,period))throw new Error('Invalid period');
  const empty=()=>({connection:liveCurrent?.running?'online':'missing',fresh:liveCurrent?Number.isFinite(liveCurrent.weatherTime)&&now-liveCurrent.weatherTime<=liveCurrent.staleAfter*1000:false,current:liveCurrent,samples:[],hourly:[],localSamples:[],localHourly:[],events:[],sessions:[],forecastInputs:[],from:now-PERIODS[period],to:now,period});
  if(!fs.existsSync(filename))return empty();
  const db=openDatabase(filename,true);
  try{
    db.exec('BEGIN');
    const row=db.prepare("SELECT value FROM meta WHERE key='current'").get();
    if(!row&&!liveCurrent)return empty();
    const current=liveCurrent||JSON.parse(row.value),ns=current.ns,from=now-PERIODS[period];
    const online=Boolean(liveCurrent?.running);
    const fresh=Number.isFinite(current.weatherTime)&&now-current.weatherTime<=current.staleAfter*1000&&now>=current.weatherTime-60000;
    const connection=online?'online':'offline';
    const hourly=['month','year'].includes(period)?db.prepare('SELECT time,metric,total/count AS mean,min,max,count FROM hourly WHERE ns=? AND time>=? AND time<=? ORDER BY time,metric').all(ns,from,now):[];
    const samples=['day','week'].includes(period)?db.prepare('SELECT * FROM samples WHERE ns=? AND time>=? AND time<=? ORDER BY time').all(ns,from,now):[];
    const localNs=current.localStation?.ns;
    const localSamples=localNs&&['day','week'].includes(period)?db.prepare('SELECT * FROM samples WHERE ns=? AND time>=? AND time<=? ORDER BY time').all(localNs,from,now):[];
    const localHourly=localNs&&['month','year'].includes(period)?db.prepare('SELECT time,metric,total/count AS mean,min,max,count FROM hourly WHERE ns=? AND time>=? AND time<=? ORDER BY time,metric').all(localNs,from,now):[];
    const events=db.prepare(`SELECT * FROM events WHERE ns=? AND time>? AND time<=?
      UNION SELECT e.* FROM events e WHERE e.ns=? AND e.time<=? AND e.id=(SELECT e2.id FROM events e2 WHERE e2.ns=e.ns AND e2.switchId=e.switchId AND e2.time<=? ORDER BY e2.time DESC,e2.id DESC LIMIT 1)
      ORDER BY time,id`).all(ns,from,now,ns,from,from);
    const sessions=db.prepare('SELECT * FROM sessions WHERE ns=? AND last>=? AND start<=? ORDER BY start').all(ns,from-90000,now);
    const limited=db.prepare("SELECT value FROM meta WHERE key='limitedAt'").get();
    const forecastInputs=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='forecast_inputs'").get()?db.prepare('SELECT * FROM forecast_inputs WHERE ns=? AND time>=? AND time<=? ORDER BY time,switchId,conditionIndex').all(ns,from,now).map(row=>({...row,details:JSON.parse(row.details)})):[];
    return {connection,fresh,current,from,to:now,period,samples,hourly,localSamples,localHourly,events:events.map(e=>({...e,inputs:e.inputs?JSON.parse(e.inputs):[]})),sessions,forecastInputs,limitedAt:limited?JSON.parse(limited.value):null,retentionDays:current.historyRetentionDays??365};
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
}
module.exports={HistoryStore,readHistory,clearHistory,databasePath,locationKey,METRICS,PERIODS,LIMITS};
