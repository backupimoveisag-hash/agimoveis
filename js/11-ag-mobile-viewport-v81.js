/* AG CRM V81 — viewport mobile/PWA */
(()=>{
  const root=document.documentElement;
  const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const standalone=(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true;
  if(isiOS && standalone) root.style.setProperty('--ag-ios-bottom-fallback','34px');
  const sync=()=>{
    const h=(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight);
    root.style.setProperty('--ag-mobile-viewport',`${Math.round(h)}px`);
  };
  sync();
  window.addEventListener('resize',sync,{passive:true});
  window.visualViewport?.addEventListener('resize',sync,{passive:true});
})();
