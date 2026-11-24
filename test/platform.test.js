'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const apiModule = process.env.WEATHER_HOMEBRIDGE_VERSION === '2' ? path.join(path.dirname(require.resolve('homebridge-v2')), 'api.js') : 'homebridge/lib/api';
const {HomebridgeAPI} = require(apiModule);
const {WeatherPlatform} = require('..');
const example = require('../example.config.json');
function setup(t, changes={}) {
  const api=new HomebridgeAPI(),registered=[],removed=[],updated=[],logs=[];
  api.registerPlatformAccessories=(_p,_a,list)=>registered.push(...list);
  api.unregisterPlatformAccessories=(_p,_a,list)=>removed.push(...list);
  api.updatePlatformAccessories=list=>updated.push(...list);
  const p=new WeatherPlatform(Object.fromEntries(['info','warn','error'].map(k=>[k,m=>logs.push(m)])),{...example,...changes},api);
  p.createHistoryStore=()=>new (require('../lib/history').HistoryStore)(':memory:',p.config);
  p.startStatusServer=()=>{};
  p.getWeather=async()=>{throw Error('offline');}; t.after(()=>p.stop());
  p.getLocalWeather=async()=>{throw Error('offline');};
  return {p,api,registered,removed,updated,logs};
}
const sample=()=>({time:Date.now(),values:{temperature:-7,humidity:80,windSpeed:35,windGusts:55}});
test('precipitation rules use their own completed-hour timestamp and fail on stale amounts',t=>{
  const {p}=setup(t,{provider:'dwd',switches:[{id:'rain',name:'Rain',failureState:'off',conditions:[{metric:'precipitation',operator:'above',threshold:1,releaseThreshold:0.5}]}]});p.launch();
  const now=Date.now();p.sample={time:now,precipitationTime:now-60000,values:{precipitation:2}};p.evaluate(now);
  assert.equal(p.records[0].rule.state,true);assert.equal(p.records[0].inputs[0].validFrom,now-3660000);
  p.sample.precipitationTime=now-3600001;p.evaluate(now);assert.equal(p.records[0].unavailable,true);assert.equal(p.records[0].rule.state,false);
});
test('exports correct dynamic platform registration',()=>{
  let args;require('..')({registerPlatform:(...v)=>args=v});assert.deepEqual(args,['homebridge-weather-switches','WeatherSwitches',WeatherPlatform]);
});

