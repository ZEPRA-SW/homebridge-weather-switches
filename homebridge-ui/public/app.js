'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  let blocks, cfg, schema, serial = 0, revision = 0, tail = Promise.resolve();
  const t = (key, values) => WeatherI18n.translate(cfg?.language || 'en', key, values);
  const staticTexts=new Map([...document.querySelectorAll('[data-i18n]')].map(node=>[node,node.getAttribute('data-i18n')||node.textContent]));
  // randomUUID requires HTTPS; Homebridge is often opened over HTTP on a LAN.
  const newId = () => 'weather-' + Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  const dwdMapUrl = 'https://www.dwd.de/DE/derdwd/messnetz/bodenbeobachtung/messnetzkarte_boden.pdf?__blob=publicationFile&v=9';
  function button(text, action, disabled = false, icon) {
    const b = el('button', icon ? undefined : t(text)); b.type = 'button'; b.disabled = disabled;
    b.title=t(text);b.setAttribute('aria-label',t(text));
    if(icon){const symbol=el('span',icon);symbol.setAttribute('aria-hidden','true');b.append(symbol);}
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); action(); }); return b;
  }
  function valid() {
    try { WeatherConfig.validate(cfg,t); if (cfg.provider==='dwd') WeatherStation.select(cfg); if (!$('settings').checkValidity()) throw new Error(t('Bitte Eingabefelder prüfen.')); return ''; }
    catch (e) { return t(e.message); }
  }
  function changed() {
    const message = valid(); $('message').textContent = message||(cfg.provider==='open-meteo'&&!WeatherConfig.openMeteoAllowed(cfg)?t('Open-Meteo gesperrt: Zustimmung zur privaten, nicht gewerblichen Nutzung fehlt.'):''); homebridge.disableSaveButton();
    const current = ++revision;
    if (message) return;
    const snapshot = structuredClone(blocks);
    tail = tail.catch(() => {}).then(() => homebridge.updatePluginConfig(snapshot)).then(() => {
      if (current === revision && !valid()) homebridge.enableSaveButton();
    }).catch(() => { $('message').textContent = t('Einstellungen konnten nicht übernommen werden.'); homebridge.disableSaveButton(); });
  }
  function fields(parent, properties, object, onChange = () => {}) {
    const grid = el('div', undefined, 'fields'); parent.append(grid);
    const thresholdLabels=[],thresholdInputs=[];
    const updateUnits=()=>{
      const unit={temperature:'°C',humidity:'%',windSpeed:'km/h',windGusts:'km/h',cloudCover:'%',precipitation:'mm',illuminance:'lux'}[object.metric];
      for(const [label,title] of thresholdLabels)label.textContent=t(title)+(unit?` (${unit})`:'');
      const min=object.metric==='temperature'?-100:0,max=object.metric==='illuminance'?1000000:object.metric==='raining'?1:['humidity','cloudCover'].includes(object.metric)?100:object.metric==='precipitation'&&object.source==='forecast'&&object.aggregation==='sum'?36000:500;
      for(const input of thresholdInputs){input.min=min;input.max=max;}
    };
    for (const [key, d] of Object.entries(properties)) {
      if(['openMeteoPrivateConsent','showLightSensor'].includes(key)&&cfg.provider!=='open-meteo')continue;
      if(key==='dataSource'&&object.source==='forecast')continue;
      if(['aggregation','forecastStartHours','forecastEndHours'].includes(key)&&object.source!=='forecast')continue;
      // Homebridge injects hidden metadata such as _bridge into the schema.
      // Only render supported, labelled user fields; preserve metadata in cfg.
      if (key.startsWith('_') || ['platform', 'accessory'].includes(key) || d.notitle || !d.title || !['string', 'number', 'integer', 'boolean'].includes(d.type)) continue;
      const wrap = el('div', undefined, 'field' + (d.type === 'boolean' ? ' check' : ''));
      const label = el('label', t(d.title)), input = el(d.enum ? 'select' : 'input');
      const nameHint=key==='name'?el('p',undefined,'hint homekit-name-hint'):null;
      const updateNameHint=()=>{if(nameHint){const name=WeatherConfig.homeKitName(object[key],cfg.language);nameHint.textContent=name!==object[key]?t('In Apple Home: {name}',{name}):'';nameHint.hidden=!nameHint.textContent;}};
      if(['threshold','releaseThreshold'].includes(key))thresholdLabels.push([label,d.title]);
      if(['threshold','releaseThreshold'].includes(key))thresholdInputs.push(input);
      wrap.dataset.field=key;
      input.id = 'field-' + (++serial); label.htmlFor = input.id;
      if (d.enum) {
        const unsupportedMetric=key==='metric'&&(object.source==='forecast'&&['illuminance','raining'].includes(object.metric)||object.source!=='forecast'&&object.dataSource==='local'&&['cloudCover','precipitation'].includes(object.metric));
        if(unsupportedMetric){const option=el('option',t(WeatherHistory.metricLabel(object.metric))+' · '+t('Nicht verfügbar'));option.value=object.metric;option.disabled=true;input.append(option);}
        if (object[key] === undefined && d.default === undefined) { const o = el('option', t('Bitte auswählen')); o.value = ''; input.append(o); }
        d.enum.forEach((v, i) => { if(key==='aggregation'&&v==='sum'&&object.metric!=='precipitation')return;if(key==='metric'&&(object.source==='forecast'&&['illuminance','raining'].includes(v)||object.source!=='forecast'&&object.dataSource==='local'&&['cloudCover','precipitation'].includes(v)))return; const o = el('option', t(key==='metric'?WeatherHistory.metricLabel(v,object.source==='forecast'?'forecast':object.dataSource&&object.dataSource!=='weather'?'local':'current',object.aggregation):(d.enumNames?.[i] || v))); o.value = v; input.append(o); });
      } else input.type = d.type === 'boolean' ? 'checkbox' : ['number', 'integer'].includes(d.type) ? 'number' : d.format==='password'?'password':'text';
      if (object[key] === undefined && d.default !== undefined) object[key] = key==='forecastStaleAfter'&&cfg.provider==='dwd'?43200:d.default;
      if (input.type === 'checkbox') input.checked = object[key] === true;
      else input.value = object[key] ?? '';
      if (input.type === 'number') input.step = 'any';
      if (d.minimum !== undefined) input.min = d.minimum;
      if (d.maximum !== undefined) input.max = d.maximum;
      if (d.minLength) input.minLength = d.minLength;
      input.required = d.default === undefined;
      input.addEventListener('input', () => {
        if (input.type === 'checkbox') object[key] = input.checked;
        // Clearing a coordinate is invalid; it must not silently restore Berlin.
        else if (input.type === 'number') object[key] = input.value === '' ? (['latitude','longitude'].includes(key)?null:undefined) : input.valueAsNumber;
        else object[key] = input.value;
        if(key==='metric')updateUnits();
        if(key==='name')updateNameHint();
        if(key==='openMeteoPrivateConsent'){if(input.checked)cfg._openMeteoConsentVersion=WeatherConfig.CONSENT_VERSION;else delete cfg._openMeteoConsentVersion;}
        onChange(key); changed();
      });
      if (input.type === 'checkbox') wrap.append(input, label); else wrap.append(label, input);
      if(nameHint){updateNameHint();wrap.append(nameHint);}
      if (d.description) wrap.append(el('p', t(d.description), 'hint'));
      if(key==='openMeteoPrivateConsent'){
        const link=el('a',t('Offizielle Open-Meteo-Nutzungsbedingungen'));link.href='https://open-meteo.com/en/terms';link.target='_blank';link.rel='noopener noreferrer';wrap.append(link);
      }
      if (key === 'dwdStation' && cfg.provider === 'dwd') {
        const help=el('p', undefined, 'hint'), link=el('a', t('DWD-Stationskarte öffnen (PDF, neuer Tab)'));
        link.id='dwd-station-map';link.href=dwdMapUrl;link.target='_blank';link.rel='noopener noreferrer';
        help.append(link, el('br'), document.createTextNode(t('Die Karte zeigt fünfstellige WMO-Kennungen, z. B. Berlin-Tempelhof 10384. Keine CDC-ID eintragen. Nur Stationen aus dem Plugin-Katalog sind auswählbar. ')));
        const catalog=el('a',t('Offizielles Stationsverzeichnis (CSV)'));catalog.href='https://opendata.dwd.de/weather/weather_reports/stationlist_synoptic_germany.csv';catalog.target='_blank';catalog.rel='noopener noreferrer';
        help.append(catalog, document.createTextNode(t(': die Spalte „Kennung“ verwenden, nicht „#ID“.')));wrap.append(help);
      }
      grid.append(wrap);
    }
    updateUnits();
  }
  function card(title, cls, open) {
    const d = el('details', undefined, cls); d.open = open;
    const summary = el('summary'); summary.append(el('span', title, 'device-title')); d.append(summary); return d;
  }
  function render(openId) {
    if(cfg.openMeteoPrivateConsent===true&&cfg._openMeteoConsentVersion!==WeatherConfig.CONSENT_VERSION)cfg.openMeteoPrivateConsent=false;
    document.documentElement.lang=cfg.language||'en';$('app').lang=cfg.language||'en';
    for(const [node,key] of staticTexts)node.textContent=t(key);
    window.weatherStatusView?.refreshLanguage();
    const opens = new Set([...$('settings').querySelectorAll('details[open]')].map(n => n.dataset.key));
    $('settings').replaceChildren();
    const general = card(t('Standort und allgemeine Einstellungen'), 'general-settings', opens.has('general') || !cfg.switches.length);
    general.dataset.key = 'general'; fields(general, schema.schema.properties, cfg, key=>{
      if (key==='language') render();
      else if (key==='provider') {
        if(cfg.provider==='dwd'&&cfg.forecastStaleAfter===3600)cfg.forecastStaleAfter=43200;
        else if(cfg.provider==='open-meteo'&&cfg.forecastStaleAfter===43200)cfg.forecastStaleAfter=3600;
        if (cfg.provider==='dwd' && cfg.staleAfter===1800) cfg.staleAfter=7200;
        else if (cfg.provider==='open-meteo' && cfg.staleAfter===7200) cfg.staleAfter=1800;
        render();
      } else updateStation();
    });
    const stationHint=el('p',undefined,'hint'); stationHint.id='station-hint';general.append(stationHint);$('settings').append(general);updateStation();
    cfg.localStation??={};
    for(const [metric,component]of Object.entries(cfg.localStation.sensorComponents||{}))cfg.localStation[metric+'Component']??=component;
    const local=card(t('Lokale Shelly-Wetterstation'),'general-settings local-station-settings',opens.has('local-station'));local.dataset.key='local-station';
    fields(local,schema.schema.properties.localStation.properties,cfg.localStation);
    local.append(el('p',t('WS90 über einen bereits eingerichteten Shelly-BTHome-Host. Sensor-IDs müssen nicht aufeinander folgen. Keine Kopplung oder Gerätekonfiguration durch dieses Plugin.'),'hint'));
    local.append(el('p',t('Die lokale Niederschlagsmenge hat noch keinen bestätigten Stundenzeitraum. Für Regen vor Ort „Regen erkannt“ wählen; Stundenmengen kommen vom Wetterdienst.'),'hint'));$('settings').append(local);
    const props = schema.schema.properties.switches.items.properties;
    cfg.switches.forEach((s, index) => {
      const d = card(s.name || t('Neuer Wetterschalter'), 'device-settings', s.id === openId || opens.has(s.id)); d.dataset.key = s.id;
      const summary = d.querySelector('summary'), tools = el('div', undefined, 'sort-controls');
      const move = offset => { [cfg.switches[index], cfg.switches[index + offset]] = [cfg.switches[index + offset], s]; render(s.id); changed(); };
      const copyButton=button('Kopieren', () => {
        const copy = structuredClone(s); copy.id = newId(); copy.name += ' '+t('Kopie'); cfg.switches.splice(index + 1, 0, copy); render(copy.id); changed();
      },false,'⧉');copyButton.className='copy-device';
      tools.append(button('↑', () => move(-1), index === 0), button('↓', () => move(1), index === cfg.switches.length - 1),copyButton);
      for(const [i,label] of ['Nach oben','Nach unten'].entries()){
        tools.children[i].setAttribute('aria-label',t(label));tools.children[i].title=t(label);
      }
      summary.append(tools);
      const body = el('div', undefined, 'device-body'); d.append(body);
      fields(body, props, s, key => { if (key === 'name') summary.querySelector('.device-title').textContent = s.name || t('Neuer Wetterschalter'); });
      body.append(el('h3', t('Bedingungen')));
      s.conditions.forEach((r, i) => {
        r.releaseThreshold ??= r.threshold + (r.operator==='above' ? -(r.hysteresis??0) : (r.hysteresis??0));
        delete r.hysteresis;
        const row = el('div', undefined, 'row'); row.append(el('h4', t('Bedingung {number}',{number:i+1}))); fields(row, props.conditions.items.properties, r,key=>{if(key==='metric'){if(r.metric!=='precipitation'&&r.aggregation==='sum')r.aggregation='max';render(s.id);}else if(key==='source'||key==='aggregation'||key==='dataSource'){if(r.source==='forecast'){r.dataSource='weather';}render(s.id);}});
        row.append(button('Bedingung entfernen', () => { s.conditions.splice(i, 1); render(s.id); changed(); })); body.append(row);
      });
      const actions = el('div', undefined, 'extension-actions');
      actions.append(button('Bedingung hinzufügen', () => { s.conditions.push({metric: 'temperature', operator: 'above', threshold: 25, hysteresis: 1}); render(s.id); changed(); }),
        button('Schalter entfernen', () => { cfg.switches.splice(index, 1); render(); changed(); }));
      body.append(actions); $('settings').append(d);
    });
  }
  function updateStation() {
    const node=$('station-hint');if(!node)return;
    if(cfg.provider!=='dwd'){node.textContent=t('Open-Meteo: globale und regionale Wettermodelle werden anhand der Koordinaten gewählt.');return;}
    try {
      if(!Number.isFinite(cfg.latitude)||!Number.isFinite(cfg.longitude))throw Error(t('Bitte zuerst Koordinaten eingeben.'));
      const s=WeatherStation.select(cfg);
      node.textContent=t('DWD: {name} ({id}), {distance} km entfernt. Messhöhen: Temperatur {temperatureHeight} m, Feuchte {humidityHeight} m, Wind {windHeight} m. Katalogstand 02.11.2026; keine Live-Messwertvorschau. Beobachtungszeitpunkt im Homebridge-Protokoll. Wind: 10-Minuten-Mittel, Böen: Maximum der letzten Stunde.',{...s,distance:s.distance.toFixed(1)});
    }catch(e){node.textContent=t(e.message);}
  }
  $('settings').addEventListener('submit', e => e.preventDefault());
  $('add-device').addEventListener('click', () => {
    const s = {id: newId(), name: t('Neuer Wetterschalter'), mode: 'all', matchedState: true, stableForSeconds: 0, failureState: 'hold', conditions: [{metric: 'windSpeed', operator: 'above', threshold: 30, hysteresis: 5}]};
    cfg.switches.push(s); render(s.id); changed();
  });
  (async () => {
    try {
      [blocks, schema] = await Promise.all([homebridge.getPluginConfig(), homebridge.getPluginConfigSchema()]);
      cfg = blocks.find(b => b.platform === 'WeatherSwitches');
      if (!cfg) { cfg = {platform: 'WeatherSwitches',provider:'dwd', language:'en', name: 'Weather switches', pollInterval: 300, staleAfter: 7200, showSensors: true, switches: []}; blocks.push(cfg); }
      else cfg.provider??='open-meteo';
      cfg.switches ??= []; render(); window.weatherStatusView=WeatherStatus.mount({t}); changed();
    } catch (e) { $('message').textContent = t('Konfiguration konnte nicht geladen werden: {error}',{error:t(e.message)}); homebridge.disableSaveButton(); }
  })();
})();
