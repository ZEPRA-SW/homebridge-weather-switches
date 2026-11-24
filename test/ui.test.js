'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../homebridge-ui/public');
const I18n=require('../homebridge-ui/public/i18n');
const germanExample={...require('../example.config.json'),language:'de'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function ui(t, config=germanExample, schemaChanges={}, requester) {
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/'});
  t.after(()=>dom.window.close());
  const w=dom.window;w.structuredClone=structuredClone;
  // LAN HTTP exposes getRandomValues, but not the secure-context-only randomUUID.
  Object.defineProperty(w.crypto,'randomUUID',{value:undefined});
  const state={enabled:false,updates:[]};
  const schema=structuredClone(require('../config.schema.json'));Object.assign(schema.schema.properties,schemaChanges);
  w.homebridge={getPluginConfig:async()=>structuredClone(config===null?[]:[config]),getPluginConfigSchema:async()=>schema,updatePluginConfig:async c=>state.updates.push(c),enableSaveButton:()=>state.enabled=true,disableSaveButton:()=>state.enabled=false};
  if(requester)w.homebridge.request=requester;
  for(const f of ['theme.js','i18n.js','config.js','stations.js','station.js','history-view.js','status.js','app.js']) w.eval(fs.readFileSync(path.join(root,f),'utf8'));
  await tick();
  const field=label=>{const l=[...w.document.querySelectorAll('label')].find(l=>l.textContent===label||l.textContent.startsWith(label+' ('));assert.ok(l,'field: '+label);return w.document.getElementById(l.htmlFor);};
  const input=(node,value)=>{if(node.type==='checkbox')node.checked=value;else node.value=value;node.dispatchEvent(new w.Event('input',{bubbles:true}));};
  return {w,state,field,input};
}

test('new setup defaults to English and editable Berlin coordinates without changing provider on location edits',async t=>{
  const {w,field,input,state}=await ui(t,null);
  assert.equal(w.document.documentElement.lang,'en');assert.equal(field('Language').value,'en');
  assert.equal(field('Latitude').value,'52.52');assert.equal(field('Longitude').value,'13.405');
  assert.equal(field('Time zone').value,'Europe/Berlin');
  assert.equal(w.document.getElementById('add-device').textContent,'Add weather switch');
  // Use the worldwide provider explicitly before moving outside DWD coverage.
  input(field('Weather data source'),'open-meteo');await tick();
  const source=field('Weather data source').value;
  input(field('Latitude'),40.7128);input(field('Longitude'),-74.006);input(field('Time zone'),'America/New_York');
  w.document.getElementById('add-device').click();await tick();
  const saved=state.updates.at(-1)[0];assert.equal(saved.language,'en');
  assert.equal(saved.latitude,40.7128);assert.equal(saved.longitude,-74.006);assert.equal(saved.timeZone,'America/New_York');
  assert.equal(saved.provider,source);assert.equal(saved.switches[0].name,'New weather switch');
});

test('missing language defaults to English while stored names, coordinates and explicit languages survive',async t=>{
  const config=structuredClone(require('../example.config.json'));delete config.language;
  config.name='Mein Standort';config.latitude=-33.8688;config.longitude=151.2093;
  const {w,state,field}=await ui(t,config);
  assert.equal(w.document.documentElement.lang,'en');assert.equal(field('Weather location name').value,'Mein Standort');
  const saved=state.updates.at(-1)[0];assert.equal(saved.language,'en');assert.equal(saved.latitude,-33.8688);assert.equal(saved.longitude,151.2093);
  for(const language of ['de','fr','es']){
    const restored=await ui(t,{...config,language});assert.equal(restored.w.document.documentElement.lang,language);
    assert.equal(restored.state.updates.at(-1)[0].name,'Mein Standort');
  }
});
test('UI loads real schema, saves changes, toggles sensors and previews DWD station locally',async t=>{
  const {w,state,field,input}=await ui(t);assert.equal(state.enabled,true);assert.equal(w.document.querySelectorAll('.device-settings').length,2);
  input(field('Wetterdatenquelle'),'dwd');await tick();assert.equal(field('Maximales Datenalter (Sekunden)').value,'7200');
  assert.match(w.document.getElementById('station-hint').textContent,/Berlin-Tempelhof/);
  input(field('Temperatur und Luftfeuchtigkeit in HomeKit anzeigen'),false);await tick();
  assert.equal(w.document.querySelector('[data-field="showLightSensor"]'),null);
  const cfg=state.updates.at(-1)[0];assert.equal(cfg.showSensors,false);assert.equal(cfg.provider,'dwd');
});
test('DWD station map opens separately beside station field, only for DWD',async t=>{
  const {w,field,input}=await ui(t);assert.equal(w.document.getElementById('dwd-station-map'),null);
  input(field('Wetterdatenquelle'),'dwd');await tick();
  const link=w.document.getElementById('dwd-station-map');assert.ok(link);
  assert.equal(link.closest('.field'),field('DWD-Stationskennung (optional)').closest('.field'));
  assert.equal(new URL(link.href).hostname,'www.dwd.de');assert.match(link.href,/messnetzkarte_boden\.pdf/);
  assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);
  assert.match(link.parentElement.textContent,/Keine CDC-ID/);assert.match(link.parentElement.textContent,/Spalte „Kennung“/);
  input(field('Wetterdatenquelle'),'open-meteo');await tick();assert.equal(w.document.getElementById('dwd-station-map'),null);
});
test('Homebridge injected internal schema never becomes an unlabelled required field and bridge metadata survives',async t=>{
  const bridge={name:'Weather Child',username:'0E:12:34:56:78:90',port:51099};
  const cfg={...structuredClone(germanExample),_bridge:bridge};
  const {w,state,field,input}=await ui(t,cfg,{
    _bridge:{type:'object',notitle:true,condition:{functionBody:'return false'},properties:{name:{type:'string'},port:{type:'integer'}}},
    _internal:{type:'string'},platform:{type:'string'},unsupportedObject:{type:'object',title:'Unsupported object'},
  });
  assert.equal(state.enabled,true);assert.equal(w.document.querySelector('[data-field="_bridge"]'),null);
  for(const node of w.document.querySelectorAll('input,select')) {
    const label=w.document.querySelector(`label[for="${node.id}"]`);assert.ok(label?.textContent.trim(),'visible input must have a label');
  }
  input(field('Name des Wetterstandorts'),'Neuer Name');await tick();
  assert.deepEqual(state.updates.at(-1)[0]._bridge,bridge);
  assert.equal(state.updates.at(-1)[0].platform,'WeatherSwitches');
});
test('UI adds, copies, reorders and removes switches with unique stable identities',async t=>{
  const {w,state}=await ui(t);
  w.document.getElementById('add-device').click();await tick();assert.equal(state.updates.at(-1)[0].switches.length,3);
  const last=w.document.querySelectorAll('.device-settings')[2];last.querySelector('.copy-device').click();await tick();
  const switches=state.updates.at(-1)[0].switches;assert.equal(new Set(switches.map(s=>s.id)).size,4);
  const lastId=switches[3].id;w.document.querySelectorAll('.device-settings')[3].querySelector('[aria-label="Nach oben"]').click();await tick();
  assert.equal(state.updates.at(-1)[0].switches[2].id,lastId);
  [...w.document.querySelectorAll('.device-settings')[2].querySelectorAll('button')].find(b=>b.textContent==='Schalter entfernen').click();await tick();
  assert.equal(state.updates.at(-1)[0].switches.length,3);
});
test('HTTP UI can add, configure, stage a valid switch and restore it on reopening with injected Homebridge schema',async t=>{
  const cfg={...structuredClone(germanExample),switches:[],_bridge:{name:'Wetter Child',port:51099}};
  const injected={_bridge:{type:'object',notitle:true,properties:{port:{type:'integer'}}}};
  const first=await ui(t,cfg,injected);
  assert.equal(first.w.crypto.randomUUID,undefined);
  first.w.document.getElementById('add-device').click();await tick();
  assert.equal(first.w.document.querySelectorAll('.device-settings').length,1);
  first.input(first.field('Name in Apple Home'),'Windschutz Terrasse');
  first.input(first.field('Aktivierungsschwelle'),40);
  first.input(first.field('Rückschaltschwelle'),30);await tick();
  assert.equal(first.state.enabled,true);
  const saved=structuredClone(first.state.updates.at(-1)[0]);
  assert.equal(saved.switches[0].name,'Windschutz Terrasse');assert.match(saved.switches[0].id,/^weather-[a-f0-9]{32}$/);
  const second=await ui(t,saved,injected);
  assert.equal(second.state.enabled,true);assert.equal(second.field('Name in Apple Home').value,'Windschutz Terrasse');
  assert.equal(second.field('Aktivierungsschwelle').value,'40');assert.equal(second.field('Rückschaltschwelle').value,'30');
  assert.equal(second.state.updates.at(-1)[0].switches[0].id,saved.switches[0].id);
  assert.deepEqual(second.state.updates.at(-1)[0]._bridge,cfg._bridge);
});
test('UI blocks invalid thresholds, duplicate IDs and empty numeric fields from being saved',async t=>{
  const {state,field,input,w}=await ui(t);const n=state.updates.length;
  input(field('Rückschaltschwelle'),99);await tick();assert.equal(state.enabled,false);assert.equal(state.updates.length,n);
  assert.match(w.document.getElementById('message').textContent,/Hysterese/);
  input(field('Rückschaltschwelle'),25);await tick();assert.equal(state.enabled,true);
  const labels=[...w.document.querySelectorAll('label')].filter(l=>l.textContent==='Dauerhafte eindeutige ID');
  input(w.document.getElementById(labels[1].htmlFor),field('Dauerhafte eindeutige ID').value);await tick();assert.equal(state.enabled,false);
  assert.match(w.document.getElementById('message').textContent,/eindeutig/);
  input(w.document.getElementById(labels[1].htmlFor),'fixed-id');await tick();assert.equal(state.enabled,true);
  input(field('Breitengrad'),'');await tick();assert.equal(state.enabled,false);
});
for(const language of ['de','en','fr','es'])test(`complete switch lifecycle and persisted language ${language} over HTTP`,async t=>{
  const tr=(key,values)=>I18n.translate(language,key,values);
  const cfg={...structuredClone(germanExample),name:'Mein eigener Standort',switches:[],provider:'dwd',staleAfter:7200};
  const first=await ui(t,cfg,{_bridge:{type:'object',notitle:true}});
  first.input(first.field('Sprache'),language);await tick();
  assert.equal(first.w.document.documentElement.lang,language);
  assert.equal(first.field(tr('Name des Wetterstandorts')).value,'Mein eigener Standort');
  assert.equal(first.field(tr('Wetterdatenquelle')).value,'dwd');
  assert.equal(first.w.document.getElementById('dwd-station-map').textContent,tr('DWD-Stationskarte öffnen (PDF, neuer Tab)'));
  assert.equal(first.w.document.getElementById('add-device').textContent,tr('Wetterschalter hinzufügen'));
  first.w.document.getElementById('add-device').click();await tick();
  const mode=first.field(tr('Bedingungen verknüpfen'));assert.equal(mode.options[0].textContent,tr('Alle müssen zutreffen (UND)'));assert.equal(mode.options[1].textContent,tr('Mindestens eine muss zutreffen (ODER)'));first.input(mode,'any');
  first.input(first.field(tr('Name in Apple Home')),'Terrassenwind Eigenname');
  first.input(first.field(tr('Aktivierungsschwelle')),45);first.input(first.field(tr('Rückschaltschwelle')),35);
  [...first.w.document.querySelectorAll('button')].find(b=>b.textContent===tr('Bedingung hinzufügen')).click();await tick();
  assert.equal(first.w.document.querySelectorAll('.row').length,2);
  assert.equal(first.w.document.querySelectorAll('h4')[1].textContent,tr('Bedingung {number}',{number:2}));
  const metric=first.w.document.querySelectorAll('[data-field="metric"] select')[1];
  assert.equal(metric.options[0].textContent,tr('Temperatur (°C, 2 m)'));
  first.input(first.field(tr('Breitengrad')),'');await tick();
  assert.equal(first.state.enabled,false);
  assert.equal(first.w.document.getElementById('message').textContent,tr('{label}: Zahl zwischen {min} und {max} erforderlich.',{label:tr('Breitengrad'),min:-90,max:90}));
  first.input(first.field(tr('Breitengrad')),52.52);
  first.input(first.field(tr('DWD-Stationskennung (optional)')),'99999');await tick();
  assert.equal(first.w.document.getElementById('message').textContent,tr('DWD-Station nicht im mitgelieferten POI-Stationskatalog.'));
  first.input(first.field(tr('DWD-Stationskennung (optional)')),'');await tick();assert.equal(first.state.enabled,true);
  const saved=structuredClone(first.state.updates.at(-1)[0]);assert.equal(saved.language,language);
  const second=await ui(t,saved,{_bridge:{type:'object',notitle:true}});
  assert.equal(second.w.document.documentElement.lang,language);
  assert.equal(second.field(tr('Name in Apple Home')).value,'Terrassenwind Eigenname');
  assert.equal(second.field(tr('Name des Wetterstandorts')).value,'Mein eigener Standort');
  assert.equal(second.state.updates.at(-1)[0].switches[0].id,saved.switches[0].id);
  assert.equal(second.state.updates.at(-1)[0].switches[0].conditions.length,2);
  assert.equal(second.state.updates.at(-1)[0].switches[0].mode,'any');
});
for(const language of ['de','en','fr','es'])test(`compact copy icon, independent copy and changing threshold units in ${language}`,async t=>{
  const cfg={...structuredClone(germanExample),language};const {w,state,input}=await ui(t,cfg),tr=key=>I18n.translate(language,key);
  const button=w.document.querySelector('.copy-device');assert.equal(button.textContent,'⧉');assert.equal(button.title,tr('Kopieren'));assert.equal(button.getAttribute('aria-label'),tr('Kopieren'));assert.equal(button.querySelector('span').getAttribute('aria-hidden'),'true');
  button.click();await tick();const saved=state.updates.at(-1)[0];assert.notEqual(saved.switches[0].id,saved.switches[1].id);assert.deepEqual(saved.switches[0].conditions,saved.switches[1].conditions);
  const row=w.document.querySelector('.device-settings .row');const metric=row.querySelector('[data-field="metric"] select');
  for(const [value,unit]of [['temperature','°C'],['humidity','%'],['windSpeed','km/h'],['windGusts','km/h']]){
    input(metric,value);await tick();assert.equal(row.querySelector('[data-field="threshold"] label').textContent,tr('Aktivierungsschwelle')+` (${unit})`);assert.equal(row.querySelector('[data-field="releaseThreshold"] label').textContent,tr('Rückschaltschwelle')+` (${unit})`);
  }
  input(row.querySelector('[data-field="threshold"] input'),60);await tick();assert.equal(state.updates.at(-1)[0].switches[1].conditions[0].threshold,30);
});
for(const language of ['de','en','fr','es'])test(`DWD hides light setting and Open-Meteo retains it in ${language}`,async t=>{
  const {w,input,field,state}=await ui(t,{...structuredClone(germanExample),language,showLightSensor:true});
  assert.equal(w.document.querySelector('[data-field="showLightSensor"] input').checked,true);
  input(field(I18n.translate(language,'Wetterdatenquelle')),'dwd');await tick();
  assert.equal(w.document.querySelector('[data-field="showLightSensor"]'),null);
  input(field(I18n.translate(language,'Wetterdatenquelle')),'open-meteo');await tick();
  assert.equal(w.document.querySelector('[data-field="showLightSensor"] input').checked,true);
  assert.equal(state.updates.at(-1)[0].showLightSensor,true);
});
for(const language of ['de','en','fr','es'])test(`precipitation controls, sum and current interval in ${language}`,async t=>{
  const fixture=statusFixture(),tr=key=>I18n.translate(language,key);fixture.current.values={precipitation:2.5};fixture.current.precipitationTime=fixture.to-60000;
  const {w,input}=await ui(t,{...structuredClone(germanExample),language},{},async()=>structuredClone(fixture));
  const row=()=>w.document.querySelector('.device-settings .row');
  input(row().querySelector('[data-field="metric"] select'),'precipitation');await tick();
  assert.ok(row().querySelector('[data-field="threshold"] label').textContent.endsWith('(mm)'));
  input(row().querySelector('[data-field="source"] select'),'forecast');await tick();
  assert.equal(row().querySelector('[data-field="metric"] select').selectedOptions[0].textContent,tr('Niederschlag (mm je Prognosestunde)'));
  assert.ok([...row().querySelector('[data-field="aggregation"] select').options].some(o=>o.value==='sum'));
  input(row().querySelector('[data-field="aggregation"] select'),'sum');await tick();
  assert.equal(row().querySelector('[data-field="metric"] select').selectedOptions[0].textContent,tr('Niederschlag (mm, Summe im Prognosezeitraum)'));
  input(row().querySelector('[data-field="source"] select'),'current');await tick();
  assert.equal(row().querySelector('[data-field="metric"] select').selectedOptions[0].textContent,tr('Niederschlag (mm, letzte Stunde)'));
  input(row().querySelector('[data-field="source"] select'),'forecast');await tick();
  input(row().querySelector('[data-field="metric"] select'),'temperature');await tick();assert.equal(row().querySelector('[data-field="aggregation"] select').value,'max');
  w.document.getElementById('view-status').click();await tick();assert.equal(w.document.querySelector('[data-metric="precipitation"] dd').textContent,'2.5 mm');
  assert.ok(w.document.getElementById('status-view').textContent.includes(tr('Niederschlagsintervall: {from} bis {to}').split('{from}')[0]));
  fixture.current.precipitationTime=fixture.to-fixture.current.staleAfter*1000-1;await w.weatherStatusView.refresh();assert.equal(w.document.querySelector('[data-metric="precipitation"] dd').textContent,tr('Nicht verfügbar'));
  const details={metric:'precipitation',source:'forecast',aggregation:'sum',startHours:0,endHours:6,sourceName:'DWD MOSMIX',switchName:'Rain',available:true,value:5,evaluatedAt:fixture.to,validFrom:fixture.to,validTo:fixture.to+21600000};
  fixture.current.switches[0].inputs=[{...details,index:0}];fixture.forecastInputs=[{time:fixture.to,switchId:'rain',conditionIndex:0,metric:'precipitation',value:5,count:1,min:5,max:5,details}];
  await w.weatherStatusView.refresh();const kind=w.document.getElementById('history-kind');kind.value='forecast';kind.dispatchEvent(new w.Event('change'));await tick();
  assert.ok(w.document.querySelector('.history-choice').textContent.includes(tr('Niederschlag (mm, Summe im Prognosezeitraum)')));
  assert.ok(w.WeatherHistory.csv(fixture,key=>tr(key)).includes(tr('Niederschlag (mm, Summe im Prognosezeitraum)')));
});
function statusFixture(){
  const now=Date.now();return {connection:'online',fresh:true,from:now-86400000,to:now,period:'day',current:{running:true,enableHistory:true,historyRetentionDays:365,locationName:'Live location',source:'DWD',weatherTime:now-1000,staleAfter:7200,switches:[{id:'windwarnung',name:'Real switch',state:false,available:true}]},samples:[{time:now-2000,received:now-1000,temperature:12,windSpeed:10,source:'DWD'}],hourly:[],events:[{id:1,time:now-3000,session:'s',switchId:'windwarnung',name:'Real switch',state:1,available:1},{id:2,time:now-1000,session:'s',switchId:'windwarnung',name:'Real switch',state:0,available:1}],sessions:[{id:'s',start:now-4000,last:now,end:null}]};
}
test('status lines, bars, points and legend retain adaptive colors across appearance changes',async t=>{
  const fixture=statusFixture();fixture.samples[0].precipitation=2;
  const {w}=await ui(t,undefined,{},async()=>structuredClone(fixture));
  w.document.getElementById('view-status').click();await tick();
  const graph=w.document.querySelector('.weather-chart'),line=graph.querySelector('.weather-line');
  assert.equal(line.style.stroke,'var(--chart-series-1)');
  assert.equal(graph.querySelector('.weather-point').style.fill,'var(--chart-series-1)');
  assert.equal(graph.querySelector('.weather-series-legend i').style.backgroundColor,'var(--chart-series-1)');
  assert.equal(w.document.querySelector('.weather-bar').getAttribute('fill'),'var(--chart-series-1)');
  w.document.body.className='modal-content config-ui-x-purple dark-mode';await tick();
  assert.equal(w.document.documentElement.dataset.weatherTheme,'dark');
  assert.equal(graph.querySelector('.weather-line'),line);
  w.document.body.classList.remove('dark-mode');await tick();assert.equal(w.document.documentElement.dataset.weatherTheme,'light');
});
for(const language of ['de','en','fr','es'])test(`status, periods, CSV and confirmed clear in ${language}`,async t=>{
  let fixture=statusFixture();const calls=[];
  const requester=async(path,body)=>{calls.push({path,body});if(path==='/clear-history'){fixture={...fixture,samples:[],hourly:[],events:[]};return {cleared:true};}return structuredClone(fixture);};
  const {w}=await ui(t,{...structuredClone(germanExample),language},{},requester),tr=key=>I18n.translate(language,key);
  w.document.getElementById('view-status').click();await tick();const view=w.document.getElementById('status-view');assert.equal(view.hidden,false);assert.equal(w.document.getElementById('settings-view').hidden,true);
  assert.equal(view.querySelector('.status-switch .status-pill').textContent,tr('Inaktiv'));assert.equal(view.querySelectorAll('svg').length,3);
  const selector=w.document.getElementById('history-period');for(const period of ['week','month','year','day']){selector.value=period;selector.dispatchEvent(new w.Event('change'));await tick();assert.equal(calls.at(-1).body.period,period);}
  let exported=null;w.URL.createObjectURL=blob=>{exported=blob;return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.document.addEventListener('click',e=>{if(e.target.tagName==='A'&&e.target.download)e.preventDefault();});
  const exportButton=[...view.querySelectorAll('button')].find(b=>b.textContent===tr('CSV exportieren'));exportButton.click();assert.ok(exported);
  fixture={...fixture,connection:'offline',fresh:false};await w.weatherStatusView.refresh();assert.equal(view.querySelector('.status-switch .status-pill').textContent,tr('Unbekannt'));assert.match(view.textContent,new RegExp(tr('Laufzeit nicht erreichbar')));
  fixture={...fixture,connection:'online',current:{...fixture.current,enableHistory:false}};await w.weatherStatusView.refresh();assert.ok(view.textContent.includes(tr('Aufzeichnung ausgeschaltet – keine neuen Verlaufsdaten')));
  const clear=[...view.querySelectorAll('button')].find(b=>b.textContent===tr('Verlauf löschen'));w.confirm=()=>false;clear.click();await tick();assert.equal(calls.some(c=>c.path==='/clear-history'),false);
  w.confirm=()=>true;clear.click();await tick();await tick();assert.equal(calls.find(c=>c.path==='/clear-history').body.confirmed,true);assert.ok(view.textContent.includes(tr('Noch keine gespeicherten Daten in diesem Zeitraum. Keine Vergangenheit wird ergänzt.')));assert.equal(exportButton.disabled,true);
});
for(const language of ['de','en','fr','es'])test(`current weather shows provider values without recording and hides invalid data in ${language}`,async t=>{
  const fixture=statusFixture(),tr=key=>I18n.translate(language,key);
  fixture.current.enableHistory=false;fixture.current.source='Open-Meteo (Modell)';
  fixture.current.values={temperature:0,humidity:70,windSpeed:12.3,windGusts:25,cloudCover:null};
  fixture.samples=[];fixture.events=[];
  const {w}=await ui(t,{...structuredClone(germanExample),language},{},async()=>structuredClone(fixture));
  w.document.getElementById('view-status').click();await tick();
  const table=w.document.querySelector('.current-weather'),value=metric=>table.querySelector(`[data-metric="${metric}"] dd`).textContent;
  assert.equal(value('temperature'),'0.0 °C');assert.equal(value('humidity'),'70.0 %');assert.equal(value('windSpeed'),'12.3 km/h');assert.equal(value('windGusts'),'25.0 km/h');assert.equal(value('cloudCover'),tr('Nicht verfügbar'));
  assert.ok(w.document.getElementById('status-view').textContent.includes('Open-Meteo (Modell)'));
  fixture.fresh=false;await w.weatherStatusView.refresh();assert.ok([...w.document.querySelectorAll('.current-weather dd')].every(n=>n.textContent===tr('Nicht verfügbar')));
  fixture.fresh=true;fixture.connection='offline';await w.weatherStatusView.refresh();assert.equal(w.document.querySelector('[data-metric="temperature"] dd').textContent,tr('Nicht verfügbar'));
  fixture.connection='online';fixture.current.openMeteoBlocked=true;await w.weatherStatusView.refresh();assert.equal(w.document.querySelector('[data-metric="temperature"] dd').textContent,tr('Nicht verfügbar'));
});

for(const language of ['de','en','fr','es'])test(`checkboxes combine compatible units, separate charts and switch bars/lines in ${language}`,async t=>{
  const fixture=statusFixture(),calls=[],tr=key=>I18n.translate(language,key),time=fixture.to-3600000;
  fixture.samples=[{time,precipitationTime:time,temperature:-3,humidity:70,cloudCover:80,windSpeed:10,windGusts:20,precipitation:0,source:'DWD'},{time:time+1800000,precipitationTime:time,temperature:2,humidity:75,cloudCover:90,windSpeed:15,windGusts:25,precipitation:0,source:'DWD'}];
  for(const sample of fixture.samples)sample.received=sample.time+1000;
  const {w}=await ui(t,{...structuredClone(germanExample),language},{},async(path,body)=>{calls.push({path,body});return structuredClone(fixture);});
  w.document.getElementById('view-status').click();await tick();const view=w.document.getElementById('status-view'),choice=metric=>view.querySelector(`.history-choice input[value="${metric}"]`),chart=unit=>[...view.querySelectorAll('.weather-chart')].find(n=>n.dataset.unit===unit);
  assert.equal(view.querySelectorAll('.history-choice input').length,7);assert.equal(view.querySelectorAll('.weather-chart').length,4);
  assert.equal(chart('km/h').querySelectorAll('g[data-series]').length,2);assert.equal(chart('%').querySelectorAll('g[data-series]').length,2);
  assert.equal(chart('mm').dataset.chartType,'bar');assert.equal(chart('mm').querySelectorAll('.weather-bar').length,1);assert.equal(chart('°C').dataset.chartType,'line');
  assert.ok(view.textContent.includes(tr('Die Auswahl ändert nur die Anzeige. Bei eingeschalteter Aufzeichnung werden alle verfügbaren Werte gespeichert.')));
  const requests=calls.length;choice('windGusts').click();assert.equal(chart('km/h').querySelectorAll('g[data-series]').length,1);assert.equal(calls.length,requests);
  choice('windSpeed').click();assert.equal(chart('km/h'),undefined);await w.weatherStatusView.refresh();assert.equal(choice('windSpeed').checked,false);assert.equal(choice('windGusts').checked,false);
  const type=w.document.getElementById('history-chart-type');type.value='bar';type.dispatchEvent(new w.Event('change'));assert.ok([...view.querySelectorAll('.weather-chart svg')].every(n=>n.dataset.chartType==='bar'));
  assert.ok([...view.querySelectorAll('.weather-bar')].every(n=>Number(n.getAttribute('height'))>=0&&!n.outerHTML.includes('NaN')));
  type.value='line';type.dispatchEvent(new w.Event('change'));assert.equal(chart('mm').querySelectorAll('.weather-bar').length,0);assert.ok(chart('mm').querySelector('.weather-line'));
  for(const input of [...view.querySelectorAll('.history-choice input:checked')])input.click();assert.equal(view.querySelectorAll('.weather-chart').length,0);assert.ok(view.textContent.includes(tr('Keine Verläufe ausgewählt.')));assert.ok(w.WeatherHistory.csv(fixture).includes('Windböen'));
});
test('line charts keep missing values and large time gaps disconnected',async t=>{
  const fixture=statusFixture(),time=fixture.to-18000000;fixture.samples=[{time,temperature:1},{time:time+600000,temperature:null},{time:time+1200000,temperature:3},{time:time+14400000,temperature:5}];
  const {w}=await ui(t,undefined,{},async()=>structuredClone(fixture));w.document.getElementById('view-status').click();await tick();
  const line=w.document.querySelector('.weather-chart[data-unit="°C"] .weather-line');assert.equal((line.getAttribute('d').match(/M/g)||[]).length,3);
});
test('forecast checkboxes retain separate windows and user selection through refresh',async t=>{
  const fixture=statusFixture(),now=fixture.to;
  const detail=(end,value)=>({source:'forecast',metric:'precipitation',aggregation:'sum',startHours:0,endHours:end,sourceName:'DWD MOSMIX',switchName:'Rain',available:true,value,evaluatedAt:now,validFrom:now,validTo:now+end*3600000});
  fixture.forecastInputs=[3,6].map((end,index)=>({time:now,switchId:'rain',conditionIndex:index,metric:'precipitation',value:end,details:detail(end,end)}));
  const {w}=await ui(t,undefined,{},async()=>structuredClone(fixture));w.document.getElementById('view-status').click();await tick();const kind=w.document.getElementById('history-kind');kind.value='forecast';kind.dispatchEvent(new w.Event('change'));await tick();
  assert.equal(w.document.querySelectorAll('.weather-chart svg').length,2);assert.equal(w.document.querySelectorAll('.history-choice input:checked').length,2);
  w.document.querySelector('.history-choice input').click();assert.equal(w.document.querySelectorAll('.weather-chart svg').length,1);await w.weatherStatusView.refresh();assert.equal(w.document.querySelectorAll('.history-choice input:checked').length,1);
  w.document.querySelector('.history-choice input:checked').click();assert.equal(w.document.querySelectorAll('.weather-chart').length,0);await w.weatherStatusView.refresh();assert.equal(w.document.querySelectorAll('.history-choice input:checked').length,0);
});

test('status request failure never presents configured switches as actual live states',async t=>{
  const {w}=await ui(t,undefined,{},async()=>{throw Error('offline');});w.document.getElementById('view-status').click();await tick();assert.equal(w.document.querySelectorAll('.status-switch').length,0);assert.match(w.document.getElementById('status-view').textContent,/Keine Verbindung/);
});
for(const language of ['de','en','fr','es'])test(`forecast/cloud rule controls and persistent private consent in ${language}`,async t=>{
  const cfg={...structuredClone(germanExample),language},tr=key=>I18n.translate(language,key);
  const {w,state,field,input}=await ui(t,cfg);
  const consent=field(tr('Ich bestätige die private, nicht gewerbliche Nutzung dieses Open-Meteo-Zugangs'));
  assert.equal(consent.checked,false);assert.ok(w.document.getElementById('message').textContent.includes(tr('Open-Meteo gesperrt: Zustimmung zur privaten, nicht gewerblichen Nutzung fehlt.')));
  input(consent,true);await tick();let saved=state.updates.at(-1)[0];assert.equal(saved._openMeteoConsentVersion,require('../homebridge-ui/public/config').CONSENT_VERSION);
  const source=w.document.querySelector('[data-field="source"] select');input(source,'forecast');await tick();
  assert.equal(field(tr('Vorhersage auswerten')).value,'max');assert.equal(field(tr('Ende/Zeitpunkt (Stunden voraus)')).value,'6');
  input(field(tr('Wetterwert')),'cloudCover');input(field(tr('Vorhersage auswerten')),'min');await tick();
  input(field(tr('Beginn (Stunden voraus)')),2);input(field(tr('Ende/Zeitpunkt (Stunden voraus)')),8);input(field(tr('Aktivierungsschwelle')),80);input(field(tr('Rückschaltschwelle')),60);await tick();
  assert.equal(w.document.querySelector('[data-field="threshold"] label').textContent,tr('Aktivierungsschwelle')+' (%)');saved=structuredClone(state.updates.at(-1)[0]);
  const reopened=await ui(t,saved);assert.equal(reopened.field(tr('Daten für diese Bedingung')).value,'forecast');assert.equal(reopened.field(tr('Vorhersage auswerten')).value,'min');assert.equal(reopened.field(tr('Ende/Zeitpunkt (Stunden voraus)')).value,'8');
  const allowed=reopened.field(tr('Ich bestätige die private, nicht gewerbliche Nutzung dieses Open-Meteo-Zugangs'));assert.equal(allowed.checked,true);reopened.input(allowed,false);await tick();assert.equal(reopened.state.updates.at(-1)[0]._openMeteoConsentVersion,undefined);
  reopened.input(reopened.field(tr('Wetterdatenquelle')),'dwd');await tick();assert.equal(reopened.w.document.querySelector('[data-field="openMeteoPrivateConsent"]'),null);assert.equal(reopened.state.enabled,true);
});
test('old consent versions are reset to an unchecked checkbox without silently renewing consent',async t=>{
  const {w,state,field}=await ui(t,{...structuredClone(germanExample),openMeteoPrivateConsent:true,_openMeteoConsentVersion:'old'});assert.equal(field('Ich bestätige die private, nicht gewerbliche Nutzung dieses Open-Meteo-Zugangs').checked,false);assert.equal(state.updates.at(-1)[0].openMeteoPrivateConsent,false);assert.ok(w.document.getElementById('message').textContent.includes('Zustimmung'));
});
for(const language of ['de','en','fr','es'])test(`forecast status and archive graph stay separate from current cloud in ${language}`,async t=>{
  const fixture=statusFixture(),now=fixture.to,tr=key=>I18n.translate(language,key);
  const detail={index:0,source:'forecast',metric:'cloudCover',aggregation:'max',startHours:0,endHours:6,available:true,value:80,sourceName:'DWD MOSMIX Test point (10384)',issuedAt:now-3600000,fetchedAt:now-1000,validFrom:now+3600000,validTo:now+6*3600000,evaluatedAt:now-1000,switchName:'Real switch'};
  fixture.current.provider='dwd';fixture.current.values={cloudCover:20};fixture.current.station={name:'Actual station',id:'10384',distance:5.9,windHeight:10};fixture.current.switches[0].inputs=[detail];fixture.forecastInputs=[{time:now-1000,switchId:'windwarnung',conditionIndex:0,metric:'cloudCover',value:80,min:70,max:80,count:2,details:detail}];
  const {w}=await ui(t,{...structuredClone(germanExample),language},{},async()=>structuredClone(fixture));w.document.getElementById('view-status').click();await tick();
  const view=w.document.getElementById('status-view');assert.ok(view.textContent.includes('20.0 %'));assert.ok(view.textContent.includes('80.0 %'));assert.ok(view.textContent.includes('Actual station'));assert.ok(view.textContent.includes('DWD MOSMIX Test point'));
  const kind=w.document.getElementById('history-kind');kind.value='forecast';kind.dispatchEvent(new w.Event('change'));await tick();assert.ok(view.textContent.includes(tr('Prognose-Regelwerte')));assert.equal(w.document.getElementById('history-metric'),null);assert.equal(w.document.querySelectorAll('.history-choice input').length,1);assert.equal(w.document.querySelectorAll('.weather-point').length,1);
  fixture.current.switches[0].inputs[0].available=false;fixture.current.switches[0].inputs[0].reason='stale';await w.weatherStatusView.refresh();assert.ok(view.textContent.includes(tr('Prognose veraltet oder nicht vorhanden.')));
  const csv=w.WeatherHistory.csv(fixture,(key,values)=>I18n.translate(language,key,values));assert.ok(csv.includes(tr('Vorhersage')));assert.ok(csv.includes(tr('Aktuell')));assert.ok(csv.includes(tr('Prognose-Ausgabe UTC')));
});

for(const language of ['de','en','fr','es'])test(`HomeKit name preview preserves saved user name and explains provider HTTP errors in ${language}`,async t=>{
  const fixture=statusFixture();fixture.current.lastError='Wetterdienst HTTP 503';const tr=key=>I18n.translate(language,key),cfg={...structuredClone(germanExample),language};cfg.switches[0].name='Temp. >8°C';
  const {w,state,input}=await ui(t,cfg,{},async()=>structuredClone(fixture));
  const field=w.document.querySelector('.device-settings [data-field="name"]'),name=require('../homebridge-ui/public/config').homeKitName(cfg.switches[0].name,language);
  assert.ok(field.querySelector('.homekit-name-hint').textContent.includes(name));assert.equal(state.updates.at(-1)[0].switches[0].name,cfg.switches[0].name);
  input(field.querySelector('input'),'Terrasse');await tick();assert.equal(field.querySelector('.homekit-name-hint').hidden,true);
  w.document.getElementById('view-status').click();await tick();assert.ok(w.document.getElementById('status-view').textContent.includes(I18n.translate(language,'Wetterdienst meldet HTTP {code}.',{code:503})));
});


for(const language of ['de','en','fr','es'])test(`local station card, source controls, live data and separate archive in ${language}`,async t=>{
  const fixture=statusFixture(),tr=key=>I18n.translate(language,key),calls=[];
  fixture.fresh=false;fixture.localSamples=[{time:fixture.to-5000,received:fixture.to,windSpeed:12,illuminance:15000,raining:1,source:'Shelly WS90'}];fixture.localHourly=[];
  fixture.current.localStation={enabled:true,host:'192.0.2.1',shellyDeviceId:'shelly-test-aabbccddeeff',deviceComponent:'bthomedevice:200',staleAfter:120,sample:{values:{windSpeed:12,illuminance:15000,raining:1},metricTimes:{windSpeed:fixture.to-5000,illuminance:fixture.to-5000,raining:fixture.to-5000},sensors:{windSpeed:'bthomesensor:213'},extras:{}}};
  fixture.current.switches[0].inputs=[{source:'current',index:0,metric:'windSpeed',origin:'weather',requestedSource:'prefer-local',fallback:true,available:true,value:30,sourceName:'DWD',validTo:fixture.to}];
  const {w,state,input,field}=await ui(t,{...structuredClone(germanExample),language},{},async(path,body)=>{calls.push({path,body});return structuredClone(fixture);});
  const cards=[...w.document.getElementById('settings').children];assert.equal(cards[0].dataset.key,'general');assert.equal(cards[1].dataset.key,'local-station');assert.ok(cards[2].classList.contains('device-settings'));
  input(field(tr('Shelly-IP-Adresse oder Hostname')),'192.0.2.1');input(field(tr('Shelly-Hardware-ID')),'shelly-test-aabbccddeeff');input(field(tr('BTHome-Geräte-ID')),'200');input(field(tr('Windsensor-ID (optional)')),'213');input(field(tr('Böensensor-ID (optional)')),'218');input(field(tr('Shelly-Passwort (optional)')),'secret-ui-password');input(field(tr('Shelly-Wetterstation aktivieren')),true);await tick();assert.equal(state.enabled,true);assert.equal(field(tr('Shelly-Passwort (optional)')).type,'password');assert.equal(calls.length,0);
  let row=w.document.querySelector('.device-settings .row');input(row.querySelector('[data-field="dataSource"] select'),'prefer-local');await tick();const saved=structuredClone(state.updates.at(-1)[0]);assert.equal(saved.localStation.enabled,true);assert.equal(saved.switches[0].conditions[0].dataSource,'prefer-local');assert.equal(saved.localStation.windSpeedComponent,'213');
  const again=await ui(t,saved);assert.equal(again.field(tr('BTHome-Geräte-ID')).value,'200');assert.equal(again.field(tr('Windsensor-ID (optional)')).value,'213');
  row=w.document.querySelector('.device-settings .row');input(row.querySelector('[data-field="metric"] select'),'illuminance');await tick();row=w.document.querySelector('.device-settings .row');assert.equal(row.querySelector('[data-field="threshold"] input').max,'1000000');
  input(row.querySelector('[data-field="source"] select'),'forecast');await tick();row=w.document.querySelector('.device-settings .row');assert.equal(row.querySelector('[data-field="dataSource"]'),null);assert.equal(row.querySelector('[data-field="metric"] select').value,'illuminance');assert.equal(state.enabled,false);input(row.querySelector('[data-field="metric"] select'),'temperature');await tick();
  w.document.getElementById('view-status').click();await tick();assert.equal(w.document.querySelector('.local-weather [data-metric="windSpeed"] dd').textContent,'12.0 km/h');assert.ok(w.document.getElementById('status-view').textContent.includes(tr('Wetterdienst als Ersatz aktiv')));
  const kind=w.document.getElementById('history-kind');kind.value='local';kind.dispatchEvent(new w.Event('change'));await tick();assert.ok(w.document.querySelector('.weather-chart[data-unit="lux"] h4').textContent.includes(tr('Beleuchtungsstärke (lux)')));assert.ok(w.WeatherHistory.csv(fixture,key=>tr(key)).includes(tr('Lokale Stationsmessung')));
  fixture.current.localStation.sample.metricTimes.windSpeed=fixture.to-121000;await w.weatherStatusView.refresh();assert.equal(w.document.querySelector('.local-weather [data-metric="windSpeed"] dd').textContent,tr('Nicht verfügbar'));
});


test('local-only hourly history uses hourly continuity and labels without external measurements',async t=>{
  const fixture=statusFixture();fixture.samples=[];fixture.hourly=[];fixture.localSamples=[];fixture.localHourly=[{time:fixture.to-7200000,metric:'windSpeed',mean:10},{time:fixture.to-3600000,metric:'windSpeed',mean:12}];
  const {w}=await ui(t,undefined,{},async()=>structuredClone(fixture));w.document.getElementById('view-status').click();await tick();const kind=w.document.getElementById('history-kind');kind.value='local';kind.dispatchEvent(new w.Event('change'));await tick();
  const panel=w.document.querySelector('.weather-chart[data-unit="km/h"]');assert.ok(panel.querySelector('.weather-line').getAttribute('d').includes('L'));assert.ok(w.document.getElementById('status-view').textContent.includes('Ältere Wetterdaten: Stundenmittel'));
});


for(const language of ['de','en','fr','es'])test(`current hourly precipitation remains visible after 45 minutes with fresh weather in ${language}`,async t=>{
  const fixture=statusFixture(),hour=3600000;fixture.to=Math.floor(fixture.to/hour)*hour+45*60000;fixture.current.weatherTime=fixture.to;fixture.current.staleAfter=1800;fixture.current.precipitationTime=Math.floor(fixture.to/hour)*hour;fixture.current.values={precipitation:0};
  const {w}=await ui(t,{...structuredClone(germanExample),language},{},async()=>structuredClone(fixture));w.document.getElementById('view-status').click();await tick();
  assert.equal(w.document.querySelector('.current-weather [data-metric="precipitation"] dd').textContent,'0.0 mm');
  fixture.current.weatherTime=fixture.to-1800001;fixture.fresh=false;await w.weatherStatusView.refresh();assert.equal(w.document.querySelector('.current-weather [data-metric="precipitation"] dd').textContent,I18n.translate(language,'Nicht verfügbar'));
});

test('all visible schema and static UI strings have four translations with intact placeholders',()=>{
  const {dictionary}=I18n;
  for(const row of Object.values(dictionary)) {
    assert.equal(row.length,4,row[0]);
    const tokens=s=>[...s.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
    for(const translation of row) {assert.ok(translation.trim());assert.deepEqual(tokens(translation),tokens(row[0]),row[0]);}
  }
  function visit(props) {
    for(const [key,d] of Object.entries(props)) {
      if(key.startsWith('_'))continue;
      if(d.type==='array'){visit(d.items.properties);continue;}
      assert.ok(dictionary[d.title],d.title);
      if(d.description)assert.ok(dictionary[d.description],d.description);
      if(key!=='language')for(const label of d.enumNames||[])assert.ok(dictionary[label],label);
    }
  }
  visit(require('../config.schema.json').schema.properties);
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'));
  for(const node of dom.window.document.querySelectorAll('[data-i18n]'))assert.ok(dictionary[node.getAttribute('data-i18n')||node.textContent],node.textContent);
  dom.window.close();
});
