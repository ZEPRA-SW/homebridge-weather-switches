'use strict';
// Homebridge supplies its theme on the iframe body. Honour that choice before
// using the browser preference; changing appearance must never change config.
(() => {
  const root=document.documentElement,body=document.body;
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  let lighting=null,request=0;
  function namedTheme(value){
    if(!value||value==='auto')return null;
    if(['dark','dark-mode','dark-mode-v1'].includes(value))return 'dark';
    return value==='light'?'light':null;
  }
  function update(){
    let theme=null;
    for(const node of [root,body]){
      const explicit=node.getAttribute('data-bs-theme');
      if(explicit==='light'||explicit==='dark'){theme=explicit;break;}
    }
    if(!theme){
      const classes=[...root.classList,...body.classList];
      // Initial host classes can survive a later OS/lighting-mode change.
      // A freshly resolved API mode therefore takes precedence over them.
      theme??=lighting;
      if(!theme&&classes.includes('dark-mode'))theme='dark';
      const host=classes.find(name=>/^config-ui-x-dark-mode(?:-v1)?$/.test(name));
      theme??=namedTheme(host?.slice('config-ui-x-'.length));
      // Homebridge injects modal-content even when its explicit light setting
      // differs from the OS. Accent classes (purple, blue, etc.) are not modes.
      if(!theme&&body.classList.contains('modal-content'))theme='light';
    }
    theme??=namedTheme(window.homebridge?.serverEnv?.theme);
    root.dataset.weatherTheme=theme||(media?.matches?'dark':'light');
  }
  async function refresh(){
    update();
    if(typeof window.homebridge?.userCurrentLightingMode!=='function')return;
    const current=++request;
    try{
      const mode=await window.homebridge.userCurrentLightingMode();
      if(current!==request)return;
      lighting=mode==='light'||mode==='dark'?mode:null;
      update();
    }catch{/* Older hosts can reject the request; browser/host classes suffice. */}
  }
  const observer=new MutationObserver(refresh);
  for(const node of [root,body])observer.observe(node,{attributes:true,attributeFilter:['class','data-bs-theme']});
  media?.addEventListener?.('change',refresh);
  window.homebridge?.addEventListener?.('ready',refresh);
  refresh();
})();
