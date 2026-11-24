'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {CONSENT_VERSION,openMeteoAllowed}=require('../homebridge-ui/public/config');
const {fetchWeather}=require('../lib/weather');
const {savedConsentAllowed}=require('../lib/consent');
const approved={provider:'open-meteo',openMeteoPrivateConsent:true,_openMeteoConsentVersion:CONSENT_VERSION};
function file(t){const root=path.resolve(__dirname,'../.preview');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'consent-test-'));t.after(()=>{if(!dir.startsWith(root+path.sep))throw Error('Bad test path');fs.rmSync(dir,{force:true,recursive:true});});return path.join(dir,'config.json');}
test('absent, false and obsolete consent prevent every Open-Meteo request, including forecast requests',async()=>{
  let calls=0;
  for(const patch of [{},{openMeteoPrivateConsent:true},{...approved,_openMeteoConsentVersion:'old'},{...approved,openMeteoPrivateConsent:false}]){
    const cfg={latitude:0,longitude:0,switches:[{conditions:[{source:'forecast'}]}],...patch};
    assert.equal(openMeteoAllowed(cfg),false);await assert.rejects(fetchWeather(cfg,undefined,async()=>{calls++;}),/Zustimmung/);
  }
  assert.equal(calls,0);
});
test('current version consent permits bounded retries; revocation blocks the next request',async()=>{
  const cfg={...approved,latitude:0,longitude:0};let calls=0;
  const fetcher=async()=>{calls++;return {ok:false,status:503};};
  await assert.rejects(fetchWeather(cfg,undefined,fetcher,{wait:async()=>{}}),/503/);assert.equal(calls,2);
  cfg.openMeteoPrivateConsent=false;await assert.rejects(fetchWeather(cfg,undefined,fetcher),/Zustimmung/);assert.equal(calls,2);
});
test('latest saved consent is authoritative; old configurations, changed provider and unreadable config are denied',t=>{
  const filename=file(t),write=c=>fs.writeFileSync(filename,JSON.stringify({platforms:[{platform:'WeatherSwitches',...c}]}));
  write(approved);assert.equal(savedConsentAllowed(approved,filename),true);assert.equal(savedConsentAllowed({},filename),false);
  write({...approved,openMeteoPrivateConsent:false});assert.equal(savedConsentAllowed(approved,filename),false);
  write({provider:'open-meteo'});assert.equal(savedConsentAllowed(approved,filename),false);
  write({...approved,provider:'dwd'});assert.equal(savedConsentAllowed(approved,filename),false);
  fs.writeFileSync(filename,'invalid JSON');assert.equal(savedConsentAllowed(approved,filename),false);
});
