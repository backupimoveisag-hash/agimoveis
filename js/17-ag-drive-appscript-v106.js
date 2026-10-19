/* AG CRM V106 — Google Drive via Google Apps Script (JSON + imagens) */
(function(){
  'use strict';
  const LS_LAST='agDriveLastBackupV106';
  const LS_LAST_TEST='agDriveLastTestV106';
  let autoTimer=null;
  const $=id=>document.getElementById(id);
  const isAdmin=()=>{try{return window.agIsPropertyAdmin?window.agIsPropertyAdmin():window.EIFirebaseCRM?.getProfile?.()?.role==='Administrador'}catch(e){return false}};
  function cfg(){
    try{return (typeof db!=='undefined' && db?.settings?.driveGateway)||{} }catch(e){return {}}
  }
  function configured(c=cfg()){
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(String(c.webAppUrl||'').trim()) && String(c.apiKey||'').trim().length>=8;
  }
  function setState(label,state='off'){const el=$('agDriveState');if(!el)return;el.textContent=label;el.dataset.state=state}
  function setMsg(msg,tone=''){const el=$('agDriveMessage');if(!el)return;el.className='ag-drive-message'+(tone?' is-'+tone:'');el.innerHTML=msg}
  function fmt(iso){if(!iso)return'Nunca';try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso))}catch(e){return iso}}
  function safeName(v){return String(v||'arquivo').replace(/[\\/:*?"<>|]+/g,'-').trim()||'arquivo'}
  function currentConfigFromFields(){
    return {
      enabled:true,
      webAppUrl:String($('agDriveWebAppUrl')?.value||'').trim(),
      apiKey:String($('agDriveApiKey')?.value||'').trim(),
      rootFolderId:String($('agDriveRootFolderId')?.value||'').trim(),
      rootFolderName:String($('agDriveRootFolderName')?.value||'AG CRM').trim()||'AG CRM',
      autoBackup:!!$('agDriveAutoToggle')?.checked,
      autoBackupDelayMs:Number(cfg().autoBackupDelayMs||120000)
    };
  }
  function render(){
    const admin=isAdmin(), c=cfg(), card=$('agDriveBackupCard');if(card)card.style.display=admin?'':'none';if(!admin)return;
    if($('agDriveWebAppUrl') && document.activeElement!==$('agDriveWebAppUrl'))$('agDriveWebAppUrl').value=c.webAppUrl||'';
    if($('agDriveApiKey') && document.activeElement!==$('agDriveApiKey'))$('agDriveApiKey').value=c.apiKey||'';
    if($('agDriveRootFolderId') && document.activeElement!==$('agDriveRootFolderId'))$('agDriveRootFolderId').value=c.rootFolderId||'';
    if($('agDriveRootFolderName') && document.activeElement!==$('agDriveRootFolderName'))$('agDriveRootFolderName').value=c.rootFolderName||'AG CRM';
    if($('agDriveAutoToggle'))$('agDriveAutoToggle').checked=!!c.autoBackup;
    if($('agDriveLastBackup'))$('agDriveLastBackup').textContent=fmt(localStorage.getItem(LS_LAST));
    if($('agDriveFolder'))$('agDriveFolder').textContent=c.rootFolderName||'AG CRM';
    if($('agDriveAutoLabel'))$('agDriveAutoLabel').textContent=c.autoBackup?'Ativado':'Desativado';
    if($('agDriveImageMode'))$('agDriveImageMode').textContent=configured(c)?'Drive obrigatório':'Pendente';
    if(configured(c)){setState('Configurado','on');setMsg('Apps Script configurado. Backups JSON e novas fotos serão enviados ao Google Drive.','success')}
    else{setState('Configuração pendente','error');setMsg('Cole a <b>URL do Web App</b> e a <b>chave de integração</b> geradas pelo Apps Script.','error')}
  }
  async function request(action,payload={},overrideCfg=null){
    const c=overrideCfg||cfg();if(!configured(c))throw new Error('Google Drive não configurado. Vá em Ajustes → Google Drive · Apps Script.');
    const body={action,apiKey:String(c.apiKey||'').trim(),rootFolderId:String(c.rootFolderId||'').trim(),rootFolderName:String(c.rootFolderName||'AG CRM').trim(),...payload};
    let res;
    try{res=await fetch(String(c.webAppUrl).trim(),{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(body),redirect:'follow'})}
    catch(err){throw new Error('Não foi possível acessar o Apps Script. Verifique a URL do Web App e se a implantação permite acesso.')}
    const raw=await res.text();let data;
    try{data=JSON.parse(raw)}catch(e){throw new Error('Resposta inválida do Apps Script. Confirme que a URL termina em /exec e que o código V106 foi publicado.')}
    if(!data?.ok)throw new Error(data?.error||'Falha na integração com o Google Drive.');
    return data;
  }
  async function saveCredentials(){
    if(!isAdmin())return;
    const c=currentConfigFromFields();
    if(typeof db==='undefined')throw new Error('Base do CRM indisponível.');db.settings=db.settings||{};db.settings.driveGateway=c;
    try{saveDB();localStorage.setItem('atlasImobCRM',JSON.stringify(db))}catch(e){console.error(e)}
    render();try{toast('Credenciais do Apps Script salvas.')}catch(e){}
  }
  async function testConnection(){
    if(!isAdmin())return;
    const c=currentConfigFromFields();setState('Testando…','off');setMsg('Testando comunicação com o Apps Script e acesso à pasta do Drive…');
    try{const r=await request('ping',{},c);localStorage.setItem(LS_LAST_TEST,new Date().toISOString());setState('Conectado','on');setMsg(`Conexão concluída. Pasta: <b>${r.rootFolderName||c.rootFolderName||'AG CRM'}</b>.`,'success');try{toast('Google Drive conectado via Apps Script.')}catch(e){}}
    catch(err){setState('Falha','error');setMsg(err.message,'error')}
  }
  function backupJsonPayload(){
    if(typeof db==='undefined')throw new Error('Base do CRM indisponível.');
    return JSON.stringify(db,null,2);
  }
  function backupName(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `AG_CRM_BACKUP_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.json`}
  async function backupNow({silent=false}={}){
    if(!isAdmin()){if(silent)return null;throw new Error('Somente o Administrador pode executar o backup JSON central.');}
    const json=backupJsonPayload(),name=backupName();
    if(!silent){setState('Salvando…','off');setMsg('Enviando o arquivo JSON para o Google Drive…')}
    try{const r=await request('backupJson',{fileName:name,json});localStorage.setItem(LS_LAST,new Date().toISOString());render();if(!silent){setState('Backup concluído','on');setMsg(`Backup salvo: <b>${name}</b>.`,'success');try{toast('Backup JSON salvo no Google Drive.')}catch(e){}}return r}
    catch(err){if(!silent){setState('Erro no backup','error');setMsg(err.message,'error')}throw err}
  }
  async function uploadImageData(dataUrl,meta={}){
    const c=cfg();if(!configured(c))throw new Error('A imagem não foi enviada: configure o Google Drive via Apps Script em Ajustes.');
    if(!/^data:image\//i.test(String(dataUrl||'')))throw new Error('Formato de imagem inválido.');
    const fileName=safeName(meta.fileName||`foto_${Date.now()}.jpg`);
    const propertyId=safeName(meta.propertyId||'SEM_CODIGO');
    const r=await request('uploadImage',{dataUrl,fileName,propertyId,room:String(meta.room||'Foto'),uploadedBy:String(window.EIFirebaseCRM?.getProfile?.()?.name||'')});
    if(!r.url)throw new Error('O Apps Script salvou a imagem, mas não retornou a URL pública.');
    return r;
  }
  function schedule(){
    const c=cfg();if(!c.autoBackup||!configured(c)||!isAdmin())return;clearTimeout(autoTimer);autoTimer=setTimeout(()=>backupNow({silent:true}).catch(()=>{}),Number(c.autoBackupDelayMs||120000));
  }
  function hookSave(){
    if(typeof window.saveDB!=='function'||window.saveDB.__agAppsDriveHook)return;const base=window.saveDB;const wrapped=function(){const r=base.apply(this,arguments);schedule();return r};wrapped.__agAppsDriveHook=true;window.saveDB=wrapped;
  }
  function bind(){
    $('agDriveSaveBtn')?.addEventListener('click',()=>saveCredentials());
    $('agDriveTestBtn')?.addEventListener('click',()=>testConnection());
    $('agDriveBackupNowBtn')?.addEventListener('click',()=>backupNow().catch(err=>setMsg(err.message,'error')));
    $('agDriveAutoToggle')?.addEventListener('change',async()=>{await saveCredentials();schedule()});
    $('agDriveShowKeyBtn')?.addEventListener('click',()=>{const el=$('agDriveApiKey');if(!el)return;el.type=el.type==='password'?'text':'password';$('agDriveShowKeyBtn').textContent=el.type==='password'?'Mostrar':'Ocultar'});
    hookSave();render();
  }
  window.AGDriveGateway={request,backupNow,uploadImageData,configured:()=>configured(cfg()),config:cfg,schedule};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,0));else setTimeout(bind,0);
  setInterval(()=>{hookSave();render()},5000);
})();
