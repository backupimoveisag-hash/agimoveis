/* AG CRM V142 — corretor edita somente imóveis vinculados a ele */
(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const profile=()=>{
    try{
      const p=window.EIFirebaseCRM?.getProfile?.();
      if(p)return p;
      return JSON.parse(localStorage.getItem('nexoSessionV1')||'null')||null;
    }catch(e){return null}
  };
  const state=()=>{try{return typeof db!=='undefined'?db:window.db}catch(e){return window.db}};
  const propertyById=id=>(state()?.properties||[]).find(p=>String(p.id)===String(id));
  const isAdmin=p=>norm(p?.role)==='administrador';
  const isBroker=p=>['corretor','corretora','broker'].includes(norm(p?.role));

  function canEditProperty(p){
    if(!p)return false;
    const me=profile();
    if(isAdmin(me))return true;
    // Esta regra nova restringe especificamente o perfil de corretor/corretora.
    // Demais perfis continuam sujeitos às permissões já existentes do CRM.
    if(!isBroker(me))return true;
    const pUid=String(p.brokerUid||'').trim(),mUid=String(me?.uid||me?.id||'').trim();
    if(pUid&&mUid&&pUid===mUid)return true;
    const pMail=norm(p.brokerEmail),mMail=norm(me?.email);
    if(pMail&&mMail&&pMail===mMail)return true;
    const pName=norm(p.broker),mName=norm(me?.name);
    return !!(pName&&mName&&pName===mName);
  }
  window.agCanEditProperty=canEditProperty;

  function deny(){
    window.toast?.('Este imóvel está vinculado a outro corretor. Você pode visualizar, mas não editar.');
    return false;
  }
  function guardId(id){const p=propertyById(id);return canEditProperty(p)||deny()}

  // Bloqueio da edição principal, inclusive chamadas manuais pelo console/onclick.
  const baseEditItem=window.editItem;
  window.editItem=function(type,id){
    if(type==='property'&&!guardId(id))return;
    return baseEditItem?.apply(this,arguments);
  };

  const baseEditDetails=window.editPropertyFromDetails;
  window.editPropertyFromDetails=function(id){
    if(!guardId(id))return;
    return baseEditDetails?.apply(this,arguments);
  };

  const baseOpenModal=window.openModal;
  window.openModal=function(type,data={}){
    if(type==='property'&&data?.id){
      const existing=propertyById(data.id);
      if(existing&&!canEditProperty(existing)){deny();return;}
    }
    return baseOpenModal?.apply(this,arguments);
  };

  // Segunda camada: mesmo que um formulário de edição já esteja aberto, não salva se o vínculo não permitir.
  const baseSaveModal=window.saveModal;
  window.saveModal=async function(){
    try{
      const ed=(typeof editing!=='undefined'?editing:window.editing);
      if(ed?.type==='property'&&ed?.id){
        const p=propertyById(ed.id);
        if(p&&!canEditProperty(p)){deny();return;}
      }
    }catch(e){}
    return baseSaveModal?.apply(this,arguments);
  };

  function protectMutation(name,idIndex=0){
    const base=window[name];if(typeof base!=='function')return;
    window[name]=function(){
      const id=arguments[idIndex];
      if(!guardId(id))return;
      return base.apply(this,arguments);
    };
  }
  [
    'setPropertyCover','renamePropertyPhoto','removePropertyPhoto','addPropertyPhotos',
    'addPropertyVideo','removePropertyVideo','setPropertyFeaturedVideo','savePropertyTour360',
    'setPropertyPublication','dropPhotoBefore'
  ].forEach(name=>protectMutation(name, name==='dropPhotoBefore'?1:0));

  function decoratePropertyCards(){
    const me=profile();if(!isBroker(me))return;
    document.querySelectorAll('#propertyGrid .property-card').forEach(card=>{
      const code=(card.querySelector('.property-code')?.textContent||'').trim();
      const p=propertyById(code);if(!p||canEditProperty(p))return;
      card.querySelectorAll('button').forEach(btn=>{
        const oc=btn.getAttribute('onclick')||'';
        if(/editItem\(['\"]property['\"]/.test(oc)||/^Editar$/i.test((btn.textContent||'').trim()))btn.remove();
      });
      if(!card.querySelector('.ag-property-readonly-badge')){
        const content=card.querySelector('.property-content');
        if(content){
          const badge=document.createElement('div');badge.className='ag-property-readonly-badge';badge.textContent='Somente leitura · responsável: '+(p.broker||'outro corretor');content.prepend(badge);
        }
      }
    });
  }

  function applyDetailPermission(){
    const workspace=document.querySelector('#modal .property-workspace');if(!workspace)return;
    const p=propertyById(workspace.dataset.property);if(!p||canEditProperty(p))return;
    // Mantém consulta, galeria e vídeos visíveis; remove somente os controles que alteram o imóvel.
    workspace.querySelectorAll('.pw-summary-actions button').forEach(btn=>{
      const txt=(btn.textContent||'').trim();
      if(/^Editar informações$/i.test(txt))btn.remove();
    });
    workspace.querySelectorAll('.pw-gallery-toolbar,.pw-photo-actions,.pw-media-toolbar,.pw-video-actions,.pw-tour-box').forEach(el=>el.style.display='none');
    workspace.querySelectorAll('.pw-photo-card[draggable="true"]').forEach(el=>{el.draggable=false;el.removeAttribute('ondragstart');el.removeAttribute('ondrop');el.removeAttribute('ondragover')});
    if(!workspace.querySelector('.ag-property-readonly-notice')){
      const target=workspace.querySelector('.pw-summary-actions')||workspace.querySelector('.pw-summary');
      if(target){const note=document.createElement('div');note.className='ag-property-readonly-notice';note.textContent='Somente leitura · imóvel vinculado a '+(p.broker||'outro corretor');target.appendChild(note)}
    }
  }

  const baseRenderProperties=window.renderProperties;
  window.renderProperties=function(){const r=baseRenderProperties?.apply(this,arguments);decoratePropertyCards();return r};

  const baseOpenDetails=window.openPropertyDetails;
  window.openPropertyDetails=function(){
    const r=baseOpenDetails?.apply(this,arguments);
    setTimeout(applyDetailPermission,0);setTimeout(applyDetailPermission,80);setTimeout(applyDetailPermission,300);
    return r;
  };

  // Ficha de autorização: imóvel de outro corretor pode ser consultado/impresso,
  // mas a assinatura não pode ser criada ou alterada por quem não é o responsável.
  const baseOpenFicha=window.openPropertyClientFicha;
  if(typeof baseOpenFicha==='function')window.openPropertyClientFicha=function(id){
    const r=baseOpenFicha.apply(this,arguments);
    setTimeout(()=>{
      const p=propertyById(id);if(!p||canEditProperty(p))return;
      const overlay=document.getElementById('agPropertyFichaOverlay');if(!overlay)return;
      ['agFichaSave','agFichaClear'].forEach(x=>{const b=document.getElementById(x);if(b)b.style.display='none'});
      const canvas=document.getElementById('agFichaSignatureCanvas');if(canvas){canvas.style.pointerEvents='none';canvas.style.opacity='.55'}
      const st=document.getElementById('agFichaSignatureStatus');if(st)st.textContent='Somente leitura. A assinatura deve ser coletada pelo corretor responsável pelo imóvel.';
    },30);
    return r;
  };
  const baseSaveFicha=window.savePropertyFichaSignature;
  if(typeof baseSaveFicha==='function')window.savePropertyFichaSignature=function(){
    const workspace=document.querySelector('#modal .property-workspace');
    const id=workspace?.dataset?.property;
    if(id&&!guardId(id))return;
    return baseSaveFicha.apply(this,arguments);
  };

  const css=document.createElement('style');
  css.textContent=`.ag-property-readonly-badge{display:inline-flex;align-items:center;width:max-content;max-width:100%;margin:0 0 8px;padding:5px 8px;border-radius:999px;background:#f2f4f7;color:#667085;font-size:8px;font-weight:800;letter-spacing:.02em}.ag-property-readonly-notice{margin-top:8px;padding:7px 10px;border:1px solid rgba(20,37,63,.12);border-radius:10px;background:#f6f7f9;color:#667085;font-size:8px;font-weight:700}`;
  document.head.appendChild(css);

  document.addEventListener('DOMContentLoaded',()=>{setTimeout(decoratePropertyCards,250)});
})();
