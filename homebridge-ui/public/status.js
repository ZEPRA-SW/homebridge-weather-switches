'use strict';
window.WeatherStatus={mount({t}){
  const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  let period='day',historyKind='current',chartType='auto',data=null,busy=false,generation=0,visible=false;
  const selectedMetrics=new Set(['temperature','humidity','windSpeed','windGusts','cloudCover','precipitation']),selectedForecasts=new Set(),knownForecasts=new Set();
  const selectedLocalMetrics=new Set(['temperature','humidity','windSpeed','windGusts','illuminance','raining']);
  const root=$('status-view'),info=el('p',undefined,'hint'),current=el('div'),controls=el('div',undefined,'status-controls'),periodSelect=el('select'),graphs=el('div'),exportButton=el('button'),clearButton=el('button'),message=el('p',undefined,'status-message');
  const periodLabel=el('label');periodSelect.id='history-period';periodLabel.htmlFor=periodSelect.id;
  const periodWrap=el('div');periodWrap.append(periodLabel,periodSelect);controls.append(periodWrap,exportButton,clearButton);
  const kindWrap=el('div'),kindLabel=el('label'),kindSelect=el('select'),typeWrap=el('div'),typeLabel=el('label'),typeSelect=el('select');
  kindSelect.id='history-kind';kindLabel.htmlFor=kindSelect.id;typeSelect.id='history-chart-type';typeLabel.htmlFor=typeSelect.id;
  kindWrap.append(kindLabel,kindSelect);typeWrap.append(typeLabel,typeSelect);controls.prepend(kindWrap);controls.insertBefore(typeWrap,exportButton);
  const choices=el('fieldset',undefined,'history-choices'),choiceLegend=el('legend'),choiceItems=el('div',undefined,'history-choice-items'),choiceNote=el('p',undefined,'hint');choices.append(choiceLegend,choiceItems);
  exportButton.type=clearButton.type='button';root.append(info,current,controls,choices,choiceNote,message,graphs);
  function date(time){
    const options={timeZone:data?.current?.timeZone||'Europe/Berlin',timeZoneName:'short'};
    try{return new Date(time).toLocaleString(document.documentElement.lang,options);}
    catch{return new Date(time).toLocaleString(document.documentElement.lang,{...options,timeZone:'Europe/Berlin'});}
  }
  function labelNode(parent,x,y,text,attrs={}){const n=svg('text',{x,y,...attrs});n.textContent=text;parent.append(n);}
  function chartTitle(title){graphs.append(el('h3',title));}
  function checkboxes(items,selection){
    const signature=JSON.stringify(items);
    if(choiceItems.dataset.signature===signature){for(const input of choiceItems.querySelectorAll('input'))input.checked=selection.has(input.value);return;}
    choiceItems.dataset.signature=signature;choiceItems.replaceChildren();
    items.forEach(([value,label],index)=>{
      const wrap=el('label',undefined,'history-choice'),input=el('input');input.type='checkbox';input.id='history-choice-'+index;input.value=value;input.checked=selection.has(value);input.dataset.historyKind=historyKind;
      input.addEventListener('change',()=>{if(input.checked)selection.add(value);else selection.delete(value);draw();});wrap.append(input,el('span',label));choiceItems.append(wrap);
    });
  }
  function plotSeries(series,title,unit){
    const panel=el('section',undefined,'weather-chart');panel.dataset.unit=unit;panel.append(el('h4',title));
    const valid=series.flatMap(s=>s.points.filter(p=>Number.isFinite(p.value)&&p.time>=data.from&&p.time<=data.to));
    if(!valid.length){panel.append(el('p',t('Für diesen Wetterwert sind keine Daten gespeichert.'),'hint'));graphs.append(panel);return;}
    const bars=chartType==='bar'||chartType==='auto'&&series.every(s=>s.metric==='precipitation');panel.dataset.chartType=bars?'bar':'line';
    let min=unit==='%'?0:valid.reduce((value,p)=>Math.min(value,p.value),Infinity),max=unit==='%'?100:valid.reduce((value,p)=>Math.max(value,p.value),-Infinity);
    if(bars){min=Math.min(0,min);max=Math.max(0,max);}if(min===max){if(min===0)max=1;else{min-=1;max+=1;}}
    const px=time=>70+(time-data.from)/(data.to-data.from)*860,py=value=>250-(value-min)/(max-min)*220;
    const plot=svg('svg',{viewBox:'0 0 960 300',role:'img','aria-label':title});plot.dataset.chartType=bars?'bar':'line';
    const clip=svg('clipPath',{id:'weather-clip-'+graphs.querySelectorAll('.weather-chart').length}),clipRect=svg('rect',{x:70,y:20,width:860,height:230});clip.append(clipRect);const defs=svg('defs');defs.append(clip);plot.append(defs);
    plot.append(svg('path',{d:'M70 20V250H930',class:'chart-axis'}));labelNode(plot,4,25,max.toFixed(1));labelNode(plot,4,250,min.toFixed(1));labelNode(plot,70,15,unit);
    const legend=el('div',undefined,'weather-series-legend');
    const palette=['var(--chart-series-1)','var(--chart-series-2)','var(--chart-series-3)','var(--chart-series-4)'];
    series.forEach((s,index)=>{
      const color=palette[index%palette.length],key=el('span'),swatch=el('i');swatch.style.backgroundColor=color;key.append(swatch,document.createTextNode(s.label));legend.append(key);
      const group=svg('g',{'clip-path':`url(#${clip.id})`});group.dataset.series=s.key;const points=s.points.filter(p=>p.time>=data.from&&p.time<=data.to).sort((a,b)=>a.time-b.time);
      if(bars){
        // A repeated current-hour amount is one bar, rather than several overlapping bars.
        const unique=[...new Map(points.map(p=>[p.time,p])).values()],times=unique.map(p=>p.time),steps=times.slice(1).map((time,i)=>time-times[i]).filter(step=>step>0),step=steps.length?steps.reduce((value,step)=>Math.min(value,step),Infinity):3600000;
        const slot=Math.max(1,Math.min(32,step/(data.to-data.from)*860*0.75)),width=Math.max(0.2,slot/series.length);
        for(const p of unique)if(Number.isFinite(p.value)){
          const rect=svg('rect',{x:px(p.time)-slot/2+index*width,y:Math.min(py(0),py(p.value)),width,height:p.value===0?0:Math.max(0.8,Math.abs(py(p.value)-py(0))),fill:color,class:'weather-bar'});
          const tooltip=svg('title');tooltip.textContent=s.label+' · '+date(p.time)+' · '+p.value.toFixed(2)+' '+unit;rect.append(tooltip);group.append(rect);
          if(p.value===0){const marker=svg('circle',{cx:px(p.time)-slot/2+(index+0.5)*width,cy:py(0),r:1.5,fill:color,class:'weather-zero'});marker.append(tooltip.cloneNode(true));group.append(marker);}
        }
      }else{
        let path='',previous=null;const maxGap=data.hourly.length||historyKind==='local'&&data.localHourly?.length||historyKind==='forecast'?5400000:historyKind==='local'?Math.max(30000,(data.current?.localStation?.staleAfter||120)*1000):Math.max(1800000,(data.current?.staleAfter||1800)*1000);
        for(const p of points){if(!Number.isFinite(p.value)){previous=null;continue;}path+=(previous&&p.time-previous.time<=maxGap?'L':'M')+px(p.time).toFixed(2)+' '+py(p.value).toFixed(2)+' ';previous=p;}
        const line=svg('path',{d:path,class:'weather-line'});line.style.stroke=color;group.append(line);
        const values=points.filter(p=>Number.isFinite(p.value));if(values.length===1){const dot=svg('circle',{cx:px(values[0].time),cy:py(values[0].value),r:3,class:'weather-point'});dot.style.fill=color;group.append(dot);}
      }
      plot.append(group);
    });
    labelNode(plot,70,280,date(data.from),{'font-size':12});labelNode(plot,930,280,date(data.to),{'text-anchor':'end','font-size':12});panel.append(legend,plot);graphs.append(panel);
  }
  function draw(){
    current.replaceChildren();graphs.replaceChildren();message.textContent='';
    if(!data){info.textContent=t('Keine Verbindung zur Laufzeit.');exportButton.disabled=true;return;}
    const online=data.connection==='online',c=data.current;
    const parts=[t(online?'Laufzeit verbunden':'Laufzeit nicht erreichbar')];
    if(c){parts.push(c.locationName,c.station?t('DWD-Station {name} ({id}), Entfernung {distance} km, Windmesshöhe {height} m',{...c.station,distance:c.station.distance.toFixed(1),height:c.station.windHeight}):c.source);if(c.weatherTime)parts.push(t('Wetterzeitpunkt: {time}',{time:date(c.weatherTime)}),t('Datenalter: {minutes} min',{minutes:Math.max(0,Math.floor((data.to-c.weatherTime)/60000))}));
      parts.push(t(data.fresh?'Wetterdaten aktuell':'Wetterdaten fehlen oder sind veraltet'));
      if(online)parts.push(t(c.enableHistory?'Aufzeichnung eingeschaltet':'Aufzeichnung ausgeschaltet – keine neuen Verlaufsdaten'));
      if(online&&c.enableHistory)parts.push(t('Aufbewahrung: {days} Tage; Rohwerte bis 7 Tage, längere Ansichten als Stundenmittel.',{days:c.historyRetentionDays}));
      if(online&&c.enableHistory&&c.historyStartedAt)parts.push(t('Aufzeichnung begonnen: {time}',{time:date(c.historyStartedAt)}));
      if(c.lastError)parts.push(t('Wetterabfrage fehlgeschlagen; letzte gültige Werte nur bis zum maximalen Datenalter.'));
      const httpCode=/HTTP (\d{3})/.exec(c.lastError||'')?.[1];if(httpCode)parts.push(t('Wetterdienst meldet HTTP {code}.',{code:httpCode}));
      if(c.openMeteoBlocked)parts.push(t('Open-Meteo gesperrt: Zustimmung zur privaten, nicht gewerblichen Nutzung fehlt.'));
      if(c.lastForecastError)parts.push(t('Prognoseabruf fehlgeschlagen; nur noch gültige zwischengespeicherte Prognosen werden verwendet.'));
      if(c.historyError)parts.push(t('Verlauf nicht verfügbar.'));
    }
    info.textContent=parts.filter(Boolean).join(' · ');
    const note=el('p',t('Status der zuletzt gestarteten Konfiguration. Änderungen in Einstellungen erst nach Speichern und Neustart wirksam.'),'hint');current.append(note);
    if(c){
      current.append(el('h3',t('Aktuell')+' · '+c.locationName+' · '+c.source));
      const values=el('dl',undefined,'current-weather');
      for(const [metric,[label,unit]]of Object.entries(WeatherHistory.metrics)){
        if(metric==='raining')continue;
        if(metric==='illuminance'&&(c.provider==='dwd'||!Number.isFinite(c.values?.[metric])))continue;
        const precipitationFresh=WeatherConfig.weatherValueFresh({time:c.weatherTime,precipitationTime:c.precipitationTime},'precipitation',c.staleAfter,data.to);
        const available=online&&data.fresh&&!c.openMeteoBlocked&&Number.isFinite(c.values?.[metric])&&(metric!=='precipitation'||precipitationFresh);
        const row=el('div',undefined,'status-switch');row.dataset.metric=metric;
        row.append(el('dt',t(label)),el('dd',available?c.values[metric].toFixed(1)+' '+unit:t('Nicht verfügbar')));values.append(row);
      }
      current.append(values);
      if(Number.isFinite(c.precipitationTime)){
        current.append(el('p',t('Niederschlagsintervall: {from} bis {to}',{from:date(c.precipitationTime-3600000),to:date(c.precipitationTime)}),'hint'));
        current.append(el('p',t('Die Niederschlagsmenge gilt für die letzte abgeschlossene Stunde. Sie bleibt bei frischen Wetterdaten bis zur nächsten Stundenmenge gültig.'),'hint'));
      }
    }
    const local=c?.localStation;
    if(local?.enabled){
      current.append(el('h3',t('Lokale Shelly-Wetterstation')));
      current.append(el('p',[local.host,local.shellyDeviceId,local.deviceComponent].filter(Boolean).join(' · '),'hint'));
      if(local.lastError){current.append(el('p',t('Lokale Stationsabfrage fehlgeschlagen. Letzte Messwerte gelten nur bis zum maximalen Stationsdatenalter.'),'status-message'));const code=/Shelly HTTP-Fehler (\d{3})/.exec(local.lastError)?.[1];current.append(el('p',code?t('Shelly meldet HTTP {code}.',{code}):t(local.lastError),'hint'));}
      const table=el('dl',undefined,'local-weather');
      for(const metric of ['temperature','humidity','windSpeed','windGusts','illuminance','raining']){
        const time=local.sample?.metricTimes?.[metric],value=local.sample?.values?.[metric],available=online&&Number.isFinite(value)&&Number.isFinite(time)&&time<=data.to+60000&&data.to-time<=local.staleAfter*1000;
        const row=el('div',undefined,'status-switch');row.dataset.metric=metric;row.append(el('dt',t(WeatherHistory.metricLabel(metric,'local'))),el('dd',available?value.toFixed(1)+' '+WeatherHistory.metrics[metric][1]:t('Nicht verfügbar')));
        if(local.sample?.sensors?.[metric])row.append(el('span',local.sample.sensors[metric],'hint'));if(time)row.append(el('span',date(time),'hint'));table.append(row);
      }
      current.append(table);
      const rainTime=local.sample?.metricTimes?.precipitationRaw;
      if(Number.isFinite(rainTime))current.append(el('p',t('Niederschlag vom Gerät (mm, Zeitraum unbestätigt)')+': '+(online&&data.to-rainTime<=local.staleAfter*1000?local.sample.extras.precipitationRaw+' · '+date(rainTime):t('Nicht verfügbar')),'hint'));
    }
    for(const r of c?.switches||[]){
      const row=el('div',undefined,'status-switch');row.append(el('strong',r.name));
      row.append(el('span',t(!online?'Unbekannt':r.state?'Aktiv':'Inaktiv'),'status-pill '+(!online?'unknown':r.available?(r.state?'on':'off'):'fault')));
      if(online&&!r.available)row.append(el('span',t('Fehlerverhalten'),'hint'));current.append(row);
      for(const input of r.inputs||[])if(input.source==='current'){
        const unit=WeatherHistory.metrics[input.metric]?.[1]||'',value=online&&input.available?Number(input.value).toFixed(1)+' '+unit:t('Nicht verfügbar');
        const words=[t('Bedingung {number}',{number:input.index+1}),t(WeatherHistory.metricLabel(input.metric,input.origin==='local'?'local':'current')),value,input.sourceName];
        if(input.fallback&&input.available)words.push(t('Wetterdienst als Ersatz aktiv'));if(input.validTo)words.push(date(input.validTo));current.append(el('p',words.filter(Boolean).join(' · '),'hint'));
      }
      for(const input of r.inputs||[])if(input.source==='forecast'){
        const unit=WeatherHistory.metrics[input.metric]?.[1]||'',value=online&&input.available?Number(input.value).toFixed(1)+' '+unit:t('Nicht verfügbar');
        const description=t('Bedingung {number}',{number:input.index+1})+' · '+t('Vorhersage')+' · '+t(WeatherHistory.metricLabel(input.metric,'forecast',input.aggregation))+' · '+t({sum:'Summe im Zeitfenster (nur Niederschlag)',max:'Maximum im Zeitfenster',min:'Minimum im Zeitfenster',mean:'Mittelwert im Zeitfenster',at:'Stundenwert am Zielzeitpunkt'}[input.aggregation])+' · '+value;
        current.append(el('p',description,'hint'));
        if(!input.available)current.append(el('p',t(input.reason==='stale'?'Prognose veraltet oder nicht vorhanden.':'Prognosefenster unvollständig oder Wetterwert fehlt.'),'hint'));
        const times=[input.sourceName];if(input.issuedAt)times.push(t('Prognose ausgegeben: {time}',{time:date(input.issuedAt)}));else times.push(t(input.fetchedAt?'Modell-Ausgabezeit vom Anbieter nicht geliefert.':'Noch keine Prognose abgerufen.'));
        if(input.fetchedAt)times.push(t('Prognose abgerufen: {time}',{time:date(input.fetchedAt)}));
        if(input.validFrom&&input.validTo)times.push(t('Prognose gültig von {from} bis {to}',{from:date(input.validFrom),to:date(input.validTo)}));
        current.append(el('p',times.filter(Boolean).join(' · '),'hint'));
      }
    }
    if(!c?.switches?.length)current.append(el('p',t('Keine laufenden Schalter verfügbar.')));
    const groups=new Map((data.forecastInputs||[]).map(r=>[WeatherHistory.forecastKey(r),r]));
    for(const key of groups.keys())if(!knownForecasts.has(key)){knownForecasts.add(key);selectedForecasts.add(key);}
    const forecastLabel=r=>`${r.details.switchName||r.switchId} · ${t('Bedingung {number}',{number:r.conditionIndex+1})} · ${t(WeatherHistory.metricLabel(r.metric,'forecast',r.details.aggregation))} · ${r.details.startHours}–${r.details.endHours} h · ${t({sum:'Summe im Zeitfenster (nur Niederschlag)',max:'Maximum im Zeitfenster',min:'Minimum im Zeitfenster',mean:'Mittelwert im Zeitfenster',at:'Stundenwert am Zielzeitpunkt'}[r.details.aggregation])}`;
    choiceLegend.textContent=t(historyKind==='forecast'?'Prognosebedingungen anzeigen':'Wetterwerte anzeigen');
    checkboxes(historyKind==='forecast'?[...groups].map(([key,r])=>[key,forecastLabel(r)]):Object.keys(WeatherHistory.metrics).filter(key=>historyKind==='local'?!['cloudCover','precipitation'].includes(key):key!=='raining').map(key=>[key,t(WeatherHistory.metricLabel(key,historyKind))]),historyKind==='forecast'?selectedForecasts:historyKind==='local'?selectedLocalMetrics:selectedMetrics);
    choiceNote.textContent=t('Die Auswahl ändert nur die Anzeige. Bei eingeschalteter Aufzeichnung werden alle verfügbaren Werte gespeichert.');
    const historyCount=data.samples.length+data.hourly.length+(data.localSamples||[]).length+(data.localHourly||[]).length+(data.forecastInputs||[]).length+data.events.filter(e=>e.time>=data.from).length;exportButton.disabled=!historyCount;
    if(data.limitedAt)message.textContent=t('Mengengrenze erreicht: ältere Verlaufsdaten wurden entfernt.');
    if(data.historyUnavailable)message.textContent=t('Verlauf nicht verfügbar.');
    if(!historyCount){graphs.append(el('p',t('Noch keine gespeicherten Daten in diesem Zeitraum. Keine Vergangenheit wird ergänzt.')));return;}
    graphs.append(el('p',t('Zeitraum: {from} bis {to}',{from:date(data.from),to:date(data.to)}),'hint'));
    chartTitle(t('Schalterverlauf'));
    const legend=el('p',undefined,'status-legend');for(const [key,word] of [['on','Aktiv'],['off','Inaktiv'],['fault','Fehlerverhalten'],['unknown','Unbekannt']])legend.append(el('span',t(word),'status-pill '+key));graphs.append(legend);
    const ids=[...new Set([...data.events.map(e=>e.switchId),...(c?.switches||[]).map(r=>r.id)])];
    const width=960,left=220,right=940,x=time=>left+(time-data.from)/(data.to-data.from)*(right-left),height=Math.max(90,ids.length*52+45);
    const timeline=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':t('Schalterverlauf')});
    ids.forEach((id,index)=>{
      const last=[...data.events].reverse().find(e=>e.switchId===id),name=c?.switches?.find(s=>s.id===id)?.name||last?.name||id,y=index*52+28;
      labelNode(timeline,4,y+4,name.length>26?name.slice(0,25)+'…':name);
      timeline.append(svg('path',{d:`M${left} ${y}H${right}`,class:'timeline-unknown'}));
      const segments=WeatherHistory.intervals(data,id);
      for(const state of ['on','off','fault']){
        const d=segments.filter(s=>s.state===state).map(s=>`M${x(s.start).toFixed(2)} ${y}H${x(s.end).toFixed(2)}`).join(' ');
        if(d)timeline.append(svg('path',{d,class:'timeline-'+state}));
      }
    });
    labelNode(timeline,left,height-5,date(data.from),{'font-size':12});labelNode(timeline,right,height-5,date(data.to),{'text-anchor':'end','font-size':12});graphs.append(timeline);
    chartTitle(t(historyKind==='forecast'?'Prognose-Regelwerte':'Wetterverlauf'));
    graphs.append(el('p',t(historyKind==='forecast'?'Prognosen: letzter ausgewerteter Regelwert je Stunde, auf der Zeitachse der Auswertung; keine gemessenen Wetterwerte.':(historyKind==='local'?data.localHourly?.length:data.hourly.length)?'Ältere Wetterdaten: Stundenmittel mit Minimum und Maximum im CSV.':'Wetterdaten: einzelne abgerufene Messzeitpunkte.'),'hint'));
    if(historyKind==='forecast'){
      let count=0;for(const [key,r]of groups)if(selectedForecasts.has(key)){
        count++;plotSeries([{key,metric:r.metric,label:forecastLabel(r),points:(data.forecastInputs||[]).filter(row=>WeatherHistory.forecastKey(row)===key).map(row=>({time:row.details.evaluatedAt,value:row.details.available?row.value:null}))}],forecastLabel(r),WeatherHistory.metrics[r.metric]?.[1]||'');
      }
      if(!count)graphs.append(el('p',t('Keine Verläufe ausgewählt.')));
    }else{
      const units=new Map();
      const values=historyKind==='local'?{...data,samples:data.localSamples||[],hourly:data.localHourly||[]}:data;
      for(const metric of historyKind==='local'?selectedLocalMetrics:selectedMetrics){const unit=WeatherHistory.metrics[metric][1],points=WeatherHistory.points(historyKind==='local'?{...values,samples:values.samples.filter(row=>Number.isFinite(row[metric]))}:values,metric),series={key:metric,metric,label:t(WeatherHistory.metricLabel(metric,historyKind)),points};if(!units.has(unit))units.set(unit,[]);units.get(unit).push(series);}
      for(const [unit,series]of units)plotSeries(series,series.map(s=>s.label).join(' · '),unit);
      if(!units.size)graphs.append(el('p',t('Keine Verläufe ausgewählt.')));
    }
    if(historyKind==='local'){graphs.append(el('p',t('Lokale Stationsmessung'),'hint'));return;}
    const sourceLabel=c?.source||'DWD / Open-Meteo';
    const attribution=el('p',t('Wetterdaten von')+' ','hint'),sourceLink=el('a',(c?.provider==='dwd'?'Deutscher Wetterdienst · ':'')+sourceLabel);
    sourceLink.href=c?.provider==='dwd'?'https://opendata.dwd.de/':'https://open-meteo.com/';sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';attribution.append(sourceLink,document.createTextNode(' · CC BY 4.0 · '+t('Eigene Verarbeitung: Einheiten und Regelwerte, Verdichtung.')));graphs.append(attribution);
  }
  async function refresh(){
    if(busy)return;busy=true;const version=++generation;
    try{if(typeof homebridge.request!=='function')throw Error('No server');const next=await homebridge.request('/history',{period});if(version===generation){data=next;draw();}}
    catch{if(version===generation){data=null;draw();message.textContent=t('Verlauf nicht verfügbar.');}}
    finally{busy=false;}
  }
  function language(){
    kindLabel.textContent=t('Datenart');kindSelect.replaceChildren();for(const [value,label]of [['current','Wetterdienst'],['local','Lokale Station'],['forecast','Vorhersage']]){const o=el('option',t(label));o.value=value;kindSelect.append(o);}kindSelect.value=historyKind;
    periodLabel.textContent=t('Zeitraum');typeLabel.textContent=t('Diagrammtyp');typeSelect.replaceChildren();for(const [value,label]of [['auto','Automatisch (Niederschlag als Balken)'],['line','Linien'],['bar','Balken']]){const o=el('option',t(label));o.value=value;typeSelect.append(o);}typeSelect.value=chartType;
    periodSelect.replaceChildren();for(const [value,label] of [['day','Tag (24 Stunden)'],['week','Woche (7 Tage)'],['month','Monat (31 Tage)'],['year','Jahr (366 Tage)']]){const o=el('option',t(label));o.value=value;periodSelect.append(o);}periodSelect.value=period;
    exportButton.textContent=t('CSV exportieren');clearButton.textContent=t('Verlauf löschen');draw();
  }
  periodSelect.addEventListener('change',()=>{period=periodSelect.value;generation++;data=null;draw();if(!busy)refresh();else setTimeout(refresh,3000);});
  typeSelect.addEventListener('change',()=>{chartType=typeSelect.value;draw();});
  kindSelect.addEventListener('change',()=>{historyKind=kindSelect.value;draw();});
  exportButton.addEventListener('click',()=>{
    if(!data)return;const blob=new Blob([WeatherHistory.csv(data,t)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`weather-switches-${period}-${new Date().toISOString().slice(0,10)}.csv`;root.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  clearButton.addEventListener('click',async()=>{
    if(!window.confirm(t('Alle gespeicherten Wetter- und Schaltverlaufsdaten dieses Plugins löschen? Bei aktiver Aufzeichnung beginnt anschließend ein neuer Verlauf. Einstellungen und HomeKit-Zuordnungen bleiben erhalten.')))return;
    clearButton.disabled=true;
    try{await homebridge.request('/clear-history',{confirmed:true});generation++;busy=false;await refresh();}
    catch{message.textContent=t('Verlauf konnte nicht gelöscht werden.');}
    finally{clearButton.disabled=false;}
  });
  function show(status){visible=status;$('settings-view').hidden=status;root.hidden=!status;$('view-settings').classList.toggle('active-tab',!status);$('view-status').classList.toggle('active-tab',status);if(status)refresh();}
  $('view-settings').addEventListener('click',()=>show(false));$('view-status').addEventListener('click',()=>show(true));
  const timer=setInterval(()=>{if(visible)refresh();},5000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});language();
  return {refreshLanguage:language,refresh};
}};
