const cfg=window.EI_FIREBASE_CONFIG||{};
const bridge=window.EICRMBridge;
const enabled=!!(cfg.enabled&&cfg.apiKey&&cfg.projectId&&cfg.appId);
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const status=(text,tone='')=>{const el=$('#cloudStatus');if(el){el.textContent=text;el.className='cloud-pill'+(tone?' '+tone:'')}};
const setAuthNote=t=>{const el=$('#cloudAuthNote');if(el)el.textContent=t};
if($('#cloudProject'))$('#cloudProject').textContent=cfg.projectId||'—';

const PAGE_DEFS=[
  ['dashboard','Visão geral'],['imoveis','Imóveis'],['leads','Leads'],['atendimento','Atendimento'],['funil','Jornada'],
  ['agenda','Agenda'],['chaves','Chaves'],['clientes','Clientes'],['match','Match'],['proprietarios','Proprietários'],['propostas','Propostas'],
  ['financeiro','Financeiro'],['relatorios','Relatórios'],['equipe','Equipe'],['site','Site público'],['configuracoes','Ajustes']
];
const ALL_PAGES=PAGE_DEFS.map(x=>x[0]);
const ROLE_DEFAULTS={
  Administrador:[...ALL_PAGES],
  Gerente:[...ALL_PAGES],
  Corretor:['dashboard','imoveis','leads','atendimento','funil','agenda','chaves','clientes','match','proprietarios','propostas'],
  Corretora:['dashboard','imoveis','leads','atendimento','funil','agenda','chaves','clientes','match','proprietarios','propostas'],
  Financeiro:['dashboard','propostas','financeiro','relatorios'],
  Marketing:['dashboard','imoveis','leads','site','relatorios'],
  Atendimento:['dashboard','imoveis','leads','atendimento','agenda','chaves','clientes']
};
const ROLES=Object.keys(ROLE_DEFAULTS);
const safeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

