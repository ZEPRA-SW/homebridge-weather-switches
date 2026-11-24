'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WeatherHistory=factory();})(globalThis,()=>{
  const metrics={temperature:['Temperatur (°C, 2 m)','°C'],humidity:['Relative Luftfeuchtigkeit (%, 2 m)','%'],windSpeed:['Windgeschwindigkeit (km/h, 10 m)','km/h'],windGusts:['Windböen (km/h, 10 m)','km/h'],illuminance:['Licht geschätzt','lux'],cloudCover:['Gesamtbewölkung (%)','%'],precipitation:['Niederschlag (mm, letzte Stunde)','mm'],raining:['Regen erkannt (0/1)','']};
  function metricLabel(metric,source='current',aggregation){
    if(source==='local'){const labels={temperature:'Temperatur (°C)',humidity:'Relative Luftfeuchtigkeit (%)',windSpeed:'Windgeschwindigkeit (km/h)',windGusts:'Windböen (km/h)',illuminance:'Beleuchtungsstärke (lux)'};if(labels[metric])return labels[metric];}
    if(metric==='precipitation'&&source==='forecast')return aggregation==='sum'?'Niederschlag (mm, Summe im Prognosezeitraum)':'Niederschlag (mm je Prognosestunde)';
    return metrics[metric]?.[0]||metric;
  }
  function forecastKey(row){const d=row.details;return JSON.stringify([row.switchId,row.conditionIndex,row.metric,d.aggregation,d.startHours,d.endHours,d.sourceName]);}
  function intervals(data,id){
    const sessions=new Map(data.sessions.map(s=>[s.id,s])),events=data.events.filter(e=>e.switchId===id).sort((a,b)=>a.time-b.time||a.id-b.id),result=[];
    for(let i=0;i<events.length;i++){
      const e=events[i],s=sessions.get(e.session);if(!s)continue;
      const sessionEnd=s.end??(data.connection==='online'&&data.current?.session===s.id?data.to:s.last);
      const start=Math.max(data.from,e.time,s.start),end=Math.min(data.to,events[i+1]?.time??data.to,sessionEnd);
      if(end>start)result.push({start,end,state:!e.available?'fault':e.state?'on':'off'});
    }
    return result;
  }
  function points(data,metric){
    if(data.hourly.length)return data.hourly.filter(r=>r.metric===metric).map(r=>({time:r.time,value:r.mean,min:r.min,max:r.max,count:r.count}));
    return data.samples.map(r=>({time:metric==='precipitation'?(r.precipitationTime??r.time):r.time,value:Number.isFinite(r[metric])?r[metric]:null}));
  }
  function csvCell(value){
    let text=value===null||value===undefined?'':String(value);
    if(typeof value==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function csv(data,t=key=>key){
    const headers=['Datensatz','Zeitpunkt UTC','Abrufzeit UTC','Zeitzone','Standort','Quelle','Verdichtung','Wetterwert','Einheit','Wert','Minimum','Maximum','Anzahl','Schalter-ID','Schaltername','Zustand','Datenqualität','Auslöser','Datenart','Prognose-Ausgabe UTC','Prognose-Abruf UTC','Gültig von UTC','Gültig bis UTC','Auswertung','Bedingung','Regelwerte mit Quellen/Gültigkeit (JSON)'];
    const lines=[headers.map(h=>csvCell(t(h))).join(';')],iso=time=>new Date(time).toISOString();
    const emit=row=>{while(row.length<headers.length)row.push('');lines.push(row.map(csvCell).join(';'));};
    const source=(value,kind)=>{
      if(kind==='local')return (value||'Shelly WS90')+' · '+t('Lokale Stationsmessung');
      const label=value||data.current?.source||'',dwd=data.current?.provider==='dwd'||String(label).startsWith('DWD');
      return (dwd?'Deutscher Wetterdienst · ':'')+label+' · '+(dwd?'https://opendata.dwd.de/':'https://open-meteo.com/')+' · CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ · '+t('Eigene Verarbeitung: Einheiten und Regelwerte, Verdichtung.');
    };
    for(const r of data.samples)for(const [key,[label,unit]] of Object.entries(metrics))if(Number.isFinite(r[key]))emit([t('Wetter'),iso(key==='precipitation'?(r.precipitationTime??r.time):r.time),iso(r.received),'UTC',data.current?.locationName||'',source(r.source),t('Einzelwert'),t(label),unit,r[key],'','',1,'','','','','',t('Aktuell')]);
    for(const r of data.hourly){const [label,unit]=metrics[r.metric]||[r.metric,''];emit([t('Wetter'),iso(r.time),'','UTC',data.current?.locationName||'',source(data.current?.source),t('Stundenmittel'),t(label),unit,r.mean,r.min,r.max,r.count,'','','','','',t('Aktuell')]);}
    for(const r of data.localSamples||[])for(const [key,[,unit]]of Object.entries(metrics))if(Number.isFinite(r[key]))emit([t('Wetter'),iso(r.time),iso(r.received),'UTC',data.current?.locationName||'',source(r.source,'local'),t('Einzelwert'),t(metricLabel(key,'local')),unit,r[key],'','',1,'','','','','',t('Lokale Station')]);
    for(const r of data.localHourly||[]){const unit=metrics[r.metric]?.[1]||'';emit([t('Wetter'),iso(r.time),'','UTC',data.current?.locationName||'',source(data.current?.localStation?.sample?.source,'local'),t('Stundenmittel'),t(metricLabel(r.metric,'local')),unit,r.mean,r.min,r.max,r.count,'','','','','',t('Lokale Station')]);}
    const isoOrBlank=value=>Number.isFinite(value)?iso(value):'';
    for(const r of data.forecastInputs||[]){const d=r.details,[label,unit]=metrics[r.metric]||[r.metric,''];emit([t('Prognose-Regelwert'),iso(d.evaluatedAt),'','UTC',data.current?.locationName||'',source(d.sourceName),t('Stündlich letzter Stand'),t(metricLabel(r.metric,'forecast',d.aggregation)),unit,r.value,r.min,r.max,r.count,r.switchId,d.switchName,'',t(d.available?'Gültig':'Fehlerverhalten'),'',t('Vorhersage'),isoOrBlank(d.issuedAt),isoOrBlank(d.fetchedAt),isoOrBlank(d.validFrom),isoOrBlank(d.validTo),t({sum:'Summe im Zeitfenster (nur Niederschlag)',max:'Maximum im Zeitfenster',min:'Minimum im Zeitfenster',mean:'Mittelwert im Zeitfenster',at:'Stundenwert am Zielzeitpunkt'}[d.aggregation]||d.aggregation),r.conditionIndex+1]);}
    for(const r of data.events)if(r.time>=data.from){const inputs=r.inputs||[],origins=new Set(inputs.map(i=>i.source==='forecast'?'forecast':i.origin==='local'?'local':'weather')),scope=origins.size>1?'Gemischt':origins.has('forecast')?'Vorhersage':origins.has('local')?'Lokale Station':'Aktuell',sources=inputs.length?[...new Set(inputs.map(i=>source(i.sourceName,i.origin==='local'?'local':undefined)))].join(' | '):source(data.current?.provider==='dwd'?'DWD':'Open-Meteo');emit([t('Schaltzustand'),iso(r.time),'','UTC',data.current?.locationName||'',sources,'','','','','','', '',r.switchId,r.name,t(r.state?'Aktiv':'Inaktiv'),t(r.available?'Gültig':'Fehlerverhalten'),t(r.reason==='boundary'?'Aufbewahrungsgrenze':r.reason==='failure'?'Fehlerverhalten':'Regel'),t(scope),'','','','','','',JSON.stringify(inputs)]);}
    return '\uFEFF'+lines.join('\r\n')+'\r\n';
  }
  return {metrics,metricLabel,intervals,points,csv,csvCell,forecastKey};
});
