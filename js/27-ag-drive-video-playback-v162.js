/* AG CRM V162 — reprodução robusta de vídeos do Google Drive */
(function(){
  'use strict';

  const txt=v=>String(v??'');
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function driveId(value){
    const s=txt(value).trim(); if(!s)return '';
    let m=s.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i); if(m)return m[1];
    m=s.match(/[?&]id=([^&#]+)/i); if(m)return decodeURIComponent(m[1]);
    return '';
  }
  function resourceKey(value){
    try{return new URL(txt(value),location.href).searchParams.get('resourcekey')||''}catch(e){return ''}
  }
  function directUrl(id,key=''){
    if(!id)return '';
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t${key?`&resourcekey=${encodeURIComponent(key)}`:''}`;
  }
  function previewUrl(id,key=''){
    if(!id)return '';
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview${key?`?resourcekey=${encodeURIComponent(key)}`:''}`;
  }
  function viewUrl(id,key=''){
    if(!id)return '';
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view${key?`?resourcekey=${encodeURIComponent(key)}`:''}`;
  }
  function byId(id){try{return (db?.properties||[]).find(p=>String(p.id)===String(id))}catch(e){return null}}
  function youtubeId(url){const m=txt(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);return m?m[1]:''}
  function vimeoId(url){const m=txt(url).match(/vimeo\.com\/(?:video\/)?(\d+)/i);return m?m[1]:''}

  function viewer(){
    let el=document.getElementById('agCrmVideoViewer');
    if(!el){
      el=document.createElement('div');el.id='agCrmVideoViewer';el.className='ag-crm-video-viewer';
      el.innerHTML='<div class="ag-crm-video-dialog"><div class="ag-crm-video-top"><b id="agCrmVideoTitle">Vídeo do imóvel</b><button type="button" id="agCrmVideoClose" aria-label="Fechar">×</button></div><div class="ag-crm-video-frame" id="agCrmVideoFrame"></div><div class="ag-crm-video-note" id="agCrmVideoNote"></div></div>';
      document.body.appendChild(el);
      el.addEventListener('click',e=>{if(e.target===el)close()});
      el.querySelector('#agCrmVideoClose')?.addEventListener('click',close);
    }
    return el;
  }
  function close(){const el=document.getElementById('agCrmVideoViewer');if(!el)return;el.classList.remove('show');const f=document.getElementById('agCrmVideoFrame');if(f)f.innerHTML=''}
  function setNote(html){const n=document.getElementById('agCrmVideoNote');if(n)n.innerHTML=html||''}
  function driveFallback(frame,id,key,title){
    frame.innerHTML=`<iframe src="${esc(previewUrl(id,key))}" title="${esc(title)}" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    setNote(`O arquivo original não pôde ser reproduzido diretamente neste navegador. Usando o player do Google Drive. <a href="${esc(viewUrl(id,key))}" target="_blank" rel="noopener">Abrir vídeo no Drive</a>`);
  }
  function drivePlayer(frame,id,key,title,poster,mime){
    frame.innerHTML='';
    const wrap=document.createElement('div');wrap.className='ag-drive-native-wrap';
    const status=document.createElement('div');status.className='ag-drive-native-status';status.innerHTML='<span class="ag-drive-spinner"></span><b>Carregando vídeo…</b><small>Reproduzindo o arquivo original do Google Drive.</small>';
    const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('controlsList','nodownload');
    if(poster)video.poster=poster;
    const source=document.createElement('source');source.src=directUrl(id,key);if(mime&&/^video\//i.test(mime))source.type=mime;video.appendChild(source);
    wrap.append(video,status);frame.appendChild(wrap);
    let settled=false;
    const ready=()=>{if(settled)return;settled=true;status.remove();setNote(`Vídeo reproduzido diretamente do Google Drive. <a href="${esc(viewUrl(id,key))}" target="_blank" rel="noopener">Abrir no Drive</a>`)};
    const fail=()=>{if(settled)return;settled=true;driveFallback(frame,id,key,title)};
    video.addEventListener('loadedmetadata',ready,{once:true});
    video.addEventListener('canplay',ready,{once:true});
    video.addEventListener('error',fail,{once:true});
    source.addEventListener('error',fail,{once:true});
    setTimeout(()=>{if(!settled&&video.readyState<1)fail()},9000);
    video.play().catch(()=>{});
  }

  window.openPropertyVideo=function(propertyId,videoId){
    const p=byId(propertyId),v=(p?.videos||[]).find(x=>String(x.id)===String(videoId));if(!v)return;
    const el=viewer(),frame=document.getElementById('agCrmVideoFrame'),title=v.title||p.title||'Vídeo do imóvel';
    document.getElementById('agCrmVideoTitle').textContent=title;
    const id=v.driveFileId||driveId(v.drivePreviewUrl||v.url||v.driveWebViewLink),key=v.driveResourceKey||resourceKey(v.drivePreviewUrl||v.driveWebViewLink||v.url);
    const y=youtubeId(v.url),vm=vimeoId(v.url);
    if(id){drivePlayer(frame,id,key,title,v.thumb||'',v.mimeType||'')}
    else if(y){frame.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(y)}?autoplay=1&rel=0" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;setNote('')}
    else if(vm){frame.innerHTML=`<iframe src="https://player.vimeo.com/video/${encodeURIComponent(vm)}?autoplay=1" title="${esc(title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;setNote('')}
    else{frame.innerHTML=`<video controls autoplay playsinline preload="metadata" src="${esc(v.url)}"></video>`;setNote('')}
    el.classList.add('show');
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
