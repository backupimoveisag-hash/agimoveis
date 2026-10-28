/* AG CRM V160 — aba Vídeos visível dentro de Cadastrar/Editar imóvel */
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state=()=>{try{return typeof db!=='undefined'?db:window.db}catch(e){return window.db}};
  const byId=id=>(state()?.properties||[]).find(p=>String(p.id)===String(id));
  const canEdit=p=>typeof window.agCanEditProperty==='function'?window.agCanEditProperty(p):true;
  const safeId=v=>String(v??'').replace(/[^a-zA-Z0-9_-]/g,'');
  let lastEditorPropertyId='';

  function videoThumb(p,v){
    try{return typeof window.propertyVideoThumb==='function'?window.propertyVideoThumb(p,v):(v?.thumb||'')}catch(e){return v?.thumb||''}
  }

  function editorVideoHTML(p){
    if(!p?.id){
      return `<div class="ag-editor-video-empty"><b>Salve o imóvel primeiro</b><p>Depois de salvar, abra novamente o imóvel em <b>Editar</b> e use esta aba para enviar vídeos diretamente ao Google Drive.</p></div>`;
    }
    const editable=canEdit(p);
    const videos=Array.isArray(p.videos)?p.videos:[];
    return `<div class="ag-editor-video-panel" data-property-id="${esc(p.id)}">
      <div class="ag-editor-video-head">
        <div><span>VÍDEOS DO IMÓVEL</span><h3>Enviar vídeo para o Google Drive</h3><p>Selecione o arquivo e o CRM gera o link automaticamente. O vídeo fica vinculado ao imóvel e pode ser reproduzido no CRM e no site.</p></div>
        <div class="ag-editor-video-count">${videos.length} ${videos.length===1?'vídeo':'vídeos'}</div>
      </div>
      ${editable?`<div class="ag-editor-video-upload">
        <div class="form-group"><label>Título do vídeo</label><input id="propertyVideoTitle" class="form-control" placeholder="Ex.: Tour completo"></div>
        <div class="form-group"><label>Arquivo de vídeo</label><input id="propertyVideoFile" class="form-control ag-editor-video-file" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.m4v,.webm"></div>
        <div class="form-group full ag-editor-video-url"><label>Ou cole um link</label><input id="propertyVideoUrl" class="form-control" placeholder="YouTube, Vimeo ou link do Google Drive"></div>
        <div class="form-group full"><label>Capa / thumbnail <small>(opcional)</small></label><input id="propertyVideoThumb" class="form-control" placeholder="URL da imagem"></div>
        <div class="ag-editor-video-action full"><button id="propertyVideoAddBtn" class="btn primary" type="button" onclick="addPropertyVideo('${safeId(p.id)}')">＋ Enviar e adicionar vídeo</button><div class="ag-video-upload-state" id="propertyVideoUploadState">MP4, MOV, M4V ou WebM · até 25 MB por envio.</div></div>
      </div>`:`<div class="ag-editor-video-readonly">Somente leitura. Apenas o corretor responsável ou administrador pode alterar os vídeos deste imóvel.</div>`}
      <div class="ag-editor-video-list">
        ${videos.length?videos.map(v=>`<article class="ag-editor-video-card">
          <button class="ag-editor-video-preview" type="button" onclick="openPropertyVideo('${safeId(p.id)}','${safeId(v.id)}')" ${videoThumb(p,v)?`style="background-image:url('${esc(videoThumb(p,v))}')"`:''}><span>▶</span></button>
          <div class="ag-editor-video-meta"><b>${esc(v.title||'Vídeo do imóvel')}</b><small>${v.storage==='google-drive'?'Google Drive':esc(v.url||'Link externo')}</small></div>
          <div class="ag-editor-video-actions">
            <button class="btn" type="button" onclick="openPropertyVideo('${safeId(p.id)}','${safeId(v.id)}')">▶ Reproduzir</button>
            ${editable&&p.videoFeaturedId!==v.id?`<button class="btn" type="button" onclick="agEditorSetFeaturedVideo('${safeId(p.id)}','${safeId(v.id)}')">Destacar</button>`:''}
            ${editable&&p.videoFeaturedId===v.id?`<button class="btn" type="button" disabled>★ Destaque</button>`:''}
            ${editable?`<button class="btn danger" type="button" onclick="agEditorRemoveVideo('${safeId(p.id)}','${safeId(v.id)}')">Excluir</button>`:''}
          </div>
        </article>`).join(''):`<div class="ag-editor-video-empty compact"><b>Nenhum vídeo cadastrado</b><p>Use o campo acima para enviar o primeiro vídeo deste imóvel.</p></div>`}
      </div>
    </div>`;
  }

  function switchEditorTab(tab){
    const modal=document.getElementById('modal');
    const tabs=modal?.querySelector('.ag-property-editor-tabs');
    if(!tabs)return;
    tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.editorTab===tab));
    modal.querySelector('.ag-property-editor-data')?.classList.toggle('active',tab==='data');
    modal.querySelector('.ag-property-editor-videos')?.classList.toggle('active',tab==='videos');
    const save=document.getElementById('modalSave');if(save)save.style.display=tab==='videos'?'none':'';
    try{sessionStorage.setItem('agPropertyEditorTabV160',tab)}catch(e){}
  }
  window.agPropertyEditorSwitch=switchEditorTab;

  function decoratePropertyEditor(data){
    const modal=document.getElementById('modal');
    const form=modal?.querySelector('#modalForm');
    if(!modal||!form||modal.classList.contains('property-detail-shell'))return;
    const ed=(()=>{try{return typeof editing!=='undefined'?editing:window.editing}catch(e){return window.editing}})();
    if(ed?.type!=='property')return;
    const p=data?.id?byId(data.id):null;
    lastEditorPropertyId=data?.id||'';
    if(modal.querySelector('.ag-property-editor-tabs'))return;
    const body=form.parentElement;
    const tabs=document.createElement('div');tabs.className='ag-property-editor-tabs';tabs.innerHTML=`<button type="button" data-editor-tab="data" onclick="agPropertyEditorSwitch('data')">Dados do imóvel</button><button type="button" data-editor-tab="videos" onclick="agPropertyEditorSwitch('videos')">▶ Vídeos <span>${p?.videos?.length||0}</span></button>`;
    body.insertBefore(tabs,form);
    const dataWrap=document.createElement('div');dataWrap.className='ag-property-editor-data';form.parentNode.insertBefore(dataWrap,form);dataWrap.appendChild(form);
    const videoWrap=document.createElement('div');videoWrap.className='ag-property-editor-videos';videoWrap.innerHTML=editorVideoHTML(p||data||{});dataWrap.parentNode.insertBefore(videoWrap,dataWrap.nextSibling);
    let preferred='data';try{preferred=sessionStorage.getItem('agPropertyEditorTabV160')||'data'}catch(e){}
    if(!data?.id)preferred='data';
    switchEditorTab(preferred==='videos'?'videos':'data');
  }

  const baseOpenModal=window.openModal;
  window.openModal=function(type,data={}){
    const r=baseOpenModal?.apply(this,arguments);
    if(type==='property')setTimeout(()=>decoratePropertyEditor(data),0);
    return r;
  };

  // Mantém o usuário na aba Vídeos ao concluir ações iniciadas dentro do editor.
  const baseAdd=window.addPropertyVideo;
  if(typeof baseAdd==='function')window.addPropertyVideo=async function(propertyId){
    const p=byId(propertyId);if(p&&!canEdit(p)){window.toast?.('Este imóvel está em modo somente leitura.');return}
    const fromEditor=!!document.querySelector('#modal .ag-property-editor-tabs');
    if(fromEditor){try{sessionStorage.setItem('agPropertyEditorTabV160','videos')}catch(e){}}
    const r=await baseAdd.apply(this,arguments);
    if(fromEditor){const updated=byId(propertyId);if(updated)setTimeout(()=>window.openModal('property',updated),30)}
    return r;
  };

  window.agEditorRemoveVideo=function(propertyId,videoId){
    const p=byId(propertyId);if(!p||!canEdit(p))return;
    if(!confirm('Excluir este vídeo do cadastro do imóvel?'))return;
    p.videos=(p.videos||[]).filter(v=>String(v.id)!==String(videoId));
    if(String(p.videoFeaturedId)===String(videoId))p.videoFeaturedId=p.videos[0]?.id||'';
    try{saveDB()}catch(e){}
    try{sessionStorage.setItem('agPropertyEditorTabV160','videos')}catch(e){}
    window.openModal('property',p);window.toast?.('Vídeo removido do imóvel.');
  };

  window.agEditorSetFeaturedVideo=function(propertyId,videoId){
    const p=byId(propertyId);if(!p||!canEdit(p))return;
    p.videoFeaturedId=videoId;try{saveDB()}catch(e){}
    try{sessionStorage.setItem('agPropertyEditorTabV160','videos')}catch(e){}
    window.openModal('property',p);window.toast?.('Vídeo definido como destaque.');
  };

  // Atalho visível também na ficha, caso versões antigas de CSS escondam a tabulação em telas estreitas.
  function ensureVideoShortcut(){
    document.querySelectorAll('#propertyGrid .property-card').forEach(card=>{
      const actions=card.querySelector('.actions');if(!actions||actions.querySelector('.ag-card-video-shortcut'))return;
      const code=(card.querySelector('.property-code')?.textContent||'').trim();if(!code)return;
      const btn=document.createElement('button');btn.type='button';btn.className='btn small ag-card-video-shortcut';btn.textContent='Vídeos';btn.onclick=e=>{e.stopPropagation();window.openPropertyDetails?.(code,'media')};
      actions.insertBefore(btn,actions.firstChild);
    });
  }
  const mo=new MutationObserver(()=>ensureVideoShortcut());
  document.addEventListener('DOMContentLoaded',()=>{ensureVideoShortcut();const grid=document.getElementById('propertyGrid');if(grid)mo.observe(grid,{childList:true,subtree:true});});
})();
