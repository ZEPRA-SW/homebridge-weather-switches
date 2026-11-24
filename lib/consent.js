'use strict';
const fs=require('node:fs');
const {openMeteoAllowed}=require('../homebridge-ui/public/config');
function savedConsentAllowed(startupConfig,configPath){
  if(!openMeteoAllowed(startupConfig))return false;
  try{
    const root=JSON.parse(fs.readFileSync(configPath,'utf8'));
    const saved=(root.platforms||[]).find(c=>['WeatherSwitches','homebridge-weather-switches.WeatherSwitches'].includes(c.platform));
    return Boolean(saved&&(saved.provider??'open-meteo')==='open-meteo'&&openMeteoAllowed(saved));
  }catch{return false;}
}
module.exports={savedConsentAllowed};
