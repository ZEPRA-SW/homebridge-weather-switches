'use strict';
// Local configuration UI harness. Never connects to Homebridge or a weather service.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../homebridge-ui/public');
const example=require('../example.config.json'),schema=require('../config.schema.json');
http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){
    const mock=`<script>window.previewSaved=null;window.previewSaveEnabled=false;window.homebridge={getPluginConfig:async()=>${JSON.stringify([example])},getPluginConfigSchema:async()=>(${JSON.stringify(schema)}),updatePluginConfig:async(c)=>{window.previewSaved=c;return c;},enableSaveButton:()=>window.previewSaveEnabled=true,disableSaveButton:()=>window.previewSaveEnabled=false};</script>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+mock+fs.readFileSync(path.join(root,'index.html'),'utf8')+'</body></html>');return;
  }
  const name=pathname.slice(1);
  if(!/^[a-z.-]+$/.test(name)){res.writeHead(404);res.end();return;}
  const filename=path.join(root,name);
  if(!fs.existsSync(filename)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');res.end(fs.readFileSync(filename));
}).listen(8766,'127.0.0.1',()=>console.log('UI preview: http://127.0.0.1:8766'));