test('symbolic user names become valid HomeKit names before accessories and services are created',t=>{
  const warnings=[];t.mock.method(console,'warn',(...args)=>warnings.push(args.join(' ')));
  const name='Temp. >8°C',location='☀ Terrasse %';const {p,api,registered}=setup(t,{name:location,switches:[{...example.switches[0],name}]});p.launch();
  assert.equal(p.config.switches[0].name,name);assert.equal(p.config.name,location);
  const accessory=registered.find(a=>a.context.switchId===example.switches[0].id),expected=require('../homebridge-ui/public/config').homeKitName(name);
  assert.equal(accessory.displayName,expected);assert.equal(accessory.getService(api.hap.Service.AccessoryInformation).getCharacteristic(api.hap.Characteristic.Name).value,expected);
  assert.equal(accessory.getService(api.hap.Service.Switch).getCharacteristic(api.hap.Characteristic.Name).value,expected);
  assert.equal(warnings.filter(w=>/invalid.*Name|invalid.*name/.test(w)).length,0);
  const sensors=registered.find(a=>!a.context.switchId);
  assert.match(sensors.getService(api.hap.Service.TemperatureSensor).displayName,/Temperature$/);
  assert.match(sensors.getService(api.hap.Service.HumiditySensor).displayName,/Humidity$/);
});
test('cached symbolic HomeKit names are repaired without replacing accessories or rule IDs',t=>{
  const first=setup(t);first.p.launch();first.p.stop();const id=example.switches[0].id,old=first.registered.find(a=>a.context.switchId===id);
  t.mock.method(console,'warn',()=>{});old.getService(first.api.hap.Service.Switch).setCharacteristic(first.api.hap.Characteristic.Name,'Temp. >8°C');
  const second=setup(t,{switches:[{...example.switches[0],name:'Temp. >8°C'}]});for(const a of first.registered)second.p.configureAccessory(a);second.p.launch();
  assert.equal(second.registered.length,0);const repaired=second.updated.find(a=>a.context.switchId===id);assert.equal(repaired,old);assert.equal(repaired.UUID,old.UUID);assert.equal(repaired.displayName,'Temp. above 8 degrees C');assert.equal(second.p.records[0].config.id,id);
});
test('real Homebridge sensors and virtual switches, events and rejected manual writes',async t=>{
  const {p,api,registered}=setup(t);p.launch();
  assert.equal(registered.length,3);p.sample=sample();p.evaluate();
  const on=p.records[0].service.getCharacteristic(api.hap.Characteristic.On);
  assert.equal(await on.handleGetRequest(),true);
  await assert.rejects(on.handleSetRequest(false));
  const temp=p.sensors[0].service.getCharacteristic(api.hap.Characteristic.CurrentTemperature);
  assert.equal(await temp.handleGetRequest(),-7);
  const humidity=p.sensors[1].service.getCharacteristic(api.hap.Characteristic.CurrentRelativeHumidity);
  assert.equal(await humidity.handleGetRequest(),80);
  const events=[];on.on('change',e=>events.push(e.newValue));p.sample.values.windSpeed=10;p.sample.values.windGusts=10;p.evaluate();
  assert.equal(await on.handleGetRequest(),false);assert.ok(events.includes(false));
  p.sample.time=Date.now()-1801000;p.evaluate();assert.equal(await on.handleGetRequest(),true);
  await assert.rejects(temp.handleGetRequest());await assert.rejects(humidity.handleGetRequest());
  await assert.rejects(p.records[1].service.getCharacteristic(api.hap.Characteristic.On).handleGetRequest());
  p.sample=sample();p.evaluate();assert.equal(await temp.handleGetRequest(),-7);
});
test('cached accessories keep identity; sensor toggle and removed switches clean up',t=>{
  const first=setup(t);first.p.launch();first.p.stop();
  const second=setup(t,{showSensors:false,switches:[{...example.switches[0],name:'Renamed'}]});
  for(const a of first.registered)second.p.configureAccessory(a);
  second.p.launch();assert.equal(second.registered.length,0);assert.equal(second.updated.length,1);assert.equal(second.removed.length,2);
  assert.equal(second.updated[0].displayName,'Renamed');assert.equal(second.p.sensors,undefined);
});
test('light sensor independently optional, missing values affect only dependent services/rules',async t=>{
  const {p,api,registered}=setup(t,{provider:'open-meteo',showSensors:false,showLightSensor:true});p.launch();
  assert.equal(p.sensors.length,1);const light=p.sensors[0].service.getCharacteristic(api.hap.Characteristic.CurrentAmbientLightLevel);
  p.sample=sample();p.sample.values.illuminance=1050;p.evaluate();assert.equal(await light.handleGetRequest(),1050);
  delete p.sample.values.illuminance;delete p.sample.values.windGusts;p.evaluate();await assert.rejects(light.handleGetRequest());
  assert.equal(p.records[0].rule.state,true); // failure-on for missing gust; temperature rule still evaluates
  assert.equal(p.records[1].unavailable,false);
  assert.equal(registered[0].getService(api.hap.Service.TemperatureSensor),undefined);
});
test('DWD removes cached light while preserving temperature, humidity and accessory identity',async t=>{
  const first=setup(t,{showSensors:true,showLightSensor:true});first.p.launch();first.p.stop();
  const second=setup(t,{provider:'dwd',showSensors:true,showLightSensor:true});
  for(const accessory of first.registered)second.p.configureAccessory(accessory);
  second.p.launch();second.p.sample=sample();second.p.evaluate();
  assert.equal(second.registered.length,0);const accessory=second.updated.find(a=>a.UUID===first.registered[0].UUID);
  assert.ok(accessory);assert.equal(accessory.getService(second.api.hap.Service.LightSensor),undefined);
  assert.deepEqual(second.p.sensors.map(s=>s.metric),['temperature','humidity']);
  assert.equal(await second.p.sensors[0].service.getCharacteristic(second.api.hap.Characteristic.CurrentTemperature).handleGetRequest(),-7);
  const disabled=setup(t,{provider:'dwd',showSensors:false,showLightSensor:true,switches:[]});
  disabled.p.configureAccessory(accessory);let calls=0;disabled.p.getWeather=()=>{calls++;};disabled.p.launch();
  assert.equal(disabled.registered.length,0);assert.equal(disabled.removed.length,1);assert.equal(calls,0);
});
test('empty configuration without sensors never fetches; invalid config leaves cache intact',t=>{
  const {p}=setup(t,{showSensors:false,switches:[]});let calls=0;p.getWeather=()=>{calls++;};p.launch();assert.equal(calls,0);
  const invalid=setup(t,{latitude:100});assert.equal(invalid.p.config,undefined);assert.ok(invalid.logs.some(m=>m.includes('deaktiviert')));
});
test('cached values report faults before launch and for invalid configuration',async t=>{
  const first=setup(t);first.p.launch();first.p.sample=sample();first.p.evaluate();first.p.stop();
  const invalid=setup(t,{latitude:100});
  for(const a of first.registered)invalid.p.configureAccessory(a);
  assert.equal(invalid.removed.length,0);
  const sensor=first.registered[0].getService(first.api.hap.Service.TemperatureSensor).getCharacteristic(first.api.hap.Characteristic.CurrentTemperature);
  await assert.rejects(sensor.handleGetRequest());
});
test('recording defaults off; live status remains available without opening history storage',t=>{
  const {p}=setup(t);let opened=0;p.createHistoryStore=()=>{opened++;throw Error('must not open');};p.launch();p.sample=sample();p.evaluate();
  const snapshot=p.statusSnapshot();assert.equal(snapshot.running,true);assert.equal(snapshot.enableHistory,false);assert.equal(snapshot.switches[0].state,true);assert.equal(opened,0);assert.equal(p.history,undefined);
});
test('enabled recording captures real transition and availability changes and fresh startup has no fabricated sample',t=>{
  const {p}=setup(t,{enableHistory:true});p.launch();assert.ok(p.history);
  assert.equal(p.history.db.prepare('SELECT count(*) AS n FROM samples').get().n,0);
  p.sample=sample();p.evaluate();assert.equal(p.statusSnapshot().switches[0].state,true);
  p.sample.time=Date.now()-1801000;p.evaluate();assert.equal(p.statusSnapshot().switches[0].available,false);
  const events=p.history.db.prepare('SELECT * FROM events').all();assert.ok(events.some(e=>e.available===1));assert.ok(events.some(e=>e.available===0&&e.reason==='failure'));
});
test('poll failures retain only fresh cached data; timestamp rollback rejected; shutdown aborts',async t=>{
  const {p}=setup(t);p.running=true;p.sample=sample();const previous=p.sample;
  p.getWeather=async()=>({time:previous.time-1000,values:previous.values});await p.poll();assert.equal(p.sample,previous);assert.equal(p.failed,true);clearTimeout(p.timer);
  p.getWeather=async()=>sample();await p.poll();assert.equal(p.failed,false);clearTimeout(p.timer);
  let release;p.getWeather=signal=>new Promise((_r,reject)=>{release=()=>reject(Error('aborted'));signal.addEventListener('abort',release);});
  const pending=p.poll();p.stop();await pending;assert.equal(p.running,false);assert.equal(p.busy,false);
});
function forecastSample(){const now=Date.now(),hour=3600000;return {source:'DWD MOSMIX TEST (10384)',issuedAt:now-3600000,fetchedAt:now,rows:Array.from({length:80},(_,i)=>({time:Math.floor(now/hour)*hour+(i+1)*hour,values:{windSpeed:50,cloudCover:80}}))};}
const forecastSwitch={id:'forecast',name:'Forecast switch',failureState:'off',conditions:[{source:'forecast',metric:'windSpeed',operator:'above',threshold:40,releaseThreshold:30,forecastStartHours:0,forecastEndHours:6,aggregation:'max'}]};
test('forecast-only switch operates during observation failure; stale forecast uses failure policy',async t=>{
  const {p}=setup(t,{provider:'dwd',switches:[forecastSwitch],enableHistory:true});p.getForecast=async()=>forecastSample();p.launch();await new Promise(resolve=>setImmediate(resolve));clearTimeout(p.timer);assert.equal(p.sample,undefined);
  assert.equal(p.records[0].rule.state,true);assert.equal(p.records[0].unavailable,false);assert.equal(p.statusSnapshot().switches[0].inputs[0].source,'forecast');
  p.forecast.issuedAt=Date.now()-p.config.forecastStaleAfter*1000-1;p.evaluate();assert.equal(p.records[0].rule.state,false);assert.equal(p.records[0].unavailable,true);
});
test('DWD current weather remains valid when MOSMIX fails',async t=>{
  const {p}=setup(t,{provider:'dwd',switches:[forecastSwitch]});p.getWeather=async()=>sample();p.getForecast=async()=>{throw Error('MOSMIX offline');};p.launch();await new Promise(resolve=>setImmediate(resolve));clearTimeout(p.timer);
  assert.ok(p.sample);assert.match(p.lastForecastError,/offline/);assert.equal(p.records[0].unavailable,true);
});
test('DWD MOSMIX downloads are shared and throttled to the configured refresh interval',async t=>{
  const {zipSync,strToU8}=require('fflate'),now=Date.now(),valid=Math.ceil(now/3600000)*3600000;
  const xml=`<kml><Document><ExtendedData><ProductDefinition><ProductID>MOSMIX</ProductID><IssueTime>${new Date(now-3600000).toISOString()}</IssueTime><ForecastTimeSteps><TimeStep>${new Date(valid).toISOString()}</TimeStep></ForecastTimeSteps></ProductDefinition></ExtendedData><Placemark><name>10384</name><description>Berlin</description><Point><coordinates>13.4,52.47,50</coordinates></Point><ExtendedData><Forecast elementName="FF"><value>10</value></Forecast></ExtendedData></Placemark></Document></kml>`;
  const bytes=zipSync({'one.kml':strToU8(xml)}),{p}=setup(t,{provider:'dwd',switches:[forecastSwitch]});let count=0;
  t.mock.method(globalThis,'fetch',async()=>{count++;return {ok:true,arrayBuffer:async()=>bytes.buffer};});
  const f=await p.getForecast();assert.equal(f.station.id,'10384');assert.equal(p.getForecast(),undefined);assert.equal(count,1);
});
test('DWD consent exemption and authoritative saved Open-Meteo revocation block requests before network',async t=>{
  const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../.preview');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'runtime-consent-'));t.after(()=>{if(!dir.startsWith(root+path.sep))throw Error('Bad path');fs.rmSync(dir,{recursive:true,force:true});});
  const {CONSENT_VERSION}=require('../homebridge-ui/public/config');const approval={openMeteoPrivateConsent:true,_openMeteoConsentVersion:CONSENT_VERSION};
  const {p,api}=setup(t,approval),filename=path.join(dir,'config.json');api.user.configPath=()=>filename;p.getWeather=require('..').WeatherPlatform.prototype.getWeather.bind(p);
  fs.writeFileSync(filename,JSON.stringify({platforms:[{...example,...approval}]}));let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return {ok:false,status:503};});
  await assert.rejects(p.getWeather(),/503/);assert.equal(calls,2);
  fs.writeFileSync(filename,JSON.stringify({platforms:[{...example,openMeteoPrivateConsent:false}]}));assert.throws(()=>p.getWeather(),/Zustimmung/);assert.equal(calls,2);assert.equal(p.openMeteoConsentBlocked,true);
  const dwd=setup(t,{provider:'dwd'});dwd.api.user.configPath=()=>{throw Error('DWD must not read Open-Meteo consent');};dwd.p.getWeather=require('..').WeatherPlatform.prototype.getWeather.bind(dwd.p);await assert.rejects(dwd.p.getWeather(),/503/);assert.equal(calls,3);
});

