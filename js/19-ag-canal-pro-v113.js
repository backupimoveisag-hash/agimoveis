/* AG CRM v113 — Canal Pro (VRSync): seleção, pré-validação e publicação via Apps Script.
 * Nenhum token de repositório, segredo ou dado de proprietário vai para o XML.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const safeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const escXml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const isAdmin=()=>{try{return typeof window.agIsPropertyAdmin==='function'&&window.agIsPropertyAdmin()}catch(e){return false}};
  const settings=()=>{try{return db.settings?.canalPro||{}}catch(e){return {}}};
  let status=null, busy=false, lastHash='', statusLoading=false;
  const typeMap={"Casa":"Residential / Home","Apartamento":"Residential / Apartment","Terreno":"Residential / Land Lot","Sítio/Chácara":"Residential / Agricultural","Rural":"Residential / Agricultural","Comercial":"Commercial / Building"};
  const validTypes=new Set(['Residential / Apartment','Residential / Home','Residential / Condo','Residential / Farm Ranch','Residential / Agricultural','Residential / Land Lot','Commercial / Building','Commercial / Office','Commercial / Land Lot','Commercial / Industrial','Commercial / Business']);
  const tierTypes=new Set(['STANDARD','PREMIUM','SUPER_PREMIUM']);
  const readyStatuses=new Set(['Disponível','Reservado']);
  function typeFor(p){
    const explicit=String(p.canalProType||'');
    if(validTypes.has(explicit))return explicit;
    if(p.type==='Terreno'&&String(p.locationProfile).toLowerCase()==='comercial')return 'Commercial / Land Lot';
    return typeMap[p.type]||'';
  }
  function photoList(p){
    const list=Array.isArray(p.photos)?p.photos.slice():[];
    if(p.coverPhoto)list.sort((a,b)=>Number(b.id===p.coverPhoto)-Number(a.id===p.coverPhoto));
    const seen=new Set();
    return list.filter(ph=>{
      const url=String(ph.src||'').trim();
      if(!/^https:\/\//i.test(url)||seen.has(url))return false;
      seen.add(url);return true;
    });
  }
  function getIssues(p){
    const issues=[];
    const id=String(p.id||'').trim(),title=String(p.title||'').trim();
    const description=String(p.canalProDescription||'').replace(/<[^>]+>/g,'').trim();
    const ty=typeFor(p),land=/Land Lot|Agricultural|Farm Ranch|Industrial/.test(ty);
    if(!id||id.length>50)issues.push('Código inválido (máximo 50 caracteres)');
    if(title.length<10||title.length>100)issues.push('Título de 10 a 100 caracteres');
    if(description.length<50||description.length>3000)issues.push('Descrição de 50 a 3.000 caracteres');
    if(!readyStatuses.has(p.status))issues.push('Imóvel indisponível (não será enviado)');
    if(!ty)issues.push('Tipo VRSync não definido');
    if(Number(p.price||0)<=0)issues.push('Valor comercial ausente');
    if(!String(p.city||'').trim()||!String(p.district||'').trim()||!/^([A-Z]{2})$/.test(String(p.state||'')))issues.push('Cidade, bairro e UF obrigatórios');
    if(Number(land?(p.landArea||p.builtArea||p.area):(p.builtArea||p.area))<=0)issues.push('Área do imóvel obrigatória');
    if(!land&&Number(p.baths||0)<=0)issues.push('Quantidade de banheiros');
    if(!land&&p.beds==null)issues.push('Quantidade de quartos');
    if(photoList(p).length<5)issues.push('Mínimo de 5 fotos HTTPS diferentes');
    return issues;
  }
  function getCandidates(){return (db.properties||[]).filter(p=>p.canalProPublished===true)}
  function getActiveCandidates(){return getCandidates().filter(p=>readyStatuses.has(p.status))}
  function getReady(){return getActiveCandidates().filter(p=>!getIssues(p).length)}
  function message(text,tone=''){
    const el=$('agCpMessage');if(!el)return;
    el.className='ag-cp-message'+(tone?' '+tone:'');el.textContent=text;
  }
  function dateLabel(str){if(!str)return '—';try{return new Date(str).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(e){return '—'}}
  function getConfigForm(){return {
    enabled:!!$('agCpEnabled')?.checked,
    feedUrl:String($('agCpUrl')?.value||'').trim(),
    name:String($('agCpName')?.value||'').trim(),
    email:String($('agCpEmail')?.value||'').trim(),
    phone:String($('agCpPhone')?.value||'').trim(),
    website:String($('agCpWebsite')?.value||'').trim()
  }}
  function readConfig(){
    const c=settings();
    const values={agCpEnabled:!!c.enabled,agCpUrl:c.feedUrl||'https://www.imoveisag.com/integracoes/canalpro.xml',agCpName:c.name||'AG Imobiliária',agCpEmail:c.email||'',agCpPhone:c.phone||db.settings?.phone||'',agCpWebsite:c.website||'https://www.imoveisag.com'};
    Object.entries(values).forEach(([id,v])=>{const el=$(id);if(!el||document.activeElement===el)return;if(el.type==='checkbox')el.checked=!!v;else el.value=v});
    const pill=$('agCpConfigStatus');if(pill){pill.textContent=c.enabled?'Exportação ativada':'Exportação desativada';pill.className='ag-cp-pill '+(c.enabled?'on':'');}
  }
  function renderStatus(){
    const el=$('agCpTechnical');if(!el)return;
    if(!window.AGDriveGateway?.configured?.()){el.textContent='Configure antes Google Drive → Apps Script em Ajustes. O Canal Pro utiliza a mesma ponte segura.';return}
    if(!status){el.textContent='Consulte o status para verificar o destino GitHub Pages.';return}
    const data=[
      'Conexão ao GitHub: '+(status.configured?'Configurada no Apps Script':'Configuração pendente'),
      'Repositório: '+(status.repo||'—'),
      'Branch: '+(status.branch||'—'),
      'Arquivo XML: '+(status.filePath||'—'),
      'URL cadastrada: '+(status.feedUrl||'—'),
      'Rotina: '+(status.triggerActive?'A cada 12 horas':'Não instalada'),
      'Último resultado: '+(status.lastState||'—')
    ];
    el.textContent=data.join('\n');
    $('agCpLastPublish').textContent=dateLabel(status.lastPublished);
    $('agCpPublishStatus').textContent=status.lastState||'Aguardando publicação';
    if(status.lastState==='Erro')$('agCpPublishStatus').title=status.lastError||'';
  }
  function renderList(){
    const arr=(db.properties||[]),selected=getCandidates(),ready=getReady();
    $('agCpSelectedCount').textContent=selected.length;
    $('agCpReadyCount').textContent=ready.length;
    $('agCpInvalidCount').textContent=getActiveCandidates().length-ready.length;
    const q=String($('agCpSearch')?.value||'').toLocaleLowerCase('pt-BR');
    const filter=$('agCpFilter')?.value||'all';
    const visible=arr.filter(p=>{
      if(q&&![p.id,p.title,p.district,p.city].join(' ').toLocaleLowerCase('pt-BR').includes(q))return false;
      if(filter==='selected'&&p.canalProPublished!==true)return false;
      if(filter==='issues'&&!(p.canalProPublished===true&&getIssues(p).length))return false;
      return true;
    });
    const list=$('agCpPropertyList');if(!list)return;
    list.innerHTML=visible.map(p=>{
      const issues=getIssues(p),eligible=readyStatuses.has(p.status),enabled=p.canalProPublished===true;
      const image=photoList(p)[0]?.src||'';
      return `<div class="ag-cp-property">
        <div class="ag-cp-property-top"><div class="ag-cp-thumb">${image?`<img src="${safeHtml(image)}" alt="" loading="lazy" onerror="this.style.display='none'">`:'⌂'}</div>
          <div class="ag-cp-property-copy"><b>${safeHtml(p.title||'Imóvel sem título')}</b><small>${safeHtml(p.id||'Sem código')} · ${safeHtml(p.city||'Cidade não informada')} · ${safeHtml(p.status||'Sem status')}</small></div>
          <label class="ag-cp-toggle" title="Selecionar para o Canal Pro"><input type="checkbox" data-cp-check="${safeHtml(p.id)}" ${enabled?'checked':''} ${!eligible?'disabled':''}><span>Enviar</span></label>
        </div>
        <div class="ag-cp-property-bottom"><label>Categoria do anúncio<select class="form-control" data-cp-tier="${safeHtml(p.id)}" ${!enabled?'disabled':''}>
          <option value="STANDARD" ${(p.canalProTier||'STANDARD')==='STANDARD'?'selected':''}>Padrão</option><option value="PREMIUM" ${p.canalProTier==='PREMIUM'?'selected':''}>Destaque</option><option value="SUPER_PREMIUM" ${p.canalProTier==='SUPER_PREMIUM'?'selected':''}>Superdestaque</option></select></label>
          <label>Tipo de imóvel no portal<select class="form-control" data-cp-type="${safeHtml(p.id)}" ${!enabled?'disabled':''}>
          <option value="Automático">Automático · ${safeHtml(typeFor(p)||'revisar')}</option>${[...validTypes].map(t=>`<option value="${t}" ${p.canalProType===t?'selected':''}>${t}</option>`).join('')}</select></label>
        </div>
        ${enabled&&!eligible?'<div class="ag-cp-ready">Status indisponível: não será incluído no próximo XML.</div>':enabled&&issues.length?`<div class="ag-cp-alert">${safeHtml(issues.join(' • '))}</div>`:enabled?'<div class="ag-cp-ready">✓ Pronto para gerar XML (fotos são verificadas no servidor)</div>':''}
      </div>`;
    }).join('')||'<p class="ag-cp-none">Nenhum imóvel corresponde à pesquisa.</p>';
  }
  function render(){const panel=$('ag-canalpro-settings');if(!panel)return;const allowed=isAdmin();
    const tab=document.querySelector('[data-settings-tab="canalpro"]');
    if(tab)tab.hidden=!allowed;
    if(!allowed){panel.style.display='none';if(panel.classList.contains('active'))window.activateSettingsTab?.('geral');return}
    panel.style.display='';
    const selected=(db.properties||[]).map(p=>[p.id,p.title,p.status,p.canalProPublished,p.canalProTier,p.canalProType,(p.photos||[]).length,p.price,p.canalProDescription,p.city,p.district].join(':')).join('|');
    const h=JSON.stringify([db.properties?.length,selected,$('agCpSearch')?.value,$('agCpFilter')?.value]);
    if(lastHash!==h){lastHash=h;renderList()}
    renderStatus();
  }
  function saveConfig(){if(!isAdmin())return;
    const c=getConfigForm();
    if(c.enabled&&(!/^https:\/\/[^\s/]+\/.+\.xml(?:\?.*)?$/i.test(c.feedUrl)||!/^https:\/\/[^\s/]+/.test(c.website)||!/^\S+@\S+\.\S+$/.test(c.email)||!c.name)){
      message('Informe URL HTTPS do XML, site HTTPS, nome e e-mail comercial válidos.','error');return;
    }
    db.settings=db.settings||{};db.settings.canalPro=c;saveDB();message('Configuração salva. Confira as pendências e publique o XML quando o Apps Script estiver preparado.','success');readConfig();render();
  }
  function saveProperty(id,patch){if(!isAdmin())return;
    const p=(db.properties||[]).find(x=>String(x.id)===String(id));if(!p)return;
    if(patch.canalProPublished===true&&!readyStatuses.has(p.status)){message('Imóvel indisponível não pode ser enviado ao Canal Pro.','error');return}
    Object.assign(p,patch);saveDB();lastHash='';render();
  }
  async function refreshStatus(){if(statusLoading||!isAdmin())return;
    statusLoading=true;
    try{
      if(!window.AGDriveGateway?.configured?.())throw new Error('Configure primeiro o Google Drive + Apps Script em Ajustes.');
      status=await window.AGDriveGateway.request('canalProStatus');
      if(status?.feedUrl&&status.feedUrl!==settings().feedUrl){message('A URL informada no CRM difere da URL configurada no Apps Script. Alinhe as duas antes de publicar.','error')}
    }catch(err){status=null;message(err.message,'error')}
    finally{statusLoading=false;renderStatus()}
  }
  async function publish(){if(busy||!isAdmin())return;const c=settings();
    if(!c.enabled){message('Ative a exportação e salve as configurações antes de publicar.','error');return}
    if(!getActiveCandidates().length&&!status?.lastPublished){message('Selecione pelo menos um imóvel para a primeira publicação.','error');return}
    if(getActiveCandidates().some(p=>getIssues(p).length)){message('Corrija as pendências dos imóveis selecionados. Nenhum feed foi publicado.','error');return}
    if(!window.AGDriveGateway?.configured?.()){message('Configure o Apps Script em Ajustes antes de publicar.','error');return}
    busy=true;$('agCpPublish').disabled=true;message('Atualizando o snapshot do CRM e enviando o XML ao GitHub Pages…');
    try{
      const snapshot=await window.AGDriveGateway.syncSnapshot({force:true,silent:false});
      if(!snapshot?.ok)throw new Error('Não foi possível salvar o estado atual do CRM no Google Drive. Publicação cancelada.');
      const result=await window.AGDriveGateway.request('canalProPublish');
      status=result.status||status;
      message(`Arquivo publicado no GitHub. ${result.published||0} anúncio(s) no XML. ${result.skipped||0} anúncio(s) com pendências. Confira o processamento no Canal Pro.`, 'success');
      await refreshStatus();
    }catch(err){message('Publicação não concluída: '+err.message,'error')}
    finally{busy=false;$('agCpPublish').disabled=false;render()}
  }
  async function installSchedule(){if(!isAdmin())return;
    try{
      const r=await window.AGDriveGateway.request('canalProInstall12h');
      message(r.triggerActive?'Rotina automática do XML instalada: a cada 12 horas.':'Não foi possível ativar a rotina.',r.triggerActive?'success':'error');
      refreshStatus();
    }catch(err){message(err.message,'error')}
  }
  function xmlPreview(){
    const c=settings(),ready=getReady();
    const el=(k,val,attrs='')=>`<${k}${attrs}>${escXml(val)}</${k}>`;
    const listings=ready.map(p=>{
      const type=typeFor(p),isLand=/Land Lot|Agricultural|Farm Ranch|Industrial/.test(type),rent=p.purpose==='Locação';
      const photos=photoList(p).slice(0,12);
      const desc=String(p.canalProDescription||'').replace(/<[^>]+>/g,'').trim().slice(0,3000);
      const tags=[el('ListingID',p.id),el('Title',p.title),el('TransactionType',rent?'For Rent':'For Sale'),el('PublicationType',tierTypes.has(p.canalProTier)?p.canalProTier:'STANDARD')];
      const media=photos.map((ph,i)=>`<Item medium="image"${i===0?' primary="true"':''}>${escXml(ph.src)}</Item>`).join('');
      const details=[el('PropertyType',type),el('Description',desc),el(rent?'RentalPrice':'ListPrice',Math.floor(Number(p.price)), ' currency="BRL"'),el(isLand?'LotArea':'LivingArea',Math.floor(Number(isLand?(p.landArea||p.builtArea||p.area):(p.builtArea||p.area))), ' unit="square metres"')];
      if(Number(p.baths)>0)details.push(el('Bathrooms',Math.floor(Number(p.baths))));
      if(!isLand)details.push(el('Bedrooms',Math.floor(Number(p.beds||0))));
      if(Number(p.suites)>0)details.push(el('Suites',Math.floor(Number(p.suites))));
      if(Number(p.parking)>0)details.push(el('Garage',Math.floor(Number(p.parking))));
      if(Number(p.condoFee||p.condo)>0)details.push(el('PropertyAdministrationFee',Math.floor(Number(p.condoFee||p.condo)),' currency="BRL"'));
      if(Number(p.iptu)>0)details.push(el('Iptu',Math.floor(Number(p.iptu)),' currency="BRL" period="Yearly"'));
      return '<Listing>'+tags.join('')+'<Media>'+media+'</Media><Details>'+details.join('')+'</Details><Location displayAddress="Neighborhood"><Country abbreviation="BR">Brasil</Country>'+el('State',p.state,' abbreviation="'+escXml(p.state)+'"')+el('City',p.city)+el('Neighborhood',p.district)+'</Location><ContactInfo>'+el('Name',c.name)+el('Email',c.email)+(c.website?el('Website',c.website):'')+(c.phone?el('Telephone',c.phone):'')+'</ContactInfo></Listing>';
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- APENAS PRÉVIA LOCAL. Fotos Drive precisam ser verificadas/espelhadas pelo Apps Script. NÃO CADASTRE ESTE ARQUIVO NO PORTAL. -->\n'+
      '<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">'+
      '<Header>'+el('Provider','AG CRM')+el('Email',c.email||'email@exemplo.com')+el('ContactName',c.name||'AG Imobiliária')+el('PublishDate',new Date().toISOString().slice(0,19))+'</Header><Listings>'+listings.join('')+'</Listings></ListingDataFeed>';
  }
  function downloadPreview(){if(!isAdmin())return;
    const c=settings();if(!c.email){message('Preencha o contato comercial e salve antes de gerar a prévia.','error');return}
    const xml=xmlPreview();const url=URL.createObjectURL(new Blob([xml],{type:'application/xml;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='canalpro-previa-nao-publicar.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    message('Prévia XML baixada para conferência. Para publicar o feed real, use “Publicar XML agora”.','success');
  }
  function bind(){
    if(!$('ag-canalpro-settings'))return;
    document.querySelector('[data-settings-tab="canalpro"]')?.addEventListener('click',()=>{readConfig();render()});
    $('agCpSaveConfig')?.addEventListener('click',saveConfig);
    $('agCpRefresh')?.addEventListener('click',refreshStatus);
    $('agCpPublish')?.addEventListener('click',publish);
    $('agCpInstallSchedule')?.addEventListener('click',installSchedule);
    $('agCpDownload')?.addEventListener('click',downloadPreview);
    $('agCpOpenFeed')?.addEventListener('click',()=>{const u=settings().feedUrl;if(/^https:\/\//i.test(u))window.open(u,'_blank','noopener,noreferrer');else message('Salve primeiro a URL pública HTTPS.','error')});
    $('agCpSearch')?.addEventListener('input',()=>{lastHash='';render()});
    $('agCpFilter')?.addEventListener('change',()=>{lastHash='';render()});
    $('agCpPropertyList')?.addEventListener('change',e=>{
      const input=e.target.closest('[data-cp-check],[data-cp-tier],[data-cp-type]');if(!input)return;
      if(input.matches('[data-cp-check]'))saveProperty(input.dataset.cpCheck,{canalProPublished:!!input.checked});
      if(input.matches('[data-cp-tier]'))saveProperty(input.dataset.cpTier,{canalProTier:input.value});
      if(input.matches('[data-cp-type]'))saveProperty(input.dataset.cpType,{canalProType:input.value});
    });
    readConfig();render();setTimeout(refreshStatus,1600);
    setInterval(()=>{const shown=$('ag-canalpro-settings')?.classList.contains('active')&&$('page-configuracoes')?.classList.contains('active');if(shown)readConfig();render()},2500);
  }
  window.AGCanalProV113={getIssues,typeFor,getReady,xmlPreview,refreshStatus};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
