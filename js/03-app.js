/* V24 classic bridge: connects the existing CRM engine to the Firebase module without changing the UI logic. */
(function(){
  const clone=v=>JSON.parse(JSON.stringify(v));
  window.EICRMBridge={
    getState:()=>db,
    replaceState(next){
      if(!next||typeof next!=='object')return;
      db={...db,...clone(next)};
      // V115: Firestore snapshots must never reintroduce two records with the same property code.
      if(Array.isArray(db.properties)){
        const unique=[],byCode=new Map();
        for(const p of db.properties){
          const code=String(p?.id||'').trim().toUpperCase();
          if(!code){unique.push(p);continue}
          if(!byCode.has(code)){byCode.set(code,unique.length);unique.push(p);continue}
          const i=byCode.get(code),prev=unique[i]||{};
          const prevPhotos=Array.isArray(prev.photos)?prev.photos:[],nextPhotos=Array.isArray(p?.photos)?p.photos:[];
          const photos=[...prevPhotos,...nextPhotos].filter((ph,j,arr)=>arr.findIndex(x=>String(x?.id||x?.driveFileId||x?.src||'')===String(ph?.id||ph?.driveFileId||ph?.src||''))===j);
          unique[i]={...prev,...p,photos};
          if(!unique[i].coverPhoto||!photos.some(ph=>String(ph.id)===String(unique[i].coverPhoto)))unique[i].coverPhoto=photos[0]?.id||'';
        }
        db.properties=unique;
      }
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
