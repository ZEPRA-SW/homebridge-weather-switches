'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../homebridge-ui/public');
const script=fs.readFileSync(path.join(root,'theme.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function page(t,{dark=false,homebridge}={}){
  const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
  t.after(()=>w.close());const media=new w.EventTarget();media.matches=dark;
  w.matchMedia=()=>media;w.homebridge=homebridge;w.eval(script);
  return {w,media,mode:()=>w.document.documentElement.dataset.weatherTheme};
}
test('appearance follows browser preference live when no Homebridge lighting API is available',async t=>{
  const {w,media,mode}=page(t,{dark:true});assert.equal(mode(),'dark');
  media.matches=false;media.dispatchEvent(new w.Event('change'));assert.equal(mode(),'light');
  w.document.body.className='modal-content config-ui-x-purple dark-mode';await tick();assert.equal(mode(),'dark');
  w.document.body.classList.remove('dark-mode');await tick();assert.equal(mode(),'light');
});
test('Homebridge explicit lighting overrides opposite system preference and resolves again on ready',async t=>{
  let current='light';const homebridge=new EventTarget();
  homebridge.serverEnv={theme:'purple'};homebridge.userCurrentLightingMode=async()=>current;
  const {w,media,mode}=page(t,{dark:true,homebridge});await tick();assert.equal(mode(),'light');
  current='dark';homebridge.dispatchEvent(new Event('ready'));await tick();assert.equal(mode(),'dark');
  w.document.body.className='modal-content config-ui-x-purple dark-mode';await tick();
  current='light';media.matches=false;media.dispatchEvent(new w.Event('change'));await tick();
  assert.equal(mode(),'light');assert.ok(w.document.body.classList.contains('dark-mode'));
});
test('older host failures retain usable lighting and explicit DOM mode changes update live',async t=>{
  const {w,mode}=page(t,{homebridge:{userCurrentLightingMode:async()=>{throw Error('unsupported');}}});
  await tick();assert.equal(mode(),'light');
  w.document.documentElement.setAttribute('data-bs-theme','dark');await tick();assert.equal(mode(),'dark');
  w.document.documentElement.setAttribute('data-bs-theme','light');await tick();assert.equal(mode(),'light');
});
test('both palettes provide readable text, status pills and graph strokes',t=>{
  const {w}=page(t);const style=w.document.createElement('style');style.textContent=fs.readFileSync(path.join(root,'style.css'),'utf8');w.document.head.append(style);
  const rules=[...style.sheet.cssRules],palettes=[rules.find(r=>r.selectorText===':root').style,rules.find(r=>r.selectorText===':root[data-weather-theme="dark"]').style];
  const luminance=hex=>{const v=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  for(const palette of palettes){
    const contrast=(a,b)=>{const x=luminance(palette.getPropertyValue('--'+a)),y=luminance(palette.getPropertyValue('--'+b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    for(const background of ['bg','panel','field'])for(const text of ['text','muted','purple','error','warning'])assert.ok(contrast(text,background)>=4.5,`${text} on ${background}`);
    for(const state of ['on','off','fault','unknown'])assert.ok(contrast(state+'-text',state+'-bg')>=4.5,state);
    for(const stroke of ['chart-series-1','chart-series-2','chart-series-3','chart-series-4','timeline-on','timeline-off','timeline-fault','timeline-unknown'])assert.ok(contrast(stroke,'panel')>=3,stroke);
  }
});
