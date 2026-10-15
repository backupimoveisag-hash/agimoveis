/* V24 classic bridge: connects the existing CRM engine to the Firebase module without changing the UI logic. */
(function(){
  const clone=v=>JSON.parse(JSON.stringify(v));
  window.EICRMBridge={
    getState:()=>db,
    replaceState(next){
      if(!next||typeof next!=='object')return;
      db={...db,...clone(next)};
      try{localStorage.setItem('atlasImobCRM',JSON.stringify(db))}catch(e){}
      try{ensureV5Schema();ensurePropertyMediaSchema();ensureV7SiteSchema();ensureAutomationSchema()}catch(e){}
      renderAll();
    },
    persistLocal(){try{localStorage.setItem('atlasImobCRM',JSON.stringify(db))}catch(e){}renderAll()},
    catalog:()=>getPublicCatalog(),
    processSiteEvent:ev=>processOneSiteEvent(ev),
    toast:msg=>toast(msg),
    setLoginVisible(show){document.body.classList.toggle('auth-required',!!show);document.getElementById('loginScreen')?.classList.toggle('hidden',!show)},
    navigate:page=>navigate(page)
  };
  const _saveDB=saveDB;
  saveDB=function(){_saveDB();window.EIFirebaseCRM?.queueStateSync?.()};
  const _syncPublicCatalog=syncPublicCatalog;
  syncPublicCatalog=function(){_syncPublicCatalog();window.EIFirebaseCRM?.queueCatalogSync?.();window.EIFirebaseCRM?.queueStateSync?.()};
  const _addPropertyPhotos=addPropertyPhotos;
  addPropertyPhotos=async function(){const r=await _addPropertyPhotos.apply(this,arguments);window.EIFirebaseCRM?.queueStateSync?.();window.EIFirebaseCRM?.queueCatalogSync?.();return r};
  window.addPropertyPhotos=addPropertyPhotos;
})();
