const cfg=window.EI_FIREBASE_CONFIG||{};
const enabled=!!(cfg.enabled&&cfg.apiKey&&cfg.projectId&&cfg.appId);
if(enabled){
  try{
    const [appMod,fsMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
    ]);
    const {initializeApp}=appMod;const {getFirestore,doc,setDoc,onSnapshot}=fsMod;
    const app=initializeApp(cfg),fs=getFirestore(app,cfg.databaseId||'(default)');
    window.EIFirebaseSite={
      enabled:true,
      async submitLead(event){try{await setDoc(doc(fs,'siteLeads',event.id),{...event,processed:false},{merge:false})}catch(err){console.warn('Lead mantido na fila local; Firebase indisponível.',err)}}
    };
    onSnapshot(doc(fs,'public','catalog'),snap=>{
      if(!snap.exists())return;
      const remote=snap.data();if(!remote?.properties)return;
      normalizeAgCatalog(remote);
      catalog=remote;
      document.documentElement.dataset.catalogSource='firebase';
      document.documentElement.dataset.catalogSyncedAt=remote.syncedAt||new Date().toISOString();
      renderHeader();renderLocationFilters();renderProperties();renderFavorites();renderLocations();renderRecentlyViewed();
      if(activeProperty&&document.getElementById('modalBg')?.classList.contains('show')){const p=catalog.properties.find(x=>x.id===activeProperty.id);if(p)openProperty(p.id)}
    },err=>console.warn('Catálogo Firebase indisponível; usando cache local.',err));
  }catch(err){console.warn('Firebase não inicializado; site operando em modo local.',err)}
}else window.EIFirebaseSite={enabled:false,submitLead:async()=>{}};
