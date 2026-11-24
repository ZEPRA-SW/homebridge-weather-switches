'use strict';
// Input is a verified, paginated RPC snapshot using the Shelly Universal approach.
// Shelly has already decoded BTHome scaling; only m/s -> km/h is converted here.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const address=value=>typeof value==='string'?value.toLowerCase().replace(/[:-]/g,''):'';
const hostId=value=>typeof value==='string'?value.toLowerCase().replace(/:/g,''):'';
const specs={
  temperature:{objects:[0x45,0x02],index:0,min:-100,max:70},
  humidity:{objects:[0x2e,0x03],index:0,min:0,max:100},
  windSpeed:{objects:[0x44],index:0,min:0,max:500,convert:value=>value*3.6},
  windGusts:{objects:[0x44],index:1,min:0,max:500,convert:value=>value*3.6},
  illuminance:{objects:[0x05],index:0,min:0,max:1000000},
  raining:{objects:[0x20],index:0,binary:true},
  precipitationRaw:{objects:[0x5f],index:0,min:0,max:1000000},
};
function inspectWs90(snapshot,config,now=Date.now()){
  const expected=hostId(config.shellyDeviceId),actual=snapshot?.info||{};
  if(!expected||![hostId(actual.id),hostId(actual.mac)].includes(expected))throw Error('WS90: Shelly-Host-ID stimmt nicht überein.');
  if(!/^bthomedevice:\d+$/.test(config.deviceComponent||''))throw Error('WS90: BTHome-Gerätekomponente erforderlich.');
  const components=snapshot.components;
  if(!Array.isArray(components)||components.length>1000)throw Error('WS90: ungültige Komponentenliste.');
  const device=components.find(c=>c.key===config.deviceComponent),addr=address(device?.config?.addr);
  // Pairing describes BLE connection access, not the validity of received sensor
  // advertisements. Unpaired devices can still supply fresh BTHome values.
  if(!/^[a-f0-9]{12}$/.test(addr)||device.status?.errors?.length)throw Error('WS90: BTHome-Gerät fehlt oder meldet einen Fehler.');
  const staleAfter=config.staleAfter??120;
  if(!finite(staleAfter)||staleAfter<10||staleAfter>86400)throw Error('WS90: ungültiges Datenalter.');
  const values={},extras={},metricTimes={},sensors={},unavailable={};
  for(const [metric,spec]of Object.entries(specs)){
    const chosen=config.sensorComponents?.[metric];
    if(chosen!==undefined&&!/^bthomesensor:\d+$/.test(chosen))throw Error('WS90: ungültige Sensorkomponente.');
    const matches=components.filter(c=>c.key?.startsWith('bthomesensor:')&&address(c.config?.addr)===addr&&spec.objects.includes(c.config?.obj_id)&&(c.config?.idx??0)===spec.index&&(!chosen||c.key===chosen));
    if(matches.length!==1){unavailable[metric]=matches.length?'ambiguous':'missing';continue;}
    const sensor=matches[0],timestamp=sensor.status?.last_updated_ts??sensor.status?.last_update_ts,time=finite(timestamp)?timestamp*1000:NaN;
    sensors[metric]=sensor.key;
    if(!finite(time)||time<=0||time>now+60000||now-time>staleAfter*1000){unavailable[metric]='stale';continue;}
    if(sensor.status?.errors?.length){unavailable[metric]='error';continue;}
    const raw=sensor.status?.value;
    if(spec.binary){
      if(![true,false,0,1].includes(raw)){unavailable[metric]='invalid';continue;}extras[metric]=!!raw;
    }else{
      const value=spec.convert&&finite(raw)?spec.convert(raw):raw;
      if(!finite(value)||value<spec.min||value>spec.max){unavailable[metric]='invalid';continue;}
      if(metric==='precipitationRaw')extras[metric]=value;else values[metric]=value;
    }
    metricTimes[metric]=time;
  }
  return {source:'Shelly WS90',hostId:actual.id||actual.mac,deviceComponent:config.deviceComponent,addr,values,extras,metricTimes,sensors,unavailable};
}
module.exports={inspectWs90};
