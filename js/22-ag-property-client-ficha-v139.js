/* AG CRM V139 — Ficha do imóvel para assinatura do proprietário/cliente */
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const digits=v=>String(v||'').replace(/\D/g,'');
  const moneyBR=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateBR=v=>{if(!v)return '—';const d=new Date(String(v).length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')};
  const yn=v=>String(v||'').toLowerCase()==='sim'||v===true?'Sim':'Não';
  const field=(label,value,full=false)=>`<div class="ag-ficha-field ${full?'full':''}"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`;
  const disclosureLabels={
    disclosure_redes_sociais:'Redes sociais',disclosure_site_da_imobiliaria:'Site da imobiliária',disclosure_placa:'Placa',
    disclosure_pintura:'Pintura',disclosure_proprietario:'Proprietário',disclosure_outro:'Outro'
  };
  function disclosureList(p){const arr=[];for(const [k,label] of Object.entries(disclosureLabels)){if(p?.[k]==='on'||p?.[k]===true)arr.push(label)}return arr.length?arr:['Não informado']}
  function getProperty(id){const state=(typeof db!=='undefined'?db:null);return (state?.properties||[]).find(p=>String(p.id)===String(id))}
  function ensureOverlay(){
    let el=document.getElementById('agPropertyFichaOverlay');if(el)return el;
    el=document.createElement('div');el.id='agPropertyFichaOverlay';el.className='ag-ficha-overlay';
    el.innerHTML='<div class="ag-ficha-dialog" role="dialog" aria-modal="true" aria-label="Ficha para assinatura"><div class="ag-ficha-toolbar"><div class="ag-ficha-toolbar-left"><div><b>Ficha para assinatura</b><span id="agFichaToolbarStatus">Cadastro e autorização do imóvel</span></div></div><div class="ag-ficha-toolbar-actions"><button class="btn" type="button" id="agFichaClear">Limpar assinatura</button><button class="btn primary" type="button" id="agFichaSave">Salvar assinatura</button><button class="btn" type="button" id="agFichaPrint">Imprimir / Salvar PDF</button><button class="btn" type="button" id="agFichaClose">Fechar</button></div></div><div class="ag-ficha-sheet" id="agFichaSheet"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click',e=>{if(e.target===el)closePropertyClientFicha()});
    el.querySelector('#agFichaClose').onclick=closePropertyClientFicha;
    el.querySelector('#agFichaClear').onclick=clearPropertyFichaSignature;
    el.querySelector('#agFichaSave').onclick=savePropertyFichaSignature;
    el.querySelector('#agFichaPrint').onclick=printPropertyClientFicha;
    return el;
  }
  let currentId='',canvas=null,ctx=null,drawing=false,dirty=false;
  function fichaHasValue(v){return !(v===null||v===undefined||String(v).trim()==='')}
  function fichaField(label,value,full=false,cls=''){
    if(!fichaHasValue(value))return '';
    return `<div class="ag-ficha-field ${full?'full':''} ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }
  function fichaNum(label,value,unit='',full=false){const n=Number(value||0);return n?fichaField(label,`${n.toLocaleString('pt-BR',{maximumFractionDigits:2})}${unit?` ${unit}`:''}`,full):''}
  function fichaMoney(label,value,full=false){const n=Number(value||0);return n?fichaField(label,moneyBR(n),full):''}
  function fichaSlug(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_')}
  function fichaSelected(p,prefix,labels){return labels.filter(label=>{const v=p?.[`${prefix}_${fichaSlug(label)}`];return v==='on'||v===true})}
  function fichaChips(title,items){return items.length?`<div class="ag-ficha-sublist"><span>${esc(title)}</span><div class="ag-ficha-list">${items.map(x=>`<span class="ag-ficha-chip">${esc(x)}</span>`).join('')}</div></div>`:''}
  function fichaPageHead(logo,p,label,page){return `<div class="ag-ficha-page-head-mini"><img src="${logo}" alt="AG"><div><small>AG IMOBILIÁRIA · ${esc(label)}</small><b>${esc(p.id)} · ${esc(p.title||'Imóvel')}</b></div><span>Página ${page}</span></div>`}
  function fichaFoot(p,page,total=3){return `<div class="ag-ficha-foot"><span>AG Imobiliária · Ficha gerada pelo AG CRM</span><span>${esc(p.id)} · Página ${page}/${total}</span></div>`}
  function renderSheet(p){
    const logo=new URL('./assets/ag-logo.png',location.href).href;
    const signed=!!p.clientFichaSignature;
    const disclosure=disclosureList(p);
    const priceSite=p.hidePrice||p.priceDisplay==='Conversar com Corretor'?'Conversar com Corretor':'Exibir preço';
    const broker=(window.agPropertyResponsibleBroker?.(p))||p.brokerName||p.responsibleBroker||p.broker||'—';
    const condition=fichaSelected(p,'statusFlag',['Pode ser financiado','Desocupado','Quitado','Blindex','Acrílico','PVC']);
    const rooms=fichaSelected(p,'rooms',['Cozinha','Área de serviço','Escritório','Banheiro social','Estar/Jantar','Lavabo','Despensa','DCE','Varanda','Varanda gourmet','Piscina privativa']);
    const leisure=fichaSelected(p,'leisure',['Churrasqueira','Playground','Salão de jogos','Coworking','Salão de festas','Pet place','Quadra','Elevador','Cerca elétrica','Bicicletário','Portão automático','Piscina','Academia','Brinquedoteca']);
    const planned=fichaSelected(p,'planned',['Suíte master','Cozinha','Quarto 1','Área de serviço','Quarto 2','Banheiro','Quarto 3','Varanda','Sala','Escritório']);
    const photoCount=Array.isArray(p.photos)?p.photos.length:0;
    const videoCount=Array.isArray(p.videos)?p.videos.filter(v=>v?.url).length:0;
    const cityUf=[p.city,p.state].filter(Boolean).join(' / ');
    const ownerFields=[
      fichaField('Nome',p.owner||p.ownerName,true),fichaField('CPF',p.ownerCpf),fichaField('RG',p.ownerRg),
      fichaField('Estado civil',p.ownerCivilStatus),fichaField('Profissão',p.ownerProfession),fichaField('Telefone 1',p.ownerPhone1),
      fichaField('Telefone 2',p.ownerPhone2),fichaField('E-mail',p.ownerEmail,true),fichaField('Endereço do proprietário',p.ownerAddress,true)
    ].join('');
    const spouseFields=[fichaField('Nome do cônjuge',p.spouseName,true),fichaField('CPF do cônjuge',p.spouseCpf),fichaField('RG do cônjuge',p.spouseRg),fichaField('Profissão do cônjuge',p.spouseProfession),fichaField('Telefone do cônjuge',p.spousePhone1)].join('');
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
    const mediaFields=[photoCount?fichaField('Fotos cadastradas',`${photoCount}`):'',videoCount?fichaField('Vídeos cadastrados',`${videoCount}`):'',p.tour360Url?fichaField('Tour 360°',p.tour360Url,true):''].join('');
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
    return `<div class="ag-ficha-print-page ag-ficha-print-page-1">
      <div class="ag-ficha-head"><img class="ag-ficha-logo" src="${logo}" alt="AG"><div class="ag-ficha-title"><small>AG IMOBILIÁRIA</small><h1>Ficha de Cadastro e Autorização de Comercialização</h1><p>Documento vinculado ao cadastro do imóvel no AG CRM.</p></div></div>
      <div class="ag-ficha-meta"><div><span>Código do imóvel</span><b>${esc(p.id)}</b></div><div><span>Data da captação</span><b>${esc(dateBR(p.created||p.createdAt||new Date()))}</b></div><div><span>Corretor responsável</span><b>${esc(broker)}</b></div></div>
      <section class="ag-ficha-section"><h2>1. Proprietário / Cliente</h2><div class="ag-ficha-grid three">${ownerFields||fichaField('Proprietário','Não informado',true)}</div></section>
      ${spouseFields?`<section class="ag-ficha-section"><h2>2. Cônjuge / Coproprietário</h2><div class="ag-ficha-grid three">${spouseFields}</div></section>`:''}
      <section class="ag-ficha-section"><h2>${spouseFields?'3':'2'}. Identificação do imóvel</h2><div class="ag-ficha-grid three">${identification}</div></section>
      ${fichaFoot(p,1)}
    </div>
    <div class="ag-ficha-print-page ag-ficha-print-page-2">
      ${fichaPageHead(logo,p,'Características e informações do imóvel',2)}
      <section class="ag-ficha-section"><h2>Características físicas</h2><div class="ag-ficha-grid three">${characteristics||fichaField('Características','Não informadas',true)}</div></section>
      <section class="ag-ficha-section ag-ficha-options"><h2>Características selecionadas</h2>${fichaChips('Condição / características',condition)}${fichaChips('Compartimentos',rooms)}${fichaChips('Área comum / lazer',leisure)}${fichaChips('Móveis projetados / embutidos',planned)}${(!condition.length&&!rooms.length&&!leisure.length&&!planned.length)?'<p class="ag-ficha-empty-note">Nenhuma característica adicional selecionada.</p>':''}</section>
      ${mediaFields?`<section class="ag-ficha-section"><h2>Mídia do imóvel</h2><div class="ag-ficha-grid three">${mediaFields}</div></section>`:''}
      <section class="ag-ficha-section"><h2>Condições comerciais e publicação</h2><div class="ag-ficha-grid three">${commercial}</div></section>
      ${texts?`<section class="ag-ficha-section"><h2>Descrição e observações</h2><div class="ag-ficha-grid">${texts}</div></section>`:''}
      ${fichaFoot(p,2)}
    </div>
    <div class="ag-ficha-print-page ag-ficha-print-page-3">
      ${fichaPageHead(logo,p,'Autorização e assinatura',3)}
      <section class="ag-ficha-section"><h2>Autorização de divulgação</h2><div class="ag-ficha-list">${disclosure.map(x=>`<span class="ag-ficha-chip">${esc(x)}</span>`).join('')}</div></section>
      <div class="ag-ficha-declaration"><b>DECLARAÇÃO E AUTORIZAÇÃO</b><br>Declaro que as informações constantes nesta ficha são verdadeiras e correspondem aos dados fornecidos para cadastramento e comercialização do imóvel. Autorizo a AG Imobiliária e o corretor responsável indicado neste documento a apresentar e divulgar o imóvel nos meios de divulgação assinalados, exclusivamente para fins de intermediação imobiliária. Autorizo o uso das imagens fornecidas do imóvel para sua comercialização. Confirmo o valor, as condições comerciais e as demais informações registradas nesta ficha e comprometo-me a comunicar à AG qualquer alteração de preço, disponibilidade, características ou condição de negociação. Esta ficha registra a captação e a autorização de divulgação do imóvel e não substitui instrumentos contratuais específicos que venham a ser celebrados entre as partes.</div>
      <section class="ag-ficha-signature-area"><div class="ag-ficha-signature-head"><h2>Assinatura do proprietário / cliente</h2><span>Assine com o dedo, mouse ou caneta digital.</span></div><div class="ag-signature-pad-wrap" id="agFichaSignatureWrap"><canvas class="ag-signature-pad" id="agFichaSignatureCanvas"></canvas>${signed?`<img class="ag-ficha-signature-saved" id="agFichaSavedSignature" src="${p.clientFichaSignature}" alt="Assinatura salva">`:''}<span class="ag-signature-hint">Assine nesta área</span></div><div class="ag-ficha-sign-lines"><div class="ag-ficha-sign-line">${esc(p.owner||p.ownerName||'Proprietário / Cliente')}</div><div class="ag-ficha-sign-line">Data: ${esc(signed?dateBR(p.clientFichaSignedAt):'____/____/________')}</div></div><div class="ag-ficha-status ${signed?'signed':''}" id="agFichaSignatureStatus">${signed?`✓ Assinatura salva em ${esc(dateBR(p.clientFichaSignedAt))}.`:'Aguardando assinatura.'}</div></section>
      ${fichaFoot(p,3)}
    </div>`;
  }
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
  function savePropertyFichaSignature(){const p=getProperty(currentId);if(!p||!canvas)return;const saved=document.getElementById('agFichaSavedSignature');if(!dirty&&saved){window.toast?.('A assinatura já está salva.');return}if(!dirty){window.toast?.('Peça ao cliente para assinar antes de salvar.');return}const data=canvas.toDataURL('image/png');p.clientFichaSignature=data;p.clientFichaSignedAt=new Date().toISOString();p.clientFichaSignedBy=p.owner||p.ownerName||'';p.clientFichaVersion=1;p.updatedAt=new Date().toISOString();try{window.saveDB?.();const wrap=document.getElementById('agFichaSignatureWrap');let img=document.getElementById('agFichaSavedSignature');if(!img&&wrap){img=document.createElement('img');img.id='agFichaSavedSignature';img.className='ag-ficha-signature-saved';img.alt='Assinatura salva';wrap.appendChild(img)}if(img)img.src=data;const st=document.getElementById('agFichaSignatureStatus');if(st){st.textContent=`✓ Assinatura salva em ${dateBR(p.clientFichaSignedAt)}.`;st.classList.add('signed')}document.getElementById('agFichaToolbarStatus').textContent='Ficha assinada';dirty=false;window.toast?.('Assinatura vinculada ao imóvel.')}catch(e){console.error(e);window.toast?.('Não foi possível salvar a assinatura.')}}
  function printPropertyClientFicha(){
    const p=getProperty(currentId);if(!p)return;
    if(dirty)savePropertyFichaSignature();
    const sheet=document.getElementById('agFichaSheet');if(!sheet)return;
    const w=window.open('','_blank','width=1100,height=900');if(!w){window.toast?.('Libere pop-ups para imprimir a ficha.');return}
    const css=`
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#14253f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .ag-ficha-sheet{margin:0;padding:0}.ag-ficha-print-page{position:relative;width:210mm;min-height:297mm;margin:0 auto;padding:11mm 13mm 13mm;background:#fff;page-break-after:always;break-after:page}.ag-ficha-print-page:last-child{page-break-after:auto;break-after:auto}
      .ag-ficha-head{display:grid;grid-template-columns:38mm 1fr;align-items:center;gap:7mm;padding-bottom:5mm;border-bottom:1.5px solid #14253f}.ag-ficha-logo{width:34mm;max-height:20mm;object-fit:contain;object-position:left center}.ag-ficha-title small{display:block;color:#a97b35;font-size:7pt;font-weight:700;letter-spacing:.12em}.ag-ficha-title h1{font-size:16pt;line-height:1.1;margin:1.5mm 0}.ag-ficha-title p{font-size:7pt;color:#6f7782;margin:0}
      .ag-ficha-page-head-mini{display:grid;grid-template-columns:25mm 1fr auto;align-items:center;gap:5mm;padding-bottom:4mm;border-bottom:1.5px solid #14253f}.ag-ficha-page-head-mini img{width:23mm;max-height:13mm;object-fit:contain}.ag-ficha-page-head-mini div small{display:block;color:#a97b35;font-size:6pt;font-weight:700;letter-spacing:.1em}.ag-ficha-page-head-mini div b{display:block;font-size:10pt;margin-top:1mm}.ag-ficha-page-head-mini>span{font-size:6.5pt;color:#7d8792}
      .ag-ficha-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin:4mm 0}.ag-ficha-meta div,.ag-ficha-field{border:1px solid #dfe3e8;border-radius:2mm;padding:2.2mm 2.5mm;background:#fff;break-inside:avoid;page-break-inside:avoid}.ag-ficha-meta span,.ag-ficha-field span{display:block;font-size:5.5pt;color:#7d8792;text-transform:uppercase;font-weight:700;letter-spacing:.05em;margin-bottom:.8mm}.ag-ficha-meta b,.ag-ficha-field b{display:block;font-size:7.1pt;line-height:1.3;overflow-wrap:anywhere}
      .ag-ficha-section{margin-top:4mm;break-inside:avoid;page-break-inside:avoid}.ag-ficha-section h2{font-size:9pt;margin:0 0 2mm;padding-bottom:1.5mm;border-bottom:1px solid #dfe3e8}.ag-ficha-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.6mm}.ag-ficha-grid.three{grid-template-columns:repeat(3,1fr)}.ag-ficha-field.full{grid-column:1/-1}.ag-ficha-field.long{break-inside:auto;page-break-inside:auto}.ag-ficha-field.long b{white-space:pre-wrap}
      .ag-ficha-sublist{margin-top:2.5mm;break-inside:avoid}.ag-ficha-sublist>span{display:block;font-size:5.8pt;color:#7d8792;font-weight:700;text-transform:uppercase;margin-bottom:1.2mm}.ag-ficha-list{display:flex;flex-wrap:wrap;gap:1.3mm}.ag-ficha-chip{border:1px solid #d8dde4;border-radius:99px;padding:1.4mm 2.2mm;font-size:6.2pt}.ag-ficha-empty-note{font-size:6.5pt;color:#7d8792;margin:0}
      .ag-ficha-declaration{margin-top:5mm;border:1px solid #d8dde4;border-radius:2.5mm;padding:4mm;font-size:7.2pt;line-height:1.55;break-inside:avoid;page-break-inside:avoid}.ag-ficha-signature-area{margin-top:8mm;border-top:1px solid #dfe3e8;padding-top:5mm;break-inside:avoid;page-break-inside:avoid}.ag-ficha-signature-head h2{font-size:9pt;margin:0 0 2mm}.ag-ficha-signature-head span,.ag-signature-hint,.ag-ficha-status{display:none}.ag-signature-pad-wrap{height:35mm;position:relative;border:0}.ag-signature-pad{display:none}.ag-ficha-signature-saved{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.ag-ficha-sign-lines{display:grid;grid-template-columns:1fr 48mm;gap:7mm;margin-top:4mm}.ag-ficha-sign-line{border-top:1px solid #66707d;padding-top:1.5mm;text-align:center;font-size:6.5pt}
      .ag-ficha-foot{position:absolute;left:13mm;right:13mm;bottom:6mm;padding-top:2mm;border-top:1px solid #e2e5e9;display:flex;justify-content:space-between;font-size:5.5pt;color:#8b929b}
      @page{size:A4 portrait;margin:0}
      @media print{.ag-ficha-print-page{margin:0!important}}
    `;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ficha ${esc(p.id)}</title><style>${css}</style></head><body>${sheet.outerHTML}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);w.document.close();
  }
  function addFichaButton(){const workspace=document.querySelector('#modal.property-detail-shell .property-workspace')||document.querySelector('#modal .property-workspace');const actions=workspace?.querySelector('.pw-summary-actions');if(!workspace||!actions)return;const id=workspace.dataset.property;if(actions.querySelector('.ag-property-ficha-btn'))return;const p=getProperty(id);const b=document.createElement('button');b.type='button';b.className='btn ag-property-ficha-btn'+(p?.clientFichaSignature?' ag-ficha-button-signed':'');b.textContent=p?.clientFichaSignature?'Ficha assinada ✓':'Ficha para assinatura';b.onclick=()=>openPropertyClientFicha(id);actions.appendChild(b)}
  const baseOpen=window.openPropertyDetails;window.openPropertyDetails=function(){const r=baseOpen?.apply(this,arguments);setTimeout(addFichaButton,0);return r};
  const baseSave=window.saveModal;window.saveModal=async function(){const form=document.getElementById('modalForm');const isProperty=!!form?.classList?.contains('v98-property-form');const desiredId=isProperty?(form.querySelector('[name="id"]')?.value||''):'';const wasNew=!!(isProperty&&desiredId&&!getProperty(desiredId));const r=await baseSave.apply(this,arguments);if(wasNew&&desiredId&&getProperty(desiredId))setTimeout(()=>openPropertyClientFicha(desiredId),220);return r};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('agPropertyFichaOverlay')?.classList.contains('show'))closePropertyClientFicha()});
  window.openPropertyClientFicha=openPropertyClientFicha;window.closePropertyClientFicha=closePropertyClientFicha;window.savePropertyFichaSignature=savePropertyFichaSignature;window.printPropertyClientFicha=printPropertyClientFicha;
})();
