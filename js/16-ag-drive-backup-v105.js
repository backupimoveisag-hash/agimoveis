/* AG CRM V105 — Google Drive backup JSON via Google Identity Services + Drive API */
(function(){
  'use strict';
  const CFG=()=>window.AG_GOOGLE_DRIVE_CONFIG||{};
  const SCOPE='https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
  const LS_AUTO='agDriveAutoBackupV105';
  const LS_LAST='agDriveLastBackupV105';
  let tokenClient=null, accessToken='', tokenExpiresAt=0, folderId='', autoTimer=null, sdkPromise=null, accountEmail='';

  const $=id=>document.getElementById(id);
  const isAdmin=()=>{try{return window.agIsPropertyAdmin?window.agIsPropertyAdmin():window.EIFirebaseCRM?.getProfile?.()?.role==='Administrador'}catch(e){return false}};
  const configured=()=>{const id=String(CFG().oauthClientId||'');return CFG().enabled!==false && /\.apps\.googleusercontent\.com$/.test(id) && !id.startsWith('COLE_AQUI_')};
  function setMsg(msg,tone=''){const el=$('agDriveMessage');if(!el)return;el.className='ag-drive-message'+(tone?' is-'+tone:'');el.innerHTML=msg}
  function setState(label,state='off'){const el=$('agDriveState');if(!el)return;el.textContent=label;el.dataset.state=state}
  function fmtDate(iso){if(!iso)return'Nunca';try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso))}catch(e){return iso}}
  function ui(){
    const admin=isAdmin(), cfg=CFG(), auto=localStorage.getItem(LS_AUTO)==='1';
    const card=$('agDriveBackupCard');if(card)card.style.display=admin?'':'none';
    if(!admin)return;
    if($('agDriveFolder'))$('agDriveFolder').textContent=cfg.folderName||'AG CRM Backups';
    if($('agDriveLastBackup'))$('agDriveLastBackup').textContent=fmtDate(localStorage.getItem(LS_LAST));
    if($('agDriveAccount'))$('agDriveAccount').textContent=accountEmail||'—';
    if($('agDriveAutoToggle'))$('agDriveAutoToggle').checked=auto;
    if($('agDriveAutoLabel'))$('agDriveAutoLabel').textContent=auto?'Ativado':'Desativado';
    const ready=!!accessToken && Date.now()<tokenExpiresAt-60000;
    if(!configured()){
      setState('Configuração pendente','error');
      setMsg('Informe o <b>OAuth Client ID</b> em <b>google-drive-config.js</b>. O passo a passo está em <b>README/README_V105_GOOGLE_DRIVE_BACKUP.txt</b>.','error');
      if($('agDriveBackupNowBtn'))$('agDriveBackupNowBtn').disabled=true;
      if($('agDriveConnectBtn'))$('agDriveConnectBtn').textContent='Configurar Google Drive';
      return;
    }
    setState(ready?'Conectado':'Não conectado',ready?'on':'off');
    if($('agDriveBackupNowBtn'))$('agDriveBackupNowBtn').disabled=!ready;
    if($('agDriveConnectBtn'))$('agDriveConnectBtn').textContent=ready?'Reconectar Drive':'Conectar Google Drive';
    if(ready)setMsg('Google Drive autorizado. O JSON será salvo apenas na pasta criada pelo AG CRM.','success');
    else setMsg('Clique em <b>Conectar Google Drive</b> para autorizar o backup nesta sessão.');
  }

  function loadGis(){
    if(window.google?.accounts?.oauth2)return Promise.resolve();
    if(sdkPromise)return sdkPromise;
    sdkPromise=new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-ag-gis]');if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}
      const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.dataset.agGis='1';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar a autorização do Google.'));document.head.appendChild(s);
    });
    return sdkPromise;
  }
  async function initTokenClient(){
    if(tokenClient)return tokenClient;
    await loadGis();
    if(!window.google?.accounts?.oauth2)throw new Error('Google Identity Services indisponível.');
    tokenClient=google.accounts.oauth2.initTokenClient({client_id:CFG().oauthClientId,scope:SCOPE,callback:()=>{}});
    return tokenClient;
  }
  async function connectDrive(){
    if(!configured()){ui();throw new Error('OAuth Client ID do Google Drive ainda não foi configurado.');}
    const client=await initTokenClient();
    setState('Autorizando…','off');setMsg('Abra a janela do Google e autorize o AG CRM a criar seus arquivos de backup.');
    return new Promise((resolve,reject)=>{
      client.callback=async resp=>{
        if(resp?.error){setState('Falha na autorização','error');setMsg('Não foi possível autorizar o Google Drive: '+resp.error,'error');reject(new Error(resp.error));return}
        accessToken=resp.access_token||'';tokenExpiresAt=Date.now()+(Number(resp.expires_in||3600)*1000);folderId='';
        try{await loadAccountEmail()}catch(e){}
        ui();resolve(accessToken);
      };
      client.requestAccessToken({prompt:'consent'});
    });
  }
  async function api(url,opt={}){
    if(!accessToken||Date.now()>=tokenExpiresAt-30000)throw new Error('Sessão do Google Drive expirada. Conecte novamente.');
    const headers=new Headers(opt.headers||{});headers.set('Authorization','Bearer '+accessToken);
    const res=await fetch(url,{...opt,headers});
    if(!res.ok){let msg='Erro Google Drive '+res.status;try{const j=await res.json();msg=j?.error?.message||msg}catch(e){}throw new Error(msg)}
    if(res.status===204)return null;const ct=res.headers.get('content-type')||'';return ct.includes('json')?res.json():res.text();
  }
  async function loadAccountEmail(){
    try{const r=await api('https://www.googleapis.com/oauth2/v3/userinfo');accountEmail=r.email||''}catch(e){accountEmail=''}
  }
  function qEscape(v){return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
  async function ensureFolder(){
    if(folderId)return folderId;
    const name=CFG().folderName||'AG CRM Backups';
    const q=`name='${qEscape(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const found=await api('https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)&q='+encodeURIComponent(q));
    if(found.files?.[0]){folderId=found.files[0].id;return folderId}
    const created=await api('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder'})});
    folderId=created.id;return folderId;
  }
  function backupPayload(){
    if(typeof db==='undefined')throw new Error('Base do CRM não está disponível.');
    return JSON.stringify(db,null,2);
  }
  function backupFilename(){
    const d=new Date(), pad=n=>String(n).padStart(2,'0');
    return `AG_CRM_BACKUP_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.json`;
  }
  async function uploadJson(name,json,parent){
    const boundary='agcrm_'+Math.random().toString(36).slice(2);
    const meta={name,mimeType:'application/json',parents:[parent],description:'Backup automático do AG CRM'};
    const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
    return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,webViewLink',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
  }
  async function backupNow({silent=false}={}){
    if(!isAdmin())throw new Error('Somente o Administrador pode gerar o backup central do Google Drive.');
    if(!accessToken||Date.now()>=tokenExpiresAt-30000){if(silent)return null;await connectDrive()}
    try{
      if(!silent){setState('Salvando…','off');setMsg('Gerando o JSON e enviando para o Google Drive…')}
      const folder=await ensureFolder(), json=backupPayload(), name=backupFilename();
      const file=await uploadJson(name,json,folder), now=new Date().toISOString();
      localStorage.setItem(LS_LAST,now);ui();
      if(!silent){setMsg(`Backup concluído: <b>${name}</b> (${(new Blob([json]).size/1024).toFixed(0)} KB).`,'success');try{toast('Backup salvo no Google Drive.')}catch(e){}}
      return file;
    }catch(err){setState('Erro no backup','error');setMsg(err.message||String(err),'error');if(!silent){try{toast('Falha ao salvar backup no Google Drive.')}catch(e){}}throw err}
  }
  function scheduleAutoBackup(){
    if(localStorage.getItem(LS_AUTO)!=='1'||!accessToken||!isAdmin())return;
    clearTimeout(autoTimer);autoTimer=setTimeout(()=>backupNow({silent:true}).catch(()=>{}),Number(CFG().autoBackupDelayMs||120000));
  }
  function hookSave(){
    if(typeof window.saveDB!=='function'||window.saveDB.__agDriveHook)return;
    const base=window.saveDB;
    const hooked=function(){const r=base.apply(this,arguments);scheduleAutoBackup();return r};hooked.__agDriveHook=true;window.saveDB=hooked;
  }
  function bind(){
    $('agDriveConnectBtn')?.addEventListener('click',()=>connectDrive().catch(err=>setMsg(err.message,'error')));
    $('agDriveBackupNowBtn')?.addEventListener('click',()=>backupNow().catch(()=>{}));
    $('agDriveAutoToggle')?.addEventListener('change',e=>{localStorage.setItem(LS_AUTO,e.target.checked?'1':'0');ui();if(e.target.checked)scheduleAutoBackup()});
    hookSave();ui();
  }
  window.AGDriveBackup={connect:connectDrive,backupNow,schedule:scheduleAutoBackup,status:()=>({connected:!!accessToken,accountEmail,folderId})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,0));else setTimeout(bind,0);
  setTimeout(()=>{hookSave();ui()},2500);
})();
