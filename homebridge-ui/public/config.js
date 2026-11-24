'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeatherConfig = factory();
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const metrics = ['temperature', 'humidity', 'windSpeed', 'windGusts','cloudCover','precipitation','illuminance','raining'];
  const CONSENT_VERSION='open-meteo-private-0.3.0-2026-11-02-v1';
  const openMeteoAllowed=config=>config.openMeteoPrivateConsent===true&&config._openMeteoConsentVersion===CONSENT_VERSION;
  function assertOpenMeteoConsent(config){if(!openMeteoAllowed(config))throw Error('Open-Meteo gesperrt: Zustimmung zur privaten, nicht gewerblichen Nutzung fehlt.');}
  function weatherValueFresh(sample,metric,staleAfter,now=Date.now()){
    const time=sample?.time;
    if(!Number.isFinite(time)||!Number.isFinite(staleAfter)||time>now+60000||now-time>staleAfter*1000)return false;
    if(metric!=='precipitation')return true;
    // A completed hourly amount is naturally up to an hour older than current
    // 15-minute weather fields. The provider sample must still be fresh, and
    // precipitation must belong to its latest completed hour, never an older one.
    const end=sample?.precipitationTime;
    return Number.isFinite(end)&&end<=now&&end<=time&&time-end<3600000&&now-end<=(staleAfter+3600)*1000;
  }
  function homeKitName(value,language='en'){
    const words={de:['über','unter','mindestens','höchstens','gleich','Grad','Prozent','Wettergerät'],en:['above','below','at least','at most','equals','degrees','percent','Weather device'],fr:['supérieur à','inférieur à','au moins','au plus','égal à','degrés','pour cent','Appareil météo'],es:['superior a','inferior a','al menos','como máximo','igual a','grados','por ciento','Dispositivo meteorológico']}[language]||['above','below','at least','at most','equals','degrees','percent','Weather device'];
    let name=String(value??'').normalize('NFC').replace(/>=|≥/g,' '+words[2]+' ').replace(/<=|≤/g,' '+words[3]+' ').replace(/>/g,' '+words[0]+' ').replace(/</g,' '+words[1]+' ').replace(/=/g,' '+words[4]+' ').replace(/°/g,' '+words[5]+' ').replace(/%/g,' '+words[6]+' ').replace(/−/g,'-').replace(/[^\p{L}\p{N}\p{Zs}’'&!._:;()/,-]/gu,' ').replace(/\s+/g,' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
    // HAP Name is at most 64 UTF-8 bytes. Truncate at a complete code point.
    let bytes=0;name=Array.from(name).filter(character=>{const point=character.codePointAt(0);bytes+=point<0x80?1:point<0x800?2:point<0x10000?3:4;return bytes<=64;}).join('').replace(/[^\p{L}\p{N}]+$/gu,'');
    return name||words[7];
  }
  function validate(input, translate = (key,values={}) => key.replace(/\{(\w+)\}/g,(match,name)=>values[name]??match)) {
    const c = JSON.parse(JSON.stringify(input));
    const fail = message => { throw new Error(translate(message)); };
    const number = (v, min, max, label) => {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(translate('{label}: Zahl zwischen {min} und {max} erforderlich.',{label:translate(label),min,max}));
    };
    const text = (v, label) => { if (typeof v !== 'string' || !v.trim()) fail(translate('{label} fehlt.',{label:translate(label)})); };
    c.language ??= 'en';
    if (!['de','en','fr','es'].includes(c.language)) fail('Unbekannte Sprache.');
    c.timeZone ??= 'Europe/Berlin';
    if(typeof c.timeZone!=='string'||!/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(c.timeZone))fail('Ungültige Zeitzone. Bitte eine IANA-Zeitzone wie Europe/Berlin angeben.');
    try{new Intl.DateTimeFormat('en',{timeZone:c.timeZone}).format(0);}
    catch{fail('Ungültige Zeitzone. Bitte eine IANA-Zeitzone wie Europe/Berlin angeben.');}
    c.name ??= 'Weather switches';
    if(c.latitude===undefined)c.latitude=52.52;
    if(c.longitude===undefined)c.longitude=13.405;
    c.provider ??= 'open-meteo';
    if (!['open-meteo', 'dwd'].includes(c.provider)) fail('Unbekannter Wetterdienst.');
    c.openMeteoPrivateConsent ??= false;
    if(typeof c.openMeteoPrivateConsent!=='boolean')fail('Open-Meteo-Zustimmung muss ein Wahrheitswert sein.');
    c.pollInterval ??= 300; c.staleAfter ??= c.provider === 'dwd' ? 7200 : 1800;
    c.dwdStation ??= ''; c.dwdMaxDistance ??= 100;
    if (typeof c.dwdStation !== 'string' || c.dwdStation !== '' && !/^\d{5}$/.test(c.dwdStation)) fail('DWD-Station: fünfstellige POI-/WMO-Kennung oder leer für automatische Auswahl.');
    number(c.dwdMaxDistance, 1, 500, 'Maximale Stationsentfernung');
    c.dwdForecastStation ??= '';
    if(typeof c.dwdForecastStation!=='string'||c.dwdForecastStation!==''&&!/^[A-Z0-9]{5}$/.test(c.dwdForecastStation))fail('MOSMIX-Kennung: fünf Großbuchstaben/Ziffern oder leer.');
    c.forecastRefresh ??= 1800;c.forecastStaleAfter ??= c.provider==='dwd'?43200:3600;
    number(c.forecastRefresh,900,21600,'Prognose-Abfrageintervall');number(c.forecastStaleAfter,3600,86400,'Maximales Prognosealter');
    if(c.forecastStaleAfter<c.forecastRefresh)fail('Maximales Prognosealter muss mindestens dem Prognose-Abfrageintervall entsprechen.');
    c.showSensors ??= true;
    c.enableHistory ??= false;
    if(typeof c.enableHistory!=='boolean')fail('Verlaufsaufzeichnung muss ein Wahrheitswert sein.');
    c.historyRetentionDays ??= 365;
    number(c.historyRetentionDays,1,366,'Aufbewahrung (Tage)');
    if(!Number.isInteger(c.historyRetentionDays))fail('Aufbewahrung muss eine ganze Anzahl Tage sein.');
    c.showLightSensor ??= false;
    c.localStation??={};
    if(typeof c.localStation!=='object'||Array.isArray(c.localStation)||c.localStation===null)fail('Lokale Station: ungültige Einstellungen.');
    const local=c.localStation;local.enabled??=false;local.host??='';local.shellyDeviceId??='';local.deviceComponent??='bthomedevice:200';local.password??='';local.pollInterval??=15;local.staleAfter??=120;
    if(typeof local.enabled!=='boolean'||['host','shellyDeviceId','deviceComponent','password'].some(key=>typeof local[key]!=='string'))fail('Lokale Station: ungültige Einstellungen.');
    number(local.pollInterval,10,300,'Stations-Abfrageintervall');number(local.staleAfter,30,3600,'Maximales Stationsdatenalter');
    if(local.staleAfter<local.pollInterval)fail('Stationsdatenalter muss mindestens dem Abfrageintervall entsprechen.');
    if(local.enabled){
      try{const url=new URL(/^https?:\/\//i.test(local.host)?local.host:'http://'+local.host);if(!local.host||/\s/.test(local.host)||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();}catch{fail('Shelly-Adresse: nur Host/IP mit optionalem Port.');}
      if(!/^[a-zA-Z0-9:-]{6,100}$/.test(local.shellyDeviceId))fail('Shelly-Hardware-ID fehlt oder ist ungültig.');
      if(/^\d+$/.test(local.deviceComponent))local.deviceComponent='bthomedevice:'+local.deviceComponent;
      if(!/^bthomedevice:\d+$/.test(local.deviceComponent))fail('BTHome-Geräte-ID fehlt oder ist ungültig.');
    }
    if(local.sensorComponents!==undefined&&(!local.sensorComponents||typeof local.sensorComponents!=='object'||Array.isArray(local.sensorComponents)))fail('Lokale Sensor-ID ist ungültig.');
    local.sensorComponents={...local.sensorComponents};
    for(const [metric,component]of Object.entries(local.sensorComponents))if(!['temperature','humidity','windSpeed','windGusts','illuminance','raining','precipitationRaw'].includes(metric)||typeof component!=='string'||!/^bthomesensor:\d+$/.test(component))fail('Lokale Sensor-ID ist ungültig.');
    for(const metric of ['temperature','humidity','windSpeed','windGusts','illuminance','raining','precipitationRaw']){
      const raw=local[metric+'Component'];if(raw===undefined)continue;
      if(raw===''){delete local.sensorComponents[metric];continue;}
      if(typeof raw!=='string'||!/^\d+$|^bthomesensor:\d+$/.test(raw))fail('Lokale Sensor-ID ist ungültig.');
      local.sensorComponents[metric]=/^\d+$/.test(raw)?'bthomesensor:'+raw:raw;
    }
    if (typeof c.showSensors !== 'boolean') fail('Sensoranzeige muss ein Wahrheitswert sein.');
    if (typeof c.showLightSensor !== 'boolean') fail('Lichtsensoranzeige muss ein Wahrheitswert sein.');
    number(c.latitude, -90, 90, 'Breitengrad'); number(c.longitude, -180, 180, 'Längengrad');
    number(c.pollInterval, 60, 3600, 'Abfrageintervall'); number(c.staleAfter, 900, 86400, 'Maximales Datenalter');
    if (c.staleAfter < c.pollInterval) fail('Maximales Datenalter muss mindestens dem Abfrageintervall entsprechen.');
    if (!Array.isArray(c.switches)) fail('Schalterliste fehlt.');
    const ids = new Set();
    for (const s of c.switches) {
      text(s.id, 'Schalter-ID'); text(s.name, 'Schaltername');
      if (s.id !== s.id.trim() || ids.has(s.id)) fail('Schalter-IDs müssen eindeutig und ohne äußere Leerzeichen sein.');
      ids.add(s.id);
      s.mode ??= 'all'; s.matchedState ??= true; s.failureState ??= 'hold'; s.stableForSeconds ??= 0;
      if (!['all', 'any'].includes(s.mode)) fail('Regelverknüpfung muss all oder any sein.');
      if (typeof s.matchedState !== 'boolean') fail('Zustand bei erfüllter Regel muss ein Wahrheitswert sein.');
      if (!['hold', 'on', 'off'].includes(s.failureState)) fail('Ungültiges Fehlerverhalten.');
      number(s.stableForSeconds, 0, 86400, 'Stabilisierungszeit');
      if (!Array.isArray(s.conditions) || s.conditions.length === 0) fail('Jeder Schalter benötigt mindestens eine Bedingung.');
      for (const r of s.conditions) {
        r.source ??= 'current';
        r.dataSource??='weather';
        if(!['weather','local','prefer-local'].includes(r.dataSource))fail('Ungültige Messwertquelle.');
        if(r.source==='current'&&r.dataSource==='local'&&['cloudCover','precipitation'].includes(r.metric))fail('Diese Messgröße ist an der lokalen Station nicht als Regelwert verfügbar.');
        if(!['current','forecast'].includes(r.source))fail('Bedingungsquelle muss aktuell oder Vorhersage sein.');
        if(r.source==='forecast'){
          if(r.dataSource!=='weather'||['illuminance','raining'].includes(r.metric))fail('Diese Messwertquelle ist für Vorhersagen nicht verfügbar.');
          r.aggregation ??= 'max';r.forecastStartHours ??= 0;r.forecastEndHours ??= 6;
          if(!['max','min','mean','at','sum'].includes(r.aggregation)||r.aggregation==='sum'&&r.metric!=='precipitation')fail('Ungültige Prognoseauswertung.');
          number(r.forecastStartHours,0,71,'Beginn (Stunden voraus)');number(r.forecastEndHours,1,72,'Ende/Zeitpunkt (Stunden voraus)');
          if(!Number.isInteger(r.forecastStartHours)||!Number.isInteger(r.forecastEndHours)||r.aggregation!=='at'&&r.forecastEndHours<=r.forecastStartHours)fail('Prognosefenster: ganze Stunden, Ende nach Beginn.');
        }
        if (!metrics.includes(r.metric)) fail('Unbekannter Wetterwert.');
        if (!['above', 'below'].includes(r.operator)) fail('Vergleich muss above oder below sein.');
        const [min, max] = r.metric === 'temperature' ? [-100, 70] : r.metric==='illuminance'?[0,1000000]:r.metric==='raining'?[0,1]:['humidity','cloudCover'].includes(r.metric) ? [0, 100] : r.metric==='precipitation'&&r.source==='forecast'&&r.aggregation==='sum'?[0,36000]:[0, 500];
        number(r.threshold, min, max, 'Einschaltschwelle'); r.hysteresis ??= 0;
        if (r.releaseThreshold !== undefined) {
          number(r.releaseThreshold, min, max, 'Rückschaltschwelle');
          r.hysteresis = r.operator === 'above' ? r.threshold-r.releaseThreshold : r.releaseThreshold-r.threshold;
        }
        number(r.hysteresis, 0, max - min, 'Hysterese (Reihenfolge der Schwellen prüfen)');
        const release = r.threshold + (r.operator === 'above' ? -r.hysteresis : r.hysteresis);
        number(release, min, max, 'Rückschaltgrenze');
      }
    }
    return c;
  }
  return { validate, metrics,CONSENT_VERSION,openMeteoAllowed,assertOpenMeteoConsent,homeKitName,weatherValueFresh };
});
