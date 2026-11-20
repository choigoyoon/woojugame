/** Cache updates wait for an explicit safe reload; no mid-game forced activation. */
export function setupPWA(beforeReload = () => {}) {
  if(!('serviceWorker' in navigator)||!['https:','http:'].includes(location.protocol))return;
  // The optional standalone export has no service-worker files; Pages serves the root app.
  if(location.pathname.includes('/dist/'))return;
  let applying=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying)location.reload();});
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(registration=>{
    function offer(){
      if(!registration.waiting||!navigator.serviceWorker.controller)return;
      let banner=document.querySelector('#app-update');if(banner)return;
      banner=document.createElement('aside');banner.id='app-update';banner.setAttribute('aria-label','앱 업데이트');
      const label=document.createElement('span');label.textContent='새 버전이 준비됐어요';
      const apply=document.createElement('button');apply.textContent='저장하고 다시 열기';
      const later=document.createElement('button');later.textContent='나중에';
      apply.addEventListener('click',()=>{beforeReload();applying=true;registration.waiting?.postMessage({type:'ACTIVATE'});});
      later.addEventListener('click',()=>banner.remove());banner.append(label,apply,later);document.body.append(banner);
    }
    offer();registration.addEventListener('updatefound',()=>{const installing=registration.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed')offer();});});
  }).catch(()=>{/* Initial offline/private sessions remain playable from loaded assets. */});
}