test('saved consent revoked after a failed request blocks its retry and clears cached weather',async t=>{
  const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../.preview');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'retry-consent-'));t.after(()=>{if(!dir.startsWith(root+path.sep))throw Error('Bad path');fs.rmSync(dir,{recursive:true,force:true});});
  const approval={openMeteoPrivateConsent:true,_openMeteoConsentVersion:require('../homebridge-ui/public/config').CONSENT_VERSION};
  const {p,api}=setup(t,approval),filename=path.join(dir,'config.json'),write=consent=>fs.writeFileSync(filename,JSON.stringify({platforms:[{...example,...approval,openMeteoPrivateConsent:consent}]}));
  api.user.configPath=()=>filename;p.getWeather=require('..').WeatherPlatform.prototype.getWeather.bind(p);p.sample=sample();p.forecast={rows:[]};write(true);let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;write(false);return {ok:false,status:503};});
  await assert.rejects(p.getWeather(),/Zustimmung/);assert.equal(calls,1);assert.equal(p.sample,null);assert.equal(p.forecast,null);assert.equal(p.openMeteoConsentBlocked,true);
});


const localConfig={enabled:true,host:'192.0.2.1',shellyDeviceId:'shelly-test-aabbccddeeff',deviceComponent:'bthomedevice:200',password:'private-test-password',pollInterval:15,staleAfter:120};
const localPoint=(value=10,time=Date.now())=>({source:'Shelly WS90',addr:'aabbccddee01',hostId:localConfig.shellyDeviceId,deviceComponent:'bthomedevice:200',values:{windSpeed:value,temperature:12,illuminance:15000},extras:{},metricTimes:{windSpeed:time,temperature:time,illuminance:time},sensors:{windSpeed:'bthomesensor:213'},unavailable:{}});
test('local polling and weather provider failures are independent; fallback and recovery preserve rules',async t=>{
  const {p}=setup(t,{localStation:localConfig,enableHistory:true,switches:[{id:'wind-local',name:'Local wind',failureState:'off',conditions:[{metric:'windSpeed',source:'current',dataSource:'prefer-local',operator:'above',threshold:20,releaseThreshold:15}]}]});
  p.getLocalWeather=async()=>localPoint(30);p.launch();await new Promise(resolve=>setImmediate(resolve));clearTimeout(p.localTimer);clearTimeout(p.timer);
  assert.equal(p.records[0].rule.state,true);assert.equal(p.records[0].inputs[0].origin,'local');assert.equal(p.failed,true);
  p.sample=sample();p.sample.values.windSpeed=10;p.localSample.metricTimes.windSpeed=Date.now()-121000;p.evaluate();assert.equal(p.records[0].rule.state,false);assert.equal(p.records[0].inputs[0].origin,'weather');assert.equal(p.records[0].inputs[0].fallback,true);
  p.getLocalWeather=async()=>localPoint(30);await p.pollLocal();clearTimeout(p.localTimer);assert.equal(p.records[0].inputs[0].origin,'local');assert.equal(p.records[0].rule.state,true);
  assert.ok(!JSON.stringify(p.statusSnapshot()).includes(localConfig.password));assert.equal(p.statusSnapshot().localStation.deviceComponent,'bthomedevice:200');
});
test('same-state fallback changes are archived with actual origin and a disabled station can use weather backup',t=>{
  const {p}=setup(t,{localStation:localConfig,enableHistory:true,switches:[{id:'same',name:'Same',conditions:[{metric:'windSpeed',dataSource:'prefer-local',operator:'above',threshold:20,releaseThreshold:15}]}]});p.launch();p.sample=sample();p.localSample=localPoint(30);p.evaluate();
  const before=p.history.db.prepare('SELECT count(*) AS n FROM events').get().n;p.localSample.metricTimes.windSpeed=Date.now()-121000;p.evaluate();
  assert.equal(p.records[0].rule.state,true);assert.ok(p.history.db.prepare('SELECT count(*) AS n FROM events').get().n>before);assert.equal(p.records[0].inputs[0].origin,'weather');
  p.config.localStation.enabled=false;p.evaluate();assert.equal(p.records[0].inputs[0].origin,'weather');assert.equal(p.records[0].unavailable,false);
});
test('two conditions combine local and provider values without averaging; local-only fails independently',t=>{
  const {p}=setup(t,{localStation:localConfig,switches:[{id:'both',name:'Both',mode:'all',failureState:'off',conditions:[{metric:'windSpeed',dataSource:'weather',operator:'above',threshold:20,releaseThreshold:15},{metric:'windSpeed',dataSource:'local',operator:'above',threshold:20,releaseThreshold:15}]}]});p.launch();p.sample=sample();p.localSample=localPoint(10);p.evaluate();assert.equal(p.records[0].rule.state,false);
  p.localSample=localPoint(30);p.evaluate();assert.equal(p.records[0].rule.state,true);assert.deepEqual(p.records[0].inputs.map(i=>i.value),[35,30]);
  p.localSample=localPoint(30,Date.now()-121000);p.evaluate();assert.equal(p.records[0].unavailable,true);assert.equal(p.records[0].rule.state,false);
});
test('local shutdown aborts a pending read and leaves no retry timer',async t=>{
  const {p}=setup(t,{localStation:localConfig});p.running=true;p.getLocalWeather=signal=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));
  const pending=p.pollLocal();p.stop();await pending;assert.equal(p.localBusy,false);assert.equal(p.localTimer,undefined);assert.equal(p.running,false);
});


test('fresh hourly precipitation does not alternate into failure every half-hour; genuine loss still does',t=>{
  const {p}=setup(t,{provider:'open-meteo',staleAfter:1800,switches:[{id:'rain-hourly',name:'Rain',failureState:'on',conditions:[{metric:'precipitation',operator:'above',threshold:1,releaseThreshold:0.5}]}]});p.launch();
  const base=Math.floor(Date.now()/3600000)*3600000;let failures=0;
  for(let minute=0;minute<180;minute++){
    const time=base+minute*60000;p.sample={time:Math.floor(time/900000)*900000,precipitationTime:Math.floor(time/3600000)*3600000,values:{precipitation:0}};p.evaluate(time);if(p.records[0].unavailable)failures++;assert.equal(p.records[0].rule.state,false);
  }
  assert.equal(failures,0);const last=p.sample.time;p.evaluate(last+1800001);assert.equal(p.records[0].unavailable,true);assert.equal(p.records[0].rule.state,true);
});
