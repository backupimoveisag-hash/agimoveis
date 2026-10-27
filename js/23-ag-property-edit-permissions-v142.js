/* AG CRM V145 — corretor edita exclusivamente imóveis vinculados a ele */
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
  const isBroker=p=>/^corretor(?:a)?(?:\b|$)/.test(norm(p?.role))||norm(p?.role)==='broker';
  const uniq=a=>[...new Set(a.map(x=>norm(x)).filter(Boolean))];

  function currentIdentity(me){
    return {
      uids:uniq([me?.uid,me?.firebaseUid,me?.id]),
      emails:uniq([me?.email]),
      names:uniq([me?.name,me?.displayName])
    };
  }
  function propertyIdentity(p){
    return {
      uids:uniq([p?.brokerUid,p?.responsibleBrokerUid,p?.brokerFirebaseUid]),
      emails:uniq([p?.brokerEmail,p?.responsibleBrokerEmail]),
      names:uniq([p?.broker,p?.brokerName,p?.responsibleBroker])
    };
  }
  function intersects(a,b){return a.some(x=>b.includes(x))}

  function rosterMatch(pIdentity,meIdentity){
    const users=Array.isArray(state()?.users)?state().users:[];
    if(!users.length)return false;
    const linked=users.find(u=>{
      const ids=uniq([u?.uid,u?.firebaseUid,u?.id]);
      const mails=uniq([u?.email]);
      const names=uniq([u?.name,u?.displayName]);
      return intersects(pIdentity.uids,ids)||intersects(pIdentity.emails,mails)||intersects(pIdentity.names,names);
    });
    if(!linked)return false;
    const li={uids:uniq([linked.uid,linked.firebaseUid,linked.id]),emails:uniq([linked.email]),names:uniq([linked.name,linked.displayName])};
    return intersects(li.uids,meIdentity.uids)||intersects(li.emails,meIdentity.emails)||intersects(li.names,meIdentity.names);
  }

  function canEditProperty(p){
    if(!p)return false;
    const me=profile();
    if(isAdmin(me))return true;
    // Restringe somente os perfis de corretor/corretora; demais perfis seguem permissões gerais do CRM.
    if(!isBroker(me))return true;
    const mine=currentIdentity(me),owner=propertyIdentity(p);
    if(intersects(owner.uids,mine.uids))return true;
    if(intersects(owner.emails,mine.emails))return true;
    if(intersects(owner.names,mine.names))return true;
    // Compatibilidade para imóveis antigos cujo brokerUid recebeu o ID interno do roster em vez do UID Firebase.
    if(rosterMatch(owner,mine))return true;
    return false;
  }
  window.agCanEditProperty=canEditProperty;

  function responsibleLabel(p){return String(p?.brokerName||p?.responsibleBroker||p?.broker||'outro corretor').trim()||'outro corretor'}
  function deny(){window.toast?.('Este imóvel pertence a outro corretor. Você pode visualizar, mas não editar.');return false}
  function guardId(id){const p=propertyById(id);return canEditProperty(p)||deny()}

  // Bloqueio funcional: não depende apenas de esconder botões.
  const baseEditItem=window.editItem;
  window.editItem=function(type,id){if(type==='property'&&!guardId(id))return;return baseEditItem?.apply(this,arguments)};
  const baseEditDetails=window.editPropertyFromDetails;
  window.editPropertyFromDetails=function(id){if(!guardId(id))return;return baseEditDetails?.apply(this,arguments)};
  const baseOpenModal=window.openModal;
  window.openModal=function(type,data={}){if(type==='property'&&data?.id){const existing=propertyById(data.id);if(existing&&!canEditProperty(existing)){deny();return}}return baseOpenModal?.apply(this,arguments)};
  const baseSaveModal=window.saveModal;
  window.saveModal=async function(){try{const ed=(typeof editing!=='undefined'?editing:window.editing);if(ed?.type==='property'&&ed?.id){const p=propertyById(ed.id);if(p&&!canEditProperty(p)){deny();return}}}catch(e){}return baseSaveModal?.apply(this,arguments)};

  function protectMutation(name,idIndex=0){const base=window[name];if(typeof base!=='function')return;window[name]=function(){const id=arguments[idIndex];if(!guardId(id))return;return base.apply(this,arguments)}}
  ['setPropertyCover','renamePropertyPhoto','removePropertyPhoto','addPropertyPhotos','addPropertyVideo','removePropertyVideo','setPropertyFeaturedVideo','savePropertyTour360','setPropertyPublication','dropPhotoBefore'].forEach(name=>protectMutation(name,name==='dropPhotoBefore'?1:0));

  function decoratePropertyCards(){
    const me=profile();if(!isBroker(me))return;
    document.querySelectorAll('#propertyGrid .property-card').forEach(card=>{
      const code=(card.querySelector('.property-code')?.textContent||card.dataset.propertyId||'').trim();
      const p=propertyById(code);if(!p)return;
      const allowed=canEditProperty(p);
      card.classList.toggle('ag-property-owned-by-me',allowed);
      card.classList.toggle('ag-property-readonly',!allowed);
      card.querySelectorAll('button').forEach(btn=>{
        const oc=btn.getAttribute('onclick')||'',txt=(btn.textContent||'').trim();
        const edit=/editItem\(['\"]property['\"]/.test(oc)||/^Editar$/i.test(txt);
        if(edit){
          if(allowed){btn.hidden=false;btn.disabled=false;btn.style.removeProperty('display')}
          else{btn.remove()}
        }
      });
      const content=card.querySelector('.property-content');if(!content)return;
      content.querySelector('.ag-property-readonly-badge')?.remove();
      content.querySelector('.ag-property-owned-badge')?.remove();
      const badge=document.createElement('div');
      if(allowed){badge.className='ag-property-owned-badge';badge.textContent='Seu imóvel · edição liberada'}
      else{badge.className='ag-property-readonly-badge';badge.textContent='Somente leitura · responsável: '+responsibleLabel(p)}
      content.prepend(badge);
    });
  }

  function applyDetailPermission(){
    const workspace=document.querySelector('#modal .property-workspace');if(!workspace)return;
    const p=propertyById(workspace.dataset.property);if(!p)return;
    const me=profile();if(!isBroker(me))return;
    const allowed=canEditProperty(p);
    if(allowed){
      workspace.classList.remove('ag-property-detail-readonly');
      return;
    }
    workspace.classList.add('ag-property-detail-readonly');
    workspace.querySelectorAll('.pw-summary-actions button').forEach(btn=>{const txt=(btn.textContent||'').trim();if(/^Editar informações$/i.test(txt))btn.remove()});
    workspace.querySelectorAll('.pw-gallery-toolbar,.pw-photo-actions,.pw-media-toolbar,.pw-video-actions,.pw-tour-box').forEach(el=>el.style.display='none');
    workspace.querySelectorAll('.pw-photo-card[draggable="true"]').forEach(el=>{el.draggable=false;el.removeAttribute('ondragstart');el.removeAttribute('ondrop');el.removeAttribute('ondragover')});
    if(!workspace.querySelector('.ag-property-readonly-notice')){const target=workspace.querySelector('.pw-summary-actions')||workspace.querySelector('.pw-summary');if(target){const note=document.createElement('div');note.className='ag-property-readonly-notice';note.textContent='Somente leitura · imóvel vinculado a '+responsibleLabel(p);target.appendChild(note)}}
  }

  const baseRenderProperties=window.renderProperties;
  window.renderProperties=function(){const r=baseRenderProperties?.apply(this,arguments);queueApply();return r};
  const baseOpenDetails=window.openPropertyDetails;
  window.openPropertyDetails=function(){const r=baseOpenDetails?.apply(this,arguments);setTimeout(applyDetailPermission,0);setTimeout(applyDetailPermission,80);setTimeout(applyDetailPermission,300);return r};

  const baseOpenFicha=window.openPropertyClientFicha;
  if(typeof baseOpenFicha==='function')window.openPropertyClientFicha=function(id){const r=baseOpenFicha.apply(this,arguments);setTimeout(()=>{const p=propertyById(id);if(!p||canEditProperty(p))return;const overlay=document.getElementById('agPropertyFichaOverlay');if(!overlay)return;['agFichaSave','agFichaClear'].forEach(x=>{const b=document.getElementById(x);if(b)b.style.display='none'});const canvas=document.getElementById('agFichaSignatureCanvas');if(canvas){canvas.style.pointerEvents='none';canvas.style.opacity='.55'}const st=document.getElementById('agFichaSignatureStatus');if(st)st.textContent='Somente leitura. A assinatura deve ser coletada pelo corretor responsável pelo imóvel.'},30);return r};
  const baseSaveFicha=window.savePropertyFichaSignature;
  if(typeof baseSaveFicha==='function')window.savePropertyFichaSignature=function(){const workspace=document.querySelector('#modal .property-workspace');const id=workspace?.dataset?.property;if(id&&!guardId(id))return;return baseSaveFicha.apply(this,arguments)};

  let applying=false;
  function queueApply(){if(applying)return;applying=true;setTimeout(()=>{applying=false;decoratePropertyCards();applyDetailPermission()},20)}
  // Perfil Firebase chega de forma assíncrona; reaplica quando papel/login muda e quando a grade é recriada.
  document.addEventListener('DOMContentLoaded',()=>{
    [50,250,800,1600].forEach(ms=>setTimeout(queueApply,ms));
    const role=document.getElementById('cloudRole');if(role)new MutationObserver(queueApply).observe(role,{childList:true,subtree:true,characterData:true});
    const grid=document.getElementById('propertyGrid');if(grid)new MutationObserver(queueApply).observe(grid,{childList:true,subtree:true});
    window.addEventListener('focus',queueApply);
  });

  const css=document.createElement('style');
  css.textContent=`.ag-property-readonly-badge,.ag-property-owned-badge{display:inline-flex;align-items:center;width:max-content;max-width:100%;margin:0 0 8px;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:800;letter-spacing:.02em}.ag-property-readonly-badge{background:#f2f4f7;color:#667085}.ag-property-owned-badge{background:#edf9f3;color:#087a4b;border:1px solid rgba(8,122,75,.14)}.ag-property-readonly-notice{margin-top:8px;padding:7px 10px;border:1px solid rgba(20,37,63,.12);border-radius:10px;background:#f6f7f9;color:#667085;font-size:8px;font-weight:700}`;
  document.head.appendChild(css);
})();
