/* V167 — identidade do usuário autenticado + sincronização automática de proprietários */
(function(){
  'use strict';

  const normText=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const digits=v=>String(v||'').replace(/\D/g,'');
  const normEmail=v=>String(v||'').trim().toLowerCase();
  const nowISO=()=>new Date().toISOString();
  let syncQueued=false;
  let syncing=false;

  function authIdentity(){
    try{
      const auth=window.EIFirebaseCRM?.getAuthUser?.()||null;
      const profile=window.EIFirebaseCRM?.getProfile?.()||null;
      const session=(()=>{try{return JSON.parse(localStorage.getItem('nexoSessionV1')||'null')}catch(e){return null}})();
      return {auth,profile,session};
    }catch(e){return {auth:null,profile:null,session:null}}
  }

  function currentFirstName(){
    const {auth,profile,session}=authIdentity();
    // O Authentication é a fonte mais segura para não misturar dois administradores
    // no mesmo navegador. O perfil Firestore entra em seguida e a sessão local é só fallback.
    const raw=auth?.displayName||profile?.name||profile?.displayName||auth?.email||profile?.email||session?.name||session?.email||'Usuário';
    return String(raw).trim().split(/\s+/)[0]||'Usuário';
  }

  function refreshGreeting(){
    try{
      if(typeof window.v25SessionName==='function'){
        window.v25SessionName=currentFirstName;
      }
      if(typeof window.renderV25Greeting==='function')window.renderV25Greeting();
      const {auth,profile}=authIdentity();
      if(auth?.uid||profile?.uid){
        const merged={
          email:auth?.email||profile?.email||'',
          name:auth?.displayName||profile?.name||profile?.displayName||auth?.email||profile?.email||'Usuário',
          role:profile?.role||'Usuário',
          uid:auth?.uid||profile?.uid||'',
          at:nowISO()
        };
        localStorage.setItem('nexoSessionV1',JSON.stringify(merged));
      }
    }catch(e){console.warn('V167: não foi possível atualizar saudação',e)}
  }

  function propertyOwnerData(p){
    const name=String(p?.owner||p?.ownerName||'').trim();
    if(!name)return null;
    const cpf=String(p?.ownerCpf||'').trim();
    const cnpj=String(p?.ownerCnpj||'').trim();
    return {
      name,
      doc:cpf||cnpj,
      phone:String(p?.ownerPhone1||p?.ownerPhone||'').trim(),
      phone2:String(p?.ownerPhone2||'').trim(),
      email:String(p?.ownerEmail||'').trim(),
      address:String(p?.ownerAddress||'').trim(),
      profession:String(p?.ownerProfession||'').trim(),
      rg:String(p?.ownerRg||'').trim(),
      civilStatus:String(p?.ownerCivilStatus||'').trim(),
      spouseName:String(p?.spouseName||'').trim(),
      spouseProfession:String(p?.spouseProfession||'').trim(),
      spouseRg:String(p?.spouseRg||'').trim(),
      spouseCpf:String(p?.spouseCpf||'').trim(),
      spousePhone:String(p?.spousePhone1||'').trim(),
      broker:String(p?.broker||p?.brokerName||p?.responsibleBroker||'').trim(),
      exclusivity:String(p?.exclusiveSale||'').toLowerCase()==='sim'?'Exclusivo':'Não exclusivo',
      capture:String(p?.created||p?.capture||p?.createdAt||'').slice(0,10),
      sourcePropertyId:String(p?.id||'').trim()
    };
  }

  function sameOwner(owner,data){
    if(!owner||!data)return false;
    const d1=digits(owner.doc),d2=digits(data.doc);
    const e1=normEmail(owner.email),e2=normEmail(data.email);
    const p1=digits(owner.phone),p2=digits(data.phone);
    if(d1&&d2&&d1===d2)return true;
    if(e1&&e2&&e1===e2)return true;
    if(p1&&p2&&p1===p2)return true;
    // Se ambos possuem identificadores fortes e eles não coincidem, não juntar
    // apenas porque duas pessoas têm o mesmo nome.
    const ownerHasStrong=!!(d1||e1||p1),dataHasStrong=!!(d2||e2||p2);
    if(ownerHasStrong&&dataHasStrong)return false;
    return !!normText(owner.name)&&normText(owner.name)===normText(data.name);
  }

  function makeOwnerId(){
    try{if(typeof uid==='function')return 'O'+String(uid()).slice(-6).toUpperCase()}catch(e){}
    return 'O'+Date.now().toString(36).slice(-6).toUpperCase()+Math.random().toString(36).slice(2,4).toUpperCase();
  }

  function syncProperty(p){
    if(!p||typeof db!=='object')return {changed:false,created:false,owner:null};
    const data=propertyOwnerData(p);if(!data)return {changed:false,created:false,owner:null};
    db.owners=Array.isArray(db.owners)?db.owners:[];
    let owner=db.owners.find(o=>sameOwner(o,data));
    let changed=false,created=false;
    if(!owner){
      owner={
        id:makeOwnerId(),
        name:data.name,
        doc:data.doc,
        phone:data.phone,
        phone2:data.phone2,
        email:data.email,
        address:data.address,
        profession:data.profession,
        rg:data.rg,
        civilStatus:data.civilStatus,
        spouseName:data.spouseName,
        spouseProfession:data.spouseProfession,
        spouseRg:data.spouseRg,
        spouseCpf:data.spouseCpf,
        spousePhone:data.spousePhone,
        broker:data.broker,
        exclusivity:data.exclusivity,
        capture:data.capture,
        bank:'',
        notes:`Cadastro criado automaticamente a partir do imóvel ${data.sourcePropertyId}.`,
        source:'property-auto',
        sourcePropertyId:data.sourcePropertyId,
        propertyIds:data.sourcePropertyId?[data.sourcePropertyId]:[],
        createdAt:nowISO(),updatedAt:nowISO()
      };
      db.owners.push(owner);changed=true;created=true;
    }else{
      const auto=owner.source==='property-auto';
      const sourceMatch=auto&&String(owner.sourcePropertyId||'')===String(data.sourcePropertyId||'');
      const fields=['doc','phone','phone2','email','address','profession','rg','civilStatus','spouseName','spouseProfession','spouseRg','spouseCpf','spousePhone','broker','capture'];
      for(const key of fields){
        const next=String(data[key]||'').trim();
        if(!next)continue;
        const current=String(owner[key]||'').trim();
        // Registros manuais só recebem campos vazios. Registros automáticos são
        // atualizados apenas pelo imóvel que os originou, evitando oscilação quando
        // o mesmo proprietário possui vários imóveis com dados ligeiramente diferentes.
        if(!current||(sourceMatch&&current!==next)){owner[key]=next;changed=true}
      }
      if(data.exclusivity&&(!owner.exclusivity||(sourceMatch&&owner.exclusivity!==data.exclusivity))){owner.exclusivity=data.exclusivity;changed=true}
      owner.propertyIds=Array.isArray(owner.propertyIds)?owner.propertyIds:[];
      if(data.sourcePropertyId&&!owner.propertyIds.includes(data.sourcePropertyId)){owner.propertyIds.push(data.sourcePropertyId);changed=true}
      if(changed)owner.updatedAt=nowISO();
    }

    // Mantém um vínculo canônico para que a carteira do proprietário nunca dependa
    // apenas de comparação textual de nome.
    if(owner){
      if(p.ownerId!==owner.id){p.ownerId=owner.id;changed=true}
      if(String(p.owner||'')!==String(owner.name||'')){p.owner=owner.name;changed=true}
      if(String(p.ownerName||'')!==String(owner.name||'')){p.ownerName=owner.name;changed=true}
    }
    return {changed,created,owner};
  }

  function rebuildOwnerLinks(){
    let changed=false;
    const props=Array.isArray(db.properties)?db.properties:[];
    const owners=Array.isArray(db.owners)?db.owners:[];
    for(const o of owners){
      const ids=props.filter(p=>p.ownerId===o.id||normText(p.owner)===normText(o.name)).map(p=>String(p.id||'')).filter(Boolean).sort();
      const old=(Array.isArray(o.propertyIds)?o.propertyIds:[]).map(String).sort();
      if(JSON.stringify(ids)!==JSON.stringify(old)){o.propertyIds=ids;o.updatedAt=nowISO();changed=true}
    }
    return changed;
  }

  function syncAllOwners({persist=true}={}){
    if(syncing||typeof db!=='object')return {changed:false,created:0};
    syncing=true;
    let changed=false,created=0;
    try{
      db.owners=Array.isArray(db.owners)?db.owners:[];
      for(const p of (Array.isArray(db.properties)?db.properties:[])){
        const r=syncProperty(p);if(r.changed)changed=true;if(r.created)created++;
      }
      if(rebuildOwnerLinks())changed=true;
      if(changed&&persist&&typeof saveDB==='function')saveDB();
      return {changed,created};
    }catch(e){console.error('V167: falha na sincronização de proprietários',e);return {changed:false,created:0}}
    finally{syncing=false}
  }

  function queueOwnerSync(){
    if(syncQueued)return;syncQueued=true;
    setTimeout(()=>{syncQueued=false;syncAllOwners({persist:true})},120);
  }

  // Expõe a rotina para o fluxo de cadastro do imóvel persistir proprietário no mesmo ciclo.
  window.AGOwnerSyncV167={syncProperty,syncAllOwners,refreshGreeting,currentFirstName};

  // Corrige imediatamente o texto do dashboard quando o perfil autenticado muda.
  window.addEventListener('ag:profile-changed',()=>{setTimeout(refreshGreeting,0);queueOwnerSync()});

  // Todo snapshot vindo do Firestore passa por renderAll; isso também executa a migração
  // dos imóveis antigos sem exigir botão ou ação manual do usuário.
  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){
      const r=baseRenderAll.apply(this,arguments);
      refreshGreeting();
      queueOwnerSync();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded',()=>{
    refreshGreeting();
    queueOwnerSync();
    setTimeout(refreshGreeting,350);
    setTimeout(queueOwnerSync,700);
  });
})();
