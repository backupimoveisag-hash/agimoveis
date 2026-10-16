const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0));
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback={version:59,syncedAt:new Date().toISOString(),settings:{brand:'AG',tagline:'Imóveis para viver o próximo capítulo.',whatsapp:'5547999990000',region:'Jaraguá do Sul e região',email:'',phone:'(47) 99999-0000'},properties:[]};
let catalog=loadCatalog();
if(['NEXO Imóveis'].includes(catalog?.settings?.brand)){catalog.settings.brand='AG';try{localStorage.setItem('nexoPublicCatalogV1',JSON.stringify(catalog))}catch(e){}}
let filters={q:'',purpose:'',type:'',price:'',state:'',city:'',district:'',quick:'all',sort:'featured'};
let visibleLimit=8,activeProperty=null,lightboxPhotos=[],lightboxIndex=0;
let favorites=loadJSON('nexoFavoritesV1',[]),compare=[],recentlyViewed=loadJSON('nexoRecentlyViewedV1',[]);

function normalizeAgCatalog(data){
  if(!data||typeof data!=='object')return data;
  data.settings=data.settings||{};
  data.settings.brand='AG';
  if(/nexo/i.test(String(data.settings.email||''))) data.settings.email='';
  if(/nexo/i.test(String(data.settings.site||data.settings.domain||''))){data.settings.site='';data.settings.domain='';}
  try{localStorage.setItem('nexoPublicCatalogV1',JSON.stringify(data))}catch(e){}
  return data;
}
function loadJSON(key,fb){try{return JSON.parse(localStorage.getItem(key)||'null')??fb}catch(e){return fb}}
function loadCatalog(){try{const raw=localStorage.getItem('nexoPublicCatalogV1');return raw?JSON.parse(raw):fallback}catch(e){return fallback}}
function cover(p){return (p.photos||[]).find(x=>String(x.id)===String(p.coverPhoto))?.src||(p.photos||[])[0]?.src||''}
const AG_DEFAULT_HERO='./assets/login-luxury-bg.jpg';
function heroCoverHD(p){
  const src=cover(p);
  if(!src)return '';
  try{
    const u=new URL(src,location.href);
    if(/(^|\.)images\.unsplash\.com$/i.test(u.hostname)){
      u.searchParams.set('auto','format');
      u.searchParams.set('fit','crop');
      u.searchParams.set('w','3200');
      u.searchParams.set('q','92');
      return u.toString();
    }
  }catch(e){}
  return src;
}
function whatsappLink(p){const n=String(catalog.settings?.whatsapp||'').replace(/\D/g,'');const msg=p?`Olá! Gostaria de saber mais sobre o imóvel ${p.id} — ${p.title}.`:'Olá! Gostaria de falar com um especialista sobre os imóveis disponíveis.';return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`}
function uniqueCities(){return new Set(catalog.properties.map(p=>p.city).filter(Boolean)).size}
function featuredProperty(){return catalog.properties.find(p=>p.featured)||catalog.properties[0]||null}
function scrollToCatalog(){document.querySelector('#properties').scrollIntoView({behavior:'smooth',block:'start'})}
function iconHeart(filled=false){return `<svg viewBox="0 0 24 24" ${filled?'fill="currentColor"':'fill="none"'} stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.7 4.95 13.9a4.95 4.95 0 0 1 0-7 4.8 4.8 0 0 1 6.86 0L12 8l.19-.18a4.8 4.8 0 0 1 6.86 0 4.95 4.95 0 0 1 0 7L12 20.7Z"/></svg>`}
function iconCompare(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 4v16M9 8l3-3 3 3M9 16l3 3 3-3"/></svg>`}
function photoIcon(){return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>`}

/* GEO20_START */
const GEO_RADIUS_KM=20;
function haversineKm(lat1,lng1,lat2,lng2){
  const rad=n=>n*Math.PI/180,R=6371.0088,dLat=rad(lat2-lat1),dLng=rad(lng2-lng1),a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function propertyCoords(p){
  if(!p)return null;const rawLat=p.lat??p.latitude,rawLng=p.lng??p.lon??p.longitude;if(rawLat===null||rawLat===undefined||rawLat===''||rawLng===null||rawLng===undefined||rawLng==='')return null;
  const lat=Number(rawLat),lng=Number(rawLng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return null;return {lat,lng};
}
function withinRadiusKm(user,p,radius=GEO_RADIUS_KM){const c=propertyCoords(p);if(!user||!c)return false;return haversineKm(user.lat,user.lng,c.lat,c.lng)<=radius;}
function formatDistanceKm(km){if(!Number.isFinite(km))return '';if(km<1)return `${Math.max(1,Math.round(km*1000))} m de você`;return `${km.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} km de você`;}
/* GEO20_END */

let userLocation=null,geoLocationState='requesting';
function propertyDistanceKm(p){const c=propertyCoords(p);return userLocation&&c?haversineKm(userLocation.lat,userLocation.lng,c.lat,c.lng):null;}
function distancePinIcon(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg>`}
function renderGeoRadiusStatus(){
  const box=document.getElementById('geoRadiusStatus'),txt=document.getElementById('geoRadiusText'),retry=document.getElementById('geoRadiusRetry');if(!box||!txt||!retry)return;
  box.classList.remove('active','requesting','denied');retry.classList.add('hidden');
  if(geoLocationState==='active'){
    box.classList.add('active');const nearby=catalog.properties.filter(p=>withinRadiusKm(userLocation,p,GEO_RADIUS_KM)).length;txt.innerHTML=`<b>Raio automático de 20 km ativo</b> · ${nearby} ${nearby===1?'imóvel próximo':'imóveis próximos'} · ordenados pela distância.`;
  }else if(geoLocationState==='requesting'){
    box.classList.add('requesting');txt.innerHTML='<b>Raio de 20 km</b> · localizando você para mostrar somente imóveis próximos.';
  }else{
    box.classList.add('denied');txt.innerHTML='<b>Raio de 20 km indisponível</b> · autorize sua localização para filtrar os imóveis próximos.';retry.classList.remove('hidden');
  }
}
function requestUserLocation(){
  geoLocationState='requesting';renderGeoRadiusStatus();
  if(!navigator.geolocation){geoLocationState='denied';renderGeoRadiusStatus();return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    userLocation={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude)};geoLocationState='active';filters.sort='distance';visibleLimit=8;
    const sort=document.getElementById('sort');if(sort){sort.value='distance';sort.disabled=true;sort.title='Com a localização ativa, os imóveis ficam ordenados do mais próximo para o mais distante.'}
    renderGeoRadiusStatus();renderProperties();
    if(activeProperty&&document.getElementById('modalBg')?.classList.contains('show'))openProperty(activeProperty.id);
  },()=>{
    userLocation=null;geoLocationState='denied';const sort=document.getElementById('sort');if(sort){sort.disabled=false;if(sort.value==='distance'){sort.value='featured';filters.sort='featured'}}renderGeoRadiusStatus();renderProperties();
  },{enableHighAccuracy:true,timeout:12000,maximumAge:300000});
}

