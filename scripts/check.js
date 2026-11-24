'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function scan(dir) {
  for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
    if(['node_modules','.preview'].includes(item.name))continue;
    const filename=path.join(dir,item.name);
    if(item.isDirectory())scan(filename);
    else if(filename.endsWith('.js'))execFileSync(process.execPath,['--check',filename]);
  }
}
scan(root);
JSON.parse(fs.readFileSync(path.join(root,'config.schema.json'),'utf8'));
require('../homebridge-ui/public/config').validate(require('../example.config.json'));
require('../homebridge-ui/public/config').validate(require('../example.forecast.config.json'));
require('../homebridge-ui/public/config').validate(require('../example.local.config.json'));
console.log('JavaScript-Syntax, Schema-JSON und Beispielkonfiguration gültig.');
