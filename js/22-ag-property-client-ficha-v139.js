/* AG CRM V149 — Ficha premium compacta com capa, anexo fotográfico, contracapa e download */
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moneyBR=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateBR=v=>{if(!v)return '—';const d=new Date(String(v).length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')};
  const fichaHasValue=v=>!(v===null||v===undefined||String(v).trim()==='');
  const fichaField=(label,value,full=false,cls='')=>fichaHasValue(value)?`<div class="ag-ficha-field ${full?'full':''} ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`:'';
  const fichaNum=(label,value,unit='',full=false)=>{const n=Number(value||0);return n?fichaField(label,`${n.toLocaleString('pt-BR',{maximumFractionDigits:2})}${unit?` ${unit}`:''}`,full):''};
  const fichaMoney=(label,value,full=false)=>{const n=Number(value||0);return n?fichaField(label,moneyBR(n),full):''};
  const fichaSlug=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_');
  const disclosureLabels={
    disclosure_redes_sociais:'Redes sociais',disclosure_site_da_imobiliaria:'Site da imobiliária',disclosure_placa:'Placa',
    disclosure_pintura:'Pintura',disclosure_proprietario:'Proprietário',disclosure_outro:'Outro'
  };
  function disclosureList(p){const arr=[];for(const [k,label] of Object.entries(disclosureLabels)){if(p?.[k]==='on'||p?.[k]===true)arr.push(label)}return arr.length?arr:['Não informado']}
  function fichaSelected(p,prefix,labels){return labels.filter(label=>{const v=p?.[`${prefix}_${fichaSlug(label)}`];return v==='on'||v===true})}
  function fichaChips(title,items){return items.length?`<div class="ag-ficha-sublist"><span>${esc(title)}</span><div class="ag-ficha-list">${items.map(x=>`<span class="ag-ficha-chip">${esc(x)}</span>`).join('')}</div></div>`:''}
  function getProperty(id){const state=(typeof db!=='undefined'?db:null);return (state?.properties||[]).find(p=>String(p.id)===String(id))}
  function companySettings(){try{return (typeof db!=='undefined'&&db?.settings)||{}}catch(e){return {}}}
  function photosOf(p){return (Array.isArray(p?.photos)?p.photos:[]).filter(ph=>ph&&ph.src)}
  function coverOf(p){const photos=photosOf(p);return photos.find(ph=>String(ph.id)===String(p?.coverPhoto))?.src||photos[0]?.src||''}
  function chunks(arr,size){const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out.length?out:[[]]}
  function brokerOf(p){return (window.agPropertyResponsibleBroker?.(p))||p.brokerName||p.responsibleBroker||p.broker||'—'}
  function logoUrl(){return new URL('./assets/ag-logo.png',location.href).href}

  function ensureOverlay(){
    let el=document.getElementById('agPropertyFichaOverlay');if(el)return el;
    el=document.createElement('div');el.id='agPropertyFichaOverlay';el.className='ag-ficha-overlay';
    el.innerHTML='<div class="ag-ficha-dialog" role="dialog" aria-modal="true" aria-label="Ficha para assinatura"><div class="ag-ficha-toolbar"><div class="ag-ficha-toolbar-left"><div><b>Ficha do imóvel</b><span id="agFichaToolbarStatus">Cadastro e autorização de comercialização</span></div></div><div class="ag-ficha-toolbar-actions"><button class="btn" type="button" id="agFichaClear">Limpar assinatura</button><button class="btn primary" type="button" id="agFichaSave">Salvar assinatura</button><button class="btn primary" type="button" id="agFichaDownload">Baixar ficha</button><button class="btn" type="button" id="agFichaPrint">Imprimir</button><button class="btn" type="button" id="agFichaClose">Fechar</button></div></div><div class="ag-ficha-sheet" id="agFichaSheet"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click',e=>{if(e.target===el)closePropertyClientFicha()});
    el.querySelector('#agFichaClose').onclick=closePropertyClientFicha;
    el.querySelector('#agFichaClear').onclick=clearPropertyFichaSignature;
    el.querySelector('#agFichaSave').onclick=savePropertyFichaSignature;
    el.querySelector('#agFichaDownload').onclick=()=>downloadPropertyClientFicha(currentId);
    el.querySelector('#agFichaPrint').onclick=printPropertyClientFicha;
    return el;
  }

  let currentId='',canvas=null,ctx=null,drawing=false,dirty=false;

  function renderCover(p,logo){
    const cover=coverOf(p);
    const address=[p.address,p.district,p.city,p.state].filter(Boolean).join(' · ');
    return `<section class="ag-ficha-cover ag-ficha-break-page">
      ${cover?`<img class="ag-ficha-cover-photo" src="${esc(cover)}" alt="Imagem de capa do imóvel">`:''}
      <div class="ag-ficha-cover-shade"></div>
      <div class="ag-ficha-cover-content">
        <img class="ag-ficha-cover-logo" src="${logo}" alt="AG Imobiliária">
        <div class="ag-ficha-cover-kicker">FICHA DO IMÓVEL · ${esc(p.id||'')}</div>
        <h1>${esc(p.title||'Imóvel')}</h1>
        <p>${esc([p.type,p.purpose].filter(Boolean).join(' · '))}</p>
        ${address?`<div class="ag-ficha-cover-address">${esc(address)}</div>`:''}
      </div>
      <div class="ag-ficha-cover-bottom"><span>Cadastro e autorização de comercialização</span><span>${esc(dateBR(p.created||p.createdAt||new Date()))}</span></div>
    </section>`;
  }

  function renderContent(p,logo){
    const signed=!!p.clientFichaSignature;
    const disclosure=disclosureList(p);
    const priceSite=p.hidePrice||p.priceDisplay==='Conversar com Corretor'?'Conversar com Corretor':'Exibir preço';
    const broker=brokerOf(p);
    const condition=fichaSelected(p,'statusFlag',['Pode ser financiado','Desocupado','Quitado','Blindex','Acrílico','PVC']);
    const rooms=fichaSelected(p,'rooms',['Cozinha','Área de serviço','Escritório','Banheiro social','Estar/Jantar','Lavabo','Despensa','DCE','Varanda','Varanda gourmet','Piscina privativa']);
    const leisure=fichaSelected(p,'leisure',['Churrasqueira','Playground','Salão de jogos','Coworking','Salão de festas','Pet place','Quadra','Elevador','Cerca elétrica','Bicicletário','Portão automático','Piscina','Academia','Brinquedoteca']);
    const planned=fichaSelected(p,'planned',['Suíte master','Cozinha','Quarto 1','Área de serviço','Quarto 2','Banheiro','Quarto 3','Varanda','Sala','Escritório']);
    const photoCount=photosOf(p).length;
    const videoCount=Array.isArray(p.videos)?p.videos.filter(v=>v?.url).length:0;
    const cityUf=[p.city,p.state].filter(Boolean).join(' / ');

    const owner=[
      fichaField('Nome',p.owner||p.ownerName,true),fichaField('CPF',p.ownerCpf),fichaField('RG',p.ownerRg),fichaField('Estado civil',p.ownerCivilStatus),
      fichaField('Profissão',p.ownerProfession),fichaField('Telefone 1',p.ownerPhone1),fichaField('Telefone 2',p.ownerPhone2),fichaField('E-mail',p.ownerEmail),fichaField('Endereço do proprietário',p.ownerAddress,true)
    ].join('');
    const spouse=[fichaField('Nome do cônjuge / coproprietário',p.spouseName,true),fichaField('CPF',p.spouseCpf),fichaField('RG',p.spouseRg),fichaField('Profissão',p.spouseProfession),fichaField('Telefone',p.spousePhone1)].join('');
    const identification=[
      fichaField('Título',p.title,true),fichaField('Tipo',p.type),fichaField('Finalidade',p.purpose),fichaField('Status',p.status),
      fichaField('Situação do imóvel',p.constructionStatus),fichaField('Localização / uso',p.locationProfile),fichaField('Endereço',p.address,true),
      fichaField('Ponto de referência',p.referencePoint,true),fichaField('Bloco / Unidade',p.unit),fichaField('Bairro',p.district),fichaField('Cidade / UF',cityUf)
    ].join('');
    const characteristics=[
      fichaNum('Área de terreno',p.landArea,'m²'),fichaNum('Área construída / privativa',p.builtArea||p.area,'m²'),fichaField('Andar',p.floorNumber||p.floor),
      fichaNum('Ano de construção',p.yearBuilt||p.year),fichaField('Construtora',p.builder),fichaField('Imobiliária',p.realEstateAgency),
      fichaNum('Quartos',p.beds||p.bedrooms),fichaNum('Suítes',p.suites),fichaNum('Banheiros',p.baths),
      fichaNum('Vagas cobertas',p.garageCovered),fichaNum('Vagas descobertas',p.garageUncovered),fichaNum('Vagas independentes',p.garageIndependent),
      fichaField('Pintura',p.painting),fichaField('Piso',p.floorFinish),fichaField('Chaves do imóvel',p.keysInfo,true)
    ].join('');
    const media=[photoCount?fichaField('Fotos cadastradas',photoCount):'',videoCount?fichaField('Vídeos cadastrados',videoCount):'',p.tour360Url?fichaField('Tour 360°',p.tour360Url,true):''].join('');
    const commercial=[
      fichaMoney('Valor do imóvel (interno)',p.price),fichaField('Preço no site',priceSite),fichaMoney('Valor de entrada',p.entryValue),fichaMoney('Saldo devedor',p.debtBalance),
      fichaMoney('Taxa de condomínio',p.condoFee||p.condo),fichaMoney('IPTU anual',p.iptu),fichaField('Comissão',fichaHasValue(p.commission)?`${Number(p.commission||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:''),
      fichaField('Venda com exclusividade',fichaHasValue(p.exclusiveSale)?String(p.exclusiveSale):''),fichaField('Imóvel em destaque',p.featured===true?'Sim':(p.featured===false?'Não':'')),
      fichaField('Publicar no site',p.published===false?'Não':'Sim'),fichaField('Publicar no Canal Pro',p.canalProPublished===true?'Sim':'Não'),
      fichaField('Plano Canal Pro',p.canalProTier),fichaField('Tipo VRSync',p.canalProType)
    ].join('');
    const texts=[
      fichaField('Descrição pública para o Canal Pro',p.canalProDescription,true,'long'),fichaField('Diferenciais',p.amenities,true,'long'),
      fichaField('Observações',p.notes,true,'long'),fichaField('Observações complementares',p.extraObs,true,'long')
    ].join('');

    return `<main class="ag-ficha-content-flow">
      <div class="ag-ficha-content-head"><img src="${logo}" alt="AG"><div><small>AG IMOBILIÁRIA</small><h2>Ficha de Cadastro e Autorização de Comercialização</h2><p>${esc(p.id)} · ${esc(p.title||'Imóvel')}</p></div></div>
      <div class="ag-ficha-meta"><div><span>Código do imóvel</span><b>${esc(p.id)}</b></div><div><span>Data da captação</span><b>${esc(dateBR(p.created||p.createdAt||new Date()))}</b></div><div><span>Corretor responsável</span><b>${esc(broker)}</b></div></div>
      <section class="ag-ficha-section"><h2>1. Proprietário / Cliente</h2><div class="ag-ficha-grid three">${owner||fichaField('Proprietário','Não informado',true)}</div></section>
      ${spouse?`<section class="ag-ficha-section"><h2>2. Cônjuge / Coproprietário</h2><div class="ag-ficha-grid three">${spouse}</div></section>`:''}
      <section class="ag-ficha-section"><h2>${spouse?'3':'2'}. Identificação do imóvel</h2><div class="ag-ficha-grid three">${identification}</div></section>
      <section class="ag-ficha-section"><h2>Características físicas</h2><div class="ag-ficha-grid three">${characteristics||fichaField('Características','Não informadas',true)}</div></section>
      <section class="ag-ficha-section ag-ficha-options"><h2>Características selecionadas</h2>${fichaChips('Condição / características',condition)}${fichaChips('Compartimentos',rooms)}${fichaChips('Área comum / lazer',leisure)}${fichaChips('Móveis projetados / embutidos',planned)}${(!condition.length&&!rooms.length&&!leisure.length&&!planned.length)?'<p class="ag-ficha-empty-note">Nenhuma característica adicional selecionada.</p>':''}</section>
      ${media?`<section class="ag-ficha-section"><h2>Mídia do imóvel</h2><div class="ag-ficha-grid three">${media}</div></section>`:''}
      <section class="ag-ficha-section"><h2>Condições comerciais e publicação</h2><div class="ag-ficha-grid three">${commercial}</div></section>
      ${texts?`<section class="ag-ficha-section"><h2>Descrição e observações</h2><div class="ag-ficha-grid">${texts}</div></section>`:''}
      <section class="ag-ficha-section ag-ficha-authorization"><h2>Autorização de divulgação</h2><div class="ag-ficha-list">${disclosure.map(x=>`<span class="ag-ficha-chip">${esc(x)}</span>`).join('')}</div>
        <div class="ag-ficha-declaration"><b>DECLARAÇÃO E AUTORIZAÇÃO</b><br>Declaro que as informações constantes nesta ficha são verdadeiras e correspondem aos dados fornecidos para cadastramento e comercialização do imóvel. Autorizo a AG Imobiliária e o corretor responsável indicado neste documento a apresentar e divulgar o imóvel nos meios de divulgação assinalados, exclusivamente para fins de intermediação imobiliária. Autorizo o uso das imagens fornecidas do imóvel para sua comercialização. Confirmo o valor, as condições comerciais e as demais informações registradas nesta ficha e comprometo-me a comunicar à AG qualquer alteração de preço, disponibilidade, características ou condição de negociação. Esta ficha registra a captação e a autorização de divulgação do imóvel e não substitui instrumentos contratuais específicos que venham a ser celebrados entre as partes.</div>
      </section>
      <section class="ag-ficha-signature-area"><div class="ag-ficha-signature-head"><h2>Assinatura do proprietário / cliente</h2><span>Assine com o dedo, mouse ou caneta digital.</span></div><div class="ag-signature-pad-wrap" id="agFichaSignatureWrap"><canvas class="ag-signature-pad" id="agFichaSignatureCanvas"></canvas>${signed?`<img class="ag-ficha-signature-saved" id="agFichaSavedSignature" src="${p.clientFichaSignature}" alt="Assinatura salva">`:''}<span class="ag-signature-hint">Assine nesta área</span></div><div class="ag-ficha-sign-lines"><div class="ag-ficha-sign-line">${esc(p.owner||p.ownerName||'Proprietário / Cliente')}</div><div class="ag-ficha-sign-line">Data: ${esc(signed?dateBR(p.clientFichaSignedAt):'____/____/________')}</div></div><div class="ag-ficha-status ${signed?'signed':''}" id="agFichaSignatureStatus">${signed?`✓ Assinatura salva em ${esc(dateBR(p.clientFichaSignedAt))}.`:'Aguardando assinatura.'}</div></section>
      <div class="ag-ficha-content-foot"><span>AG Imobiliária · Documento gerado pelo AG CRM</span><span>${esc(p.id)}</span></div>
    </main>`;
  }

  function renderPhotoAnnex(p,logo){
    const photos=photosOf(p);
    const pages=chunks(photos,6);
    return pages.map((pagePhotos,idx)=>`<section class="ag-ficha-photo-annex ag-ficha-break-page">
      <div class="ag-ficha-annex-head"><img src="${logo}" alt="AG"><div><small>ANEXO FOTOGRÁFICO</small><h2>${esc(p.id)} · ${esc(p.title||'Imóvel')}</h2><p>${photos.length?`${photos.length} imagem${photos.length===1?'':'ens'} cadastrada${photos.length===1?'':'s'} no imóvel`:'Nenhuma imagem cadastrada no imóvel'}</p></div><span>${pages.length>1?`${idx+1}/${pages.length}`:''}</span></div>
      ${pagePhotos.length?`<div class="ag-ficha-photo-grid">${pagePhotos.map((ph,i)=>`<figure class="ag-ficha-photo-item"><img src="${esc(ph.src)}" alt="${esc(ph.room||ph.name||'Foto do imóvel')}"><figcaption><b>${esc(ph.room||'Foto')}</b>${ph.name?`<span>${esc(ph.name)}</span>`:''}</figcaption></figure>`).join('')}</div>`:'<div class="ag-ficha-no-photos">Nenhuma foto cadastrada para este imóvel.</div>'}
      <div class="ag-ficha-annex-foot">Anexo integrante da ficha de cadastro e autorização de comercialização.</div>
    </section>`).join('');
  }

  function renderBackCover(p,logo){
    const s=companySettings();
    const contacts=[s.phone,s.email,s.address].filter(Boolean);
    return `<section class="ag-ficha-back-cover">
      <div class="ag-ficha-back-line"></div>
      <img src="${logo}" alt="AG Imobiliária">
      <h2>AG Imobiliária</h2>
      <p>Curadoria, relacionamento e intermediação com clareza em cada etapa.</p>
      ${contacts.length?`<div class="ag-ficha-back-contact">${contacts.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
      <div class="ag-ficha-back-code">${esc(p.id)} · ${esc(p.title||'Imóvel')}<br>Documento gerado pelo AG CRM</div>
    </section>`;
  }

  function renderSheet(p){const logo=logoUrl();return `${renderCover(p,logo)}${renderContent(p,logo)}${renderPhotoAnnex(p,logo)}${renderBackCover(p,logo)}`}

  function setupCanvas(){
    canvas=document.getElementById('agFichaSignatureCanvas');if(!canvas)return;ctx=canvas.getContext('2d');dirty=false;
    const fit=()=>{const r=canvas.getBoundingClientRect(),d=Math.max(1,Math.min(2,window.devicePixelRatio||1));canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx=canvas.getContext('2d');ctx.scale(d,d);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#14253f'};fit();
    let last={x:0,y:0};const pos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
    canvas.onpointerdown=e=>{const saved=document.getElementById('agFichaSavedSignature');if(saved)saved.remove();drawing=true;dirty=true;last=pos(e);canvas.setPointerCapture?.(e.pointerId);e.preventDefault()};
    canvas.onpointermove=e=>{if(!drawing)return;const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;e.preventDefault()};
    const end=e=>{drawing=false;try{canvas.releasePointerCapture?.(e.pointerId)}catch(_){}};canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onpointerleave=end;
  }

  function openPropertyClientFicha(id){const p=getProperty(id);if(!p){window.toast?.('Imóvel não encontrado.');return}currentId=String(id);const el=ensureOverlay();el.querySelector('#agFichaSheet').innerHTML=renderSheet(p);el.querySelector('#agFichaToolbarStatus').textContent=p.clientFichaSignature?'Ficha assinada':'Cadastro e autorização do imóvel';el.classList.add('show');document.body.style.overflow='hidden';requestAnimationFrame(setupCanvas)}
  function closePropertyClientFicha(){const el=document.getElementById('agPropertyFichaOverlay');if(el)el.classList.remove('show');document.body.style.overflow='';currentId='';canvas=ctx=null;dirty=false}
  function clearPropertyFichaSignature(){const p=getProperty(currentId);if(!p||!canvas)return;ctx.clearRect(0,0,canvas.width,canvas.height);document.getElementById('agFichaSavedSignature')?.remove();dirty=true;const st=document.getElementById('agFichaSignatureStatus');if(st){st.textContent='Assinatura limpa. Assine novamente e clique em Salvar assinatura.';st.classList.remove('signed')}}
  function savePropertyFichaSignature(){const p=getProperty(currentId);if(!p||!canvas)return;const saved=document.getElementById('agFichaSavedSignature');if(!dirty&&saved){window.toast?.('A assinatura já está salva.');return}if(!dirty){window.toast?.('Peça ao cliente para assinar antes de salvar.');return}const data=canvas.toDataURL('image/png');p.clientFichaSignature=data;p.clientFichaSignedAt=new Date().toISOString();p.clientFichaSignedBy=p.owner||p.ownerName||'';p.clientFichaVersion=2;p.updatedAt=new Date().toISOString();try{window.saveDB?.();const wrap=document.getElementById('agFichaSignatureWrap');let img=document.getElementById('agFichaSavedSignature');if(!img&&wrap){img=document.createElement('img');img.id='agFichaSavedSignature';img.className='ag-ficha-signature-saved';img.alt='Assinatura salva';wrap.appendChild(img)}if(img)img.src=data;const st=document.getElementById('agFichaSignatureStatus');if(st){st.textContent=`✓ Assinatura salva em ${dateBR(p.clientFichaSignedAt)}.`;st.classList.add('signed')}document.getElementById('agFichaToolbarStatus').textContent='Ficha assinada';dirty=false;window.toast?.('Assinatura vinculada ao imóvel.')}catch(e){console.error(e);window.toast?.('Não foi possível salvar a assinatura.')}}

  function printCss(){return `
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#14253f;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-size:8pt}.ag-ficha-sheet{margin:0;padding:0}
    .ag-ficha-cover,.ag-ficha-photo-annex,.ag-ficha-back-cover{position:relative;min-height:277mm;overflow:hidden}.ag-ficha-break-page{break-after:page;page-break-after:always}.ag-ficha-cover-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.38) saturate(.85)}.ag-ficha-cover-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,24,43,.12),rgba(10,24,43,.78))}.ag-ficha-cover-content{position:absolute;left:14mm;right:14mm;bottom:38mm;color:#fff}.ag-ficha-cover-logo{width:42mm;max-height:28mm;object-fit:contain;object-position:left center;filter:brightness(0) invert(1);margin-bottom:16mm}.ag-ficha-cover-kicker{font-size:7pt;font-weight:700;letter-spacing:.18em;color:#eac686}.ag-ficha-cover h1{font-size:28pt;line-height:1.03;margin:3mm 0 2mm;max-width:155mm}.ag-ficha-cover p{font-size:11pt;margin:0}.ag-ficha-cover-address{margin-top:7mm;font-size:8pt;line-height:1.5;max-width:145mm}.ag-ficha-cover-bottom{position:absolute;left:14mm;right:14mm;bottom:12mm;border-top:1px solid rgba(255,255,255,.45);padding-top:4mm;display:flex;justify-content:space-between;color:#fff;font-size:6.5pt}
    .ag-ficha-content-flow{padding:0 1.8mm 5mm}.ag-ficha-content-head{display:grid;grid-template-columns:28mm 1fr;align-items:center;gap:6mm;padding-bottom:5mm;border-bottom:1.5px solid #14253f}.ag-ficha-content-head img{width:25mm;max-height:16mm;object-fit:contain}.ag-ficha-content-head small{display:block;color:#a97b35;font-size:6pt;font-weight:700;letter-spacing:.12em}.ag-ficha-content-head h2{margin:1mm 0 0;font-size:13pt}.ag-ficha-content-head p{margin:1mm 0 0;color:#74808d;font-size:7pt;line-height:1.45}
    .ag-ficha-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:2.2mm;margin:4mm 0}.ag-ficha-meta div,.ag-ficha-field{border:1px solid #dfe3e8;border-radius:1.8mm;padding:2.4mm 2.8mm;background:#fff;break-inside:avoid;page-break-inside:avoid}.ag-ficha-meta span,.ag-ficha-field span{display:block;font-size:5.1pt;color:#7d8792;text-transform:uppercase;font-weight:700;letter-spacing:.05em;margin-bottom:.8mm}.ag-ficha-meta b,.ag-ficha-field b{display:block;font-size:6.8pt;line-height:1.38;overflow-wrap:anywhere}.ag-ficha-section{margin-top:4mm}.ag-ficha-section h2{font-size:8.2pt;margin:0 0 2mm;padding-bottom:1.3mm;border-bottom:1px solid #dfe3e8;break-after:avoid}.ag-ficha-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.8mm}.ag-ficha-grid.three{grid-template-columns:repeat(3,1fr)}.ag-ficha-field.full{grid-column:1/-1}.ag-ficha-field.long b{white-space:pre-wrap}.ag-ficha-sublist{margin-top:2.2mm;break-inside:avoid}.ag-ficha-sublist>span{display:block;font-size:5.2pt;color:#7d8792;font-weight:700;text-transform:uppercase;margin-bottom:1mm}.ag-ficha-list{display:flex;flex-wrap:wrap;gap:1.2mm}.ag-ficha-chip{border:1px solid #d8dde4;border-radius:99px;padding:1.2mm 2mm;font-size:5.7pt}.ag-ficha-empty-note{font-size:6pt;color:#7d8792;margin:0}.ag-ficha-declaration{margin-top:3.2mm;border:1px solid #d8dde4;border-radius:2mm;padding:3.3mm;font-size:6.6pt;line-height:1.5;break-inside:avoid}.ag-ficha-signature-area{margin-top:5mm;border-top:1px solid #dfe3e8;padding-top:3.6mm;break-inside:avoid}.ag-ficha-signature-head h2{font-size:8.2pt;margin:0 0 1.8mm}.ag-ficha-signature-head span,.ag-signature-hint,.ag-ficha-status{display:none}.ag-signature-pad-wrap{height:27mm;position:relative;border:0}.ag-signature-pad{display:none}.ag-ficha-signature-saved{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.ag-ficha-sign-lines{display:grid;grid-template-columns:1fr 44mm;gap:7mm;margin-top:2.6mm}.ag-ficha-sign-line{border-top:1px solid #66707d;padding-top:1.4mm;text-align:center;font-size:6pt}.ag-ficha-content-foot{margin-top:5mm;padding-top:2.4mm;border-top:1px solid #e2e5e9;display:flex;justify-content:space-between;color:#8b929b;font-size:5.4pt}
    .ag-ficha-photo-annex{break-before:page;page-break-before:always;padding:0 1mm}.ag-ficha-annex-head{display:grid;grid-template-columns:25mm 1fr auto;align-items:center;gap:5mm;padding-bottom:4mm;border-bottom:1.5px solid #14253f}.ag-ficha-annex-head img{width:23mm;max-height:15mm;object-fit:contain}.ag-ficha-annex-head small{display:block;color:#a97b35;font-size:6pt;font-weight:700;letter-spacing:.13em}.ag-ficha-annex-head h2{font-size:12pt;margin:1mm 0}.ag-ficha-annex-head p,.ag-ficha-annex-head>span{font-size:6.3pt;color:#7b8591;margin:0}.ag-ficha-photo-grid{display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(3,1fr);gap:3mm;margin-top:5mm;height:228mm}.ag-ficha-photo-item{margin:0;border:1px solid #dfe3e8;border-radius:2.5mm;overflow:hidden;display:grid;grid-template-rows:1fr auto;background:#fff}.ag-ficha-photo-item img{width:100%;height:100%;min-height:0;object-fit:cover}.ag-ficha-photo-item figcaption{padding:2mm 2.4mm;display:flex;align-items:center;justify-content:space-between;gap:2mm;font-size:5.8pt}.ag-ficha-photo-item figcaption span{color:#7d8792;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ag-ficha-annex-foot{position:absolute;left:1mm;right:1mm;bottom:0;padding-top:2mm;border-top:1px solid #e2e5e9;font-size:5.5pt;color:#8b929b}.ag-ficha-no-photos{display:grid;place-items:center;height:220mm;border:1px dashed #d3d9e1;border-radius:3mm;color:#7f8995;font-size:9pt}
    .ag-ficha-back-cover{break-before:page;page-break-before:always;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:25mm}.ag-ficha-back-line{position:absolute;left:0;top:0;width:100%;height:5mm;background:#14253f}.ag-ficha-back-cover img{width:45mm;max-height:30mm;object-fit:contain}.ag-ficha-back-cover h2{font-size:20pt;margin:8mm 0 2mm}.ag-ficha-back-cover>p{max-width:120mm;font-size:9pt;line-height:1.6;color:#66717f}.ag-ficha-back-contact{margin-top:10mm;display:flex;flex-direction:column;gap:2mm;color:#14253f;font-size:7pt}.ag-ficha-back-code{position:absolute;left:0;right:0;bottom:16mm;font-size:6pt;line-height:1.6;color:#9098a3}
    @page{size:A4 portrait;margin:10mm 12mm}
  `}

  function openPrintWindow(p,downloadIntent=false){
    if(!p)return;
    if(String(p.id)===String(currentId)&&dirty)savePropertyFichaSignature();
    const html=renderSheet(p);
    const w=window.open('','_blank','width=1100,height=900');if(!w){window.toast?.('Libere pop-ups para gerar a ficha.');return}
    const safeId=String(p.id||'imovel').replace(/[^a-z0-9_-]+/gi,'_');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ficha_${esc(safeId)}</title><style>${printCss()}</style></head><body><div class="ag-ficha-sheet">${html}</div><script>window.onload=()=>setTimeout(()=>window.print(),550)<\/script></body></html>`);w.document.close();
    if(downloadIntent)window.toast?.('Na janela aberta, escolha “Salvar como PDF” para baixar a ficha completa.');
  }
  function printPropertyClientFicha(){openPrintWindow(getProperty(currentId),false)}
  function downloadPropertyClientFicha(id=currentId){const p=getProperty(id);if(!p){window.toast?.('Imóvel não encontrado.');return}openPrintWindow(p,true)}

  function addFichaButton(){
    const workspace=document.querySelector('#modal.property-detail-shell .property-workspace')||document.querySelector('#modal .property-workspace');const actions=workspace?.querySelector('.pw-summary-actions');if(!workspace||!actions)return;const id=workspace.dataset.property;const p=getProperty(id);
    if(!actions.querySelector('.ag-property-ficha-btn')){const b=document.createElement('button');b.type='button';b.className='btn ag-property-ficha-btn'+(p?.clientFichaSignature?' ag-ficha-button-signed':'');b.textContent=p?.clientFichaSignature?'Ficha assinada ✓':'Ficha para assinatura';b.onclick=()=>openPropertyClientFicha(id);actions.appendChild(b)}
    if(!actions.querySelector('.ag-property-ficha-download-btn')){const d=document.createElement('button');d.type='button';d.className='btn primary ag-property-ficha-download-btn';d.textContent='Baixar ficha';d.onclick=()=>downloadPropertyClientFicha(id);actions.appendChild(d)}
  }

  const baseOpen=window.openPropertyDetails;window.openPropertyDetails=function(){const r=baseOpen?.apply(this,arguments);setTimeout(addFichaButton,0);return r};
  const baseSave=window.saveModal;window.saveModal=async function(){const form=document.getElementById('modalForm');const isProperty=!!form?.classList?.contains('v98-property-form');const desiredId=isProperty?(form.querySelector('[name="id"]')?.value||''):'';const wasNew=!!(isProperty&&desiredId&&!getProperty(desiredId));const r=await baseSave.apply(this,arguments);if(wasNew&&desiredId&&getProperty(desiredId))setTimeout(()=>openPropertyClientFicha(desiredId),220);return r};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('agPropertyFichaOverlay')?.classList.contains('show'))closePropertyClientFicha()});
  window.openPropertyClientFicha=openPropertyClientFicha;window.closePropertyClientFicha=closePropertyClientFicha;window.savePropertyFichaSignature=savePropertyFichaSignature;window.printPropertyClientFicha=printPropertyClientFicha;window.downloadPropertyClientFicha=downloadPropertyClientFicha;
})();