function renderHeader(){
  const s=catalog.settings||{}, fp=featuredProperty();
  document.title='AG — Imóveis selecionados';
  ['brandName','footerBrand','copyrightBrand'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='AG'});
  const tagline=s.tagline||fallback.settings.tagline; document.getElementById('heroTagline').innerHTML=safe(tagline).replace(/(próximo capítulo\.?)/i,'<span>$1</span>');
  document.getElementById('footerTagline').textContent=tagline;
  document.getElementById('regionKicker').textContent=(s.region||'Imóveis selecionados').toUpperCase();document.getElementById('footerRegion').textContent=s.region||'';
  document.getElementById('heroCount').textContent=catalog.properties.length;document.getElementById('heroCities').textContent=uniqueCities();
  document.getElementById('buyCount').textContent=`${catalog.properties.filter(p=>p.purpose==='Venda').length} opções`;document.getElementById('rentCount').textContent=`${catalog.properties.filter(p=>p.purpose==='Locação').length} opções`;document.getElementById('houseCount').textContent=`${catalog.properties.filter(p=>p.type==='Casa').length} opções`;document.getElementById('apartmentCount').textContent=`${catalog.properties.filter(p=>p.type==='Apartamento').length} opções`;
  const date=new Date(catalog.syncedAt||Date.now());document.getElementById('heroSync').textContent=date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});document.getElementById('syncText').textContent='Atualizado '+date.toLocaleDateString('pt-BR')+' às '+date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('footerEmail').textContent=s.email||'E-mail';document.getElementById('footerEmail').href=s.email?`mailto:${s.email}`:'#';document.getElementById('footerPhone').textContent=s.phone||'';document.getElementById('year').textContent=new Date().getFullYear();
  ['navWhatsapp','floatingWa','footerWhatsapp','financeWhatsapp'].forEach(id=>{const a=document.getElementById(id);if(a){a.href=whatsappLink();a.target='_blank'}});
  const heroPhoto=document.getElementById('heroPhoto');
  const heroInfo=document.getElementById('heroPropertyInfo');
  const heroOpen=document.getElementById('heroOpen');
  const experienceImage=document.getElementById('experienceImage');
  const featuredCover=fp?heroCoverHD(fp):'';
  if(heroPhoto) heroPhoto.style.backgroundImage=`url("${featuredCover||AG_DEFAULT_HERO}")`;
  if(experienceImage){
    const expProperty=(catalog.properties||[])[1]||fp;
    experienceImage.style.backgroundImage=`url("${(expProperty&&cover(expProperty))||AG_DEFAULT_HERO}")`;
  }
  if(fp){
    if(heroInfo) heroInfo.innerHTML=`<div><small>${safe(fp.district||fp.city)} · ${safe(fp.id)}</small><h2>${safe(fp.title)}</h2></div><div class="hero-property-price">${money(fp.price)}</div>`;
    if(heroOpen){heroOpen.dataset.id=fp.id;heroOpen.disabled=false}
  }else{
    if(heroInfo) heroInfo.innerHTML='';
    if(heroOpen){delete heroOpen.dataset.id;heroOpen.disabled=true}
  }
  renderFavoriteCount();renderLocations();renderRecentlyViewed();calculateFinance();
}


