// Upgrade from releases without a worker: do not mix cached old imports with new game modules.
async function boot() {
  const loading=document.querySelector('#loading');
  if('serviceWorker' in navigator&&globalThis.isSecureContext){
    let registration;
    try{registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});}
    catch{/* Restricted/private browsers may still play the regular web app. */}
    if(registration){
      let timeout;
      try{
        await Promise.race([
          navigator.serviceWorker.ready.then(()=>navigator.serviceWorker.controller?undefined:new Promise(resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});if(navigator.serviceWorker.controller)resolve();})),
          new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('App installation timed out')),15000);const installing=registration.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='redundant'&&!registration.active)reject(Error('Incomplete app installation'));});})
        ]);
      }finally{clearTimeout(timeout);}
      // Reload the stylesheet through the coherent worker cache too.
      const style=document.querySelector('link[rel="stylesheet"]');
      if(style)await new Promise(resolve=>{style.onload=resolve;style.onerror=resolve;style.href='./css/style.css?installed';});
    }
  }
  await import('./main.js');
  loading?.remove();
}
window.__ujuReady=boot().catch(error=>{
  const loading=document.querySelector('#loading');if(!loading)return;
  loading.textContent=error?.code==='FUTURE_SAVE'?'저장된 기록을 열려면 새 버전이 필요해요. 기록은 그대로 보관하고 있어요.':'연결을 확인하고 다시 열어 주세요.';
  // Startup stops before main initializes; still offer a waiting update without saving defaults.
  if(error?.code==='FUTURE_SAVE')import('./pwa.js').then(({setupPWA})=>setupPWA()).catch(()=>{});
  const retry=document.createElement('button');retry.textContent='다시 열기';retry.onclick=()=>location.reload();loading.append(retry);
});
