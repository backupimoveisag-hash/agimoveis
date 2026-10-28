/* AG CRM V159 — upload e reprodução de vídeos via Google Drive */
(function(){
  'use strict';

  const MAX_VIDEO_BYTES=25*1024*1024;
  const $=s=>document.querySelector(s);
  const safeText=v=>String(v??'');
  const esc=v=>safeText(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const escJs=v=>safeText(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
  const propertyById=id=>{try{return (db?.properties||[]).find(p=>String(p.id)===String(id))}catch(e){return null}};
  const canEdit=p=>{try{return typeof window.agCanEditProperty==='function'?window.agCanEditProperty(p):true}catch(e){return true}};

  function driveFileId(value){
    const s=safeText(value).trim();
    if(!s)return '';
    let m=s.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);if(m)return m[1];
    m=s.match(/[?&]id=([^&#]+)/i);if(m)return decodeURIComponent(m[1]);
    return '';
  }
  function driveResourceKey(value){
    try{return new URL(value).searchParams.get('resourcekey')||''}catch(e){return ''}
  }
  function drivePreviewUrl(id,key=''){
    if(!id)return '';
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview${key?`?resourcekey=${encodeURIComponent(key)}`:''}`;
  }
  function driveThumbUrl(id,key=''){
    if(!id)return '';
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200${key?`&resourcekey=${encodeURIComponent(key)}`:''}`;
  }
  function youtubeId(url){const m=safeText(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);return m?m[1]:''}
  function vimeoId(url){const m=safeText(url).match(/vimeo\.com\/(?:video\/)?(\d+)/i);return m?m[1]:''}

  // Mantém miniaturas do Drive funcionais mesmo em cadastros importados/antigos.
  const priorThumb=window.propertyVideoThumb;
  window.propertyVideoThumb=function(p,v){
    if(v?.thumb)return v.thumb;
    const id=v?.driveFileId||driveFileId(v?.drivePreviewUrl||v?.url||v?.driveWebViewLink);
    const key=v?.driveResourceKey||driveResourceKey(v?.drivePreviewUrl||v?.driveWebViewLink||v?.url);
    if(id)return driveThumbUrl(id,key);
    return typeof priorThumb==='function'?priorThumb(p,v):(window.propertyImage?.(p)||'');
  };

  function bytesLabel(n){
    const x=Number(n||0);if(!x)return '';
    if(x>=1024*1024)return `${(x/(1024*1024)).toFixed(1)} MB`;
    if(x>=1024)return `${Math.round(x/1024)} KB`;
    return `${x} B`;
  }
  function fileToDataUrl(file,onProgress){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Não foi possível ler o vídeo selecionado.'));
      reader.onprogress=e=>{if(e.lengthComputable&&onProgress)onProgress(Math.round((e.loaded/e.total)*35))};
      reader.onload=()=>resolve(String(reader.result||''));
      reader.readAsDataURL(file);
    });
  }
  function setUploadState(text,tone=''){
    const el=document.getElementById('propertyVideoUploadState');if(!el)return;
    el.className='ag-video-upload-state'+(tone?` is-${tone}`:'');el.textContent=text;
  }
  function setUploadBusy(busy,label=''){
    const btn=document.getElementById('propertyVideoAddBtn');
    if(btn){btn.disabled=!!busy;btn.textContent=busy?(label||'Enviando vídeo…'):'＋ Adicionar vídeo'}
    const input=document.getElementById('propertyVideoFile');if(input)input.disabled=!!busy;
  }

  async function uploadSelectedVideo(p,title,file){
    if(!window.AGDriveGateway?.configured?.())throw new Error('Configure o Google Drive via Apps Script em Ajustes antes de enviar vídeos.');
    if(!file)throw new Error('Selecione um vídeo.');
    const okMime=/^video\//i.test(file.type||'')||/\.(mp4|mov|m4v|webm)$/i.test(file.name||'');
    if(!okMime)throw new Error('Selecione um arquivo de vídeo MP4, MOV, M4V ou WebM.');
    if(file.size>MAX_VIDEO_BYTES)throw new Error('Este envio direto aceita vídeos de até 25 MB. Para arquivos maiores, use um link do YouTube/Vimeo ou comprima o vídeo antes de enviar.');

    setUploadBusy(true,'Preparando vídeo…');
    setUploadState(`Preparando ${file.name} · ${bytesLabel(file.size)}…`);
    const dataUrl=await fileToDataUrl(file,pct=>setUploadState(`Lendo vídeo… ${pct}%`));
    setUploadBusy(true,'Enviando ao Drive…');
    setUploadState('Enviando ao Google Drive… mantenha esta tela aberta.');
    const r=await window.AGDriveGateway.request('uploadVideo',{
      dataUrl,
      fileName:file.name,
      mimeType:file.type||'video/mp4',
      propertyId:p.id,
      title:title||'',
      uploadedBy:String(window.EIFirebaseCRM?.getProfile?.()?.name||'')
    });
    if(!r?.fileId)throw new Error('O Google Drive não retornou o identificador do vídeo.');
    setUploadState('Vídeo enviado. Salvando no cadastro…','success');
    return r;
  }

  // Substitui o cadastro antigo por um fluxo híbrido: arquivo → Drive OU link externo.
  window.addPropertyVideo=async function(propertyId){
    const p=propertyById(propertyId);if(!p)return;
    if(!canEdit(p)){window.toast?.('Este imóvel pertence a outro corretor. Você pode visualizar, mas não editar.');return}
    const title=(document.getElementById('propertyVideoTitle')?.value||'').trim();
    const url=(document.getElementById('propertyVideoUrl')?.value||'').trim();
    const thumb=(document.getElementById('propertyVideoThumb')?.value||'').trim();
    const file=document.getElementById('propertyVideoFile')?.files?.[0]||null;
    p.videos=Array.isArray(p.videos)?p.videos:[];
    try{
      let item;
      if(file){
        const r=await uploadSelectedVideo(p,title,file);
        item={
          id:'VD'+uid().slice(-8).toUpperCase(),
          title:title||file.name.replace(/\.[^.]+$/,''),
          url:r.previewUrl||r.webViewLink||'',
          thumb:r.thumbnailUrl||'',
          driveFileId:r.fileId||'',
          driveResourceKey:r.resourceKey||'',
          driveWebViewLink:r.webViewLink||'',
          drivePreviewUrl:r.previewUrl||'',
          mimeType:r.mimeType||file.type||'',
          size:Number(r.size||file.size||0),
          storage:'google-drive',
          created:todayISO()
        };
      }else{
        if(!/^https?:\/\//i.test(url)){window.toast?.('Selecione um vídeo para enviar ao Drive ou informe uma URL válida.');return}
        const id=driveFileId(url),key=driveResourceKey(url);
        item={
          id:'VD'+uid().slice(-8).toUpperCase(),
          title:title||`Vídeo ${p.videos.length+1}`,
          url:id?drivePreviewUrl(id,key):url,
          thumb:thumb||(id?driveThumbUrl(id,key):''),
          driveFileId:id,
          driveResourceKey:key,
          driveWebViewLink:id?url:'',
          drivePreviewUrl:id?drivePreviewUrl(id,key):'',
          storage:id?'google-drive':'external-url',
          created:todayISO()
        };
      }
      p.videos.push(item);
      if(!p.videoFeaturedId)p.videoFeaturedId=item.id;
      saveDB();
      window.openPropertyDetails?.(propertyId,'media');
      window.toast?.(file?'Vídeo enviado ao Google Drive e vinculado ao imóvel.':'Vídeo vinculado ao imóvel.');
    }catch(err){
      console.error(err);
      setUploadState(err?.message||'Falha ao enviar o vídeo.','error');
      window.toast?.(err?.message||'Não foi possível enviar o vídeo ao Google Drive.');
    }finally{setUploadBusy(false)}
  };

  function ensureViewer(){
    let el=document.getElementById('agCrmVideoViewer');if(el)return el;
    el=document.createElement('div');el.id='agCrmVideoViewer';el.className='ag-crm-video-viewer';
    el.innerHTML='<div class="ag-crm-video-dialog"><div class="ag-crm-video-top"><b id="agCrmVideoTitle">Vídeo do imóvel</b><button type="button" id="agCrmVideoClose" aria-label="Fechar">×</button></div><div class="ag-crm-video-frame" id="agCrmVideoFrame"></div><div class="ag-crm-video-note">Vídeos do Google Drive usam o player do próprio Drive.</div></div>';
    document.body.appendChild(el);
    el.addEventListener('click',e=>{if(e.target===el)closeViewer()});
    document.getElementById('agCrmVideoClose')?.addEventListener('click',closeViewer);
    return el;
  }
  function closeViewer(){const el=document.getElementById('agCrmVideoViewer');if(!el)return;el.classList.remove('show');const f=document.getElementById('agCrmVideoFrame');if(f)f.innerHTML=''}
  window.openPropertyVideo=function(propertyId,videoId){
    const p=propertyById(propertyId),v=(p?.videos||[]).find(x=>String(x.id)===String(videoId));if(!v)return;
    const el=ensureViewer(),frame=document.getElementById('agCrmVideoFrame'),title=v.title||p.title||'Vídeo do imóvel';
    document.getElementById('agCrmVideoTitle').textContent=title;
    const id=v.driveFileId||driveFileId(v.drivePreviewUrl||v.url||v.driveWebViewLink),key=v.driveResourceKey||driveResourceKey(v.drivePreviewUrl||v.driveWebViewLink||v.url);
    const y=youtubeId(v.url),vm=vimeoId(v.url);
    if(id)frame.innerHTML=`<iframe src="${esc(drivePreviewUrl(id,key))}" title="${esc(title)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    else if(y)frame.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(y)}?autoplay=1&rel=0" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    else if(vm)frame.innerHTML=`<iframe src="https://player.vimeo.com/video/${encodeURIComponent(vm)}?autoplay=1" title="${esc(title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    else frame.innerHTML=`<video controls autoplay playsinline preload="metadata" src="${esc(v.url)}"></video>`;
    el.classList.add('show');
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeViewer()});

  function enhancePanel(propertyId){
    const p=propertyById(propertyId),panel=document.querySelector('.property-workspace [data-pw-panel="media"]');
    if(!p||!panel)return;
    const toolbar=panel.querySelector('.pw-media-toolbar');
    if(toolbar&&!toolbar.querySelector('#propertyVideoFile')){
      const upload=document.createElement('div');upload.className='ag-video-upload-box';
      upload.innerHTML=`<label for="propertyVideoFile"><span>Enviar vídeo para o Google Drive</span><b>Selecionar arquivo</b><small>MP4, MOV, M4V ou WebM · até 25 MB por envio</small></label><input id="propertyVideoFile" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.m4v,.webm"><div class="ag-video-upload-state" id="propertyVideoUploadState">O link de reprodução será gerado automaticamente.</div>`;
      toolbar.prepend(upload);
      const urlField=document.getElementById('propertyVideoUrl');
      if(urlField){urlField.placeholder='Opcional: YouTube, Vimeo ou link do Google Drive';urlField.closest('.form-group')?.classList.add('ag-video-url-alt')}
      const btn=[...toolbar.querySelectorAll('button')].find(b=>/Adicionar vídeo/i.test(b.textContent||''));if(btn)btn.id='propertyVideoAddBtn';
      const note=panel.querySelector('.pw-media-note');if(note)note.innerHTML='Envie o arquivo diretamente para o <b>Google Drive</b> e o CRM gera o link sozinho. Como alternativa, você ainda pode colar YouTube, Vimeo ou outro link.';
    }

    const cards=panel.querySelectorAll('.pw-video-card');
    cards.forEach((card,i)=>{
      const v=(p.videos||[])[i];if(!v)return;
      const actions=card.querySelector('.pw-video-actions');
      if(actions&&!actions.querySelector('.ag-video-play-btn')){
        const b=document.createElement('button');b.type='button';b.className='btn ag-video-play-btn';b.textContent='▶ Reproduzir';b.onclick=()=>window.openPropertyVideo(propertyId,v.id);actions.prepend(b);
      }
      const thumb=card.querySelector('.pw-video-thumb');if(thumb){thumb.style.cursor='pointer';thumb.title='Reproduzir vídeo';thumb.onclick=()=>window.openPropertyVideo(propertyId,v.id)}
      const meta=card.querySelector('.pw-video-meta small');if(meta&&v.storage==='google-drive')meta.textContent=`Google Drive${v.size?` · ${bytesLabel(v.size)}`:''}`;
    });
  }

  // openPropertyDetails já inclui as regras de permissão da V146. Encadeamos após elas.
  const baseOpen=window.openPropertyDetails;
  if(typeof baseOpen==='function')window.openPropertyDetails=function(id){const r=baseOpen.apply(this,arguments);setTimeout(()=>enhancePanel(id),0);setTimeout(()=>enhancePanel(id),100);return r};

  // Caso a ficha já esteja aberta no carregamento deste patch.
  setTimeout(()=>{const id=document.querySelector('.property-workspace')?.dataset?.property;if(id)enhancePanel(id)},200);
})();