function renderLocations(){
  const grid=document.getElementById('locationGrid');if(!grid)return;
  const groups=new Map();catalog.properties.forEach(p=>{const key=(p.district||p.city||'Região').trim();if(!groups.has(key))groups.set(key,{name:key,city:p.city||'',count:0,property:p});groups.get(key).count++});
  const items=[...groups.values()].sort((a,b)=>b.count-a.count).slice(0,4);
  grid.innerHTML=items.length?items.map(x=>`<button class="location-card" data-location="${safe(x.name)}" style="background-image:url('${cover(x.property)}')"><span class="location-arrow">↗</span><div class="location-copy"><small>${safe(x.city||catalog.settings?.region||'Região')}</small><strong>${safe(x.name)}</strong><span>${x.count} ${x.count===1?'imóvel':'imóveis'} publicado${x.count===1?'':'s'}</span></div></button>`).join(''):`<div class="empty">As regiões aparecem aqui conforme os imóveis são publicados.</div>`;
  grid.querySelectorAll('[data-location]').forEach(b=>b.addEventListener('click',()=>{document.getElementById('search').value=b.dataset.location;filters.q=b.dataset.location.toLowerCase();visibleLimit=8;renderProperties();scrollToCatalog()}));
}
function rememberViewed(id){recentlyViewed=[id,...recentlyViewed.filter(x=>x!==id)].slice(0,6);localStorage.setItem('nexoRecentlyViewedV1',JSON.stringify(recentlyViewed));renderRecentlyViewed()}
function renderRecentlyViewed(){const section=document.getElementById('recentSection'),grid=document.getElementById('recentGrid');if(!section||!grid)return;const list=recentlyViewed.map(id=>catalog.properties.find(p=>p.id===id)).filter(Boolean).slice(0,4);section.classList.toggle('hidden',!list.length);grid.innerHTML=list.map(p=>`<button class="recent-card" data-recent="${safe(p.id)}"><div class="recent-img" style="background-image:url('${cover(p)}')"></div><div class="recent-copy"><b>${safe(p.title)}</b><span>${safe(p.district||p.city)} · ${money(p.price)}</span></div></button>`).join('');grid.querySelectorAll('[data-recent]').forEach(b=>b.addEventListener('click',()=>openProperty(b.dataset.recent)))}
function calculateFinance(){const value=Number(document.getElementById('financeValue')?.value||0),down=Number(document.getElementById('financeDown')?.value||0),years=Number(document.getElementById('financeYears')?.value||30),ratePct=Number(document.getElementById('financeRate')?.value||0);const principal=Math.max(0,value-down),n=Math.max(1,years*12),r=Math.max(0,ratePct)/100;let payment=principal/n;if(r>0)payment=principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);const m=document.getElementById('financeMonthly'),f=document.getElementById('financeFinanced');if(m)m.textContent=money(payment);if(f)f.textContent=`Valor financiado: ${money(principal)} · ${n} meses`}
function digits(v){return String(v||'').replace(/\D/g,'')}
function loadSiteJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(e){return fallback}}
function parseBudgetText(v){const s=String(v||'').toLowerCase().replace(/\./g,'').replace(',','.');const n=(s.match(/[\d.]+/)||[])[0];if(!n)return 0;let value=Number(n);if(/mil/.test(s))value*=1000;if(/mi|milh/.test(s))value*=1000000;return Math.round(value)||0}
function rememberVisitor(profile){const current=loadSiteJSON('eiVisitorProfileV1',{});const next={...current,...profile,updatedAt:new Date().toISOString()};try{localStorage.setItem('eiVisitorProfileV1',JSON.stringify(next))}catch(e){}return next}
function queueSiteLead(payload){
  const phone=digits(payload.phone);if(phone.length<10)return {ok:false,error:'Informe um WhatsApp válido para continuar.'};
  const profile=rememberVisitor({name:payload.name||'',phone,email:payload.email||''});
  const event={id:'WEB-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),source:'Site',createdAt:new Date().toISOString(),page:location.pathname||'site_imobiliaria.html',...payload,name:payload.name||profile.name||'Lead do site',phone,email:payload.email||profile.email||'',status:'Novo'};
  const inbox=loadSiteJSON('eiSiteLeadInboxV1',[]);inbox.push(event);try{localStorage.setItem('eiSiteLeadInboxV1',JSON.stringify(inbox.slice(-500)));localStorage.setItem('eiSiteLeadPingV1',String(Date.now()))}catch(e){}
  try{const bc=new BroadcastChannel('ei-site-leads');bc.postMessage(event);bc.close()}catch(e){}
  try{window.EIFirebaseSite?.submitLead?.(event)}catch(e){console.warn('Firebase lead queue',e)}
  return {ok:true,event};
}
let leadCaptureState={kind:'general',propertyId:''};
function openLeadCapture(ctx={}){
  leadCaptureState={kind:ctx.kind||'general',propertyId:ctx.propertyId||''};const profile=loadSiteJSON('eiVisitorProfileV1',{}),p=catalog.properties.find(x=>x.id===leadCaptureState.propertyId);
  document.getElementById('leadCaptureName').value=profile.name||'';document.getElementById('leadCapturePhone').value=profile.phone||'';document.getElementById('leadCaptureEmail').value=profile.email||'';document.getElementById('leadCaptureStatus').textContent='';
  const title=leadCaptureState.kind==='finance'?'Falar sobre financiamento':p?'Quero conhecer este imóvel':'Falar com um especialista';document.getElementById('leadCaptureTitle').textContent=title;
  document.getElementById('leadCaptureContext').innerHTML=p?`<b>${safe(p.title)}</b><br>${safe(p.district||p.city||p.address)} · ${money(p.price)}`:'Conte seus dados e direcionaremos seu atendimento para um corretor.';
  document.getElementById('leadCaptureBg').classList.add('show');document.body.classList.add('modal-open');
}
function closeLeadCapture(){document.getElementById('leadCaptureBg').classList.remove('show');if(!document.getElementById('modalBg').classList.contains('show')&&!document.getElementById('visitModalBg').classList.contains('show'))document.body.classList.remove('modal-open')}
function submitLeadCapture(){
  const name=document.getElementById('leadCaptureName').value.trim(),phone=document.getElementById('leadCapturePhone').value.trim(),email=document.getElementById('leadCaptureEmail').value.trim(),p=catalog.properties.find(x=>x.id===leadCaptureState.propertyId);if(!name){document.getElementById('leadCaptureStatus').textContent='Informe seu nome.';return}
  const kind=leadCaptureState.kind;const result=queueSiteLead({kind,name,phone,email,propertyId:p?.id||'',propertyTitle:p?.title||'',propertyValue:Number(p?.price||0),city:p?.city||'',state:propertyState(p||{}),district:p?.district||'',interest:p?`${p.title} (${p.id})`:kind==='finance'?'Financiamento imobiliário':'Atendimento imobiliário'});if(!result.ok){document.getElementById('leadCaptureStatus').textContent=result.error;return}
  const n=digits(catalog.settings?.whatsapp),msg=p?`Olá! Meu nome é ${name}. Tenho interesse no imóvel ${p.id} — ${p.title}. Gostaria de receber mais informações.`:kind==='finance'?`Olá! Meu nome é ${name}. Gostaria de conversar sobre financiamento imobiliário.`:`Olá! Meu nome é ${name}. Gostaria de falar com um especialista sobre os imóveis disponíveis.`;closeLeadCapture();window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`,'_blank');
}
function preferenceWhatsapp(){const name=document.getElementById('prefName').value.trim(),phone=document.getElementById('prefPhone').value.trim(),city=document.getElementById('prefCity').value.trim(),purpose=document.getElementById('prefPurpose').value,type=document.getElementById('prefType').value,budget=document.getElementById('prefBudget').value.trim(),beds=document.getElementById('prefBeds').value,status=document.getElementById('preferenceStatus');if(!name){status.textContent='Informe seu nome.';return}const result=queueSiteLead({kind:'curadoria',name,phone,interest:`${purpose} · ${type} · ${city||'região a definir'}`,city,purpose,type,budgetText:budget,budgetValue:parseBudgetText(budget),beds});if(!result.ok){status.textContent=result.error;return}const n=digits(catalog.settings?.whatsapp),msg=`Olá! Meu nome é ${name}. Estou procurando um imóvel para ${purpose.toLowerCase()}.
Região: ${city||'a definir'}
Tipo: ${type}
Orçamento: ${budget||'a definir'}
Dormitórios: ${beds}.
Gostaria de receber uma curadoria de opções.`;status.textContent='Busca registrada no CRM. Abrindo o WhatsApp…';window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`,'_blank')}
function openVisitScheduler(propertyId){const select=document.getElementById('visitProperty');select.innerHTML=catalog.properties.map(p=>`<option value="${safe(p.id)}" ${p.id===propertyId?'selected':''}>${safe(p.title)} · ${safe(p.id)}</option>`).join('');const tomorrow=new Date(Date.now()+86400000);document.getElementById('visitDate').min=new Date().toISOString().slice(0,10);if(!document.getElementById('visitDate').value)document.getElementById('visitDate').value=tomorrow.toISOString().slice(0,10);document.getElementById('visitModalBg').classList.add('show');document.body.classList.add('modal-open')}
function closeVisitScheduler(){document.getElementById('visitModalBg').classList.remove('show');if(!document.getElementById('modalBg').classList.contains('show'))document.body.classList.remove('modal-open')}
function submitVisit(){const id=document.getElementById('visitProperty').value,p=catalog.properties.find(x=>x.id===id),name=document.getElementById('visitName').value.trim(),phone=document.getElementById('visitPhone').value.trim(),date=document.getElementById('visitDate').value,time=document.getElementById('visitTime').value;if(!name){alert('Informe seu nome para solicitar a visita.');return}const result=queueSiteLead({kind:'visit',name,phone,propertyId:id,propertyTitle:p?.title||id,propertyValue:Number(p?.price||0),interest:`Visita · ${p?.title||id}`,city:p?.city||'',state:propertyState(p||{}),district:p?.district||'',desiredDate:date,desiredTime:time});if(!result.ok){alert(result.error);return}const n=digits(catalog.settings?.whatsapp),br=date?date.split('-').reverse().join('/'):'a combinar',msg=`Olá! Gostaria de solicitar uma visita.
Imóvel: ${p?.title||id} (${id})
Nome: ${name}
Meu WhatsApp: ${phone}
Data preferida: ${br}
Horário preferido: ${time}.`;window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`,'_blank');closeVisitScheduler()}
function shareProperty(p){const text=`${p.title} — ${money(p.price)} · ${p.address||p.city||''}`;if(navigator.share){navigator.share({title:p.title,text}).catch(()=>{})}else{window.open(whatsappLink(p),'_blank')}}

function propertyState(p){
  const direct=String(p.state||p.uf||'').trim().toUpperCase();if(direct)return direct;
  const m=String(p.address||'').toUpperCase().match(/(?:-|,)\s*([A-Z]{2})\s*$/);return m?m[1]:'';
}
function uniqueSorted(values){return [...new Set(values.filter(Boolean).map(v=>String(v).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
function fillLocationSelect(select,values,placeholder,current){
  if(!select)return;select.innerHTML=`<option value="">${placeholder}</option>`+values.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');
  if(current&&values.includes(current))select.value=current;else select.value='';
}
function renderLocationFilters(){
  const stateSel=document.getElementById('stateFilter'),citySel=document.getElementById('cityFilter'),districtSel=document.getElementById('districtFilter');if(!stateSel||!citySel||!districtSel)return;
  const states=uniqueSorted(catalog.properties.map(propertyState));
  if(filters.state&&!states.includes(filters.state))filters.state='';
  fillLocationSelect(stateSel,states,'Todos os estados',filters.state);
  const byState=catalog.properties.filter(p=>!filters.state||propertyState(p)===filters.state);
  const cities=uniqueSorted(byState.map(p=>p.city));if(filters.city&&!cities.includes(filters.city)){filters.city='';filters.district=''}
  fillLocationSelect(citySel,cities,'Todas as cidades',filters.city);citySel.disabled=!cities.length;
  const byCity=byState.filter(p=>!filters.city||p.city===filters.city);
  const districts=uniqueSorted(byCity.map(p=>p.district));if(filters.district&&!districts.includes(filters.district))filters.district='';
  fillLocationSelect(districtSel,districts,'Todos os bairros',filters.district);districtSel.disabled=!districts.length;
}

function filtered(){
  let list=catalog.properties.filter(p=>{
    const hay=[p.id,p.title,p.address,p.city,p.district,propertyState(p),p.type,p.amenities].join(' ').toLowerCase();
    if(filters.q&&!hay.includes(filters.q))return false;if(filters.purpose&&p.purpose!==filters.purpose)return false;if(filters.type&&p.type!==filters.type)return false;
    if(filters.state&&propertyState(p)!==filters.state)return false;if(filters.city&&p.city!==filters.city)return false;if(filters.district&&p.district!==filters.district)return false;
    if(filters.price){const [a,b]=filters.price.split('-').map(Number);if(Number(p.price)<a||Number(p.price)>b)return false}
    if(filters.quick==='featured'&&!p.featured)return false;
    if(userLocation&&!withinRadiusKm(userLocation,p,GEO_RADIUS_KM))return false;
    return true;
  });
  if(userLocation)list.sort((a,b)=>(propertyDistanceKm(a)??Infinity)-(propertyDistanceKm(b)??Infinity));
  else if(filters.sort==='priceAsc')list.sort((a,b)=>a.price-b.price);else if(filters.sort==='priceDesc')list.sort((a,b)=>b.price-a.price);else if(filters.sort==='areaDesc')list.sort((a,b)=>(b.area||0)-(a.area||0));else list.sort((a,b)=>(Number(b.featured)-Number(a.featured))||String(a.id).localeCompare(String(b.id)));
  return list;
}

function renderProperties(){
  const all=filtered(), list=all.slice(0,visibleLimit), grid=document.getElementById('propertyGrid');
  document.getElementById('resultCount').textContent=userLocation?`${all.length} ${all.length===1?'imóvel em até 20 km':'imóveis em até 20 km'}`:`${all.length} ${all.length===1?'imóvel encontrado':'imóveis encontrados'}`;renderGeoRadiusStatus();
  grid.innerHTML=list.length?list.map((p,i)=>propertyCard(p,i===0&&p.featured)).join(''):`<div class="empty"><strong>Nenhum imóvel encontrado.</strong>Experimente remover algum filtro ou buscar por outra região.</div>`;
  document.getElementById('loadMore').classList.toggle('hidden',all.length<=visibleLimit);
  bindCardEvents();
}
function propertyCard(p,isFeatured=false){
  const fav=favorites.includes(p.id), comp=compare.includes(p.id), photoCount=(p.photos||[]).length,distance=propertyDistanceKm(p);
  return `<article class="property-card ${isFeatured?'featured-card':''} reveal in" data-card-id="${safe(p.id)}"><div class="property-media" data-open-property="${safe(p.id)}" style="background-image:url('${cover(p)}')"><div class="media-top"><span class="tag">${safe(p.type)} · ${safe(p.purpose)}</span><div class="media-actions"><button class="media-action ${comp?'active':''}" data-compare="${safe(p.id)}" aria-label="Comparar" title="Comparar">${iconCompare()}</button><button class="media-action ${fav?'active':''}" data-favorite="${safe(p.id)}" aria-label="Favoritar" title="Favoritar">${iconHeart(fav)}</button></div></div>${photoCount?`<span class="photo-count">${photoIcon()} ${photoCount}</span>`:''}${distance!==null?`<span class="distance-badge">${distancePinIcon()} ${safe(formatDistanceKm(distance))}</span>`:''}</div><div class="property-body"><div class="property-loc">${safe(p.district||p.city||p.address)} · ${safe(p.id)}</div><h3 class="property-title">${safe(p.title)}</h3><div class="property-facts">${p.area?`<span><b>${p.area}</b> m²</span>`:''}${p.beds?`<span><b>${p.beds}</b> quartos</span>`:''}${p.suites?`<span><b>${p.suites}</b> suítes</span>`:''}${p.parking?`<span><b>${p.parking}</b> vagas</span>`:''}</div><div class="property-bottom"><div class="property-price"><small>${p.purpose==='Locação'?'valor mensal':'valor do imóvel'}</small><strong>${money(p.price)}</strong></div><button class="view-link" data-open-property="${safe(p.id)}">Ver detalhes <span>→</span></button></div></div></article>`;
}
function bindCardEvents(){document.querySelectorAll('[data-open-property]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openProperty(el.dataset.openProperty)}));document.querySelectorAll('[data-favorite]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFavorite(b.dataset.favorite)}));document.querySelectorAll('[data-compare]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleCompare(b.dataset.compare)}))}

function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem('nexoFavoritesV1',JSON.stringify(favorites));renderFavoriteCount();renderProperties();renderFavorites()}
function renderFavoriteCount(){const el=document.getElementById('favCount');el.textContent=favorites.length;el.classList.toggle('hidden',!favorites.length)}
function renderFavorites(){const list=catalog.properties.filter(p=>favorites.includes(p.id)), box=document.getElementById('favoriteList');box.innerHTML=list.length?list.map(p=>`<div class="favorite-item"><button class="favorite-thumb" data-fav-open="${safe(p.id)}" style="background-image:url('${cover(p)}');border:0"></button><div class="favorite-copy"><b>${safe(p.title)}</b><span>${safe(p.district||p.city)} · ${money(p.price)}</span></div><button class="favorite-remove" data-fav-remove="${safe(p.id)}">×</button></div>`).join(''):`<div class="drawer-empty">Você ainda não favoritou nenhum imóvel.<br>Use o coração nos cards para guardar suas opções.</div>`;box.querySelectorAll('[data-fav-open]').forEach(b=>b.addEventListener('click',()=>{closeFavorites();openProperty(b.dataset.favOpen)}));box.querySelectorAll('[data-fav-remove]').forEach(b=>b.addEventListener('click',()=>toggleFavorite(b.dataset.favRemove)))}
function openFavorites(){renderFavorites();document.getElementById('favoriteDrawerBg').classList.add('show')}
function closeFavorites(){document.getElementById('favoriteDrawerBg').classList.remove('show')}

function toggleCompare(id){if(compare.includes(id))compare=compare.filter(x=>x!==id);else if(compare.length<3)compare.push(id);else{compare.shift();compare.push(id)}renderCompareBar();renderProperties()}
function renderCompareBar(){const bar=document.getElementById('compareBar'), items=document.getElementById('compareItems');bar.classList.toggle('show',compare.length>0);items.innerHTML=compare.map(id=>{const p=catalog.properties.find(x=>x.id===id);return p?`<span class="compare-pill">${safe(p.title)} <button data-remove-compare="${safe(id)}">×</button></span>`:''}).join('');items.querySelectorAll('[data-remove-compare]').forEach(b=>b.addEventListener('click',()=>toggleCompare(b.dataset.removeCompare)));document.getElementById('openCompare').disabled=compare.length<2;document.getElementById('openCompare').textContent=compare.length<2?'Escolha mais 1':'Comparar imóveis'}
function openCompare(){const props=compare.map(id=>catalog.properties.find(p=>p.id===id)).filter(Boolean);if(props.length<2)return;document.getElementById('compareGrid').innerHTML=props.map(p=>`<div class="compare-col"><div class="compare-img" style="background-image:url('${cover(p)}')"></div><h3>${safe(p.title)}</h3><div class="compare-row"><span>Preço</span><b>${money(p.price)}</b></div><div class="compare-row"><span>Área</span><b>${p.area||'—'} m²</b></div><div class="compare-row"><span>Quartos</span><b>${p.beds||0}</b></div><div class="compare-row"><span>Suítes</span><b>${p.suites||0}</b></div><div class="compare-row"><span>Vagas</span><b>${p.parking||0}</b></div><div class="compare-row"><span>Localização</span><b>${safe(p.district||p.city||'—')}</b></div></div>`).join('');document.getElementById('compareBg').classList.add('show');document.body.classList.add('modal-open')}
function closeCompare(){document.getElementById('compareBg').classList.remove('show');document.body.classList.remove('modal-open')}

function openProperty(id){
  const p=catalog.properties.find(x=>x.id===id);if(!p)return;activeProperty=p;rememberViewed(id);const photos=p.photos?.length?p.photos:[{id:'x',room:'Imagem',src:cover(p)}], fav=favorites.includes(p.id),comp=compare.includes(p.id), amenities=String(p.amenities||'').split(',').map(x=>x.trim()).filter(Boolean);
  const galleryPhotos=photos.slice(0,3);
  const gallery=galleryPhotos.map((ph,i)=>`<button class="detail-photo ${i===2&&photos.length>3?'more':''}" ${i===2&&photos.length>3?`data-more="+${photos.length-3} fotos"`:''} data-lightbox-index="${i}" style="background-image:url('${ph.src}')" aria-label="Abrir foto ${safe(ph.room||i+1)}"></button>`).join('');
  const similar=catalog.properties.filter(x=>x.id!==p.id&&(x.city===p.city||x.type===p.type)).slice(0,3);
  document.getElementById('modalContent').innerHTML=`<div class="modal-topbar"><span class="modal-code">${safe(p.id)} · ${safe(p.type)} · ${safe(p.purpose)}</span><div class="modal-actions"><button class="modal-icon-btn ${fav?'active':''}" id="modalFavorite">${iconHeart(fav)} <span>${fav?'Salvo':'Favoritar'}</span></button><button class="modal-icon-btn" id="modalCompare">${iconCompare()} <span>${comp?'Remover comparação':'Comparar'}</span></button><button class="modal-close" id="modalClose">×</button></div></div><div class="detail-layout"><section class="detail-gallery">${gallery}</section><aside class="detail-side"><div class="detail-kicker">${safe(p.district||p.city)} · ${safe(p.status||'Disponível')}</div><h2>${safe(p.title)}</h2><div class="detail-address">${safe(p.address)}</div>${propertyDistanceKm(p)!==null?`<div class="detail-distance">${distancePinIcon()} ${safe(formatDistanceKm(propertyDistanceKm(p)))}</div>`:''}<div class="detail-price">${money(p.price)}</div><div class="detail-specs"><div class="detail-spec"><span>Área</span><b>${p.area||'—'} m²</b></div><div class="detail-spec"><span>Dormitórios</span><b>${p.beds||0}</b></div><div class="detail-spec"><span>Suítes</span><b>${p.suites||0}</b></div><div class="detail-spec"><span>Vagas</span><b>${p.parking||0}</b></div></div><div class="detail-cta"><a class="primary" target="_blank" href="${whatsappLink(p)}">Quero conhecer este imóvel</a><button id="openGalleryBtn">Fotos</button></div><div class="detail-secondary-actions"><button id="scheduleVisitBtn">Agendar visita</button><button id="sharePropertyBtn">Compartilhar</button></div>${(p.condo||p.iptu)?`<div class="cost-note">${p.condo?`<div><span>Condomínio</span><b>${money(p.condo)}/mês</b></div>`:''}${p.iptu?`<div><span>IPTU</span><b>${money(p.iptu)}/ano</b></div>`:''}</div>`:''}</aside><div class="detail-content"><div class="detail-main-copy"><h3>Sobre este imóvel</h3><p>${safe(p.notes||'Entre em contato para receber todas as informações deste imóvel.')}</p>${amenities.length?`<div class="amenities">${amenities.map(a=>`<span class="amenity">${safe(a)}</span>`).join('')}</div>`:''}</div><div class="detail-contact-card"><h3>Gostou desta opção?</h3><p>Conte para nosso time o que chamou sua atenção. Podemos ajudar com disponibilidade, visita e próximos passos.</p><a target="_blank" href="${whatsappLink(p)}">Conversar pelo WhatsApp</a></div></div>${similar.length?`<section class="similar"><h3>Você também pode gostar</h3><div class="similar-grid">${similar.map(s=>`<article class="similar-card" data-similar="${safe(s.id)}"><div class="pic" style="background-image:url('${cover(s)}')"></div><div class="copy"><b>${safe(s.title)}</b><span>${safe(s.district||s.city)} · ${money(s.price)}</span></div></article>`).join('')}</div></section>`:''}</div>`;
  document.getElementById('modalBg').classList.add('show');document.body.classList.add('modal-open');
  document.getElementById('modalClose').addEventListener('click',closeProperty);document.getElementById('modalFavorite').addEventListener('click',()=>{toggleFavorite(p.id);openProperty(p.id)});document.getElementById('modalCompare').addEventListener('click',()=>{toggleCompare(p.id);openProperty(p.id)});document.querySelectorAll('[data-lightbox-index]').forEach(b=>b.addEventListener('click',()=>openLightbox(photos,Number(b.dataset.lightboxIndex),p.title)));document.getElementById('openGalleryBtn').addEventListener('click',()=>openLightbox(photos,0,p.title));document.getElementById('scheduleVisitBtn').addEventListener('click',()=>openVisitScheduler(p.id));document.getElementById('sharePropertyBtn').addEventListener('click',()=>shareProperty(p));document.querySelectorAll('[data-similar]').forEach(c=>c.addEventListener('click',()=>openProperty(c.dataset.similar)));
}
function closeProperty(){document.getElementById('modalBg').classList.remove('show');document.body.classList.remove('modal-open')}
function openLightbox(photos,index,title){lightboxPhotos=photos;lightboxIndex=index;document.getElementById('lightbox').classList.add('show');document.body.classList.add('modal-open');document.getElementById('lightboxTitle').textContent=title;renderLightbox()}
function renderLightbox(){const ph=lightboxPhotos[lightboxIndex];if(!ph)return;document.getElementById('lightboxImg').src=ph.src;document.getElementById('lightboxImg').alt=`${ph.room||'Foto'} do imóvel`;document.getElementById('lightboxRoom').textContent=ph.room||'Foto';document.getElementById('lightboxCounter').textContent=`${lightboxIndex+1} / ${lightboxPhotos.length}`}
function moveLightbox(dir){lightboxIndex=(lightboxIndex+dir+lightboxPhotos.length)%lightboxPhotos.length;renderLightbox()}
function closeLightbox(){document.getElementById('lightbox').classList.remove('show');if(!document.getElementById('modalBg').classList.contains('show'))document.body.classList.remove('modal-open')}

function applyFiltersFromControls(){filters.q=document.getElementById('search').value.trim().toLowerCase();filters.purpose=document.getElementById('purpose').value;filters.type=document.getElementById('type').value;filters.price=document.getElementById('priceRange').value;filters.state=document.getElementById('stateFilter')?.value||'';filters.city=document.getElementById('cityFilter')?.value||'';filters.district=document.getElementById('districtFilter')?.value||'';filters.sort=userLocation?'distance':document.getElementById('sort').value;visibleLimit=8;renderProperties()}
function clearFilters(){filters={q:'',purpose:'',type:'',price:'',state:'',city:'',district:'',quick:'all',sort:userLocation?'distance':'featured'};['search','purpose','type','priceRange'].forEach(id=>document.getElementById(id).value='');document.getElementById('sort').value=userLocation?'distance':'featured';document.querySelectorAll('[data-quick]').forEach(b=>b.classList.toggle('active',b.dataset.quick==='all'));renderLocationFilters();visibleLimit=8;renderProperties()}
function refreshCatalog(){catalog=loadCatalog();renderHeader();renderLocationFilters();renderProperties();renderFavorites();renderLocations();renderRecentlyViewed();if(activeProperty){const still=catalog.properties.find(p=>p.id===activeProperty.id);if(still&&document.getElementById('modalBg').classList.contains('show'))openProperty(still.id)}}
function revealOnScroll(){const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>obs.observe(el))}

// Events
window.addEventListener('scroll',()=>document.getElementById('siteNav').classList.toggle('scrolled',scrollY>20),{passive:true});
document.getElementById('searchSubmit').addEventListener('click',()=>{applyFiltersFromControls();scrollToCatalog()});
['search','purpose','type','priceRange'].forEach(id=>document.getElementById(id).addEventListener(id==='search'?'input':'change',()=>{if(id!=='search'||document.getElementById('search').value.length>1)applyFiltersFromControls()}));
document.getElementById('search').addEventListener('keydown',e=>{if(e.key==='Enter'){applyFiltersFromControls();scrollToCatalog()}});
document.getElementById('stateFilter')?.addEventListener('change',e=>{filters.state=e.target.value;filters.city='';filters.district='';renderLocationFilters();visibleLimit=8;renderProperties()});
document.getElementById('cityFilter')?.addEventListener('change',e=>{filters.city=e.target.value;filters.district='';renderLocationFilters();visibleLimit=8;renderProperties()});
document.getElementById('districtFilter')?.addEventListener('change',e=>{filters.district=e.target.value;visibleLimit=8;renderProperties()});
document.getElementById('sort').addEventListener('change',applyFiltersFromControls);document.getElementById('clearFilters').addEventListener('click',clearFilters);document.getElementById('geoRadiusRetry')?.addEventListener('click',requestUserLocation);
document.querySelectorAll('[data-quick]').forEach(b=>b.addEventListener('click',()=>{filters.quick=b.dataset.quick;document.querySelectorAll('[data-quick]').forEach(x=>x.classList.toggle('active',x===b));renderProperties()}));
document.querySelectorAll('[data-intent-purpose]').forEach(b=>b.addEventListener('click',()=>{filters.purpose=b.dataset.intentPurpose;document.getElementById('purpose').value=filters.purpose;renderProperties();scrollToCatalog()}));document.querySelectorAll('[data-intent-type]').forEach(b=>b.addEventListener('click',()=>{filters.type=b.dataset.intentType;document.getElementById('type').value=filters.type;renderProperties();scrollToCatalog()}));
document.querySelectorAll('[data-nav-purpose],[data-footer-purpose]').forEach(b=>b.addEventListener('click',()=>{filters.purpose=b.dataset.navPurpose||b.dataset.footerPurpose;document.getElementById('purpose').value=filters.purpose;renderProperties();scrollToCatalog()}));
document.getElementById('navProperties').addEventListener('click',scrollToCatalog);document.getElementById('footerProperties').addEventListener('click',scrollToCatalog);document.getElementById('navExperience').addEventListener('click',()=>document.getElementById('experience').scrollIntoView({behavior:'smooth'}));
document.getElementById('heroOpen').addEventListener('click',()=>{const id=document.getElementById('heroOpen').dataset.id;if(id)openProperty(id)});document.getElementById('mobileSearchBtn').addEventListener('click',()=>document.getElementById('searchDock').scrollIntoView({behavior:'smooth',block:'center'}));
document.getElementById('loadMore').addEventListener('click',()=>{visibleLimit+=6;renderProperties()});
document.getElementById('openFavorites').addEventListener('click',openFavorites);document.getElementById('closeFavorites').addEventListener('click',closeFavorites);document.getElementById('favoriteDrawerBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeFavorites()});
document.getElementById('openCompare').addEventListener('click',openCompare);document.getElementById('closeCompare').addEventListener('click',closeCompare);document.getElementById('compareBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCompare()});
document.getElementById('modalBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeProperty()});
document.getElementById('lightboxClose').addEventListener('click',closeLightbox);document.getElementById('lightboxPrev').addEventListener('click',()=>moveLightbox(-1));document.getElementById('lightboxNext').addEventListener('click',()=>moveLightbox(1));
document.addEventListener('keydown',e=>{if(document.getElementById('lightbox').classList.contains('show')){if(e.key==='Escape')closeLightbox();if(e.key==='ArrowLeft')moveLightbox(-1);if(e.key==='ArrowRight')moveLightbox(1)}else if(document.getElementById('modalBg').classList.contains('show')&&e.key==='Escape')closeProperty()});
window.addEventListener('storage',e=>{if(e.key==='nexoPublicCatalogV1')refreshCatalog()});try{const bc=new BroadcastChannel('nexo-public-catalog');bc.onmessage=refreshCatalog}catch(e){}
['financeValue','financeDown','financeYears','financeRate'].forEach(id=>document.getElementById(id)?.addEventListener('input',calculateFinance));document.getElementById('financeYears')?.addEventListener('change',calculateFinance);
document.getElementById('financeFromFeatured')?.addEventListener('click',()=>{const p=featuredProperty();if(!p)return;document.getElementById('financeValue').value=p.price;document.getElementById('financeDown').value=Math.round(p.price*.2);calculateFinance();document.getElementById('finance').scrollIntoView({behavior:'smooth',block:'center'})});
document.getElementById('preferenceSubmit')?.addEventListener('click',preferenceWhatsapp);
document.querySelectorAll('.faq-question').forEach(b=>b.addEventListener('click',()=>{const item=b.closest('.faq-item'),was=item.classList.contains('open');document.querySelectorAll('.faq-item').forEach(i=>i.classList.remove('open'));if(!was)item.classList.add('open')}));
document.getElementById('visitClose')?.addEventListener('click',closeVisitScheduler);document.getElementById('visitModalBg')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeVisitScheduler()});document.getElementById('visitSubmit')?.addEventListener('click',submitVisit);
document.getElementById('leadCaptureClose')?.addEventListener('click',closeLeadCapture);document.getElementById('leadCaptureBg')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeLeadCapture()});document.getElementById('leadCaptureSubmit')?.addEventListener('click',submitLeadCapture);
['navWhatsapp','floatingWa','footerWhatsapp'].forEach(id=>document.getElementById(id)?.addEventListener('click',e=>{e.preventDefault();openLeadCapture({kind:'general'})}));document.getElementById('financeWhatsapp')?.addEventListener('click',e=>{e.preventDefault();openLeadCapture({kind:'finance'})});
document.addEventListener('click',e=>{const a=e.target.closest('.detail-cta a.primary,.detail-contact-card a');if(a&&activeProperty){e.preventDefault();openLeadCapture({kind:'property',propertyId:activeProperty.id})}});

renderHeader();renderLocationFilters();renderProperties();renderFavorites();renderCompareBar();renderLocations();renderRecentlyViewed();calculateFinance();revealOnScroll();requestUserLocation();