if(!enabled){
  status('Modo local');
  setAuthNote('Modo local · configure firebase-config.js para ativar a nuvem.');
  window.EIFirebaseCRM={enabled:false,queueStateSync(){},queueCatalogSync(){}};
}else{
  const [appMod,authMod,fsMod]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);
  const {initializeApp,deleteApp}=appMod;
  const {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInWithRedirect,getRedirectResult,GoogleAuthProvider,signOut,updateProfile,sendPasswordResetEmail}=authMod;
  const {initializeFirestore,enableNetwork,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,collection,onSnapshot,writeBatch,serverTimestamp,runTransaction,query,orderBy,limit}=fsMod;
  const firebaseOptions={apiKey:cfg.apiKey,authDomain:cfg.authDomain,projectId:cfg.projectId,messagingSenderId:cfg.messagingSenderId,appId:cfg.appId};
  const app=initializeApp(firebaseOptions);
  const firestoreDatabaseId=cfg.databaseId||'(default)';
  const auth=getAuth(app),fs=initializeFirestore(app,{experimentalForceLongPolling:true,experimentalLongPollingOptions:{timeoutSeconds:20}},firestoreDatabaseId),wid=cfg.workspaceId||'main';
  console.info(`[AG CRM v69] Firestore databaseId=${firestoreDatabaseId}`);
  window.dispatchEvent(new CustomEvent('ag:firebase-ready'));
  window.dispatchEvent(new CustomEvent('ag:firestore-database',{detail:{databaseId:firestoreDatabaseId}}));
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  let roleProfile=null,stateTimer=null,catalogTimer=null,initialStateResolved=false,sectionUnsub=null,leadUnsub=null,ownProfileUnsub=null,adminUsersUnsub=null,adminRequestsUnsub=null;
  let lastCloudState=null,pendingRegisterName='';
  const userCache=new Map(),requestCache=new Map();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const FIRESTORE_TIMEOUT_MS=6500;
  let firestoreTransport='rest';
  function timeoutError(label='Firestore'){
    const e=new Error(`${label} não respondeu dentro do tempo esperado.`);e.code='ag/firestore-timeout';return e;
  }
  function withTimeout(promise,ms=FIRESTORE_TIMEOUT_MS,label='Firestore'){
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError(label)),ms)})
    ]);
  }
  function restDocUrl(path){
    const encoded=String(path||'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(firestoreDatabaseId)}/documents/${encoded}`;
  }
  function toRestValue(v){
    if(v===null||v===undefined)return {nullValue:null};
    if(typeof v==='string')return {stringValue:v};
    if(typeof v==='boolean')return {booleanValue:v};
    if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
    if(v instanceof Date)return {timestampValue:v.toISOString()};
    if(Array.isArray(v))return {arrayValue:{values:v.map(toRestValue)}};
    if(typeof v==='object'){
      // Firestore SDK sentinel values (serverTimestamp etc.) are intentionally converted to current ISO timestamps in REST fallback.
      const ctor=String(v?.constructor?.name||'');
      if(ctor.includes('FieldValue')||String(v?._methodName||'').includes('serverTimestamp'))return {timestampValue:new Date().toISOString()};
      const fields={};for(const [k,val] of Object.entries(v))fields[k]=toRestValue(val);return {mapValue:{fields}};
    }
    return {stringValue:String(v)};
  }
  function fromRestValue(v){
    if(!v||typeof v!=='object')return null;
    if('nullValue' in v)return null;if('stringValue' in v)return v.stringValue;if('booleanValue' in v)return v.booleanValue;
    if('integerValue' in v)return Number(v.integerValue);if('doubleValue' in v)return Number(v.doubleValue);
    if('timestampValue' in v)return v.timestampValue;
    if('arrayValue' in v)return (v.arrayValue?.values||[]).map(fromRestValue);
    if('mapValue' in v){const o={};for(const [k,val] of Object.entries(v.mapValue?.fields||{}))o[k]=fromRestValue(val);return o}
    return null;
  }
  function toRestFields(obj){const fields={};for(const [k,v] of Object.entries(obj||{}))fields[k]=toRestValue(v);return fields}
  function fromRestFields(fields){const obj={};for(const [k,v] of Object.entries(fields||{}))obj[k]=fromRestValue(v);return obj}
  async function firestoreRestRequest(path,{method='GET',data=null,user=auth.currentUser,allow404=false,timeout=7000}={}){
    if(!user)throw Object.assign(new Error('Usuário não autenticado.'),{code:'auth/no-current-user'});
    const token=await withTimeout(user.getIdToken(),5000,'Token do Firebase');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const res=await fetch(restDocUrl(path),{
        method,
        headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
        body:data==null?undefined:JSON.stringify({fields:toRestFields(data)}),
        signal:controller.signal,
        cache:'no-store'
      });
      let body=null;try{body=await res.json()}catch(e){}
      if(res.status===404&&allow404)return {exists:false,data:null,raw:body};
      if(!res.ok){
        const err=new Error(body?.error?.message||`Firestore HTTP ${res.status}`);
        err.code=`rest/${res.status}`;err.httpStatus=res.status;err.details=body?.error||null;
        if(isDatabaseMissingError(err)) err.code='ag/firestore-database-missing';
        throw err;
      }
      return {exists:true,data:fromRestFields(body?.fields||{}),raw:body};
    }catch(err){
      if(err?.name==='AbortError'){const e=timeoutError('Firestore REST');e.code='ag/firestore-rest-timeout';throw e}
      throw err;
    }finally{clearTimeout(timer)}
  }
  async function restGet(path,user=auth.currentUser){return firestoreRestRequest(path,{method:'GET',user,allow404:true})}
  async function restSet(path,data,user=auth.currentUser){return firestoreRestRequest(path,{method:'PATCH',data,user,allow404:false})}
  async function restDelete(path,user=auth.currentUser){return firestoreRestRequest(path,{method:'DELETE',user,allow404:true})}
  async function dbSet(path,data,{merge=false,user=auth.currentUser}={}){
    if(firestoreTransport==='rest'){
      if(merge){const cur=await restGet(path,user);data={...(cur.exists?cur.data:{}),...data}}
      return restSet(path,data,user);
    }
    const parts=String(path).split('/');return setDoc(doc(fs,...parts),data,{merge});
  }
  async function dbUpdate(path,data,{user=auth.currentUser}={}){
    if(firestoreTransport==='rest'){const cur=await restGet(path,user);if(!cur.exists)throw Object.assign(new Error(`Documento ${path} não existe.`),{code:'rest/404'});return restSet(path,{...cur.data,...data},user)}
    const parts=String(path).split('/');return updateDoc(doc(fs,...parts),data);
  }
  async function restList(path,user=auth.currentUser){
    if(!user)throw Object.assign(new Error('Usuário não autenticado.'),{code:'auth/no-current-user'});
    const token=await withTimeout(user.getIdToken(),5000,'Token do Firebase');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
    try{
      const res=await fetch(restDocUrl(path)+`?pageSize=200`,{headers:{'Authorization':`Bearer ${token}`},signal:controller.signal,cache:'no-store'});
      let body=null;try{body=await res.json()}catch(e){}
      if(!res.ok){const err=new Error(body?.error?.message||`Firestore HTTP ${res.status}`);err.code=`rest/${res.status}`;err.httpStatus=res.status;if(isDatabaseMissingError(err))err.code='ag/firestore-database-missing';throw err}
      return (body?.documents||[]).map(d=>({id:decodeURIComponent(String(d.name||'').split('/').pop()||''),data:fromRestFields(d.fields||{})}));
    }catch(err){if(err?.name==='AbortError'){const e=timeoutError('Firestore REST');e.code='ag/firestore-rest-timeout';throw e}throw err}finally{clearTimeout(timer)}
  }
  function isFirestoreConnectivityError(err){
    const code=String(err?.code||'').toLowerCase(),msg=String(err?.message||'').toLowerCase();
    return code.includes('unavailable')||code.includes('deadline-exceeded')||code.includes('firestore-timeout')||code.includes('firestore-rest-timeout')||msg.includes('client is offline')||msg.includes('failed to get document because the client is offline')||msg.includes('network error')||msg.includes('não respondeu dentro do tempo esperado');
  }
  function isDatabaseMissingError(err){
    const msg=String(err?.message||'').toLowerCase();
    return msg.includes('database')&&msg.includes('does not exist');
  }
  function firestoreFriendlyMessage(err){
    const code=String(err?.code||'').toLowerCase(),msg=String(err?.message||'');
    if(isFirestoreConnectivityError(err))return 'A autenticação funcionou, mas o Cloud Firestore não respondeu. No Firebase Console, confirme que o banco Firestore (default) foi criado e está ativo. Depois clique em “Tentar conectar”.';
    if(code.includes('permission-denied')||code==='rest/403')return 'O Firestore respondeu, mas as regras bloquearam o acesso. Publique o arquivo firestore.rules desta versão em Firestore Database → Regras → Publicar.';
    if(code.includes('failed-precondition')||code==='rest/404'||/database.*does not exist|firestore api.*disabled|not found/i.test(msg))return 'O Cloud Firestore de ID "default" não foi encontrado neste projeto. Em Firebase Console → Firestore Database, crie o banco padrão e depois tente novamente.';
    if(code.includes('profile-not-created'))return 'O Authentication criou a conta, mas o documento users/{uid} não foi criado. Publique as regras desta versão e tente entrar novamente; a V66 cria o perfil ausente automaticamente no primeiro login.';
    return msg||'Não foi possível acessar o Cloud Firestore.';
  }
  async function withFirestoreRetry(task,{attempts=3,delay=700,timeout=FIRESTORE_TIMEOUT_MS}={}){
    let last;
    for(let i=0;i<attempts;i++){
      try{
        // Nunca deixe enableNetwork bloquear a autenticação. Em alguns hosts/navegadores
        // essa Promise pode ficar pendente quando o canal do SDK do Firestore é bloqueado.
        withTimeout(enableNetwork(fs),1200,'Rede Firestore').catch(()=>{});
        return await withTimeout(Promise.resolve().then(task),timeout,'Firestore SDK');
      }catch(err){last=err;if(!isFirestoreConnectivityError(err)||i===attempts-1)throw err;await sleep(delay*(i+1))}
    }
    throw last;
  }
  async function ensureFirestoreOnline(){
    return withFirestoreRetry(()=>getDoc(doc(fs,'public','catalog')),{attempts:3,delay:800});
  }
  function ensureFirestoreRecoveryUI(){
    let btn=$('#firestoreRetryBtn');
    if(btn)return btn;
    const host=$('#loginStatus')?.parentElement||$('#loginForm');if(!host)return null;
    btn=document.createElement('button');btn.type='button';btn.id='firestoreRetryBtn';btn.className='register-back';btn.style.cssText='width:100%;margin-top:10px;min-height:42px;border:1px solid rgba(234,198,134,.55);color:#EAC686;background:rgba(234,198,134,.06);border-radius:12px;font-weight:800;';btn.textContent='Tentar conectar ao Firestore';host.appendChild(btn);return btn;
  }
  function hideFirestoreRecoveryUI(){const b=$('#firestoreRetryBtn');if(b)b.remove()}

  function clean(v){return JSON.parse(JSON.stringify(v))}
  function sectionRef(key){return doc(fs,'workspaces',wid,'sections',key)}
  function setLastSync(){const el=$('#cloudLastSync');if(el)el.textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
  function permissionsForProfile(profile){
    if(!profile)return [];
    if(profile.role==='Administrador')return [...ALL_PAGES];
    if(Array.isArray(profile.permissions)&&profile.permissions.length){const perms=[...new Set(profile.permissions.filter(p=>ALL_PAGES.includes(p)))];if(['Corretor','Corretora','Gerente','Atendimento'].includes(profile.role)&&!perms.includes('chaves'))perms.push('chaves');return perms;}
    return ROLE_DEFAULTS[profile.role]?[...ROLE_DEFAULTS[profile.role]]:['dashboard'];
  }
  function canPage(page){return permissionsForProfile(roleProfile).includes(page)}
  function isAdmin(){return roleProfile?.active!==false&&roleProfile?.role==='Administrador'}
  function applyProfileAccess(profile){
    const allowed=new Set(permissionsForProfile(profile));
    document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('role-hidden',!allowed.has(el.dataset.page)));
    document.querySelectorAll('[data-pagejump]').forEach(el=>{const p=el.dataset.pagejump;if(p)el.classList.toggle('role-hidden',!allowed.has(p))});
    const canalTab=$('[data-settings-tab="canalpro"]');if(canalTab)canalTab.hidden=profile?.role!=='Administrador';
    const canalPanel=$('[data-settings-panel="canalpro"]');if(canalPanel&&profile?.role!=='Administrador'&&canalPanel.classList.contains('active'))window.activateSettingsTab?.('geral');
    const userTab=$('[data-settings-tab="usuarios"]');if(userTab)userTab.hidden=profile?.role!=='Administrador';
    const userPanel=$('[data-settings-panel="usuarios"]');if(userPanel&&profile?.role!=='Administrador'){if(userPanel.classList.contains('active'))window.activateSettingsTab?.('geral');userPanel.classList.remove('active')}
    const active=document.querySelector('.page.active')?.id?.replace('page-','');if(active&&!allowed.has(active))bridge.navigate('dashboard');
    if($('#cloudRole'))$('#cloudRole').textContent=profile?.role||'—';
    renderCurrentAccessSummary();
  }
  function sectionPermission(key){
    const map={settings:'configuracoes',properties:'imoveis',prospectings:'imoveis',owners:'proprietarios',leads:'leads',tasks:'atendimento',siteEvents:'atendimento',automation:'configuracoes',clients:'clientes',appointments:'agenda',proposals:'propostas',contracts:'propostas',commissions:'financeiro',finance:'financeiro',users:'equipe',keys:'chaves',keyMovements:'chaves'};
    return map[key]||null;
  }
  function canWriteSection(key){
    if(isAdmin())return true;
    if(['activities','timeline'].includes(key))return !!roleProfile?.active;
    const perm=sectionPermission(key);return perm?canPage(perm):false;
  }
  function newUserBase(user,nameOverride=''){
    const email=String(user.email||'').trim().toLowerCase();
    return {
      uid:user.uid,
      name:nameOverride||pendingRegisterName||user.displayName||email.split('@')[0]||'Novo usuário',
      email,
      provider:user.providerData?.[0]?.providerId||'password'
    };
  }
  function plainProfile(base,extra={}){return {...base,...extra,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}
  async function provisionMissingProfileSdk(user,nameOverride=''){
    const base=newUserBase(user,nameOverride),uref=doc(fs,'users',user.uid),bootstrapRef=doc(fs,'system','bootstrap');
    const rref=doc(fs,'accessRequests',user.uid),invRef=base.email?doc(fs,'accessInvites',base.email):null;
    return withFirestoreRetry(()=>runTransaction(fs,async tx=>{
      const existing=await tx.get(uref);if(existing.exists())return existing.data();
      const boot=await tx.get(bootstrapRef);
      if(!boot.exists()){
        const profile={...base,role:'Administrador',permissions:[...ALL_PAGES],active:true,approvalStatus:'approved',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
        tx.set(uref,profile);tx.set(bootstrapRef,{initialized:true,adminUid:user.uid,adminEmail:base.email,createdAt:serverTimestamp()});return profile;
      }
      // V66: todo cadastro posterior ao primeiro administrador entra como pendente.
      // A liberação é feita exclusivamente pelo Administrador em Ajustes > Usuários e permissões.
      const profile={...base,role:'Corretor',permissions:[],active:false,approvalStatus:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      tx.set(uref,profile);tx.set(rref,{...base,status:'pending',reason:'Cadastro solicitado',requestedAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});return profile;
    }),{attempts:2,delay:500,timeout:5000});
  }
  async function provisionMissingProfileRest(user,nameOverride=''){
    const base=newUserBase(user,nameOverride);
    const existing=await restGet(`users/${user.uid}`,user);
    if(existing.exists)return existing.data;

    // V66: o bootstrap é criado ANTES do perfil do primeiro administrador.
    // Assim, se o Authentication já possui o usuário e o Firestore está vazio,
    // o primeiro login consegue inicializar o banco sem depender de um documento users prévio.
    let boot=await restGet('system/bootstrap',user);
    if(!boot.exists){
      const bootPayload={initialized:true,adminUid:user.uid,adminEmail:base.email,createdAt:new Date().toISOString()};
      try{
        await restSet('system/bootstrap',bootPayload,user);
        boot={exists:true,data:bootPayload};
      }catch(err){
        // Outra sessão pode ter feito o bootstrap no mesmo instante. Releia antes de falhar.
        const reread=await restGet('system/bootstrap',user).catch(()=>({exists:false,data:null}));
        if(!reread.exists)throw err;
        boot=reread;
      }
    }

    // Se este UID é o administrador definido no bootstrap, reconstrua o perfil admin
    // mesmo que o usuário tenha sido criado manualmente no Authentication.
    if(boot.data?.adminUid===user.uid){
      const profile=plainProfile(base,{role:'Administrador',permissions:[...ALL_PAGES],active:true,approvalStatus:'approved'});
      await restSet(`users/${user.uid}`,profile,user);
      const verify=await restGet(`users/${user.uid}`,user);
      if(!verify.exists){const e=new Error('O Firestore não confirmou a criação do perfil do administrador.');e.code='ag/profile-not-created';throw e}
      return verify.data;
    }

    // V66: depois que o primeiro administrador existe, qualquer novo cadastro
    // (e-mail/senha ou Google) é criado como pendente e precisa ser aprovado
    // em Ajustes > Usuários e permissões.
    const profile=plainProfile(base,{role:'Corretor',permissions:[],active:false,approvalStatus:'pending'});
    await restSet(`users/${user.uid}`,profile,user);
    await restSet(`accessRequests/${user.uid}`,{...base,status:'pending',reason:'Cadastro solicitado',requestedAt:new Date().toISOString(),updatedAt:new Date().toISOString()},user);
    const verify=await restGet(`users/${user.uid}`,user);
    if(!verify.exists){const e=new Error('O Firestore não confirmou a criação do perfil pendente.');e.code='ag/profile-not-created';throw e}
    return verify.data;
  }
  async function ensureProfile(user){
    // V66: autenticação e criação/leitura do perfil usam REST HTTPS como caminho primário, com bootstrap-first.
    // Isso evita o travamento "Conectando ao Firestore…" observado quando o SDK fica offline.
    firestoreTransport='rest';
    status('Conectando ao Firestore','syncing');
    setAuthNote(`Firebase autenticado · Firestore: ${firestoreDatabaseId} · HTTPS v71`);
    let profile=null;
    try{
      profile=await withTimeout(
        provisionMissingProfileRest(user,pendingRegisterName||user.displayName||''),
        11000,
        'Perfil no Firestore'
      );
    }catch(err){
      console.error('Firestore REST / perfil',err);
      throw err;
    }
    if(!profile){const e=new Error('A conta foi autenticada, mas o perfil não pôde ser criado no Firestore.');e.code='ag/profile-not-created';throw e}
    if(profile.approvalStatus==='pending'){const e=new Error('Seu cadastro foi criado no Firestore e está aguardando aprovação do administrador da AG.');e.code='ag/pending-approval';throw e}
    if(profile.approvalStatus==='rejected'){const e=new Error('Seu acesso foi recusado. Fale com o administrador da AG.');e.code='ag/access-rejected';throw e}
    return profile;
  }
  async function syncRosterInvites(){
    if(!isAdmin())return;
    const users=bridge.getState()?.users||[],byEmail=new Map();
    if(firestoreTransport==='rest'){const profiles=await restList('users');profiles.forEach(d=>{const email=String(d.data?.email||'').trim().toLowerCase();if(email)byEmail.set(email,d.id)});for(const u of users.filter(u=>u.email)){const email=String(u.email).trim().toLowerCase(),role=u.role||'Corretor',payload={email,name:u.name||'',role,permissions:Array.isArray(u.permissions)?u.permissions:(ROLE_DEFAULTS[role]||ROLE_DEFAULTS.Corretor),active:u.active!==false,updatedAt:new Date().toISOString()};await dbSet(`accessInvites/${email}`,payload,{merge:true});const uid=byEmail.get(email);if(uid)await dbSet(`users/${uid}`,payload,{merge:true})}return}
    const profiles=await getDocs(collection(fs,'users'));profiles.forEach(d=>{const x=d.data(),email=String(x.email||'').trim().toLowerCase();if(email)byEmail.set(email,d.id)});const batch=writeBatch(fs);users.filter(u=>u.email).forEach(u=>{const email=String(u.email).trim().toLowerCase(),role=u.role||'Corretor',payload={email,name:u.name||'',role,permissions:Array.isArray(u.permissions)?u.permissions:(ROLE_DEFAULTS[role]||ROLE_DEFAULTS.Corretor),active:u.active!==false,updatedAt:serverTimestamp()};batch.set(doc(fs,'accessInvites',email),payload,{merge:true});const uid=byEmail.get(email);if(uid)batch.set(doc(fs,'users',uid),payload,{merge:true})});await batch.commit();
  }
  function isInlineImage(src){return typeof src==='string'&&src.startsWith('data:image/')}
  function cloudSafeState(state){
    const out=clean(state);
    for(const p of (out.properties||[])){
      p.photos=(p.photos||[]).map(ph=>{
        if(!isInlineImage(ph?.src))return ph;
        const copy={...ph,src:'',localOnly:true};delete copy.storagePath;return copy;
      });
    }
    return out;
  }
  function mergeLocalOnlyMedia(remote){
    const current=bridge.getState()||{},localProps=current.properties||[];
    if(!Array.isArray(remote.properties))return remote;
    remote.properties=remote.properties.map(rp=>{
      const lp=localProps.find(x=>String(x.id)===String(rp.id));if(!lp)return rp;
      const localPhotos=lp.photos||[],byId=new Map(localPhotos.map(ph=>[String(ph.id||''),ph]));
      const merged=(rp.photos||[]).map(ph=>{
        const local=byId.get(String(ph.id||''));
        if((!ph.src||ph.localOnly)&&local&&isInlineImage(local.src))return {...ph,src:local.src,localOnly:true};
        return ph;
      });
      const known=new Set(merged.map(ph=>String(ph.id||'')));
      for(const local of localPhotos){
        if(isInlineImage(local?.src)&&!known.has(String(local.id||'')))merged.push({...local,localOnly:true});
      }
      return {...rp,photos:merged};
    });
    return remote;
  }
  function cloudSafeCatalog(catalog){
    const out=clean(catalog);
    for(const p of (out.properties||[])){
      p.photos=(p.photos||[]).filter(ph=>!isInlineImage(ph?.src));
      if(p.coverPhoto&&!p.photos.some(ph=>String(ph.id)===String(p.coverPhoto)))p.coverPhoto=p.photos[0]?.id||'';
    }
    return out;
  }
  async function saveStateNow(force=false){
    if(!auth.currentUser||!roleProfile?.active)return;
    status('Sincronizando','syncing');
    if(firestoreTransport==='rest'){
      try{
        const state=cloudSafeState(bridge.getState());
        for(const [key,value] of Object.entries(state)){if(!canWriteSection(key))continue;await restSet(`workspaces/${wid}/sections/${key}`,{value,updatedAt:new Date().toISOString()})}
        await restSet(`workspaces/${wid}`,{version:68,updatedAt:new Date().toISOString(),updatedBy:auth.currentUser.uid});
        if(isAdmin())await syncRosterInvites();
        lastCloudState=state;status('Online via HTTPS','online');setLastSync();return;
      }catch(err){console.error('Firestore REST state sync',err);status('Erro de sync','error');bridge.toast(firestoreFriendlyMessage(err));return}
    }
    try{
      const state=cloudSafeState(bridge.getState());
      const batch=writeBatch(fs);let writes=0;
      for(const [key,value] of Object.entries(state)){if(!canWriteSection(key))continue;batch.set(sectionRef(key),{value,updatedAt:serverTimestamp()},{merge:true});writes++}
      batch.set(doc(fs,'workspaces',wid),{version:26,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid},{merge:true});writes++;
      if(writes)await batch.commit();
      if(isAdmin())await syncRosterInvites();
      lastCloudState=state;status('Online','online');setLastSync();
    }catch(err){
      if(isFirestoreConnectivityError(err)){
        try{firestoreTransport='rest';const state=cloudSafeState(bridge.getState());for(const [key,value] of Object.entries(state)){if(!canWriteSection(key))continue;await restSet(`workspaces/${wid}/sections/${key}`,{value,updatedAt:new Date().toISOString()})}await restSet(`workspaces/${wid}`,{version:63,updatedAt:new Date().toISOString(),updatedBy:auth.currentUser.uid});lastCloudState=state;status('Online via HTTPS','online');setLastSync();return}catch(restErr){console.error('REST state sync',restErr)}
      }
      console.error('Firebase state sync',err);status('Erro de sync','error');bridge.toast('Não foi possível sincronizar com o Firestore.');}
  }
  async function saveCatalogNow(){
    if(!auth.currentUser||!roleProfile?.active||(!isAdmin()&&!canPage('imoveis')&&!canPage('site')))return;
    if(firestoreTransport==='rest'){try{await restSet('public/catalog',cloudSafeCatalog(bridge.catalog()));setLastSync()}catch(err){console.warn('Firestore REST catalog sync',err)}return}
    try{await withTimeout(setDoc(doc(fs,'public','catalog'),cloudSafeCatalog(bridge.catalog()),{merge:false}),5000,'Catálogo Firestore');setLastSync()}catch(err){try{firestoreTransport='rest';await restSet('public/catalog',cloudSafeCatalog(bridge.catalog()));setLastSync()}catch(restErr){console.warn('Firebase catalog sync',err,restErr)}}
  }
  function queueStateSync(){clearTimeout(stateTimer);stateTimer=setTimeout(()=>saveStateNow(),700)}
  function queueCatalogSync(){clearTimeout(catalogTimer);catalogTimer=setTimeout(()=>saveCatalogNow(),500)}
  let restStateTimer=null;
  async function pullStateRest(){
    if(!auth.currentUser||firestoreTransport!=='rest')return;
    try{const docs=await restList(`workspaces/${wid}/sections`);const remote={};docs.forEach(x=>remote[x.id]=x.data?.value);if(docs.length){initialStateResolved=true;const mergedRemote=mergeLocalOnlyMedia(remote);lastCloudState=mergedRemote;bridge.replaceState({...bridge.getState(),...mergedRemote});status('Online via HTTPS','online');setLastSync()}else if(!initialStateResolved&&isAdmin()){initialStateResolved=true;await saveStateNow(true);await saveCatalogNow()}}catch(err){console.warn('REST state pull',err)}
  }
  function startStateListener(){
    sectionUnsub?.();clearInterval(restStateTimer);
    if(firestoreTransport==='rest'){pullStateRest();restStateTimer=setInterval(pullStateRest,15000);return}
    const cref=collection(fs,'workspaces',wid,'sections');
    sectionUnsub=onSnapshot(cref,async snap=>{const remote={};snap.forEach(d=>remote[d.id]=d.data().value);if(!snap.empty){initialStateResolved=true;const mergedRemote=mergeLocalOnlyMedia(remote);lastCloudState=mergedRemote;bridge.replaceState({...bridge.getState(),...mergedRemote});status('Online','online');setLastSync()}else if(!initialStateResolved&&isAdmin()){initialStateResolved=true;await saveStateNow(true);await saveCatalogNow()}},err=>{console.error(err);if(isFirestoreConnectivityError(err)){firestoreTransport='rest';startStateListener()}else status('Erro de leitura','error')});
  }
  async function claimAndProcess(d){
    const dref=d.ref;let claimed=false;
    try{claimed=await runTransaction(fs,async tx=>{const s=await tx.get(dref);if(!s.exists())return false;const data=s.data();if(data.processed===true)return false;if(data.claimedBy){const age=Date.now()-new Date(data.claimedAt||0).getTime();if(Number.isFinite(age)&&age<120000&&data.claimedBy!==auth.currentUser.uid)return false}tx.update(dref,{claimedBy:auth.currentUser.uid,claimedAt:new Date().toISOString()});return true})}catch(e){return}
    if(!claimed)return;
    try{const data=d.data();const event={...data,id:data.id||d.id};const ok=bridge.processSiteEvent(event);if(ok){bridge.persistLocal();await saveStateNow(true)}await updateDoc(dref,{processed:true,processedAt:new Date().toISOString(),processedBy:auth.currentUser.uid})}catch(err){console.error('Lead cloud processing',err);try{await updateDoc(dref,{processingError:String(err?.message||err),claimedBy:null})}catch(e){}}
  }
  function startLeadListener(){
    leadUnsub?.();if(!canPage('leads')&&!canPage('atendimento')&&!isAdmin())return;
    if(firestoreTransport==='rest')return;
    const q=query(collection(fs,'siteLeads'),orderBy('createdAt','desc'),limit(100));
    leadUnsub=onSnapshot(q,s=>s.docChanges().forEach(c=>{if(c.type==='added'&&c.doc.data().processed!==true)claimAndProcess(c.doc)}),err=>console.warn('siteLeads listener',err));
  }
  function ensureRosterLink(user,profile){
    const state=bridge.getState(),email=String(user.email||'').toLowerCase();if(!email)return;
    const existing=(state.users||[]).find(u=>String(u.email||'').toLowerCase()===email);
    if(existing){existing.role=profile.role;existing.permissions=permissionsForProfile(profile);existing.active=profile.active!==false;existing.firebaseUid=user.uid}
    else{state.users=state.users||[];state.users.push({id:'U'+Date.now().toString(36).toUpperCase(),name:profile.name||user.displayName||email,role:profile.role,permissions:permissionsForProfile(profile),email,phone:'',active:true,closed:0,pipeline:0,firebaseUid:user.uid})}
    bridge.persistLocal();
  }

  function authErrorMessage(err){
    const code=err?.code||'';
    if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')return 'E-mail ou senha incorretos.';
    if(code==='auth/email-already-in-use')return 'Este e-mail já possui uma conta. Use Entrar ou Google.';
    if(code==='auth/weak-password')return 'A senha precisa ter pelo menos 6 caracteres.';
    if(code==='auth/unauthorized-domain')return `O domínio ${location.hostname||'atual'} ainda não está autorizado no Firebase Authentication.`;
    if(code==='auth/network-request-failed')return 'Falha de conexão com o Firebase. Verifique a internet e tente novamente.';
    if(code==='auth/configuration-not-found')return 'A autenticação ainda não está configurada neste projeto Firebase.';
    if(code==='auth/web-storage-unsupported')return 'O navegador bloqueou o armazenamento necessário para o login. Verifique as configurações de privacidade.';
    if(code==='auth/operation-not-allowed')return 'Este método de login ainda não foi habilitado no Firebase Authentication.';
    return err?.message||'Não foi possível concluir a autenticação.';
  }
  function setLoginMessage(text,tone='info'){const el=$('#loginStatus');if(!el)return;el.textContent=text||'';el.dataset.tone=tone}
  function showRegister(show){
    $('#loginSigninFields')?.classList.toggle('hidden',show);$('#loginRegisterPanel')?.classList.toggle('hidden',!show);
    $('#loginError').textContent='';setLoginMessage(show?'Crie sua conta. Após o cadastro, o administrador aprova o acesso.':'','info');
  }
  $('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();$('#loginError').textContent='';setLoginMessage('Entrando…');try{await signInWithEmailAndPassword(auth,$('#loginEmail').value.trim(),$('#loginPassword').value)}catch(err){$('#loginError').textContent=authErrorMessage(err);setLoginMessage('','')}},true);
  let googleBusy=false,googleWatchdog=null;
  function setGoogleBusy(busy,message=''){
    googleBusy=busy;const btn=$('#loginGoogle');
    if(btn){btn.disabled=busy;btn.classList.toggle('is-loading',busy);btn.setAttribute('aria-busy',busy?'true':'false')}
    if(message)setLoginMessage(message,busy?'pending':'info');
  }
  async function startGoogleLogin(){
    if(googleBusy)return;
    $('#loginError').textContent='';
    if(location.protocol==='file:'){
      $('#loginError').textContent='O login com Google precisa do CRM publicado em http/https. Abra pela hospedagem, não diretamente pelo arquivo.';
      setLoginMessage('','');return;
    }
    setGoogleBusy(true,'Redirecionando para o Google…');
    clearTimeout(googleWatchdog);
    googleWatchdog=setTimeout(()=>{
      if(document.visibilityState==='visible'&&googleBusy){
        setGoogleBusy(false,'');
        $('#loginError').textContent='O Google não abriu. Verifique se o domínio desta hospedagem está autorizado no Firebase Authentication e tente novamente.';
      }
    },8000);
    try{
      await signInWithRedirect(auth,provider);
    }catch(err){
      clearTimeout(googleWatchdog);setGoogleBusy(false,'');
      $('#loginError').textContent=authErrorMessage(err);
    }
  }
  $('#loginGoogle')?.addEventListener('click',startGoogleLogin);
  try{
    const redirectResult=await getRedirectResult(auth);
    if(redirectResult?.user){setLoginMessage('Google conectado. Validando seu acesso…','info')}
  }catch(err){
    setGoogleBusy(false,'');
    $('#loginError').textContent=authErrorMessage(err);
  }

  function setRegisterBusy(busy){const btn=$('#loginRegisterSubmit');if(!btn)return;btn.disabled=busy;btn.setAttribute('aria-busy',busy?'true':'false');btn.innerHTML=busy?'Criando conta…':'Cadastrar <span>→</span>'}
  $('#loginRegisterSubmit')?.addEventListener('click',async()=>{
    const name=$('#registerName')?.value.trim(),email=$('#registerEmail')?.value.trim().toLowerCase(),pass=$('#registerPassword')?.value||'',confirm=$('#registerConfirm')?.value||'';
    $('#loginError').textContent='';hideFirestoreRecoveryUI();if(!name||!email){$('#loginError').textContent='Informe nome e e-mail.';return}if(pass.length<6){$('#loginError').textContent='A senha precisa ter pelo menos 6 caracteres.';return}if(pass!==confirm){$('#loginError').textContent='As senhas não conferem.';return}
    pendingRegisterName=name;setRegisterBusy(true);setLoginMessage('Criando conta no Firebase Authentication…','pending');
    try{
      const cred=await createUserWithEmailAndPassword(auth,email,pass);
      await updateProfile(cred.user,{displayName:name});
      setLoginMessage('Conta criada no Authentication. Criando perfil no Firestore…','pending');
      await completeAuthenticatedSession(cred.user);
    }
    catch(err){setRegisterBusy(false);$('#loginError').textContent=firestoreFriendlyMessage(err)||authErrorMessage(err);if(!auth.currentUser)pendingRegisterName='';setLoginMessage(auth.currentUser?'Conta criada no Authentication, mas falta concluir o perfil no Firestore.':'','pending')}
  });
  $('#logoutBtn')?.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();await signOut(auth)},true);

  $('#cloudTestBtn')?.addEventListener('click',async()=>{try{status('Testando','syncing');firestoreTransport='rest';await restGet('public/catalog');status('Online via HTTPS','online');bridge.toast('Firestore conectado via HTTPS.')}catch(e){status('Erro','error');bridge.toast(firestoreFriendlyMessage(e))}});
  $('#cloudPushBtn')?.addEventListener('click',async()=>{await saveStateNow(true);await saveCatalogNow();bridge.toast('Dados autorizados enviados para a nuvem.')});
  $('#cloudPullBtn')?.addEventListener('click',()=>{if(lastCloudState){bridge.replaceState({...bridge.getState(),...lastCloudState});bridge.toast('Dados da nuvem aplicados.')}else bridge.toast('Aguardando primeira leitura da nuvem.')});

  function formatTs(v){try{const d=v?.toDate?v.toDate():new Date(v);return d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(e){return '—'}}
  function renderCurrentAccessSummary(){
    const el=$('#agCurrentAccess');if(!el)return;
    if(!roleProfile){el.innerHTML='<span>Faça login para visualizar o perfil de acesso.</span>';return}
    el.innerHTML=`<div><b>${safeText(roleProfile.name||auth.currentUser?.displayName||'Usuário')}</b><span>${safeText(roleProfile.email||auth.currentUser?.email||'')}</span></div><div><b>${safeText(roleProfile.role||'')}</b><span>${permissionsForProfile(roleProfile).length} áreas liberadas</span></div>`;
  }
  function renderPermissionChecks(container,selected=[]){
    if(!container)return;const set=new Set(selected);
    container.innerHTML=PAGE_DEFS.map(([id,label])=>`<label class="ag-permission-check"><input type="checkbox" value="${id}" ${set.has(id)?'checked':''}><span>${label}</span></label>`).join('');
  }
  function roleOptions(selected){return ROLES.map(r=>`<option ${r===selected?'selected':''}>${r}</option>`).join('')}
  let restAdminTimer=null;
  async function refreshAdminConsoleRest(){
    if(!isAdmin()||firestoreTransport!=='rest')return;
    try{const [users,requests]=await Promise.all([restList('users'),restList('accessRequests')]);userCache.clear();users.forEach(x=>userCache.set(x.id,{uid:x.id,...x.data}));requestCache.clear();requests.forEach(x=>requestCache.set(x.id,{uid:x.id,...x.data}));renderAdminConsole()}catch(err){console.warn('REST admin console',err)}
  }
  function startAdminConsole(){
    adminUsersUnsub?.();adminRequestsUnsub?.();clearInterval(restAdminTimer);
    if(!isAdmin()){renderAdminConsole();return}
    if(firestoreTransport==='rest'){refreshAdminConsoleRest();restAdminTimer=setInterval(refreshAdminConsoleRest,12000);return}
    adminUsersUnsub=onSnapshot(collection(fs,'users'),snap=>{userCache.clear();snap.forEach(d=>userCache.set(d.id,{uid:d.id,...d.data()}));renderAdminConsole()},err=>{console.warn('users listener',err);if(isFirestoreConnectivityError(err)){firestoreTransport='rest';startAdminConsole()}});
    adminRequestsUnsub=onSnapshot(collection(fs,'accessRequests'),snap=>{requestCache.clear();snap.forEach(d=>requestCache.set(d.id,{uid:d.id,...d.data()}));renderAdminConsole()},err=>{console.warn('access requests listener',err);if(isFirestoreConnectivityError(err)){firestoreTransport='rest';startAdminConsole()}});
  }
  function renderAdminConsole(){
    const lock=$('#agUsersAdminLock'),content=$('#agUsersAdminContent');if(!lock||!content)return;
    lock.hidden=isAdmin();content.hidden=!isAdmin();if(!isAdmin())return;
    const pending=[...requestCache.values()].filter(r=>r.status==='pending').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const reqList=$('#agPendingAccessList');
    reqList.innerHTML=pending.length?pending.map(r=>`<div class="ag-access-row"><div class="ag-access-person"><span class="ag-access-avatar">${safeText((r.name||r.email||'?').slice(0,1).toUpperCase())}</span><div><b>${safeText(r.name||'Novo usuário')}</b><small>${safeText(r.email||'')} · ${safeText(r.provider||'cadastro')} · ${formatTs(r.requestedAt)}</small></div></div><div class="ag-access-actions"><select class="form-control ag-request-role" data-request-role="${r.uid}">${roleOptions('Corretor')}</select><button class="btn primary small" data-approve-user="${r.uid}">Aprovar</button><button class="btn danger small" data-reject-user="${r.uid}">Recusar</button></div></div>`).join(''):'<div class="ag-access-empty">Nenhum cadastro aguardando aprovação.</div>';
    const users=[...userCache.values()].filter(u=>u.approvalStatus!=='pending'&&u.approvalStatus!=='rejected').sort((a,b)=>String(a.name||a.email||'').localeCompare(String(b.name||b.email||'')));
    const userList=$('#agAccessUserList');
    userList.innerHTML=users.length?users.map(u=>`<div class="ag-user-row" data-user-row="${u.uid}"><div class="ag-access-person"><span class="ag-access-avatar">${safeText((u.name||u.email||'?').slice(0,1).toUpperCase())}</span><div><b>${safeText(u.name||'Usuário')}</b><small>${safeText(u.email||'')} · ${u.active===false?'inativo':'ativo'} · ${permissionsForProfile(u).length} permissões</small></div></div><div class="ag-access-actions"><select class="form-control ag-user-role" data-user-role="${u.uid}" ${u.uid===auth.currentUser?.uid?'disabled':''}>${roleOptions(u.role||'Corretor')}</select><button class="btn small" data-edit-permissions="${u.uid}">Permissões</button><button class="btn small" data-reset-password="${u.uid}">Redefinir senha</button>${u.uid===auth.currentUser?.uid?'':`<button class="btn ${u.active===false?'primary':'danger'} small" data-toggle-user="${u.uid}">${u.active===false?'Ativar':'Desativar'}</button>`}</div></div>`).join(''):'<div class="ag-access-empty">Nenhum usuário aprovado.</div>';
  }
  async function upsertRosterFromProfile(uid,profile){
    const state=bridge.getState();state.users=state.users||[];const email=String(profile.email||'').toLowerCase();let row=state.users.find(u=>u.firebaseUid===uid||String(u.email||'').toLowerCase()===email);
    if(!row){row={id:'U'+Date.now().toString(36).toUpperCase(),name:profile.name||email,role:profile.role||'Corretor',email,phone:'',active:profile.active!==false,closed:0,pipeline:0,firebaseUid:uid};state.users.push(row)}
    Object.assign(row,{name:profile.name||row.name,email,role:profile.role||row.role,permissions:permissionsForProfile(profile),active:profile.active!==false,firebaseUid:uid});bridge.persistLocal();queueStateSync();
  }
  function agCrmAccessUrl(){
    try{
      const u=new URL(window.location.href);
      u.search='';u.hash='';
      if(/\/index\.html?$/i.test(u.pathname))u.pathname=u.pathname.replace(/\/index\.html?$/i,'/');
      return u.href;
    }catch(e){return String(window.location.href||'')}
  }
  async function sendWelcomeEmailToUser(profile){
    const email=String(profile?.email||'').trim().toLowerCase();
    if(!email)return {sent:false,reason:'no-email'};
    if(!window.AGDriveGateway?.configured?.())return {sent:false,reason:'drive-not-configured'};
    try{
      await window.AGDriveGateway.request('welcomeEmail',{
        email,
        name:String(profile?.name||email),
        role:String(profile?.role||'Usuário'),
        accessUrl:agCrmAccessUrl()
      });
      return {sent:true};
    }catch(err){
      console.warn('AG CRM: usuário criado/aprovado, mas o e-mail de boas-vindas falhou.',err);
      return {sent:false,reason:err?.message||String(err)};
    }
  }

  async function approveRequest(uid){
    if(!isAdmin())return;const r=requestCache.get(uid);if(!r)return;const role=$(`[data-request-role="${uid}"]`)?.value||'Corretor';const permissions=ROLE_DEFAULTS[role]||ROLE_DEFAULTS.Corretor;
    const profile={uid,name:r.name||r.email,email:String(r.email||'').toLowerCase(),role,permissions,active:true,approvalStatus:'approved',approvedAt:serverTimestamp(),approvedBy:auth.currentUser.uid,updatedAt:serverTimestamp()};
    await dbSet(`users/${uid}`,profile,{merge:true});await dbUpdate(`accessRequests/${uid}`,{status:'approved',approvedAt:new Date().toISOString(),approvedBy:auth.currentUser.uid});await upsertRosterFromProfile(uid,profile);await refreshAdminConsoleRest();
    const welcome=await sendWelcomeEmailToUser(profile);
    bridge.toast(welcome.sent?'Usuário aprovado. E-mail de boas-vindas enviado.':'Usuário aprovado e liberado. O e-mail de boas-vindas não pôde ser enviado.');
  }
  async function rejectRequest(uid){if(!isAdmin())return;if(firestoreTransport==='rest'){await dbUpdate(`accessRequests/${uid}`,{status:'rejected',rejectedAt:new Date().toISOString(),rejectedBy:auth.currentUser.uid});await dbSet(`users/${uid}`,{active:false,approvalStatus:'rejected',updatedAt:new Date().toISOString(),updatedBy:auth.currentUser.uid},{merge:true});await refreshAdminConsoleRest()}else{const batch=writeBatch(fs);batch.update(doc(fs,'accessRequests',uid),{status:'rejected',rejectedAt:serverTimestamp(),rejectedBy:auth.currentUser.uid});batch.set(doc(fs,'users',uid),{active:false,approvalStatus:'rejected',updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid},{merge:true});await batch.commit()}bridge.toast('Solicitação recusada.')}
  async function createUserByAdmin(){
    if(!isAdmin())return;const name=$('#adminCreateName').value.trim(),email=$('#adminCreateEmail').value.trim().toLowerCase(),role=$('#adminCreateRole').value,pass=$('#adminCreatePassword').value;
    if(!name||!email||pass.length<6){bridge.toast('Preencha nome, e-mail e senha temporária com 6+ caracteres.');return}
    const perms=[...document.querySelectorAll('#adminCreatePermissions input:checked')].map(i=>i.value);const permissions=role==='Administrador'?[...ALL_PAGES]:(perms.length?perms:(ROLE_DEFAULTS[role]||ROLE_DEFAULTS.Corretor));
    let secondaryApp=null,secondaryAuth=null;
    try{
      secondaryApp=initializeApp(firebaseOptions,'ag-user-create-'+Date.now());secondaryAuth=getAuth(secondaryApp);const cred=await createUserWithEmailAndPassword(secondaryAuth,email,pass);await updateProfile(cred.user,{displayName:name});await signOut(secondaryAuth);
      const profile={uid:cred.user.uid,name,email,role,permissions,active:true,approvalStatus:'approved',createdAt:new Date().toISOString(),createdBy:auth.currentUser.uid,updatedAt:new Date().toISOString()};await dbSet(`users/${cred.user.uid}`,profile);await dbSet(`accessInvites/${email}`,{name,email,role,permissions,active:true,createdAt:new Date().toISOString()},{merge:true});await upsertRosterFromProfile(cred.user.uid,profile);await refreshAdminConsoleRest();
      const welcome=await sendWelcomeEmailToUser(profile);
      $('#adminCreateName').value='';$('#adminCreateEmail').value='';$('#adminCreatePassword').value='';bridge.toast(welcome.sent?'Usuário criado e e-mail de boas-vindas enviado. Compartilhe a senha temporária por um canal seguro.':'Usuário criado. O e-mail de boas-vindas não pôde ser enviado; compartilhe a senha temporária por um canal seguro.');
    }catch(err){console.error(err);bridge.toast(authErrorMessage(err))}finally{if(secondaryApp)try{await deleteApp(secondaryApp)}catch(e){}}
  }
  function openPermissionEditor(uid){
    const u=userCache.get(uid),box=$('#agPermissionEditor');if(!u||!box)return;box.hidden=false;box.dataset.uid=uid;$('#agPermissionEditorTitle').textContent=`Permissões · ${u.name||u.email}`;renderPermissionChecks($('#agPermissionChecks'),permissionsForProfile(u));box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function savePermissionEditor(){
    if(!isAdmin())return;const box=$('#agPermissionEditor'),uid=box?.dataset.uid,u=userCache.get(uid);if(!uid||!u)return;const role=$(`[data-user-role="${uid}"]`)?.value||u.role||'Corretor';let permissions=[...document.querySelectorAll('#agPermissionChecks input:checked')].map(i=>i.value);if(role==='Administrador')permissions=[...ALL_PAGES];
    await dbUpdate(`users/${uid}`,{role,permissions,updatedAt:new Date().toISOString(),updatedBy:auth.currentUser.uid});await dbSet(`accessInvites/${String(u.email||'').toLowerCase()}`,{name:u.name||'',email:String(u.email||'').toLowerCase(),role,permissions,active:u.active!==false,updatedAt:new Date().toISOString()},{merge:true});await upsertRosterFromProfile(uid,{...u,role,permissions});await refreshAdminConsoleRest();box.hidden=true;bridge.toast('Permissões atualizadas.');
  }
  async function toggleUser(uid){if(!isAdmin()||uid===auth.currentUser?.uid)return;const u=userCache.get(uid);if(!u)return;const active=u.active===false;await dbUpdate(`users/${uid}`,{active,updatedAt:new Date().toISOString(),updatedBy:auth.currentUser.uid});if(u.email)await dbSet(`accessInvites/${String(u.email).toLowerCase()}`,{active,updatedAt:new Date().toISOString()},{merge:true});await upsertRosterFromProfile(uid,{...u,active});await refreshAdminConsoleRest();bridge.toast(active?'Usuário ativado.':'Usuário desativado.')}
  async function resetUserPassword(uid){if(!isAdmin())return;const u=userCache.get(uid);if(!u?.email)return;try{await sendPasswordResetEmail(auth,u.email);bridge.toast('E-mail para redefinição de senha enviado.')}catch(err){bridge.toast(authErrorMessage(err))}}

  $('#adminCreateRole')?.addEventListener('change',e=>renderPermissionChecks($('#adminCreatePermissions'),ROLE_DEFAULTS[e.target.value]||ROLE_DEFAULTS.Corretor));
  $('#adminCreateUser')?.addEventListener('click',createUserByAdmin);
  $('#agSavePermissions')?.addEventListener('click',savePermissionEditor);
  $('#agCancelPermissions')?.addEventListener('click',()=>{const b=$('#agPermissionEditor');if(b)b.hidden=true});
  document.addEventListener('click',async e=>{
    const approve=e.target.closest('[data-approve-user]');if(approve){await approveRequest(approve.dataset.approveUser);return}
    const reject=e.target.closest('[data-reject-user]');if(reject){await rejectRequest(reject.dataset.rejectUser);return}
    const edit=e.target.closest('[data-edit-permissions]');if(edit){openPermissionEditor(edit.dataset.editPermissions);return}
    const toggle=e.target.closest('[data-toggle-user]');if(toggle){await toggleUser(toggle.dataset.toggleUser);return}
    const reset=e.target.closest('[data-reset-password]');if(reset){await resetUserPassword(reset.dataset.resetPassword);return}
  });
  document.addEventListener('change',async e=>{
    const roleSel=e.target.closest('[data-user-role]');if(!roleSel||!isAdmin())return;const uid=roleSel.dataset.userRole,u=userCache.get(uid);if(!u||uid===auth.currentUser?.uid)return;const role=roleSel.value,permissions=ROLE_DEFAULTS[role]||ROLE_DEFAULTS.Corretor;
    try{await dbUpdate(`users/${uid}`,{role,permissions,updatedAt:new Date().toISOString(),updatedBy:auth.currentUser.uid});if(u.email)await dbSet(`accessInvites/${String(u.email).toLowerCase()}`,{role,permissions,updatedAt:new Date().toISOString()},{merge:true});await upsertRosterFromProfile(uid,{...u,role,permissions});await refreshAdminConsoleRest();bridge.toast('Perfil e permissões padrão atualizados.')}catch(err){console.error(err);bridge.toast('Não foi possível alterar o perfil.')}
  });
  renderPermissionChecks($('#adminCreatePermissions'),ROLE_DEFAULTS.Corretor);

  const PRODUCTION_RESET_VERSION=82;
  function productionEmptyState(){
    const current=bridge.getState()||{};
    return {
      ...current,
      settings:{...(current.settings||{}),name:'AG',cnpj:'',phone:'',email:'',address:'',siteBrand:'AG',siteTagline:(current.settings?.siteTagline||'Imóveis para viver o próximo capítulo.'),siteWhatsapp:'',siteRegion:(current.settings?.siteRegion||'Jaraguá do Sul e região'),productionResetVersion:PRODUCTION_RESET_VERSION},
      properties:[],prospectings:[],leads:[],clients:[],appointments:[],proposals:[],finance:[],activities:[],owners:[],contracts:[],commissions:[],timelines:[],tasks:[],siteEvents:[],users:[],
      automation:{roundRobin:true,rrIndex:0,slaMinutes:15,followupHours:24}
    };
  }
  async function ensureProductionResetV82(){
    if(!isAdmin()||!auth.currentUser)return;
    let remoteSettings={exists:false,data:null};
    try{
      if(firestoreTransport==='rest'){
        const snap=await restGet(`workspaces/${wid}/sections/settings`);
        remoteSettings={exists:snap.exists,data:snap.exists?(snap.data?.value||{}):null};
      }else{
        const snap=await withTimeout(getDoc(sectionRef('settings')),5000,'Leitura das configurações do workspace');
        remoteSettings={exists:snap.exists(),data:snap.exists()?(snap.data()?.value||{}):null};
      }
    }catch(err){console.warn('Leitura do marcador de base limpa',err)}
    if(Number(remoteSettings?.data?.productionResetVersion||0)>=PRODUCTION_RESET_VERSION)return;
    localStorage.removeItem('atlasImobCRM');
    localStorage.removeItem('eiSiteLeadInboxV1');
    localStorage.removeItem('eiSiteLeadPingV1');
    bridge.replaceState(productionEmptyState());
    await saveStateNow(true);
    await saveCatalogNow();
    lastCloudState=cloudSafeState(bridge.getState());
    bridge.toast('Base do CRM zerada e pronta para os cadastros reais.');
  }

  let authProcessing=false;
  async function completeAuthenticatedSession(user){
    if(!user||authProcessing)return;authProcessing=true;hideFirestoreRecoveryUI();setRegisterBusy(false);setLoginMessage(`Autenticação concluída. Conectando ao Firestore · banco ${firestoreDatabaseId} · HTTPS v82…`,'pending');
    try{
      roleProfile=await withTimeout(ensureProfile(user),12500,'Inicialização do perfil');pendingRegisterName='';if(roleProfile.active===false)throw new Error('Acesso inativo. Fale com o administrador.');
      localStorage.setItem('nexoSessionV1',JSON.stringify({email:user.email,name:roleProfile.name||user.displayName||user.email,role:roleProfile.role,uid:user.uid,at:new Date().toISOString()}));
      bridge.setLoginVisible(false);if($('#cloudUser'))$('#cloudUser').textContent=user.email||user.uid;applyProfileAccess(roleProfile);setAuthNote(`Firebase online · ${roleProfile.role}${firestoreTransport==='rest'?' · HTTPS':''}`);status(firestoreTransport==='rest'?'Online via HTTPS':'Online','online');await ensureProductionResetV82();ensureRosterLink(user,roleProfile);startStateListener();startLeadListener();queueCatalogSync();startAdminConsole();setLoginMessage('','');$('#loginError').textContent='';
      ownProfileUnsub?.();if(firestoreTransport==='sdk')ownProfileUnsub=onSnapshot(doc(fs,'users',user.uid),async snap=>{if(!snap.exists())return;const next=snap.data();if(next.active===false){bridge.toast('Seu acesso foi desativado.');await signOut(auth);return}roleProfile=next;applyProfileAccess(roleProfile);startLeadListener();startAdminConsole()},err=>{console.warn('Perfil em tempo real',err);if(isFirestoreConnectivityError(err)){firestoreTransport='rest';startStateListener();startAdminConsole()}});
    }catch(err){
      console.error('Finalização de acesso',err);setRegisterBusy(false);
      if(isFirestoreConnectivityError(err)||String(err?.code||'').includes('permission-denied')||String(err?.code||'').includes('failed-precondition')){
        bridge.setLoginVisible(true);const msg=firestoreFriendlyMessage(err);$('#loginError').textContent=msg;setLoginMessage('A autenticação funcionou, mas o Firestore não respondeu nem pelo modo HTTPS.','pending');status('Firestore indisponível','error');
        const retry=ensureFirestoreRecoveryUI();if(retry)retry.onclick=()=>completeAuthenticatedSession(auth.currentUser);
        return;
      }
      const msg=err.code==='ag/pending-approval'?err.message:(err.message||'Acesso não liberado.');setLoginMessage(msg,err.code==='ag/pending-approval'?'pending':'error');$('#loginError').textContent=err.code==='ag/pending-approval'?'':msg;pendingRegisterName='';await signOut(auth);
    }finally{authProcessing=false}
  }
  onAuthStateChanged(auth,async user=>{
    ownProfileUnsub?.();adminUsersUnsub?.();adminRequestsUnsub?.();
    if(!user){roleProfile=null;localStorage.removeItem('nexoSessionV1');bridge.setLoginVisible(true);applyProfileAccess(null);if($('#cloudUser'))$('#cloudUser').textContent='—';status('Aguardando login','syncing');setAuthNote('Firebase ativo · entre com sua conta ou cadastre-se.');sectionUnsub?.();leadUnsub?.();renderAdminConsole();setRegisterBusy(false);return}
    await completeAuthenticatedSession(user);
  });

  window.EIFirebaseCRM={enabled:true,queueStateSync,queueCatalogSync,saveStateNow,saveCatalogNow,getProfile:()=>roleProfile,permissionsForProfile};
}
