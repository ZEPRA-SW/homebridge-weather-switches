'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validate} = require('../homebridge-ui/public/config');
const {Rule} = require('../lib/rules');
const example = require('../example.config.json');
const make = (extra = {}) => validate({...example, switches: [{id: 'x', name: 'X', conditions: [{metric: 'windSpeed', operator: 'above', threshold: 30, hysteresis: 5}], ...extra}]}).switches[0];

test('default language and translation fallback are English, explicit languages remain available',()=>{
  const {translate}=require('../homebridge-ui/public/i18n'),{homeKitName}=require('../homebridge-ui/public/config');
  const c={...example};delete c.language;assert.equal(validate(c).language,'en');
  delete c.latitude;delete c.longitude;
  assert.equal(validate(c).latitude,52.52);assert.equal(validate(c).longitude,13.405);
  assert.throws(()=>validate({...c,latitude:null}));assert.throws(()=>validate({...c,longitude:null}));
  assert.equal(translate(undefined,'Einstellungen'),'Settings');assert.equal(translate('unknown','Einstellungen'),'Settings');
  assert.equal(homeKitName('Temp. >8°C'),'Temp. above 8 degrees C');
  for(const language of ['de','en','fr','es'])assert.equal(validate({...c,language}).language,language);
});
test('inclusive threshold and hysteresis release boundaries', () => {
  const r = new Rule(make());
  for (const [v, state] of [[29,false], [30,true], [28,true], [25,true], [24.9,false]]) assert.equal(r.evaluate({windSpeed:v}, 0),state);
  const cold = new Rule(make({conditions:[{metric:'temperature',operator:'below',threshold:0,hysteresis:2}]}));
  for (const [v,state] of [[1,false],[0,true],[2,true],[2.1,false],[-5,true]]) assert.equal(cold.evaluate({temperature:v},0),state);
});
test('AND/OR, per-condition latches and inverted state', () => {
  const conditions = [{metric:'temperature',operator:'above',threshold:25,hysteresis:1},{metric:'humidity',operator:'above',threshold:70,hysteresis:5}];
  const all = new Rule(make({conditions}));
  assert.equal(all.evaluate({temperature:25,humidity:60},0),false);
  assert.equal(all.evaluate({temperature:24,humidity:70},0),true);
  assert.equal(all.evaluate({temperature:23,humidity:70},0),false);
  const any = new Rule(make({conditions,mode:'any',matchedState:false}));
  assert.equal(any.evaluate({temperature:20,humidity:60},0),true);
  assert.equal(any.evaluate({temperature:25,humidity:60},0),false);
});
test('stabilization cancels on bounce, delays both directions, resets on stale', () => {
  const r = new Rule(make({stableForSeconds:10}));
  assert.equal(r.evaluate({windSpeed:30},0),false);
  r.evaluate({windSpeed:20},9000);
  assert.equal(r.evaluate({windSpeed:30},10000),false);
  assert.equal(r.evaluate({windSpeed:30},20000),true);
  assert.equal(r.evaluate({windSpeed:20},21000),true);
  r.unavailable();
  assert.equal(r.evaluate({windSpeed:20},40000),true);
  assert.equal(r.evaluate({windSpeed:20},50000),false);
});
test('failure modes including initial state', () => {
  for (const [failureState, state] of [['on',true],['off',false],['hold',false]]) assert.equal(new Rule(make({failureState})).unavailable(),state);
  const r = new Rule(make()); r.evaluate({windSpeed:50},0); assert.equal(r.unavailable(),true);
});
test('configuration rejects invalid coordinates, duplicate IDs, empty rules and unreachable release bounds', () => {
  assert.equal(validate(example).showSensors,true);
  for (const change of [{latitude:91},{longitude:-181},{pollInterval:0},{staleAfter:100},{showSensors:'yes'}, {switches:[example.switches[0],example.switches[0]]}]) assert.throws(() => validate({...example,...change}));
  assert.throws(() => make({conditions:[]}));
  assert.throws(() => make({conditions:[{metric:'humidity',operator:'above',threshold:5,hysteresis:10}]}));
  assert.throws(() => make({conditions:[{metric:'windSpeed',operator:'above',threshold:null}]}));
  assert.throws(() => make({mode:'other'}));
});
test('history is opt-in and retention is a validated integer number of days',()=>{
  const c=validate(example);assert.equal(c.enableHistory,false);assert.equal(c.historyRetentionDays,365);
  for(const value of [0,367,1.5,'365'])assert.throws(()=>validate({...example,historyRetentionDays:value}));
  assert.equal(validate({...example,historyRetentionDays:1,enableHistory:true}).historyRetentionDays,1);
  assert.throws(()=>validate({...example,enableHistory:'yes'}));
});


test('HomeKit name conversion preserves Unicode, translates comparison symbols and bounds UTF-8 length',()=>{
  const {homeKitName}=require('../homebridge-ui/public/config');
  assert.equal(homeKitName('Temp. >8°C','de'),'Temp. über 8 Grad C');assert.equal(homeKitName('Feuchte ≤ 80%','de'),'Feuchte höchstens 80 Prozent');
  for(const language of ['de','en','fr','es'])for(const value of ['☀🌧','😀 Terrasse!','O’Briens Terrasse','東京'.repeat(100),'A','1','e\u0301']){
    const name=homeKitName(value,language);assert.ok(Buffer.byteLength(name,'utf8')<=64);assert.ok(/^[\p{L}\p{N}](?:[\p{L}\p{N}\p{Zs}’'&!._:;()/,-]*[\p{L}\p{N}])?$/u.test(name),name);
  }
});
