/* AG CRM V117 — Google Drive via Apps Script + e-mail + snapshot + backup 12h + boas-vindas */
(function(){
  'use strict';

  const DEFAULT_EMAIL='lucas@igenergia.com.br';
  const LS_LAST_BACKUP='agDriveLastBackupV107';
  const LS_LAST_TEST='agDriveLastTestV107';
  const LS_LAST_SNAPSHOT_HASH='agDriveLastSnapshotHashV107';
  const LS_TRIGGER='agDriveTriggerV107';
  let snapshotTimer=null;

  const $=id=>document.getElementById(id);
  const profile=()=>{try{return window.EIFirebaseCRM?.getProfile?.()||null}catch(e){return null}};
  const isAdmin=()=>{try{return window.agIsPropertyAdmin?window.agIsPropertyAdmin():profile()?.role==='Administrador'}catch(e){return false}};

  function cfg(){
    try{return (typeof db!=='undefined' && db?.settings?.driveGateway)||{} }catch(e){return {}}
  }

  function configured(c=cfg()){
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(String(c.webAppUrl||'').trim()) && String(c.apiKey||'').trim().length>=8;
  }

  function setState(label,state='off'){
    const el=$('agDriveState');if(!el)return;el.textContent=label;el.dataset.state=state;
  }

  function setMsg(msg,tone=''){
    const el=$('agDriveMessage');if(!el)return;el.className='ag-drive-message'+(tone?' is-'+tone:'');el.innerHTML=msg;
  }

  function fmt(iso){
    if(!iso)return'Nunca';
    try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso))}catch(e){return iso}
  }

  function safeName(v){return String(v||'arquivo').replace(/[\\/:*?"<>|]+/g,'-').trim()||'arquivo'}

  function currentHostedCrmUrl(){
    try{
      if(!/^https?:$/i.test(location.protocol))return '';
      const u=new URL(location.href);u.search='';u.hash='';
      if(/\/index\.html?$/i.test(u.pathname))u.pathname=u.pathname.replace(/\/index\.html?$/i,'/');
      return u.href;
    }catch(e){return ''}
  }

  function currentConfigFromFields(){
    return {
      enabled:true,
      webAppUrl:String($('agDriveWebAppUrl')?.value||'').trim(),
      apiKey:String($('agDriveApiKey')?.value||'').trim(),
      rootFolderId:String($('agDriveRootFolderId')?.value||'').trim(),
      rootFolderName:String($('agDriveRootFolderName')?.value||'AG CRM').trim()||'AG CRM',
      notifyEmail:String($('agDriveNotifyEmail')?.value||DEFAULT_EMAIL).trim()||DEFAULT_EMAIL,
      crmAccessUrl:String($('agDriveCrmAccessUrl')?.value||currentHostedCrmUrl()).trim(),
      backupEveryHours:12
    };
  }

  function render(){
    const admin=isAdmin(), c=cfg(), card=$('agDriveBackupCard');
    if(card)card.style.display=admin?'':'none';
    if(!admin)return;

    if($('agDriveWebAppUrl') && document.activeElement!==$('agDriveWebAppUrl'))$('agDriveWebAppUrl').value=c.webAppUrl||'';
    if($('agDriveApiKey') && document.activeElement!==$('agDriveApiKey'))$('agDriveApiKey').value=c.apiKey||'';
    if($('agDriveRootFolderId') && document.activeElement!==$('agDriveRootFolderId'))$('agDriveRootFolderId').value=c.rootFolderId||'';
    if($('agDriveRootFolderName') && document.activeElement!==$('agDriveRootFolderName'))$('agDriveRootFolderName').value=c.rootFolderName||'AG CRM';
    if($('agDriveNotifyEmail') && document.activeElement!==$('agDriveNotifyEmail'))$('agDriveNotifyEmail').value=c.notifyEmail||DEFAULT_EMAIL;
    if($('agDriveCrmAccessUrl') && document.activeElement!==$('agDriveCrmAccessUrl'))$('agDriveCrmAccessUrl').value=c.crmAccessUrl||currentHostedCrmUrl()||'';

    if($('agDriveLastBackup'))$('agDriveLastBackup').textContent=fmt(localStorage.getItem(LS_LAST_BACKUP));
    if($('agDriveFolder'))$('agDriveFolder').textContent=c.rootFolderName||'AG CRM';
    if($('agDriveImageMode'))$('agDriveImageMode').textContent=configured(c)?'Drive obrigatório':'Pendente';
    if($('agDriveScheduleLabel'))$('agDriveScheduleLabel').textContent=localStorage.getItem(LS_TRIGGER)==='1'?'A cada 12 horas':'Pendente';
    if($('agDriveEmailLabel'))$('agDriveEmailLabel').textContent=c.notifyEmail||DEFAULT_EMAIL;

    if(configured(c)){
      setState('Configurado','on');
      setMsg('Apps Script configurado. Alterações relevantes atualizam o snapshot no Drive e enviam aviso por e-mail. O backup agendado ocorre a cada 12 horas.','success');
    }else{
      setState('Configuração pendente','error');
      setMsg('Cole a <b>URL do Web App</b> e a <b>chave de integração</b> geradas pelo Apps Script.','error');
    }
  }

  async function request(action,payload={},overrideCfg=null){
    const c=overrideCfg||cfg();
    if(!configured(c))throw new Error('Google Drive não configurado. Vá em Ajustes → Google Drive · Apps Script.');
    const body={
      action,
      apiKey:String(c.apiKey||'').trim(),
      rootFolderId:String(c.rootFolderId||'').trim(),
      rootFolderName:String(c.rootFolderName||'AG CRM').trim(),
      notifyEmail:String(c.notifyEmail||DEFAULT_EMAIL).trim()||DEFAULT_EMAIL,
      crmAccessUrl:String(c.crmAccessUrl||currentHostedCrmUrl()||'').trim(),
      ...payload
    };
    let res;
    try{
      res=await fetch(String(c.webAppUrl).trim(),{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify(body),
        redirect:'follow'
      });
    }catch(err){
      throw new Error('Não foi possível acessar o Apps Script. Verifique a URL do Web App e a implantação.');
    }
    const raw=await res.text();let data;
    try{data=JSON.parse(raw)}catch(e){throw new Error('Resposta inválida do Apps Script. Publique o código V117 em uma nova versão do Web App.');}
    if(!data?.ok)throw new Error(data?.error||'Falha na integração com o Google Drive.');
    return data;
  }

  async function saveCredentials(){
    if(!isAdmin())return;
    const c=currentConfigFromFields();
    if(typeof db==='undefined')throw new Error('Base do CRM indisponível.');
    db.settings=db.settings||{};
    db.settings.driveGateway=c;
    try{
      saveDB();
      localStorage.setItem('atlasImobCRM',JSON.stringify(db));
    }catch(e){console.error(e)}
    render();

    if(configured(c)){
      try{
        await request('configure',{},c);
        const r=await request('installBackup12h',{},c);
        localStorage.setItem(LS_TRIGGER,r?.triggerActive?'1':'0');
        await syncSnapshot({force:true,overrideCfg:c,silent:true});
        setMsg(`Credenciais salvas. Avisos serão enviados para <b>${c.notifyEmail}</b> e o backup está programado a cada 12 horas.`,'success');
      }catch(err){
        setMsg('Credenciais salvas no CRM, mas o Apps Script respondeu: '+err.message,'error');
      }
    }
    try{toast('Credenciais do Apps Script salvas.')}catch(e){}
  }

  async function testConnection(){
    if(!isAdmin())return;
    const c=currentConfigFromFields();
    setState('Testando…','off');
    setMsg('Testando Apps Script, Google Drive, e-mail e situação do backup 12h…');
    try{
      const r=await request('ping',{},c);
      localStorage.setItem(LS_LAST_TEST,new Date().toISOString());
      localStorage.setItem(LS_TRIGGER,r?.triggerActive?'1':'0');
      setState('Conectado','on');
      setMsg(`Conexão concluída. Pasta: <b>${r.rootFolderName||c.rootFolderName||'AG CRM'}</b> · E-mail: <b>${r.notifyEmail||c.notifyEmail}</b> · Backup: <b>${r.triggerActive?'a cada 12 horas':'gatilho pendente'}</b>.`,'success');
      try{toast('Google Drive e Apps Script conectados.')}catch(e){}
      render();
    }catch(err){
      setState('Falha','error');
      setMsg(err.message,'error');
    }
  }

  async function installBackup12h(){
    if(!isAdmin())return;
    const c=currentConfigFromFields();
    setMsg('Instalando o gatilho de backup a cada 12 horas…');
    try{
      const r=await request('installBackup12h',{},c);
      localStorage.setItem(LS_TRIGGER,r?.triggerActive?'1':'0');
      setMsg('Backup automático instalado: <b>a cada 12 horas</b>.','success');
      render();
      try{toast('Backup automático de 12 em 12 horas ativado.')}catch(e){}
    }catch(err){setMsg(err.message,'error')}
  }

  function sanitizedDbJson(){
    if(typeof db==='undefined')throw new Error('Base do CRM indisponível.');
    const copy=JSON.parse(JSON.stringify(db));
    if(copy?.settings?.driveGateway?.apiKey) copy.settings.driveGateway.apiKey='';
    return JSON.stringify(copy,null,2);
  }

  function hashString(str){
    let h=2166136261;
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(16);
  }

  function actorName(){
    const p=profile();
    return String(p?.name||p?.email||p?.role||'Usuário do CRM');
  }

  function latestSummary(){
    try{
      const a=db?.activities?.[0];
      if(a?.title)return [a.title,a.text].filter(Boolean).join(' · ').slice(0,220);
    }catch(e){}
    return 'Dados do CRM atualizados';
  }

  async function syncSnapshot({force=false,overrideCfg=null,silent=true}={}){
    const c=overrideCfg||cfg();
    if(!configured(c))return null;
    const json=sanitizedDbJson();
    const hash=hashString(json);
    if(!force && localStorage.getItem(LS_LAST_SNAPSHOT_HASH)===hash)return null;
    try{
      const r=await request('saveSnapshot',{json,summary:latestSummary(),actor:actorName()},c);
      localStorage.setItem(LS_LAST_SNAPSHOT_HASH,hash);
      return r;
    }catch(err){
      if(!silent)setMsg(err.message,'error');
      console.warn('AG CRM: não foi possível atualizar o snapshot no Drive.',err);
      return null;
    }
  }

  function scheduleSnapshot(){
    const c=cfg();
    if(!configured(c))return;
    clearTimeout(snapshotTimer);
    snapshotTimer=setTimeout(()=>syncSnapshot({silent:true}),2200);
  }

  function backupName(){
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    return `AG_CRM_BACKUP_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.json`;
  }

  async function backupNow({silent=false}={}){
    if(!isAdmin()){
      if(silent)return null;
      throw new Error('Somente o Administrador pode executar o backup JSON central.');
    }
    const json=sanitizedDbJson(),name=backupName();
    if(!silent){setState('Salvando…','off');setMsg('Enviando o backup JSON para o Google Drive…')}
    try{
      const r=await request('backupJson',{fileName:name,json,backupKind:'manual',actor:actorName()});
      localStorage.setItem(LS_LAST_BACKUP,new Date().toISOString());
      localStorage.setItem(LS_LAST_SNAPSHOT_HASH,hashString(json));
      render();
      if(!silent){
        setState('Backup concluído','on');
        setMsg(`Backup salvo: <b>${r.fileName||name}</b>. Um e-mail de confirmação foi enviado.`,'success');
        try{toast('Backup JSON salvo no Google Drive.')}catch(e){}
      }
      return r;
    }catch(err){
      if(!silent){setState('Erro no backup','error');setMsg(err.message,'error')}
      throw err;
    }
  }

  async function uploadImageData(dataUrl,meta={}){
    const c=cfg();
    if(!configured(c))throw new Error('A imagem não foi enviada: configure o Google Drive via Apps Script em Ajustes.');
    if(!/^data:image\//i.test(String(dataUrl||'')))throw new Error('Formato de imagem inválido.');
    const fileName=safeName(meta.fileName||`foto_${Date.now()}.jpg`);
    const propertyId=safeName(meta.propertyId||'SEM_CODIGO');
    const r=await request('uploadImage',{
      dataUrl,
      fileName,
      propertyId,
      room:String(meta.room||'Foto'),
      uploadedBy:actorName()
    });
    if(!r.url)throw new Error('O Apps Script salvou a imagem, mas não retornou a URL pública.');
    return r;
  }

  function hookSave(){
    if(typeof window.saveDB!=='function'||window.saveDB.__agAppsDriveV107Hook)return;
    const base=window.saveDB;
    const wrapped=function(){
      const r=base.apply(this,arguments);
      scheduleSnapshot();
      return r;
    };
    wrapped.__agAppsDriveV107Hook=true;
    window.saveDB=wrapped;
  }

  async function testWelcomeEmail(){
    if(!isAdmin())return;
    const c=currentConfigFromFields();
    const recipient=String(c.notifyEmail||DEFAULT_EMAIL).trim();
    setMsg(`Enviando um e-mail de boas-vindas de teste para <b>${recipient}</b>…`);
    try{
      const r=await request('welcomeEmail',{
        email:recipient,
        name:'Teste AG CRM',
        role:'Administrador',
        accessUrl:String(c.crmAccessUrl||currentHostedCrmUrl()||'').trim()
      },c);
      setMsg(`E-mail de boas-vindas enviado para <b>${r.recipient||recipient}</b>. Verifique também a pasta de spam.`, 'success');
      try{toast('E-mail de boas-vindas de teste enviado.')}catch(e){}
      return r;
    }catch(err){
      setMsg('Falha no e-mail de boas-vindas: <b>'+String(err.message||err)+'</b>','error');
      throw err;
    }
  }

  function bind(){
    $('agDriveSaveBtn')?.addEventListener('click',()=>saveCredentials());
    $('agDriveTestBtn')?.addEventListener('click',()=>testConnection());
    $('agDriveBackupNowBtn')?.addEventListener('click',()=>backupNow().catch(err=>setMsg(err.message,'error')));
    $('agDriveInstallTriggerBtn')?.addEventListener('click',()=>installBackup12h());
    $('agDriveTestWelcomeBtn')?.addEventListener('click',()=>testWelcomeEmail().catch(()=>{}));
    $('agDriveShowKeyBtn')?.addEventListener('click',()=>{
      const el=$('agDriveApiKey');if(!el)return;
      el.type=el.type==='password'?'text':'password';
      $('agDriveShowKeyBtn').textContent=el.type==='password'?'Mostrar':'Ocultar';
    });
    hookSave();
    render();
  }

  window.AGDriveGateway={
    request,
    backupNow,
    uploadImageData,
    syncSnapshot,
    configured:()=>configured(cfg()),
    config:cfg,
    installBackup12h,
    testWelcomeEmail,
    currentHostedCrmUrl
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,0));
  else setTimeout(bind,0);

  setInterval(()=>{hookSave();render()},5000);
})();
