'use strict';
const {weatherValueFresh}=require('../homebridge-ui/public/config');
function currentInput(condition,weather,local,config,now=Date.now()){
  const metric=condition.metric,requestedSource=condition.dataSource||'weather';
  const input=origin=>{
    const sample=origin==='local'?local:weather,time=origin==='local'?sample?.metricTimes?.[metric]:metric==='precipitation'?sample?.precipitationTime:sample?.time;
    const value=sample?.values?.[metric],enabled=origin!=='local'||config.localStation?.enabled,limit=origin==='local'?config.localStation?.staleAfter:config.staleAfter;
    const present=typeof value==='number'&&Number.isFinite(value),fresh=origin==='weather'?weatherValueFresh(sample,metric,limit,now):Number.isFinite(time)&&time<=now+60000&&now-time<=limit*1000;
    return {source:'current',metric,requestedSource,origin,value:present?value:null,available:!!enabled&&present&&fresh,reason:!enabled?'disabled':!present?sample?.unavailable?.[metric]||'missing':!fresh?'stale':null,sourceName:sample?.source||(origin==='local'?'Shelly WS90':config.provider==='dwd'?'DWD':'Open-Meteo (Modell)'),validFrom:Number.isFinite(time)?time-(metric==='precipitation'?3600000:0):null,validTo:time??null};
  };
  if(requestedSource==='local')return input('local');
  if(requestedSource==='prefer-local'){const primary=input('local');if(primary.available)return primary;return {...input('weather'),fallback:true,fallbackReason:primary.reason};}
  return input('weather');
}
module.exports={currentInput};
