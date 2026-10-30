/* AG CRM V171 — Rascunho automático de imóveis + moeda BRL em tempo real */
(function(){
  'use strict';

  const DRAFT_VERSION=171;
  const DRAFT_SECTION='propertyDrafts';
  const MONEY_FIELDS=new Set(['price','entryValue','debtBalance','condoFee','iptu']);
  let activeNewPropertyForm=null;
  let autosaveTimer=null;
  let draftStarted=false;

  function safeNow(){return new Date().toISOString()}
  function userKey(){
    try{
      const u=window.EIFirebaseCRM?.getAuthUser?.();
      if(u?.uid)return `uid:${u.uid}`;
      if(u?.email)return `email:${String(u.email).trim().toLowerCase()}`;
    }catch(e){}
    try{
      const s=JSON.parse(localStorage.getItem('nexoSessionV1')||'{}');
      if(s?.email)return `email:${String(s.email).trim().toLowerCase()}`;
      if(s?.name)return `name:${String(s.name).trim().toLowerCase()}`;
    }catch(e){}
    return 'browser:default';
  }
  function localKey(){return `agPropertyDraftV171:${userKey()}`}
  function ensureBucket(){
    try{db[DRAFT_SECTION] ||= {}}catch(e){}
    return (typeof db!=='undefined'&&db[DRAFT_SECTION])?db[DRAFT_SECTION]:{};
  }
  function readLocalDraft(){
    try{const x=JSON.parse(localStorage.getItem(localKey())||'null');return x&&x.fields?x:null}catch(e){return null}
  }
  function readCloudDraft(){
    try{const x=ensureBucket()?.[userKey()];return x&&x.fields?x:null}catch(e){return null}
  }
  function newestDraft(){
    const a=readLocalDraft(),b=readCloudDraft();
    if(!a)return b;if(!b)return a;
    return Date.parse(a.savedAt||0)>=Date.parse(b.savedAt||0)?a:b;
  }
  function persistLocalState(){
    try{localStorage.setItem('atlasImobCRM',JSON.stringify(db))}catch(e){}
  }
  function queueCloudDraft(){
    try{window.EIFirebaseCRM?.queueStateSync?.()}catch(e){}
  }
  function saveDraftObject(draft,{cloud=true}={}){
    try{ensureBucket()[userKey()]=draft}catch(e){}
    try{localStorage.setItem(localKey(),JSON.stringify(draft))}catch(e){}
    persistLocalState();
    if(cloud)queueCloudDraft();
  }
  function clearDraft(){
    clearTimeout(autosaveTimer);autosaveTimer=null;draftStarted=false;
    try{delete ensureBucket()[userKey()]}catch(e){}
    try{localStorage.removeItem(localKey())}catch(e){}
    persistLocalState();queueCloudDraft();
  }

  function typingBRL(value){
    let s=String(value??'').replace(/R\$/gi,'').trim();
    const parts=s.split(',');
    const integerDigits=String(parts[0]||'').replace(/\D/g,'')||'0';
    const cents=String(parts[1]??'00').replace(/\D/g,'').slice(0,2).padEnd(2,'0');
    const integer=Number(integerDigits||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
    return `${integer},${cents}`;
  }
  function numberToBRL(value){
    const n=Number(value||0);
    if(!Number.isFinite(n)||n===0)return value===0||value==='0'?'0,00':'';
    return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function parseBRL(value){
    let s=String(value??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');
    if(!s)return 0;
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
    const n=Number(s.replace(/[^0-9.-]/g,''));
    return Number.isFinite(n)?n:0;
  }
  function moneyFieldValue(input){return parseBRL(input?.value||'')}
  function formatMoneyInput(input,fromExisting=false){
    if(!input)return;
    input.type='text';input.inputMode='numeric';input.autocomplete='off';
    input.dataset.agMoneyV171='1';
    const current=input.value;
    if(current!==''&&fromExisting)input.value=numberToBRL(parseBRL(current));
    input.addEventListener('input',()=>{
      const caret=input.selectionStart||0;
      const commaBefore=input.value.indexOf(',');
      const editingCents=commaBefore>=0&&caret>commaBefore;
      input.value=typingBRL(input.value);
      const comma=input.value.indexOf(',');
      try{input.setSelectionRange(editingCents?input.value.length:comma,editingCents?input.value.length:comma)}catch(e){}
    });
    input.addEventListener('blur',()=>{
      if(input.value!=='')input.value=numberToBRL(parseBRL(input.value));
    });
  }
  function setupMoneyFields(form){
    for(const name of MONEY_FIELDS){
      const input=form.elements?.namedItem(name);
      if(input instanceof HTMLInputElement && input.dataset.agMoneyV171!=='1')formatMoneyInput(input,true);
    }
  }

  function serialize(form){
    const fields={};
    for(const el of Array.from(form.elements||[])){
      if(!el?.name||el.disabled)continue;
      if(el.type==='file'||el.type==='button'||el.type==='submit')continue;
      if(el.type==='checkbox')fields[el.name]=el.checked?'on':'';
      else if(el.type==='radio'){if(el.checked)fields[el.name]=el.value}
      else if(MONEY_FIELDS.has(el.name))fields[el.name]=moneyFieldValue(el);
      else fields[el.name]=el.value;
    }
    return fields;
  }
  function applyDraft(form,draft){
    const fields=draft?.fields||{};
    for(const el of Array.from(form.elements||[])){
      if(!el?.name||!(el.name in fields))continue;
      const value=fields[el.name];
      if(el.type==='checkbox')el.checked=value==='on'||value===true;
      else if(el.type==='radio')el.checked=String(el.value)===String(value);
      else if(MONEY_FIELDS.has(el.name))el.value=numberToBRL(value);
      else el.value=value??'';
    }
    // Atualiza campos ocultos ligados ao corretor quando o diretório terminar de carregar.
    try{window.dispatchEvent(new Event('change'))}catch(e){}
  }
  function hasMeaningfulInput(fields){
    const ignore=new Set(['id','type','purpose','status','state','constructionStatus','locationProfile','painting','floorFinish','created','priceDisplay','exclusiveSale','commission','featured','published','canalProPublished','canalProTier','canalProType']);
    return Object.entries(fields).some(([k,v])=>!ignore.has(k)&&String(v??'').trim()!==''&&String(v)!=='0');
  }
  function draftFromForm(form){
    const fields=serialize(form);
    return {version:DRAFT_VERSION,userKey:userKey(),propertyCode:String(fields.id||'').trim(),fields,savedAt:safeNow(),startedAt:newestDraft()?.startedAt||safeNow()};
  }
  function statusText(text,tone='saved'){
    const el=document.getElementById('agPropertyDraftStatusV171');if(!el)return;
    el.textContent=text;el.dataset.tone=tone;
  }
  function persistCurrentDraft({cloud=true,force=false}={}){
    const form=activeNewPropertyForm;
    if(!form?.isConnected)return;
    const draft=draftFromForm(form);
    if(!draftStarted&&!hasMeaningfulInput(draft.fields))return;
    draftStarted=true;
    statusText('Salvando rascunho…','saving');
    saveDraftObject(draft,{cloud});
    const t=new Date(draft.savedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    statusText(`Rascunho salvo automaticamente às ${t}`,'saved');
  }
  function scheduleAutosave(){
    draftStarted=true;
    // Salva localmente no mesmo instante: mesmo fechando o modal antes do debounce, nada digitado se perde.
    persistCurrentDraft({cloud:false,force:true});
    statusText('Rascunho salvo neste dispositivo · sincronizando…','saving');
    clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(()=>persistCurrentDraft({cloud:true,force:true}),850);
  }
  function decorateAutosave(form,recovered){
    if(document.getElementById('agPropertyAutosaveV171'))return;
    const box=document.createElement('div');box.id='agPropertyAutosaveV171';box.className='ag-property-autosave-v171';
    box.innerHTML=`<div><span class="ag-autosave-dot"></span><strong>Rascunho automático</strong><small id="agPropertyDraftStatusV171">${recovered?'Rascunho recuperado. Continue de onde parou.':'Comece a preencher. O CRM salvará automaticamente.'}</small></div><button type="button" id="agDiscardPropertyDraftV171">Descartar rascunho</button>`;
    form.prepend(box);
    document.getElementById('agDiscardPropertyDraftV171')?.addEventListener('click',()=>{
      if(!confirm('Descartar o rascunho deste imóvel e começar um cadastro em branco?'))return;
      clearDraft();
      try{window.closeModal?.()}catch(e){}
      setTimeout(()=>window.openModal?.('property',{}),60);
      window.toast?.('Rascunho descartado.');
    });
  }
  function setupNewPropertyForm(form){
    if(!form||form.dataset.agAutosaveV171==='1')return;
    form.dataset.agAutosaveV171='1';activeNewPropertyForm=form;draftStarted=false;
    const draft=newestDraft();
    if(draft?.fields){applyDraft(form,draft);draftStarted=true;saveDraftObject(draft,{cloud:true})}
    setupMoneyFields(form);
    decorateAutosave(form,!!draft?.fields);
    form.addEventListener('input',scheduleAutosave,{passive:true});
    form.addEventListener('change',scheduleAutosave,{passive:true});
    if(draft?.fields){
      const t=draft.savedAt?new Date(draft.savedAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      statusText(`Rascunho recuperado${t?` · salvo em ${t}`:''}`,'recovered');
      setTimeout(()=>window.toast?.('Rascunho do imóvel recuperado automaticamente.'),120);
    }
  }
  function setupExistingPropertyForm(form){
    if(!form)return;setupMoneyFields(form);
  }

  const baseOpenModal=window.openModal;
  if(typeof baseOpenModal==='function'){
    window.openModal=function(type,data={}){
      const isNew=type==='property'&&!data?.id;
      const r=baseOpenModal.apply(this,arguments);
      if(type==='property')setTimeout(()=>{
        const form=document.querySelector('#modalForm.v98-property-form');
        if(!form)return;
        if(isNew)setupNewPropertyForm(form);else setupExistingPropertyForm(form);
      },35);
      return r;
    };
  }

  const baseSaveModal=window.saveModal;
  if(typeof baseSaveModal==='function'){
    window.saveModal=async function(){
      const form=document.querySelector('#modalForm.v98-property-form');
      const isNew=!!(form&&form===activeNewPropertyForm);
      if(form)for(const name of MONEY_FIELDS){
        const input=form.elements?.namedItem(name);
        if(input instanceof HTMLInputElement && input.dataset.agMoneyV171==='1'){
          // O fluxo original espera número no FormData. Converte temporariamente e restaura se houver erro.
          input.dataset.agDisplayValue=input.value;
          input.value=String(parseBRL(input.value));
        }
      }
      let result;
      try{result=await baseSaveModal.apply(this,arguments)}finally{
        const stillOpen=form?.isConnected;
        if(stillOpen){
          for(const name of MONEY_FIELDS){
            const input=form.elements?.namedItem(name);
            if(input instanceof HTMLInputElement&&input.dataset.agDisplayValue!==undefined){
              input.value=numberToBRL(input.value||input.dataset.agDisplayValue);delete input.dataset.agDisplayValue;
            }
          }
        }
      }
      if(isNew&&!form?.isConnected){clearDraft();activeNewPropertyForm=null}
      return result;
    };
  }

  // Persistência imediata em caso de aba fechada, troca de aplicativo ou navegador indo para segundo plano.
  window.addEventListener('pagehide',()=>persistCurrentDraft({cloud:false,force:true}));
  window.addEventListener('beforeunload',()=>persistCurrentDraft({cloud:false,force:true}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistCurrentDraft({cloud:false,force:true})});

  window.AGPropertyDraftV171={clear:clearDraft,save:()=>persistCurrentDraft({cloud:true,force:true}),parseBRL,formatBRL:numberToBRL};
})();
