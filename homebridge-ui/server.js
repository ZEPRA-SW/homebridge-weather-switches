'use strict';
const {HomebridgePluginUiServer,RequestError}=require('@homebridge/plugin-ui-utils');
const {requestStatus}=require('../lib/status-ipc');
const {readHistory,databasePath,clearHistory,PERIODS}=require('../lib/history');
class UiServer extends HomebridgePluginUiServer{
  constructor(){
    super();
    this.onRequest('/history',async payload=>{
      const period=payload?.period||'day';if(!['day','week','month','year'].includes(period))throw new RequestError('Invalid period');
      let current=null;try{current=await requestStatus(this.homebridgeStoragePath);}catch{/* Offline is a real state, not a fabricated snapshot. */}
      try{return readHistory(databasePath(this.homebridgeStoragePath),period,Date.now(),current);}
      catch{
        const now=Date.now();
        return {connection:current?.running?'online':'offline',fresh:Boolean(current?.weatherTime&&now-current.weatherTime<=current.staleAfter*1000),current:current?{...current,historyError:'History unavailable'}:null,
          period,from:now-PERIODS[period],to:now,samples:[],hourly:[],events:[],sessions:[],forecastInputs:[],historyUnavailable:true};
      }
    });
    this.onRequest('/clear-history',async payload=>{
      if(payload?.confirmed!==true)throw new RequestError('Confirmation required');
      try{
        try{return await requestStatus(this.homebridgeStoragePath,'clear');}
        catch(error){if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;clearHistory(databasePath(this.homebridgeStoragePath));return {cleared:true};}
      }catch{throw new RequestError('History unavailable');}
    });
    this.ready();
  }
}
if(require.main===module)new UiServer();
module.exports={UiServer};
