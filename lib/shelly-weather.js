'use strict';
const {createHash,randomBytes}=require('node:crypto');
const {responseText}=require('./http');
const {inspectWs90}=require('./ws90');
const hash=value=>createHash('sha256').update(value).digest('hex');
function hostUrl(host){
  if(typeof host!=='string'||!host.trim()||/\s/.test(host))throw Error('Shelly-Adresse fehlt oder ist ungültig.');
  const url=new URL(/^https?:\/\//i.test(host)?host:'http://'+host);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Shelly-Adresse: nur Host/IP mit optionalem Port.');
  return url;
}
const normalized=value=>String(value||'').toLowerCase().replace(/:/g,'');
function matchesHost(info,expected){const id=normalized(expected);return !!id&&[normalized(info?.id),normalized(info?.mac)].includes(id);}
function digest(challenge,password,method,path,count){
  if(!password||challenge.algorithm?.toUpperCase()!=='SHA-256'||!challenge.realm||challenge.nonce===undefined||!challenge.qop?.split(',').map(v=>v.trim()).includes('auth'))throw Error('Shelly-Authentifizierung fehlgeschlagen.');
  const nc=count.toString(16).padStart(8,'0'),cnonce=randomBytes(12).toString('hex');
  const fields={username:'admin',realm:challenge.realm,nonce:challenge.nonce,uri:path,algorithm:'SHA-256',response:hash(`${hash('admin:'+challenge.realm+':'+password)}:${challenge.nonce}:${nc}:${cnonce}:auth:${hash(method+':'+path)}`),qop:'auth',nc,cnonce,...(challenge.opaque?{opaque:challenge.opaque}:{})};
  const quote=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  return 'Digest '+Object.entries(fields).map(([key,value])=>key+'='+(['algorithm','qop','nc'].includes(key)?value:quote(value))).join(', ');
}
class ShellyWeatherClient{
  constructor(config,fetcher=fetch){this.config=config;this.base=hostUrl(config.host);this.fetcher=fetcher;this.sequence=0;this.count=0;}
  async http(path,body,signal){
    for(let attempt=0;attempt<2;attempt++){
      signal?.throwIfAborted();const method=body?'POST':'GET',headers={'Content-Type':'application/json'};
      if(this.challenge)headers.Authorization=digest(this.challenge,this.config.password,method,path,++this.count);
      let response;try{response=await this.fetcher(new URL(path,this.base),{method,headers,signal,redirect:'error',...(body?{body:JSON.stringify(body)}:{})});}catch{signal?.throwIfAborted();throw Error('Shelly nicht erreichbar oder Zeitlimit überschritten.');}
      if(response.status===401&&attempt===0){
        const header=response.headers?.get('www-authenticate')||'',challenge={};for(const match of header.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g))challenge[match[1]]=match[2]??match[3];
        await response.body?.cancel?.();if(!/^Digest /i.test(header))throw Error('Shelly-Authentifizierung fehlgeschlagen.');this.challenge=challenge;this.count=0;continue;
      }
      if(!response.ok){await response.body?.cancel?.();throw Error('Shelly HTTP-Fehler '+response.status);}
      let result;try{result=JSON.parse(await responseText(response,500000));}catch{signal?.throwIfAborted();throw Error('Ungültige oder zu große Shelly-Antwort.');}
      if(!result||typeof result!=='object'||Array.isArray(result))throw Error('Ungültige Shelly-Antwort.');return result;
    }
    throw Error('Shelly-Authentifizierung fehlgeschlagen.');
  }
  async rpc(method,params,signal){
    if(method!=='Shelly.GetComponents')throw Error('Shelly-RPC ist nicht zum Lesen freigegeben.');
    const id=++this.sequence,data=await this.http('/rpc',{id,method,params},signal);
    if(data.error||data.id!==id||!data.result)throw Error('Ungültige Shelly-RPC-Antwort.');return data.result;
  }
  async read(signal){
    const timeout=AbortSignal.timeout(8000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
    const info=await this.http('/shelly',null,combined);
    if(!matchesHost(info,this.config.shellyDeviceId))throw Error('WS90: Shelly-Host-ID stimmt nicht überein.');
    if(!(info.gen>=2)&&info.app!=='WallDisplay')throw Error('WS90 benötigt einen Shelly-Host mit lokaler RPC-/BTHome-Unterstützung.');
    const components=[],seen=new Set();let total;
    for(let offset=0;offset<1000;){
      const page=await this.rpc('Shelly.GetComponents',{offset,include:['config','status'],dynamic_only:true},combined);
      if(!Array.isArray(page.components)||!Number.isInteger(page.total)||page.total<0||page.total>1000||total!==undefined&&page.total!==total)throw Error('Ungültige BTHome-Komponentenliste.');
      total=page.total;
      for(const component of page.components){if(!component||typeof component.key!=='string'||seen.has(component.key))throw Error('Ungültige BTHome-Komponentenliste.');seen.add(component.key);components.push(component);}
      offset+=page.components.length;if(offset>total)throw Error('Ungültige BTHome-Komponentenliste.');if(offset===total)break;if(!page.components.length)throw Error('Unvollständige BTHome-Komponentenliste.');
    }
    const sample=inspectWs90({info,components},this.config);
    if(typeof sample.extras.raining==='boolean'){sample.values.raining=Number(sample.extras.raining);}
    return sample;
  }
}
function localNamespace(config){return 'local:'+hash(JSON.stringify([config.latitude,config.longitude,normalized(config.localStation?.shellyDeviceId),config.localStation?.deviceComponent])).slice(0,24);}
module.exports={ShellyWeatherClient,hostUrl,matchesHost,localNamespace};
