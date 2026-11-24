'use strict';
const {validate,openMeteoAllowed,homeKitName} = require('./homebridge-ui/public/config');
const {translate}=require('./homebridge-ui/public/i18n');
const {Rule} = require('./lib/rules');
const {fetchWeather} = require('./lib/weather');
const {fetchDwd} = require('./lib/dwd');
const {HistoryStore,databasePath,locationKey,clearHistory}=require('./lib/history');
const {startStatusServer}=require('./lib/status-ipc');
const {hasForecast,fetchMosmix,forecastInput}=require('./lib/forecast');
const {savedConsentAllowed}=require('./lib/consent');
const {ShellyWeatherClient,localNamespace}=require('./lib/shelly-weather');
const {currentInput}=require('./lib/inputs');
const PLUGIN = 'homebridge-weather-switches', PLATFORM = 'WeatherSwitches';
class WeatherPlatform {
  constructor(log, config, api) {
    this.log = log; this.api = api; this.cache = new Map(); this.records = []; this.running = false;
    try { this.config = validate(config || {}); }
    catch (e) { log.error(`Wetterschalter deaktiviert: ${e.message}`); return; }
    api.on('didFinishLaunching', () => this.launch());
    api.on('shutdown', () => this.stop());
  }
  configureAccessory(accessory) {
    this.cache.set(accessory.UUID, accessory);
    // Cached values must not appear fresh before launch or with invalid configuration.
    const {Service,Characteristic:C,HAPStatus}=this.api.hap;
    for (const service of accessory.services) if (service.UUID!==Service.AccessoryInformation.UUID) {
      for (const c of service.characteristics) if (c.UUID!==C.Name.UUID) c.onGet(()=>{throw this.error(HAPStatus.SERVICE_COMMUNICATION_FAILURE);});
    }
  }
  error(status) { return new this.api.hap.HapStatusError(status); }
  launch() {
    if (this.running) return;
    this.running = true;
    try{if(this.config.enableHistory)this.history=this.createHistoryStore();}
    catch(e){this.historyError=e.message;this.log.warn(`Verlauf nicht verfügbar: ${e.message}`);}
    this.startStatusServer();
    const {Service, Characteristic: C, HAPStatus, uuid} = this.api.hap;
    const allowed = new Set();
    const t=key=>translate(this.config.language,key);
    const locationName=homeKitName(this.config.name,this.config.language);
    const showLightSensor=this.config.provider==='open-meteo'&&this.config.showLightSensor;
    if (this.config.showSensors || showLightSensor) {
      const id = uuid.generate(`${PLUGIN}:weather-sensors`); allowed.add(id);
      let a = this.cache.get(id), fresh = !a;
      if (!a) a = new this.api.platformAccessory(locationName, id);
      a.displayName = locationName;
      a.getService(Service.AccessoryInformation).setCharacteristic(C.Name, locationName)
        .setCharacteristic(C.Manufacturer, this.config.provider === 'dwd' ? 'Deutscher Wetterdienst' : 'Open-Meteo').setCharacteristic(C.Model, this.config.provider === 'dwd' ? 'Stationsbeobachtungen' : 'Modellbasierte Wetterdaten')
        .setCharacteristic(C.SerialNumber, 'weather-location').setCharacteristic(C.FirmwareRevision, require('./package.json').version);
      this.sensors = [
        {service: a.getService(Service.TemperatureSensor) || a.addService(Service.TemperatureSensor, homeKitName(`${this.config.name} ${t('Temperatur')}`,this.config.language)), characteristic: C.CurrentTemperature, metric: 'temperature'},
        {service: a.getService(Service.HumiditySensor) || a.addService(Service.HumiditySensor, homeKitName(`${this.config.name} ${t('Luftfeuchtigkeit')}`,this.config.language)), characteristic: C.CurrentRelativeHumidity, metric: 'humidity'},
      ];
      if (!this.config.showSensors) {
        for (const s of this.sensors) a.removeService(s.service);
        this.sensors = [];
      }
      const oldLight=a.getService(Service.LightSensor);
      if (showLightSensor) this.sensors.push({service:oldLight || a.addService(Service.LightSensor, t('Licht geschätzt Modell')),characteristic:C.CurrentAmbientLightLevel,metric:'illuminance'});
      else if (oldLight) a.removeService(oldLight);
      for (const s of this.sensors) {
        const name=s.metric==='illuminance' ? t(this.config.provider==='dwd' ? 'Licht geschätzt Stundenmittel' : 'Licht geschätzt Modell') : `${this.config.name} ${t(s.metric==='temperature'?'Temperatur':'Luftfeuchtigkeit')}`;
        s.service.displayName=homeKitName(name,this.config.language);s.service.setCharacteristic(C.Name,s.service.displayName);
        if (s.metric === 'temperature') s.service.getCharacteristic(s.characteristic).setProps({minValue: -100, maxValue: 100});
        s.service.getCharacteristic(s.characteristic).onGet(() => {
          if (!this.isFresh() || !Number.isFinite(this.sample.values[s.metric])) throw this.error(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
          return this.sample.values[s.metric];
        });
      }
      if (fresh) this.api.registerPlatformAccessories(PLUGIN, PLATFORM, [a]);
      else this.api.updatePlatformAccessories([a]);
    }
    for (const config of this.config.switches) {
      const name=homeKitName(config.name,this.config.language);
      const id = uuid.generate(`${PLUGIN}:switch:${config.id}`); allowed.add(id);
      let a = this.cache.get(id), fresh = !a;
      if (!a) a = new this.api.platformAccessory(name, id);
      a.displayName = name;
      a.context = {switchId: config.id};
      a.getService(Service.AccessoryInformation)
        .setCharacteristic(C.Name, name).setCharacteristic(C.Manufacturer, 'Weather Switches')
        .setCharacteristic(C.Model, 'Wetter-Regelschalter').setCharacteristic(C.SerialNumber, config.id)
        .setCharacteristic(C.FirmwareRevision, require('./package.json').version);
      const service = a.getService(Service.Switch) || a.addService(Service.Switch, name);
      service.displayName=name;service.setCharacteristic(C.Name, name);
      const record = {config, rule: new Rule(config), service, unavailable: true};
      record.rule.unavailable();
      service.getCharacteristic(C.On).onGet(() => {
        this.evaluate();
        if (record.unavailable && config.failureState === 'hold') throw this.error(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        return record.rule.state;
      }).onSet(() => { throw this.error(HAPStatus.READ_ONLY_CHARACTERISTIC); });
      this.records.push(record);
      if (fresh) this.api.registerPlatformAccessories(PLUGIN, PLATFORM, [a]);
      else this.api.updatePlatformAccessories([a]);
    }
    for (const [id, a] of this.cache) if (!allowed.has(id)) this.api.unregisterPlatformAccessories(PLUGIN, PLATFORM, [a]);
    this.evaluate();
    if(this.config.localStation.enabled)this.pollLocal();
    if (!this.records.length && !this.sensors?.length&&!this.config.localStation.enabled) return;
    this.poll();
    this.watchdog = setInterval(() => this.evaluate(), 1000);
    this.watchdog.unref?.();
    this.log.info(this.config.provider === 'dwd' ? 'Datenbasis: Deutscher Wetterdienst, https://opendata.dwd.de/ (CC BY 4.0); Stationsbeobachtungen.' : 'Wetterdaten: https://open-meteo.com/ (CC BY 4.0); modellbasierte virtuelle Schalter.');
  }
  isFresh(now = Date.now()) {
    return Boolean(this.sample && now - this.sample.time <= this.config.staleAfter * 1000 && now >= this.sample.time - 60000);
  }
  evaluate(now = Date.now()) {
    let changed=false;
    const valid = this.isFresh(now);
    for (const s of this.sensors || []) {
      const available = valid && Number.isFinite(this.sample.values[s.metric]);
      const value = available ? this.sample.values[s.metric] : null;
      if (s.last !== value || s.last === undefined) {
        s.service.updateCharacteristic(s.characteristic, available ? value : this.error(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        s.last = value;
      }
    }
    for (const r of this.records) {
      const previous = r.rule.state, wasUnavailable = r.unavailable;
      r.inputs=r.config.conditions.map((condition,index)=>{
        if(condition.source==='forecast')return {...forecastInput(condition,this.forecast,this.config,now),index};
        return {...currentInput(condition,this.sample,this.localSample,this.config,now),index};
      });
      const sourceSignature=JSON.stringify(r.inputs.map(input=>[input.source,input.origin,input.fallback||false,input.available]));
      const sourceChanged=r.sourceSignature!==undefined&&r.sourceSignature!==sourceSignature;r.sourceSignature=sourceSignature;
      const available = r.inputs.every(input=>input.available);
      r.unavailable = !available;
      const state = available ? r.rule.evaluate(r.inputs.map(input=>input.value), now) : r.rule.unavailable();
      if (previous !== state || wasUnavailable !== r.unavailable || r.published === undefined||sourceChanged) {
        changed=true;
        const {Characteristic: C, HAPStatus} = this.api.hap;
        r.service.updateCharacteristic(C.On, !available && r.config.failureState === 'hold' ? this.error(HAPStatus.SERVICE_COMMUNICATION_FAILURE) : state);
        r.published = state;
        this.recordHistory(()=>this.history?.event(r,now));
        if (previous !== state) this.log.info(`${r.config.name}: ${state ? 'EIN' : 'AUS'}${available ? '' : ' (Fehlerverhalten)'}`);
      }
      else if(this.recordBaseline)this.recordHistory(()=>this.history?.event(r,now));
    }
    this.recordBaseline=false;
    if(changed||!this.lastHeartbeat||now-this.lastHeartbeat>=30000){this.publishStatus(now);this.lastHeartbeat=now;}
  }
  createHistoryStore(){return new HistoryStore(databasePath(this.api.user.storagePath()),this.config);}
  async startStatusServer(){
    try{
      const server=await startStatusServer(this.api.user.storagePath(),action=>{
        if(action==='clear'){
          if(this.history)this.history.clear();else clearHistory(databasePath(this.api.user.storagePath()));
          this.needsHistoryBaseline=true;this.publishStatus();return {cleared:true};
        }
        return this.statusSnapshot();
      });
      if(!this.running)server.close();else this.statusServer=server;
    }catch(e){this.log.warn(`Statusanzeige nicht verfügbar: ${e.message}`);}
  }
  recordHistory(action){try{action();}catch(e){if(!this.historyError)this.log.warn(`Verlauf nicht verfügbar: ${e.message}`);this.historyError=e.message;}}
  publishStatus(now=Date.now()){
    this.currentStatus={running:this.running,provider:this.config.provider,openMeteoBlocked:this.config.provider==='open-meteo'&&(!openMeteoAllowed(this.config)||this.openMeteoConsentBlocked===true),locationName:this.config.name,latitude:this.config.latitude,longitude:this.config.longitude,timeZone:this.config.timeZone,staleAfter:this.config.staleAfter,pollInterval:this.config.pollInterval,enableHistory:this.config.enableHistory,historyRetentionDays:this.config.historyRetentionDays,
      weatherTime:this.sample?.time??null,precipitationTime:this.sample?.precipitationTime??null,values:this.sample?.values||{},station:this.sample?.station||null,source:this.sample?.source||(this.config.provider==='dwd'?'DWD':'Open-Meteo'),lastError:this.lastError||null,historyError:this.historyError||null,
      forecast:this.forecast?{source:this.forecast.source,issuedAt:this.forecast.issuedAt,fetchedAt:this.forecast.fetchedAt,station:this.forecast.station||null,validFrom:this.forecast.rows[0]?.time,validTo:this.forecast.rows.at(-1)?.time}:null,lastForecastError:this.lastForecastError||null,
      localStation:{enabled:this.config.localStation.enabled,host:this.config.localStation.host,shellyDeviceId:this.config.localStation.shellyDeviceId,deviceComponent:this.config.localStation.deviceComponent,staleAfter:this.config.localStation.staleAfter,sample:this.localSample||null,lastError:this.lastLocalError||null,ns:localNamespace(this.config,this.localSample)},
      switches:this.records.map(r=>({id:r.config.id,name:r.config.name,state:r.rule.state,available:!r.unavailable,failureState:r.config.failureState,inputs:r.inputs||[]})),ns:locationKey(this.config),session:this.history?.session||null,historyStartedAt:this.history?.historyStartedAt??null,updatedAt:now};
    this.recordHistory(()=>this.history?.heartbeat(this.currentStatus,now));
  }
  statusSnapshot(){this.evaluate();this.publishStatus();return this.currentStatus;}
  async pollLocal(){
    if(!this.running||this.localBusy||!this.config.localStation.enabled)return;
    this.localBusy=true;this.localController=new AbortController();
    try{
      const sample=await this.getLocalWeather(this.localController.signal);if(!this.running)return;
      this.localSample=sample;this.lastLocalError=null;
      const grouped=new Map();for(const [metric,value]of Object.entries(sample.values)){
        const time=sample.metricTimes[metric];if(!Number.isFinite(time))continue;
        if(!grouped.has(time))grouped.set(time,{time,source:sample.source,values:{}});grouped.get(time).values[metric]=value;
      }
      for(const point of grouped.values())this.recordHistory(()=>this.history?.sample(point,Date.now(),localNamespace(this.config,sample)));
    }catch(error){if(this.running){if(!this.lastLocalError)this.log.warn('Lokale Wetterstation nicht verfügbar: '+error.message);this.lastLocalError=error.message;}}
    finally{this.localBusy=false;if(this.running){this.evaluate();this.publishStatus();this.localTimer=setTimeout(()=>this.pollLocal(),this.config.localStation.pollInterval*1000);this.localTimer.unref?.();}}
  }
  getLocalWeather(signal){this.localClient??=new ShellyWeatherClient(this.config.localStation);return this.localClient.read(signal);}
  async poll() {
    if (!this.running || this.busy) return;
    this.busy = true;
    this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 15000);
    try {
      const [weatherResult,forecastResult]=await Promise.allSettled([this.getWeather(this.controller.signal),this.getForecast(this.controller.signal)]);
      if (!this.running) return;
      const candidate=forecastResult.status==='fulfilled'?forecastResult.value:null;
      const forecast=candidate|| (weatherResult.status==='fulfilled'?weatherResult.value.forecast:null);
      const forecastError=forecastResult.status==='rejected'?forecastResult.reason?.message:weatherResult.status==='fulfilled'?weatherResult.value.forecastError:null;
      if(forecast){
        if(this.forecast?.issuedAt&&forecast.issuedAt&&forecast.issuedAt<this.forecast.issuedAt)this.lastForecastError='Prognose-Ausgabezeit ist rückwärts gesprungen.';
        else{this.forecast=forecast;this.lastForecastError=null;this.recordBaseline=this.needsHistoryBaseline;this.needsHistoryBaseline=false;}
      }else if(forecastError){if(!this.lastForecastError)this.log.warn(`Prognoseabruf fehlgeschlagen: ${forecastError}`);this.lastForecastError=forecastError;}
      if(weatherResult.status==='rejected')throw weatherResult.reason;
      const sample=weatherResult.value;
      if(sample.currentError)throw Error(sample.currentError);
      if (Date.now() - sample.time > this.config.staleAfter * 1000) throw new Error('Wetterdaten sind veraltet.');
      if (this.sample && sample.time < this.sample.time) throw new Error('Wetterzeitstempel ist rückwärts gesprungen.');
      if (sample.time !== this.sample?.time) this.log.info(`${sample.source || 'Open-Meteo (Modell)'}; Wetterzeitpunkt: ${new Date(sample.time).toISOString()}`);
      this.sample = sample;
      this.recordBaseline=this.recordBaseline||this.needsHistoryBaseline;this.needsHistoryBaseline=false;
      this.recordHistory(()=>this.history?.sample(sample));
      this.lastError=null;
      if (this.failed) this.log.info('Wetterabfrage wieder erfolgreich.');
      this.failed = false;
    } catch (e) {
      this.lastError=e.message;
      if (this.running && !this.failed) this.log.warn(`Wetterabfrage fehlgeschlagen: ${e.message}. Letzte Daten gelten nur bis zum maximalen Datenalter.`);
      this.failed = true;
    } finally {
      clearTimeout(timeout); this.busy = false;
      if (this.running) {
        this.evaluate();
        this.recordHistory(()=>this.history?.forecastInputs(this.records));
        this.publishStatus();
        this.timer = setTimeout(() => this.poll(), this.config.pollInterval * 1000);
        this.timer.unref?.();
      }
    }
  }
  getWeather(signal) {
    if(this.config.provider==='dwd')return fetchDwd(this.config,signal);
    const verifyConsent=()=>{
      this.openMeteoConsentBlocked=!savedConsentAllowed(this.config,this.api.user.configPath?.());
      if(this.openMeteoConsentBlocked){this.sample=null;this.forecast=null;throw Error('Open-Meteo gesperrt: Zustimmung zur privaten, nicht gewerblichen Nutzung fehlt.');}
    };
    verifyConsent();return fetchWeather(this.config,signal,undefined,{beforeRequest:verifyConsent});
  }
  getForecast(signal){
    if(this.config.provider!=='dwd'||!hasForecast(this.config))return;
    const now=Date.now();if(this.forecastLastAttempt&&now-this.forecastLastAttempt<this.config.forecastRefresh*1000)return;
    this.forecastLastAttempt=now;return fetchMosmix(this.config,signal);
  }
  stop() {
    this.running = false; clearTimeout(this.timer); clearInterval(this.watchdog); this.controller?.abort();
    clearTimeout(this.localTimer);this.localController?.abort();
    this.recordHistory(()=>this.history?.close());this.history=null;
    this.statusServer?.close();this.statusServer=null;
  }
}
module.exports = api => api.registerPlatform(PLUGIN, PLATFORM, WeatherPlatform);
module.exports.WeatherPlatform = WeatherPlatform;
