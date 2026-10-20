const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0));
const brDate=d=>{if(!d)return'-';const [y,m,day]=String(d).split('-');return day&&m&&y?`${day}/${m}/${y}`:d};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const initials=n=>String(n||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const fmtPhone=s=>String(s||'').replace(/\D/g,'').replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
const todayISO=()=>new Date().toISOString().slice(0,10);

const defaultDB={
 settings:{name:'AG',cnpj:'',phone:'',email:'',address:'',siteBrand:'AG',siteTagline:'Imóveis para viver o próximo capítulo.',siteWhatsapp:'',siteRegion:'Jaraguá do Sul e região'},
 properties:[],
 prospectings:[],
 leads:[],
 clients:[],
 appointments:[],
 proposals:[],
 finance:[],
 users:[],
 activities:[],
 owners:[],
 contracts:[],
 commissions:[],
 timelines:[],
 tasks:[],
 siteEvents:[],
 automation:{roundRobin:true,rrIndex:0,slaMinutes:15,followupHours:24}
};

let db=loadDB(), calendarDate=new Date(), editing={type:null,id:null};
if(db?.settings){db.settings.name='AG';db.settings.siteBrand='AG';}
function loadDB(){try{const x=localStorage.getItem('atlasImobCRM');return x?JSON.parse(x):structuredClone(defaultDB)}catch(e){return JSON.parse(JSON.stringify(defaultDB))}}
function saveDB(){localStorage.setItem('atlasImobCRM',JSON.stringify(db));renderAll()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function navigate(page){$$('.page').forEach(p=>p.classList.remove('active'));$('#page-'+page)?.classList.add('active');$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});if(page==='dashboard')setTimeout(drawChart,50)}
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));$('#sideNav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)navigate(b.dataset.page)});document.addEventListener('click',e=>{const b=e.target.closest('[data-pagejump]');if(b)navigate(b.dataset.pagejump)});$('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('open');

function renderKPIs(){
  const avail=db.properties.filter(x=>x.status==='Disponível').length;
  const active=db.leads.filter(x=>x.stage!=='Fechado').length;
  const proposals=db.proposals.filter(x=>x.status!=='Aprovada').length;
  const closed=db.leads.filter(x=>x.stage==='Fechado').reduce((a,b)=>a+Number(b.value||0),0);
  const pipeline=db.leads.filter(x=>x.stage!=='Fechado').reduce((a,b)=>a+Number(b.value||0),0);
  if($('#heroPipeline')) $('#heroPipeline').textContent=money(pipeline);
  if($('#heroDeals')) $('#heroDeals').textContent=active+' oportunidades';
  const cards=[
    {label:'Imóveis disponíveis',value:avail,icon:'▦',trend:avail?'Carteira ativa':'Comece cadastrando imóveis',tone:'green',spark:'2,23 14,19 25,20 36,13 48,17 59,8 67,10'},
    {label:'Leads ativos',value:active,icon:'◎',trend:active?'Oportunidades em andamento':'Aguardando novos leads',tone:'blue',spark:'2,20 14,22 25,15 36,18 48,11 59,13 67,5'},
    {label:'Propostas em aberto',value:proposals,icon:'◇',trend:proposals?'Acompanhar hoje':'Nenhuma proposta em aberto',tone:'gold',spark:'2,22 14,16 25,18 36,11 48,15 59,8 67,12'},
    {label:'VGV fechado',value:money(closed),icon:'$',trend:closed?'Fechamentos registrados':'Sem fechamentos registrados',tone:'rose',spark:'2,24 14,22 25,20 36,15 48,17 59,10 67,6'}
  ];
  $('#kpiGrid').innerHTML=cards.map(c=>`<div class="card kpi" data-tone="${c.tone}"><div class="kpi-top"><span class="kpi-label">${c.label}</span><span class="kpi-icon">${c.icon}</span></div><strong>${c.value}</strong><div class="kpi-footer"><span class="trend">↗ ${c.trend}</span><svg class="sparkline" viewBox="0 0 70 28" aria-hidden="true"><polyline points="${c.spark}"/></svg></div></div>`).join('');
  $('#navLeadBadge') && ($('#navLeadBadge').textContent=active);
}
function renderActivities(){$('#activityList').innerHTML=db.activities.slice(0,6).map(a=>`<div class="activity-item"><div class="activity-icon">${a.icon}</div><div><b>${safe(a.title)}</b><p>${safe(a.text)}</p></div><time>${safe(a.time)}</time></div>`).join('')||'<div class="empty">Nenhuma atividade.</div>'}
function propertyImage(p){
 const direct=String(p?.image||'').trim();
 if(direct)return direct;
 const photos=Array.isArray(p?.photos)?p.photos:[];
 const cover=photos.find(ph=>ph.id===p?.coverPhoto)||photos[0];
 return String(cover?.src||'').trim();
}
function renderDashboardLists(){
 const now=todayISO();
 const ap=[...db.appointments].filter(a=>a.date>=now).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,4);
 $('#nextVisits').innerHTML=ap.map(a=>{const p=db.properties.find(x=>x.id===a.property),img=p?propertyImage(p):'';return `<div class="mini-item"><div class="thumb" ${img?`style="background-image:linear-gradient(rgba(10,35,31,.08),rgba(10,35,31,.12)),url('${img}')"`:''}>${img?'':'□'}</div><div><b>${safe(a.title)}</b><small>${brDate(a.date)} às ${safe(a.time)} · ${safe(a.client)}</small></div><div class="right"><span class="status ${a.type==='Visita'?'warn':'info'}">${safe(a.type)}</span></div></div>`}).join('')||'<div class="empty">Sem compromissos futuros.</div>';
 const fp=db.properties.filter(x=>x.featured).slice(0,4);
 $('#featuredProperties').innerHTML=fp.map(p=>{const img=propertyImage(p);return `<div class="mini-item"><div class="thumb" ${img?`style="background-image:linear-gradient(rgba(10,35,31,.05),rgba(10,35,31,.10)),url('${img}')"`:''}></div><div><b>${safe(p.title)}</b><small>${safe(p.address)}</small></div><div class="right"><b>${money(p.price)}</b><small>${safe(p.purpose)}</small></div></div>`}).join('')||'<div class="empty">Nenhum imóvel em destaque.</div>';
 const hero=$('#dashboardSpotlight');
 if(hero){
   const featured=db.properties.find(p=>p.featured)||db.properties[0]||null;
   if(!featured){
     hero.classList.add('spotlight-empty');
     hero.style.backgroundImage='none';
     hero.querySelector('.spotlight-index').textContent='—';
     hero.querySelector('.spotlight-copy').innerHTML='<small>Carteira</small><h3>Nenhum imóvel em destaque</h3><div class="spotlight-meta"><span>Cadastre um imóvel e marque como destaque para exibi-lo aqui.</span><strong></strong></div>';
   }else{
     const img=propertyImage(featured);
     hero.classList.toggle('spotlight-empty',!img);
     hero.style.backgroundImage=img?`url('${img}')`:'none';
     hero.querySelector('.spotlight-index').textContent='01';
     const loc=[featured.district,featured.city].filter(Boolean).join(' / ')||featured.address||'Carteira';
     const specs=[];
     if(featured.area)specs.push(`${Number(featured.area).toLocaleString('pt-BR')} m²`);
     if(featured.suites)specs.push(`${featured.suites} suíte${Number(featured.suites)===1?'':'s'}`);
     else if(featured.beds)specs.push(`${featured.beds} quarto${Number(featured.beds)===1?'':'s'}`);
     hero.querySelector('.spotlight-copy').innerHTML=`<small>${safe(loc)}</small><h3>${safe(featured.title||'Imóvel')}</h3><div class="spotlight-meta"><span>${safe(specs.join(' · ')||featured.purpose||'')}</span><strong>${featured.price?money(featured.price):''}</strong></div>`;
   }
 }
}
function drawChart(){
 const c=$('#salesChart');if(!c)return;const dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;c.width=w*dpr;c.height=h*dpr;
 const x=c.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,w,h);
 const now=new Date(),months=[];for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({y:d.getFullYear(),m:d.getMonth(),label:d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')})}
 const monthKey=d=>{const dt=new Date(d);return Number.isNaN(dt.getTime())?'':`${dt.getFullYear()}-${dt.getMonth()}`};
 const leads=months.map(mm=>(db.leads||[]).filter(l=>monthKey(l.created||l.date||l.last)===`${mm.y}-${mm.m}`).length);
 const sales=months.map(mm=>(db.leads||[]).filter(l=>l.stage==='Fechado'&&monthKey(l.closedAt||l.updatedAt||l.created||l.date||l.last)===`${mm.y}-${mm.m}`).length);
 const labels=months.map(mm=>mm.label),pad=30,max=Math.max(4,...leads,...sales);
 x.lineWidth=1;x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--line').trim()||'#e5e9e6';x.globalAlpha=.7;
 for(let i=0;i<5;i++){const y=pad+(h-pad*2)*i/4;x.beginPath();x.moveTo(pad,y);x.lineTo(w-pad,y);x.stroke()}
 x.globalAlpha=1;labels.forEach((l,i)=>{const px=pad+(w-pad*2)*i/(labels.length-1);x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#7d8991';x.font='500 9px Manrope, Arial';x.textAlign='center';x.fillText(l,px,h-7)});
 const plot=(arr,color,fill)=>{const pts=arr.map((v,i)=>[pad+(w-pad*2)*i/(arr.length-1),h-pad-(v/max)*(h-pad*2)]);x.beginPath();pts.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.strokeStyle=color;x.lineWidth=2.7;x.lineCap='round';x.lineJoin='round';x.stroke();if(fill){const g=x.createLinearGradient(0,pad,0,h-pad);g.addColorStop(0,fill);g.addColorStop(1,'rgba(255,255,255,0)');x.lineTo(pts[pts.length-1][0],h-pad);x.lineTo(pts[0][0],h-pad);x.closePath();x.fillStyle=g;x.fill()}pts.forEach(p=>{x.beginPath();x.arc(p[0],p[1],3.4,0,Math.PI*2);x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()||'#fff';x.fill();x.lineWidth=2;x.strokeStyle=color;x.stroke()})};
 plot(leads,'#14253F','rgba(20,37,63,.08)');
 plot(sales,'#aeb2bd','rgba(174,178,189,.04)');
}
function renderProperties(){
 const q=$('#propertySearch')?.value.toLowerCase()||'',typ=$('#propertyTypeFilter')?.value||'',pur=$('#propertyPurposeFilter')?.value||'';
 const list=db.properties.filter(p=>(!q||[p.id,p.title,p.address,p.owner].join(' ').toLowerCase().includes(q))&&(!typ||p.type===typ)&&(!pur||p.purpose===pur));
 $('#propertyGrid').innerHTML=list.map(p=>`<article class="card property-card"><div class="property-cover" style="background-image:linear-gradient(0deg,rgba(7,27,24,.06),rgba(7,27,24,.02)),url('${propertyImage(p)}')"><span class="property-tag">${safe(p.type)} · ${safe(p.purpose)}</span><span class="property-status" style="background:${p.status==='Disponível'?'var(--success)':p.status==='Reservado'?'var(--warning)':'var(--info)'}">${safe(p.status)}</span><span class="property-code">${safe(p.id)}</span></div><div class="property-content"><h3>${safe(p.title)}</h3><div class="address">${safe(p.address)}</div><div class="specs"><span>▱ ${p.area} m²</span>${p.beds?`<span>▣ ${p.beds} quartos</span>`:''}${p.baths?`<span>◫ ${p.baths} banheiros</span>`:''}</div><div class="price-row"><div><strong>${money(p.price)}</strong><small style="display:block;color:var(--muted);font-size:9px">${safe(p.purpose==='Locação'?'por mês':'valor anunciado')}</small></div><div class="actions"><button class="btn small" onclick="editItem('property','${p.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('property','${p.id}')">Excluir</button></div></div></div></article>`).join('')||'<div class="card empty" style="grid-column:1/-1">Nenhum imóvel encontrado.</div>';
}
function stageClass(s){return s==='Novo'?'info':s==='Contato'||s==='Visita'?'warn':s==='Fechado'?'':'info'}
function renderLeads(){const q=$('#leadSearch')?.value.toLowerCase()||'',src=$('#leadSourceFilter')?.value||'',st=$('#leadStatusFilter')?.value||'';const list=db.leads.filter(l=>(!q||[l.name,l.phone,l.email,l.interest].join(' ').toLowerCase().includes(q))&&(!src||l.source===src)&&(!st||l.stage===st));$('#leadTable').innerHTML=list.map(l=>`<tr><td><div class="row-avatar"><div class="avatar">${initials(l.name)}</div><div><b>${safe(l.name)}</b><small style="display:block;color:var(--muted)">${fmtPhone(l.phone)}</small></div></div></td><td>${safe(l.interest)}</td><td>${safe(l.source)}</td><td><span class="status ${stageClass(l.stage)}">${safe(l.stage)}</span></td><td>${safe(l.broker)}</td><td><b>${money(l.value)}</b></td><td><div class="actions"><button class="btn small" onclick="editItem('lead','${l.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('lead','${l.id}')">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nenhum lead encontrado.</td></tr>'}
function renderKanban(){const stages=['Novo','Contato','Visita','Proposta','Fechado'];$('#kanban').innerHTML=stages.map(s=>{const items=db.leads.filter(l=>l.stage===s);return `<div class="kan-col" data-stage="${s}"><div class="kan-title"><span>${s}</span><span class="kan-count">${items.length}</span></div><div class="kan-cards">${items.map(l=>`<div class="lead-card" draggable="true" data-id="${l.id}"><h4>${safe(l.name)}</h4><p>${safe(l.interest)} · ${safe(l.source)}</p><div class="lead-value">${money(l.value)}</div><div class="lead-foot"><span class="temp">${safe(l.temp)}</span><span class="avatar" style="width:26px;height:26px;font-size:9px">${initials(l.broker)}</span></div></div>`).join('')}</div></div>`}).join('');$$('.lead-card').forEach(c=>c.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',c.dataset.id)));$$('.kan-col').forEach(col=>{col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('dragover')});col.addEventListener('dragleave',()=>col.classList.remove('dragover'));col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('dragover');const id=e.dataTransfer.getData('text/plain'),lead=db.leads.find(x=>x.id===id);if(lead){lead.stage=col.dataset.stage;pushActivity('▥','Lead movido',`${lead.name} → ${lead.stage}`);saveDB();toast('Etapa atualizada.')}})})}
function renderClients(){const q=$('#clientSearch')?.value.toLowerCase()||'',t=$('#clientTypeFilter')?.value||'';const list=db.clients.filter(c=>(!q||[c.name,c.doc,c.phone,c.email].join(' ').toLowerCase().includes(q))&&(!t||c.type===t));$('#clientTable').innerHTML=list.map(c=>`<tr><td><div class="row-avatar"><div class="avatar">${initials(c.name)}</div><div><b>${safe(c.name)}</b><small style="display:block;color:var(--muted)">${safe(c.email)}</small></div></div></td><td><span class="status info">${safe(c.type)}</span></td><td>${safe(c.doc)}</td><td>${fmtPhone(c.phone)}</td><td>${brDate(c.last)}</td><td>${safe(c.broker)}</td><td><div class="actions"><button class="btn small" onclick="editItem('client','${c.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('client','${c.id}')">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nenhum cliente encontrado.</td></tr>'}

function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth();$('#calendarTitle').textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(calendarDate).replace(/^./,s=>s.toUpperCase());const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());let html=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<div class="dow">${d}</div>`).join('');for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=d.toISOString().slice(0,10),events=db.appointments.filter(a=>a.date===iso),muted=d.getMonth()!==m,today=iso===todayISO();html+=`<div class="day ${muted?'muted':''} ${today?'today':''}" data-date="${iso}"><b>${d.getDate()}</b>${events.slice(0,2).map(e=>`<span class="event-chip ${e.type==='Visita'?'visit':''}" title="${safe(e.title)}">${safe(e.time)} ${safe(e.title)}</span>`).join('')}${events.length>2?`<small>+${events.length-2}</small>`:''}</div>`}$('#calendarGrid').innerHTML=html;const now=todayISO();const ap=[...db.appointments].filter(a=>a.date>=now).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,8);$('#appointmentList').innerHTML=ap.map(a=>`<div class="mini-item"><div class="thumb">${a.type==='Visita'?'⌂':'□'}</div><div><b>${safe(a.title)}</b><small>${brDate(a.date)} · ${safe(a.time)} · ${safe(a.client)}</small></div><div class="right"><button class="btn small" onclick="editItem('appointment','${a.id}')">Editar</button></div></div>`).join('')||'<div class="empty">Sem compromissos.</div>'}
$('#prevMonth').onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};$('#nextMonth').onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};

function renderProposals(){$('#proposalTable').innerHTML=db.proposals.map(p=>{const prop=db.properties.find(x=>x.id===p.property);return `<tr><td><b>${safe(p.id)}</b></td><td>${safe(p.client)}</td><td>${safe(prop?.title||p.property)}</td><td>${safe(p.type)}</td><td><b>${money(p.value)}</b></td><td><span class="status ${p.status==='Aprovada'?'':p.status==='Recusada'?'danger':'warn'}">${safe(p.status)}</span></td><td>${brDate(p.date)}</td><td><div class="actions"><button class="btn small" onclick="previewProposal('${p.id}')">Visualizar</button><button class="btn small" onclick="editItem('proposal','${p.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('proposal','${p.id}')">Excluir</button></div></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Nenhuma proposta.</td></tr>'}
function renderFinance(){const receive=db.finance.filter(f=>f.status==='A receber').reduce((a,b)=>a+Number(b.value||0),0),received=db.finance.filter(f=>f.status==='Recebido').reduce((a,b)=>a+Number(b.value||0),0),expenses=db.finance.filter(f=>['Despesa','Pago'].includes(f.category)||f.status==='Pago').reduce((a,b)=>a+Number(b.value||0),0);$('#financeCards').innerHTML=[["A receber",receive,'72%'],['Recebido no período',received,'88%'],['Despesas / pagos',expenses,'41%']].map(x=>`<div class="card money-card"><small>${x[0]}</small><strong>${money(x[1])}</strong><div class="progress"><span style="width:${x[2]}"></span></div></div>`).join('');$('#financeTable').innerHTML=db.finance.map(f=>`<tr><td><b>${safe(f.desc)}</b></td><td>${safe(f.category)}</td><td>${safe(f.client)}</td><td>${brDate(f.due)}</td><td><b>${money(f.value)}</b></td><td><span class="status ${f.status==='A receber'?'warn':''}">${safe(f.status)}</span></td><td><div class="actions"><button class="btn small" onclick="editItem('finance','${f.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('finance','${f.id}')">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Sem lançamentos.</td></tr>'}
function barReport(el,data){const max=Math.max(1,...data.map(x=>x[1]));$(el).innerHTML=data.map(([k,v])=>`<div class="bar-row"><span>${safe(k)}</span><div class="bar"><span style="width:${(v/max)*100}%"></span></div><b>${v}</b></div>`).join('')}
function countBy(arr,key){return Object.entries(arr.reduce((o,x)=>(o[x[key]]=(o[x[key]]||0)+1,o),{})).sort((a,b)=>b[1]-a[1])}
function renderReports(){barReport('#sourceReport',countBy(db.leads,'source'));barReport('#typeReport',countBy(db.properties,'type'));const brokers=db.users.filter(u=>u.active!==false).map(u=>[u.name,Number(u.closed||0)]);barReport('#brokerReport',brokers);const totalVGV=db.leads.filter(x=>x.stage==='Fechado').reduce((a,b)=>a+Number(b.value||0),0),conversion=db.leads.length?Math.round(db.leads.filter(x=>x.stage==='Fechado').length/db.leads.length*100):0;$('#summaryReport').innerHTML=`<div class="grid" style="grid-template-columns:1fr 1fr"><div class="kpi"><span class="kpi-label">VGV fechado</span><strong>${money(totalVGV)}</strong></div><div class="kpi"><span class="kpi-label">Conversão</span><strong>${conversion}%</strong></div><div class="kpi"><span class="kpi-label">Carteira</span><strong>${db.properties.length}</strong></div><div class="kpi"><span class="kpi-label">Clientes</span><strong>${db.clients.length}</strong></div></div>`}
function renderTeam(){$('#teamGrid').innerHTML=db.users.map(u=>`<article class="card" style="padding:18px"><div style="display:flex;align-items:center;gap:12px"><div class="avatar" style="width:46px;height:46px">${initials(u.name)}</div><div><h3 style="margin:0;font-size:14px">${safe(u.name)}</h3><small style="color:var(--muted)">${safe(u.role)} · ${u.active?'Ativo':'Inativo'}</small></div><button class="btn small" style="margin-left:auto" onclick="editItem('user','${u.id}')">Editar</button></div><div class="grid" style="grid-template-columns:1fr 1fr;margin-top:16px;gap:8px"><div class="kpi" style="background:var(--surface-2);border-radius:12px"><span class="kpi-label">Fechamentos</span><strong style="font-size:20px">${u.closed||0}</strong></div><div class="kpi" style="background:var(--surface-2);border-radius:12px"><span class="kpi-label">Pipeline</span><strong style="font-size:15px">${money(u.pipeline||0)}</strong></div></div><p style="font-size:10px;color:var(--muted);margin:14px 0 0">${safe(u.email)} · ${fmtPhone(u.phone)}</p></article>`).join('')}
function renderSettings(){$('#cfgName').value=db.settings.name||'';$('#cfgCnpj').value=db.settings.cnpj||'';$('#cfgPhone').value=db.settings.phone||'';$('#cfgEmail').value=db.settings.email||'';$('#cfgAddress').value=db.settings.address||'';$('#brandNameSide').textContent=db.settings.name||'AG'}
function renderAll(){renderKPIs();renderActivities();renderDashboardLists();renderProperties();renderLeads();renderKanban();renderClients();renderCalendar();renderProposals();renderFinance();renderReports();renderTeam();renderSettings();setTimeout(drawChart,20)}

function pushActivity(icon,title,text){db.activities.unshift({icon,title,text,time:'agora'});db.activities=db.activities.slice(0,12)}
function findType(type){return ({property:'properties',prospecting:'prospectings',lead:'leads',client:'clients',appointment:'appointments',proposal:'proposals',finance:'finance',user:'users'})[type]}
function editItem(type,id){editing={type,id};openModal(type,db[findType(type)].find(x=>x.id===id))}
function deleteItem(type,id){if(!confirm('Deseja realmente excluir este registro?'))return;const k=findType(type);db[k]=db[k].filter(x=>x.id!==id);saveDB();toast('Registro excluído.')}

function field(name,label,value='',type='text',extra=''){return `<div class="form-group ${extra.includes('full')?'full':''}"><label>${label}</label><input class="form-control" name="${name}" type="${type}" value="${safe(value)}" ${extra.replace('full','')}></div>`}
function selectField(name,label,options,value='',full=false){return `<div class="form-group ${full?'full':''}"><label>${label}</label><select class="form-control" name="${name}">${options.map(o=>`<option ${o===value?'selected':''}>${o}</option>`).join('')}</select></div>`}

function checkboxGroup(name,label,options,data={}){return `<div class="form-group full"><label>${label}</label><div class="check-grid">${options.map(opt=>{const key=`${name}_${opt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_')}`;const checked=data[key]==='on'||data[key]===true?'checked':'';return `<label class="check-chip"><input type="checkbox" name="${key}" ${checked}><span>${opt}</span></label>`}).join('')}</div></div>`}
function formDivider(title, note=''){return `<div class="form-divider">${title}${note?`<div class="muted-note">${note}</div>`:''}</div>`}

function openModal(type,data={}){editing={type,id:data.id||null};let title='',body='';const brokers=db.users.filter(u=>u.active).map(u=>u.name);if(type==='quick'){title='Criar novo';body=`<div class="grid" style="grid-template-columns:repeat(2,1fr)"><button class="card" style="padding:24px;border:1px solid var(--line);cursor:pointer" onclick="openModal('prospecting')">◎<br><b>Prospecção</b></button><button class="card" style="padding:24px;border:1px solid var(--line);cursor:pointer" onclick="openModal('property')">⌂<br><b>Novo imóvel</b></button><button class="card" style="padding:24px;border:1px solid var(--line);cursor:pointer" onclick="openModal('client')">♙<br><b>Novo cliente</b></button><button class="card" style="padding:24px;border:1px solid var(--line);cursor:pointer" onclick="openModal('appointment')">□<br><b>Compromisso</b></button></div>`;showModal(title,body,'');return}
if(type==='property'){title=data.id?'Editar imóvel':'Cadastrar imóvel';body=`<form id="modalForm" class="form-grid">${field('id','Código',data.id||`IM${String(db.properties.length+1).padStart(3,'0')}`,'text','required')}${field('title','Título do imóvel',data.title,'text','required')}${selectField('type','Tipo',['Apartamento','Casa','Terreno','Comercial','Rural'],data.type)}${selectField('purpose','Finalidade',['Venda','Locação'],data.purpose)}${field('price','Valor',data.price||'','number','required min="0" step="0.01"')}${selectField('status','Status',['Disponível','Reservado','Vendido','Alugado','Inativo'],data.status||'Disponível')}${field('address','Endereço',data.address,'text','full required')}${field('beds','Quartos',data.beds||0,'number','min="0"')}${field('baths','Banheiros',data.baths||0,'number','min="0"')}${field('area','Área (m²)',data.area||'','number','min="0"')}${field('owner','Proprietário',data.owner||'')}${selectField('featured','Destaque',['Não','Sim'],data.featured?'Sim':'Não')}<div class="form-group full"><label>Observações</label><textarea class="form-control" name="notes">${safe(data.notes||'')}</textarea></div></form>`}

if(type==='prospecting'){
  title=data.id?'Editar prospecção':'Nova prospecção';
  body=`<form id="modalForm" class="form-grid prospecting-grid">
    ${formDivider('Imóvel')}
    ${field('propertyTitle','Imóvel',data.propertyTitle,'text','required')}
    ${field('address','Endereço',data.address,'text','full required')}
    ${field('referencePoint','Ponto de referência',data.referencePoint||'','text','')}
    ${field('unit','BL/Unidade',data.unit||'','text','')}
    ${formDivider('Informações gerais')}
    ${selectField('propertyType','Tipo de imóvel',['Casa','Apartamento','Terreno','Sítio/Chácara','Comercial','Rural','Outro'],data.propertyType||'Casa')}
    ${selectField('constructionStatus','Situação do imóvel',['Pronto','Na planta'],data.constructionStatus||(data.statusFlag_pronto==='on'?'Pronto':data.statusFlag_na_planta==='on'?'Na planta':'Pronto'))}
    ${selectField('locationProfile','Localização/uso',['Residencial','Comercial','Rural','Outro'],data.locationProfile||'Residencial')}
    ${field('price','Valor do imóvel',data.price||'','number','min="0" step="0.01"')}
    ${field('entryValue','Valor de entrada',data.entryValue||'','number','min="0" step="0.01"')}
    ${field('debtBalance','Saldo devedor',data.debtBalance||'','number','min="0" step="0.01"')}
    ${field('condoFee','Taxa de condomínio',data.condoFee||'','number','min="0" step="0.01"')}
    ${field('floorNumber','Andar',data.floorNumber||'','text','')}
    ${field('landArea','Área de terreno (m²)',data.landArea||'','number','min="0" step="0.01"')}
    ${field('builtArea','Área construída (m²)',data.builtArea||'','number','min="0" step="0.01"')}
    ${field('yearBuilt','Ano de construção',data.yearBuilt||'','number','min="0" step="1"')}
    ${field('builder','Construtora',data.builder||'','text','')}
    ${field('realEstateAgency','Imobiliária',data.realEstateAgency||'','text','')}
    ${field('garageCovered','Vagas cobertas',data.garageCovered||'','number','min="0" step="1"')}
    ${field('garageUncovered','Vagas descobertas',data.garageUncovered||'','number','min="0" step="1"')}
    ${field('garageIndependent','Vagas independentes',data.garageIndependent||'','number','min="0" step="1"')}
    ${field('bedrooms','Quartos',data.bedrooms||'','number','min="0" step="1"')}
    ${field('suites','Suítes',data.suites||'','number','min="0" step="1"')}
    ${checkboxGroup('statusFlag','Condição / características',['Pode ser financiado','Desocupado','Quitado','Blindex','Acrílico','PVC'],data)}
    ${checkboxGroup('rooms','Compartimentos',['Cozinha','Área de serviço','Escritório','Banheiro social','Estar/Jantar','Lavabo','Despensa','DCE','Varanda','Varanda gourmet','Piscina privativa'],data)}
    ${checkboxGroup('leisure','Área comum / lazer',['Churrasqueira','Playground','Salão de jogos','Coworking','Salão de festas','Pet place','Quadra','Elevador','Cerca elétrica','Bicicletário','Portão automático','Piscina','Academia','Brinquedoteca'],data)}
    ${checkboxGroup('planned','Móveis projetados / embutidos',['Suíte master','Cozinha','Quarto 1','Área de serviço','Quarto 2','Banheiro','Quarto 3','Varanda','Sala','Escritório'],data)}
    ${checkboxGroup('disclosure','Autorização de divulgação',['Redes sociais','Site da imobiliária','Placa','Pintura','Proprietário','Outro'],data)}
    ${selectField('painting','Pintura',['Nova','Regular','Boa','Deficiente'],data.painting||'Boa')}
    ${selectField('floorFinish','Piso',['Mármore','Granito','Cerâmica','Porcelanato','Madeira'],data.floorFinish||'Porcelanato')}
    ${field('keysInfo','Chaves do imóvel',data.keysInfo||'','text','')}
    ${field('broker','Responsável',brokers,data.broker||brokers[0])}
    ${field('created','Data da prospecção',data.created||todayISO(),'date')}
    <div class="form-group full"><label>Observações</label><textarea class="form-control" name="notes">${safe(data.notes||'')}</textarea></div>
    ${formDivider('Dados do proprietário')}
    ${field('ownerName','Nome',data.ownerName||'','text','required')}
    ${field('ownerProfession','Profissão',data.ownerProfession||'','text','')}
    ${field('ownerAddress','Endereço',data.ownerAddress||'','text','full')}
    ${field('ownerPhone1','Telefone 1',data.ownerPhone1||'','tel','required')}
    ${field('ownerPhone2','Telefone 2',data.ownerPhone2||'','tel','')}
    ${field('ownerEmail','E-mail',data.ownerEmail||'','email','')}
    ${field('ownerRg','RG',data.ownerRg||'','text','')}
    ${field('ownerCpf','CPF',data.ownerCpf||'','text','')}
    ${field('ownerCivilStatus','Estado civil',data.ownerCivilStatus||'','text','')}
    ${field('spouseName','Nome do cônjuge',data.spouseName||'','text','')}
    ${field('spouseProfession','Profissão do cônjuge',data.spouseProfession||'','text','')}
    ${field('spouseRg','RG do cônjuge',data.spouseRg||'','text','')}
    ${field('spouseCpf','CPF do cônjuge',data.spouseCpf||'','text','')}
    ${field('spousePhone1','Telefone do cônjuge',data.spousePhone1||'','tel','')}
    ${formDivider('Dados complementares','Campos baseados na ficha de prospecção enviada.')}
    ${selectField('exclusiveSale','Opção de venda por exclusividade',['Não','Sim'],data.exclusiveSale||'Não')}
    ${field('commission','Percentual de comissão',data.commission||'5','number','min="0" step="0.01"')}
    <div class="form-group full"><label>Observações complementares</label><textarea class="form-control" name="extraObs">${safe(data.extraObs||'')}</textarea></div>
  </form>`}
if(type==='lead'){title=data.id?'Editar lead':'Novo lead';body=`<form id="modalForm" class="form-grid">${field('name','Nome',data.name,'text','required')}${field('phone','Telefone',data.phone,'tel','required')}${field('email','E-mail',data.email,'email')}${field('interest','Interesse',data.interest,'text','required')}${selectField('source','Origem',['Site','Instagram','Indicação','WhatsApp','Portal','Plantão'],data.source||'WhatsApp')}${selectField('stage','Etapa',['Novo','Contato','Visita','Proposta','Fechado'],data.stage||'Novo')}${selectField('broker','Responsável',brokers,data.broker||brokers[0])}${field('value','Valor potencial',data.value||'','number','min="0"')}${selectField('temp','Temperatura',['Frio','Morno','Quente'],data.temp||'Morno')}${field('created','Data de entrada',data.created||todayISO(),'date')}</form>`}
if(type==='client'){title=data.id?'Editar cliente':'Novo cliente';body=`<form id="modalForm" class="form-grid">${field('name','Nome / Razão social',data.name,'text','required')}${selectField('type','Perfil',['Comprador','Locatário','Proprietário','Investidor'],data.type||'Comprador')}${field('doc','CPF / CNPJ',data.doc,'text','required')}${field('phone','Telefone',data.phone,'tel','required')}${field('email','E-mail',data.email,'email')}${selectField('broker','Responsável',brokers,data.broker||brokers[0])}${field('last','Último contato',data.last||todayISO(),'date')}</form>`}
if(type==='appointment'){title=data.id?'Editar compromisso':'Novo compromisso';body=`<form id="modalForm" class="form-grid">${field('date','Data',data.date||todayISO(),'date','required')}${field('time','Hora',data.time||'09:00','time','required')}${selectField('type','Tipo',['Visita','Retorno','Reunião','Assinatura','Tarefa'],data.type||'Visita')}${field('title','Título',data.title,'text','required')}${field('client','Cliente',data.client,'text','required')}${selectField('broker','Responsável',brokers,data.broker||brokers[0])}${selectField('property','Imóvel',['',...db.properties.map(p=>p.id)],data.property||'')}</form>`}
if(type==='proposal'){title=data.id?'Editar proposta':'Nova proposta';body=`<form id="modalForm" class="form-grid">${field('id','Número',data.id||`P-2026-${String(43+db.proposals.length).padStart(3,'0')}`,'text','required')}${selectField('client','Cliente',db.clients.map(c=>c.name),data.client||db.clients[0]?.name||'')}${selectField('property','Imóvel',db.properties.map(p=>p.id),data.property||db.properties[0]?.id||'')}${selectField('type','Tipo',['Compra e Venda','Locação','Reserva'],data.type||'Compra e Venda')}${field('value','Valor',data.value||'','number','required min="0"')}${selectField('status','Status',['Rascunho','Enviada','Em análise','Aprovada','Recusada'],data.status||'Rascunho')}${field('date','Data',data.date||todayISO(),'date')}</form>`}
if(type==='finance'){title=data.id?'Editar lançamento':'Novo lançamento';body=`<form id="modalForm" class="form-grid">${field('desc','Descrição',data.desc,'text','required')}${selectField('category','Categoria',['Comissão','Administração','Receita','Despesa'],data.category||'Comissão')}${field('client','Cliente',data.client||'')}${field('due','Vencimento',data.due||todayISO(),'date')}${field('value','Valor',data.value||'','number','required min="0" step="0.01"')}${selectField('status','Status',['A receber','Recebido','Pago','Atrasado'],data.status||'A receber')}</form>`}
if(type==='user'){title=data.id?'Editar usuário':'Novo usuário';body=`<form id="modalForm" class="form-grid">${field('name','Nome',data.name,'text','required')}${selectField('role','Perfil',['Administrador','Gerente','Corretor','Corretora','Financeiro','Marketing'],data.role||'Corretor')}${field('email','E-mail',data.email,'email','required')}${field('phone','Telefone',data.phone,'tel')}${selectField('active','Status',['Ativo','Inativo'],data.active===false?'Inativo':'Ativo')}${field('closed','Fechamentos',data.closed||0,'number','min="0"')}${field('pipeline','Pipeline',data.pipeline||0,'number','min="0"')}</form>`}
showModal(title,body,'Salvar')}
function showModal(title,body,saveLabel){const modal=$('#modal');modal.classList.toggle('quick-create-modal',editing?.type==='quick');modal.innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="close" onclick="closeModal()">×</button></div><div class="modal-body">${body}</div>${saveLabel?`<div class="modal-foot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" type="button" id="modalSave" onclick="saveModal()">${saveLabel}</button></div>`:''}`;$('#modalBackdrop').classList.add('show')}
function closeModal(){$('#modalBackdrop').classList.remove('show');$('#modal')?.classList.remove('quick-create-modal');editing={type:null,id:null}}
$('#modalBackdrop').addEventListener('click',e=>{
  if(e.target!==e.currentTarget)return;
  /* V101: formulários/cadastros não fecham ao tocar fora. */
  if(editing?.type)return;
  closeModal();
});
function saveModal(){const form=$('#modalForm');if(!form.reportValidity())return;const type=editing.type,key=findType(type);let fd=Object.fromEntries(new FormData(form).entries());if(type==='prospecting'){fd={};const raw=new FormData(form);for(const [k,v] of raw.entries())fd[k]=v;form.querySelectorAll('input[type="checkbox"]').forEach(ch=>{fd[ch.name]=ch.checked?'on':''});}
if(['property','lead','finance','user','prospecting'].includes(type)){['price','beds','baths','area','value','closed','pipeline','entryValue','debtBalance','condoFee','landArea','builtArea','yearBuilt','garageCovered','garageUncovered','garageIndependent','bedrooms','suites','commission'].forEach(k=>{if(k in fd && fd[k]!=='' && !isNaN(fd[k]))fd[k]=Number(fd[k]||0)})}
if(type==='property')fd.featured=fd.featured==='Sim';if(type==='user')fd.active=fd.active==='Ativo';if(type==='lead'&&!editing.id)fd.id='L'+uid().slice(-6).toUpperCase();if(type==='prospecting'&&!editing.id)fd.id='PR'+uid().slice(-6).toUpperCase();if(type==='client'&&!editing.id)fd.id='C'+uid().slice(-6).toUpperCase();if(type==='appointment'&&!editing.id)fd.id='A'+uid().slice(-6).toUpperCase();if(type==='finance'&&!editing.id)fd.id='F'+uid().slice(-6).toUpperCase();if(type==='user'&&!editing.id)fd.id='U'+uid().slice(-6).toUpperCase();if(editing.id){const i=db[key].findIndex(x=>x.id===editing.id);if(i>=0)db[key][i]={...db[key][i],...fd}}else db[key].push(fd);pushActivity('＋','Registro atualizado',`${type} · ${fd.name||fd.ownerName||fd.propertyTitle||fd.title||fd.desc||fd.id}`);closeModal();saveDB();toast(type==='prospecting'?'Prospecção salva com sucesso.':'Dados salvos com sucesso.')}

function previewProposal(id){const p=db.proposals.find(x=>x.id===id),prop=db.properties.find(x=>x.id===p.property),client=db.clients.find(x=>x.name===p.client);const body=`<div class="contract-preview" id="printContract"><h2>PROPOSTA IMOBILIÁRIA</h2><p><b>${safe(db.settings.name)}</b><br>${safe(db.settings.cnpj)} · ${safe(db.settings.phone)}<br>${safe(db.settings.address)}</p><hr><p><b>Proposta:</b> ${safe(p.id)}<br><b>Cliente:</b> ${safe(p.client)}${client?` · ${safe(client.doc)}`:''}<br><b>Imóvel:</b> ${safe(prop?.title||p.property)}<br><b>Endereço:</b> ${safe(prop?.address||'-')}<br><b>Modalidade:</b> ${safe(p.type)}</p><p>Valor proposto: <b style="font-size:18px">${money(p.value)}</b></p><p>Esta proposta registra as condições comerciais apresentadas pelas partes e poderá ser convertida em contrato definitivo após aceite e validação documental.</p><div class="signs"><div class="signature">${safe(p.client)}<br>Cliente</div><div class="signature">${safe(db.settings.name)}<br>Imobiliária</div></div></div>`;showModal('Visualizar proposta',body,'');$('.modal-foot')?.remove();$('#modal').insertAdjacentHTML('beforeend',`<div class="modal-foot"><button class="btn" onclick="closeModal()">Fechar</button><button class="btn primary" onclick="printProposal('${id}')">⎙ Imprimir / PDF</button></div>`)}
function printProposal(id){const content=$('#printContract').outerHTML,w=window.open('','_blank');w.document.write(`<html><head><title>${id}</title><link rel="stylesheet" href="./css/20-styles.css">



<link rel="stylesheet" id="typography-v4" href="./css/21-typography-v4.css">
</head><body>${content}<script>window.onload=()=>window.print()<\/script>


</body></html>`);w.document.close()}

$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));$('#quickAddBtn').onclick=()=>openModal('quick');
['propertySearch','propertyTypeFilter','propertyPurposeFilter'].forEach(id=>$('#'+id).addEventListener('input',renderProperties));$('#clearPropertyFilters').onclick=()=>{$('#propertySearch').value='';$('#propertyTypeFilter').value='';$('#propertyPurposeFilter').value='';renderProperties()};['leadSearch','leadSourceFilter','leadStatusFilter'].forEach(id=>$('#'+id).addEventListener('input',renderLeads));['clientSearch','clientTypeFilter'].forEach(id=>$('#'+id).addEventListener('input',renderClients));
$('#globalSearch').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const q=e.target.value.trim().toLowerCase();if(!q)return;const prop=db.properties.find(p=>[p.id,p.title,p.address].join(' ').toLowerCase().includes(q));if(prop){navigate('imoveis');$('#propertySearch').value=e.target.value;renderProperties();return}const lead=db.leads.find(l=>[l.name,l.phone,l.email].join(' ').toLowerCase().includes(q));if(lead){navigate('leads');$('#leadSearch').value=e.target.value;renderLeads();return}const c=db.clients.find(c=>[c.name,c.phone,c.doc].join(' ').toLowerCase().includes(q));if(c){navigate('clientes');$('#clientSearch').value=e.target.value;renderClients();return}toast('Nenhum resultado encontrado.')});
$('#saveSettings').onclick=()=>{db.settings={...db.settings,name:$('#cfgName').value,cnpj:$('#cfgCnpj').value,phone:$('#cfgPhone').value,email:$('#cfgEmail').value,address:$('#cfgAddress').value};saveDB();toast('Configurações salvas.')};
function downloadBackup(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`backup-crm-imobiliaria-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href)}$('#backupBtn').onclick=downloadBackup;$('#exportBtn').onclick=downloadBackup;
$('#importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);saveDB();toast('Backup importado com sucesso.')}catch(err){alert('Arquivo de backup inválido.')}};r.readAsText(f)};
$('#resetBtn').onclick=()=>{if(confirm('Isso apagará todos os dados locais e restaurará o modelo inicial. Continuar?')){db=JSON.parse(JSON.stringify(defaultDB));saveDB();toast('Dados restaurados.')}};
$('#printReport').onclick=()=>window.print();$('#notificationBtn').onclick=()=>toast('Você não possui notificações pendentes.');

document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();$('#globalSearch').select()}if(e.key==='Escape'&&$('#modalBackdrop').classList.contains('show'))closeModal()});
window.addEventListener('resize',()=>{if($('#page-dashboard').classList.contains('active'))drawChart()});
window.editItem=editItem;window.deleteItem=deleteItem;window.openModal=openModal;window.closeModal=closeModal;window.saveModal=saveModal;window.previewProposal=previewProposal;window.printProposal=printProposal;

/* =========================================================
   NEXO V5 — business depth and connected modules
   ========================================================= */
function ensureV5Schema(){
  db.owners ||= [];
  db.contracts ||= [];
  db.commissions ||= [];
  db.timelines ||= [];
  db.clients ||= [];
  db.properties ||= [];
  db.prospectings ||= [];
  db.leads ||= [];
  db.appointments ||= [];
  db.proposals ||= [];
  db.finance ||= [];
  db.users ||= [];
  db.activities ||= [];
  db.tasks ||= [];
  db.siteEvents ||= [];
}

function renderV5Dashboard(){
  const available=db.properties.filter(p=>p.status==='Disponível');
  const portfolio=available.reduce((a,p)=>a+Number(p.price||0),0);
  const probs={Novo:.10,Contato:.25,Visita:.50,Proposta:.80,Fechado:1};
  const forecast=db.leads.reduce((a,l)=>a+Number(l.value||0)*(probs[l.stage]||0),0);
  const stalled=db.leads.filter(l=>l.stage!=='Fechado' && daysSince(l.created)>5).length;
  const conversion=db.leads.length?Math.round(db.leads.filter(l=>l.stage==='Fechado').length/db.leads.length*100):0;
  if($('#v5PortfolioVgv'))$('#v5PortfolioVgv').textContent=money(portfolio);
  if($('#v5Forecast'))$('#v5Forecast').textContent=money(forecast);
  if($('#v5Stalled'))$('#v5Stalled').textContent=stalled;
  if($('#v5Conversion'))$('#v5Conversion').textContent=conversion+'%';
  const alerts=[];
  const hot=db.leads.find(l=>l.temp==='Quente'&&l.stage!=='Fechado');
  if(hot)alerts.push({icon:'◎',title:`${hot.name} está quente`,text:`${hot.stage} · ${money(hot.value)} · próximo contato recomendado hoje`,action:`openTimeline('${escJS(hot.name)}')`,label:'Abrir'});
  const old=db.leads.filter(l=>l.stage!=='Fechado').sort((a,b)=>daysSince(b.created)-daysSince(a.created))[0];
  if(old)alerts.push({icon:'↻',title:'Oportunidade envelhecendo',text:`${old.name} está há ${daysSince(old.created)} dias no CRM`,action:`navigate('funil')`,label:'Funil'});
  const exp=db.contracts.find(c=>c.status!=='Concluído');
  if(exp)alerts.push({icon:'◇',title:'Documento em andamento',text:`${exp.id} · ${exp.status} · ${exp.client}`,action:`navigate('propostas')`,label:'Docs'});
  $('#v5SmartAlerts').innerHTML=alerts.slice(0,3).map(a=>`<div class="v5-alert"><div class="v5-alert-icon">${a.icon}</div><div><b>${safe(a.title)}</b><p>${safe(a.text)}</p></div><button class="btn small" onclick="${a.action}">${a.label}</button></div>`).join('');
}
function daysSince(date){if(!date)return 0;return Math.max(0,Math.floor((new Date(todayISO())-new Date(date+'T00:00:00'))/86400000))}
function escJS(v){return String(v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}

function matchScore(c,p){
  let score=0,why=[];
  if(c.desiredPurpose){if(p.purpose===c.desiredPurpose){score+=20;why.push('finalidade')} }else score+=10;
  if(c.desiredType){if(p.type===c.desiredType){score+=25;why.push('tipo')}else if(c.desiredType==='Apartamento'&&p.type==='Casa'){score+=4}}else score+=12;
  if(c.maxPrice){const ratio=Number(p.price||0)/Number(c.maxPrice);if(ratio<=1){score+=25;why.push('orçamento')}else if(ratio<=1.10){score+=10}}else score+=12;
  if(c.city){if(String(p.address).toLowerCase().includes(String(c.city).toLowerCase())){score+=15;why.push('localização')}}else score+=7;
  if(Number(c.minBeds||0)===0||Number(p.beds||0)>=Number(c.minBeds||0)){score+=10;if(c.minBeds)why.push('dormitórios')}
  if(Number(c.minArea||0)===0||Number(p.area||0)>=Number(c.minArea||0)){score+=5;if(c.minArea)why.push('metragem')}
  return {score:Math.min(100,score),why};
}
function renderMatch(){
  const sel=$('#matchClientSelect');if(!sel)return;
  const eligible=db.clients.filter(c=>c.type!=='Proprietário'&&(c.maxPrice||c.desiredType||c.type==='Comprador'||c.type==='Investidor'||c.type==='Locatário'));
  const current=sel.value||eligible[0]?.id||'';
  sel.innerHTML=eligible.map(c=>`<option value="${c.id}" ${c.id===current?'selected':''}>${safe(c.name)} · ${safe(c.type)}</option>`).join('');
  const c=eligible.find(x=>x.id===sel.value)||eligible[0];
  if(!c){$('#matchProfile').innerHTML='<div class="v5-empty">Cadastre um comprador ou locatário para gerar matches.</div>';$('#matchResults').innerHTML='';return}
  const prefs=[['Operação',c.desiredPurpose||'Qualquer'],['Tipo',c.desiredType||'Qualquer'],['Até',c.maxPrice?money(c.maxPrice):'Sem teto'],['Cidade',c.city||'Qualquer'],['Dormitórios',c.minBeds?`${c.minBeds}+`:'Livre'],['Metragem',c.minArea?`${c.minArea} m²+`:'Livre']];
  $('#matchProfile').innerHTML=`<span class="v5-kicker">PERFIL DE BUSCA</span><div class="v5-profile-head"><div class="avatar">${initials(c.name)}</div><div><h3>${safe(c.name)}</h3><p>${safe(c.type)} · ${safe(c.broker)}</p></div></div><div class="v5-pref-list">${prefs.map(x=>`<div class="v5-pref"><span>${x[0]}</span><b>${safe(x[1])}</b></div>`).join('')}</div><div class="v5-profile-actions"><button class="btn" onclick="openTimeline('${escJS(c.name)}')">Timeline</button><button class="btn" onclick="editItem('client','${c.id}')">Editar perfil</button></div>`;
  const results=db.properties.filter(p=>!['Vendido','Alugado','Inativo'].includes(p.status)).map(p=>({...matchScore(c,p),p})).sort((a,b)=>b.score-a.score);
  $('#matchResults').innerHTML=results.map(({p,score,why})=>`<article class="card v5-match-card"><div class="v5-match-image" style="background-image:url('${propertyImage(p)}')"><div class="v5-score">${score}%<small>match</small></div></div><div class="v5-match-copy"><span class="v5-kicker">${safe(p.id)} · ${safe(p.status)}</span><h3>${safe(p.title)}</h3><p>${safe(p.address)}</p><div class="v5-match-tags">${why.slice(0,4).map(w=>`<span>✓ ${safe(w)}</span>`).join('')}${score<55?'<span>△ revisar critérios</span>':''}</div><div class="v5-match-bottom"><div><span class="v5-kicker">VALOR</span><strong>${money(p.price)}</strong></div><div class="actions"><button class="btn small" onclick="shareMatch('${c.id}','${p.id}')">WhatsApp</button><button class="btn small primary" onclick="editItem('property','${p.id}')">Imóvel ↗</button></div></div></div></article>`).join('')||'<div class="v5-empty">Nenhum imóvel elegível.</div>';
}
function shareMatch(clientId,propertyId){const c=db.clients.find(x=>x.id===clientId),p=db.properties.find(x=>x.id===propertyId);if(!c||!p)return;const phone=String(c.phone||'').replace(/\D/g,'');const text=`Olá ${c.name.split(' ')[0]}, encontrei um imóvel que combina com seu perfil: ${p.title}, ${p.address}, por ${money(p.price)}. Posso te enviar mais detalhes?`;window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`,'_blank')}

function renderOwners(){const grid=$('#ownerGrid');if(!grid)return;const q=$('#ownerSearch')?.value.toLowerCase()||'',ex=$('#ownerExclusivityFilter')?.value||'';const list=db.owners.filter(o=>(!q||[o.name,o.doc,o.phone,o.email,db.properties.filter(p=>p.owner===o.name).map(p=>p.title).join(' ')].join(' ').toLowerCase().includes(q))&&(!ex||o.exclusivity===ex));grid.innerHTML=list.map(o=>{const props=db.properties.filter(p=>p.owner===o.name),vgv=props.reduce((a,p)=>a+Number(p.price||0),0);return `<article class="card v5-owner-card"><div class="v5-owner-top"><div class="avatar">${initials(o.name)}</div><div><h3>${safe(o.name)}</h3><p>${safe(o.doc)} · ${fmtPhone(o.phone)}</p></div><span class="status ${o.exclusivity==='Exclusivo'?'':'warn'}">${safe(o.exclusivity)}</span></div><div class="v5-owner-metrics"><div><span>Imóveis vinculados</span><strong>${props.length}</strong></div><div><span>Carteira anunciada</span><strong>${money(vgv)}</strong></div></div><div class="v5-owner-properties">${props.length?props.map(p=>`${p.id} · ${p.title}`).join('<br>'):'Nenhum imóvel vinculado'}</div><div class="v5-owner-actions"><button class="btn small" onclick="openOwnerPortfolio('${o.id}')">Carteira</button><button class="btn small" onclick="openTimeline('${escJS(o.name)}')">Histórico</button><button class="btn small" onclick="editItem('owner','${o.id}')">Editar</button></div></article>`}).join('')||'<div class="v5-empty">Nenhum proprietário encontrado.</div>'}
function openOwnerPortfolio(id){const o=db.owners.find(x=>x.id===id),props=db.properties.filter(p=>p.owner===o?.name);showModal('Carteira do proprietário',`<div style="display:grid;gap:9px">${props.map(p=>`<div class="mini-item"><div class="thumb" style="background-image:url('${propertyImage(p)}')"></div><div><b>${safe(p.title)}</b><small>${safe(p.address)}</small></div><div class="right"><b>${money(p.price)}</b><small>${safe(p.status)}</small></div></div>`).join('')||'<div class="v5-empty">Sem imóveis vinculados.</div>'}</div>`,'')}

function renderDocumentsV5(){
  if($('#documentStats')){const proposalV=db.proposals.reduce((a,p)=>a+Number(p.value||0),0),signed=db.contracts.filter(c=>['Assinatura','Concluído'].includes(c.status)).length,pending=db.contracts.filter(c=>c.status!=='Concluído').length;$('#documentStats').innerHTML=[["Propostas",db.proposals.length,'registros ativos'],['Valor proposto',money(proposalV),'soma das condições'],['Contratos em curso',pending,'documentação / assinatura'],['Assinados',signed,'formalizações avançadas']].map(x=>`<article class="card v5-doc-stat"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('')}
  if($('#contractTable'))$('#contractTable').innerHTML=db.contracts.map(c=>{const p=db.properties.find(x=>x.id===c.property);return `<tr><td><b>${safe(c.id)}</b></td><td>${safe(c.client)}</td><td>${safe(p?.title||c.property)}</td><td>${safe(c.type)}</td><td><b>${money(c.value)}</b></td><td><span class="status ${c.status==='Concluído'?'':c.status==='Assinatura'?'info':'warn'}">${safe(c.status)}</span></td><td>${safe(c.broker)}</td><td><div class="actions"><button class="btn small" onclick="previewContract('${c.id}')">Visualizar</button><button class="btn small" onclick="editItem('contract','${c.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('contract','${c.id}')">Excluir</button></div></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Nenhum contrato.</td></tr>'
}
function previewContract(id){const c=db.contracts.find(x=>x.id===id),p=db.properties.find(x=>x.id===c.property);const body=`<div class="contract-preview"><span class="v5-kicker">${safe(c.id)}</span><h2 style="text-align:left">Contrato · ${safe(c.type)}</h2><p><b>Cliente:</b> ${safe(c.client)}<br><b>Imóvel:</b> ${safe(p?.title||c.property)}<br><b>Endereço:</b> ${safe(p?.address||'-')}<br><b>Valor:</b> ${money(c.value)}<br><b>Etapa atual:</b> ${safe(c.status)}<br><b>Responsável:</b> ${safe(c.broker)}</p><div class="v5-pref-list"><div class="v5-pref"><span>Cadastro</span><b>✓ validado</b></div><div class="v5-pref"><span>Documentação</span><b>${c.status==='Documentação'?'em análise':'✓ revisada'}</b></div><div class="v5-pref"><span>Assinatura</span><b>${['Assinatura','Concluído'].includes(c.status)?'pronta / realizada':'pendente'}</b></div></div></div>`;showModal('Contrato e checklist',body,'')}

function renderCommissions(){
  if(!$('#commissionTable'))return;const total=db.commissions.reduce((a,c)=>a+Number(c.value||0),0),pending=db.commissions.filter(c=>c.status!=='Pago').reduce((a,c)=>a+Number(c.value||0),0),paid=db.commissions.filter(c=>c.status==='Pago').reduce((a,c)=>a+Number(c.value||0),0);const brokers=new Set(db.commissions.map(c=>c.broker)).size;
  $('#commissionSummary').innerHTML=[["Comissões geradas",money(total),'total calculado'],['A pagar',money(pending),'pendente / prevista'],['Pagas',money(paid),'liquidadas'],['Corretores',brokers,'com participação']].map(x=>`<article class="card v5-commission-stat"><span>${String(x[0]).replace('",','')}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
  $('#commissionTable').innerHTML=db.commissions.map(c=>{const p=db.properties.find(x=>x.id===c.property);return `<tr><td><b>${safe(c.deal)}</b></td><td>${safe(p?.title||c.property)}</td><td>${safe(c.broker)}</td><td>${money(c.gross)}</td><td>${Number(c.rate||0)}%</td><td><b>${money(c.value)}</b></td><td><span class="status ${c.status==='Pago'?'':c.status==='Pendente'?'warn':'info'}">${safe(c.status)}</span></td><td><div class="actions"><button class="btn small" onclick="editItem('commission','${c.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('commission','${c.id}')">Excluir</button></div></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Sem comissões.</td></tr>'
}

function openTimeline(person){
  const client=db.clients.find(c=>c.name===person),lead=db.leads.find(l=>l.name===person),owner=db.owners.find(o=>o.name===person);const phone=client?.phone||lead?.phone||owner?.phone||'';const broker=client?.broker||lead?.broker||owner?.broker||'-';
  const events=[...(db.timelines||[]).filter(t=>t.person===person)];
  db.appointments.filter(a=>a.client===person).forEach(a=>events.push({date:a.date,time:a.time,type:a.type,title:a.title,text:`Compromisso com ${a.broker}`}));
  db.proposals.filter(p=>p.client===person).forEach(p=>events.push({date:p.date,time:'12:00',type:'Proposta',title:`${p.id} · ${p.status}`,text:`${p.type} no valor de ${money(p.value)}`}));
  db.contracts.filter(c=>c.client===person).forEach(c=>events.push({date:c.start,time:'12:00',type:'Contrato',title:`${c.id} · ${c.status}`,text:`${c.type} · ${money(c.value)}`}));
  events.sort((a,b)=>String(b.date+b.time).localeCompare(String(a.date+a.time)));
  const proposalTotal=db.proposals.filter(p=>p.client===person).reduce((a,p)=>a+Number(p.value||0),0);const visits=db.appointments.filter(a=>a.client===person&&a.type==='Visita').length;
  const body=`<div class="v5-timeline-head"><div class="v5-person-card"><div class="avatar">${initials(person)}</div><div><h3>${safe(person)}</h3><p>${fmtPhone(phone)} · ${safe(broker)}</p></div></div><div class="v5-mini-stat"><span>Interações</span><b>${events.length}</b></div><div class="v5-mini-stat"><span>Visitas</span><b>${visits}</b></div><div class="v5-mini-stat"><span>Propostas</span><b>${money(proposalTotal)}</b></div></div><div class="v5-timeline-actions"><button class="btn primary" onclick="quickTimelineAction('${escJS(person)}','Contato')">＋ Registrar contato</button>${phone?`<button class="btn" onclick="window.open('https://wa.me/55${String(phone).replace(/\D/g,'')}','_blank')">WhatsApp ↗</button>`:''}<button class="btn" onclick="openModal('appointment',{client:'${escJS(person)}'})">Agendar</button></div><div class="v5-timeline">${events.map(e=>`<div class="v5-time-item"><time>${brDate(e.date)} · ${safe(e.time||'')}</time><b>${safe(e.title)}</b><p>${safe(e.type)} · ${safe(e.text||'')}</p></div>`).join('')||'<div class="v5-empty">Nenhuma interação registrada.</div>'}</div>`;
  showModal('Timeline 360°',body,'')
}
function quickTimelineAction(person,type){const text=prompt('Resumo do contato / observação:');if(!text)return;db.timelines.push({id:'T'+uid().slice(-6).toUpperCase(),person,date:todayISO(),time:new Date().toTimeString().slice(0,5),type,title:'Contato registrado',text});saveDB();openTimeline(person);toast('Interação adicionada à timeline.')}

// Upgrade clients/leads with 360º actions, preserving filters
const v4RenderClients=renderClients;
renderClients=function(){const q=$('#clientSearch')?.value.toLowerCase()||'',t=$('#clientTypeFilter')?.value||'';const list=db.clients.filter(c=>(!q||[c.name,c.doc,c.phone,c.email].join(' ').toLowerCase().includes(q))&&(!t||c.type===t));$('#clientTable').innerHTML=list.map(c=>`<tr><td><div class="row-avatar"><div class="avatar">${initials(c.name)}</div><div><b>${safe(c.name)}</b><small style="display:block;color:var(--muted)">${safe(c.email)}</small></div></div></td><td><span class="status info">${safe(c.type)}</span></td><td>${safe(c.doc)}</td><td>${fmtPhone(c.phone)}</td><td>${brDate(c.last)}</td><td>${safe(c.broker)}</td><td><div class="actions"><button class="btn small" onclick="openTimeline('${escJS(c.name)}')">360°</button>${c.maxPrice?`<button class="btn small" onclick="openMatchFor('${c.id}')">Match</button>`:''}<button class="btn small" onclick="editItem('client','${c.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('client','${c.id}')">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nenhum cliente encontrado.</td></tr>'}
renderLeads=function(){const q=$('#leadSearch')?.value.toLowerCase()||'',src=$('#leadSourceFilter')?.value||'',st=$('#leadStatusFilter')?.value||'';const list=db.leads.filter(l=>(!q||[l.name,l.phone,l.email,l.interest].join(' ').toLowerCase().includes(q))&&(!src||l.source===src)&&(!st||l.stage===st));$('#leadTable').innerHTML=list.map(l=>`<tr><td><div class="row-avatar"><div class="avatar">${initials(l.name)}</div><div><b>${safe(l.name)}</b><small style="display:block;color:var(--muted)">${fmtPhone(l.phone)}</small></div></div></td><td>${safe(l.interest)}</td><td>${safe(l.source)}</td><td><span class="status ${stageClass(l.stage)}">${safe(l.stage)}</span></td><td>${safe(l.broker)}</td><td><b>${money(l.value)}</b></td><td><div class="actions"><button class="btn small" onclick="openTimeline('${escJS(l.name)}')">360°</button><button class="btn small" onclick="editItem('lead','${l.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('lead','${l.id}')">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nenhum lead encontrado.</td></tr>'}
function openMatchFor(id){navigate('match');setTimeout(()=>{if($('#matchClientSelect')){$('#matchClientSelect').value=id;renderMatch()}},20)}

// Extend modal and persistence with the new record types
const v4FindType=findType;
findType=function(type){return ({owner:'owners',contract:'contracts',commission:'commissions',...{property:'properties',lead:'leads',client:'clients',appointment:'appointments',proposal:'proposals',finance:'finance',user:'users'}})[type]||v4FindType(type)};
const v4OpenModal=openModal;
openModal=function(type,data={}){
  if(!['owner','contract','commission'].includes(type)){v4OpenModal(type,data);if(type==='client'&&$('#modalForm')){const form=$('#modalForm');form.insertAdjacentHTML('beforeend',`${selectField('desiredPurpose','Operação desejada',['','Venda','Locação'],data.desiredPurpose||'')}${selectField('desiredType','Tipo desejado',['','Apartamento','Casa','Terreno','Comercial','Rural'],data.desiredType||'')}${field('maxPrice','Teto de investimento',data.maxPrice||'','number','min="0"')}${field('city','Cidade desejada',data.city||'')}${field('minBeds','Mínimo de dormitórios',data.minBeds||0,'number','min="0"')}${field('minArea','Metragem mínima',data.minArea||0,'number','min="0"')}`)}return}
  editing={type,id:data.id||null};const brokers=db.users.filter(u=>u.active).map(u=>u.name);let title='',body='';
  if(type==='owner'){title=data.id?'Editar proprietário':'Novo proprietário';body=`<form id="modalForm" class="form-grid">${field('name','Nome / razão social',data.name,'text','required')}${field('doc','CPF / CNPJ',data.doc,'text','required')}${field('phone','Telefone',data.phone,'tel','required')}${field('email','E-mail',data.email,'email')}${selectField('broker','Captador responsável',brokers,data.broker||brokers[0])}${selectField('exclusivity','Captação',['Exclusivo','Não exclusivo'],data.exclusivity||'Exclusivo')}${field('capture','Data da captação',data.capture||todayISO(),'date')}${field('bank','Dados bancários',data.bank||'')}<div class="form-group full"><label>Observações</label><textarea class="form-control" name="notes">${safe(data.notes||'')}</textarea></div></form>`}
  if(type==='contract'){title=data.id?'Editar contrato':'Novo contrato';body=`<form id="modalForm" class="form-grid">${field('id','Número',data.id||`CT-2026-${String(db.contracts.length+14).padStart(3,'0')}`,'text','required')}${selectField('client','Cliente',db.clients.map(c=>c.name),data.client||db.clients[0]?.name||'')}${selectField('property','Imóvel',db.properties.map(p=>p.id),data.property||db.properties[0]?.id||'')}${selectField('type','Tipo',['Compra e Venda','Locação','Administração','Exclusividade'],data.type||'Compra e Venda')}${field('value','Valor do negócio',data.value||'','number','required min="0"')}${selectField('status','Etapa',['Minuta','Documentação','Assinatura','Concluído','Cancelado'],data.status||'Minuta')}${field('start','Data',data.start||todayISO(),'date')}${selectField('broker','Responsável',brokers,data.broker||brokers[0])}</form>`}
  if(type==='commission'){title=data.id?'Editar comissão':'Nova comissão';body=`<form id="modalForm" class="form-grid">${field('deal','Negócio / proposta',data.deal||'','text','required')}${selectField('property','Imóvel',db.properties.map(p=>p.id),data.property||db.properties[0]?.id||'')}${selectField('broker','Corretor',brokers,data.broker||brokers[0])}${field('gross','Comissão base',data.gross||'','number','required min="0"')}${field('rate','Repasse (%)',data.rate||50,'number','required min="0" max="100"')}${field('value','Valor do repasse',data.value||'','number','required min="0"')}${selectField('status','Status',['Prevista','Pendente','Pago'],data.status||'Prevista')}${field('due','Vencimento',data.due||todayISO(),'date')}</form>`}
  showModal(title,body,'Salvar')
};
const v4SaveModal=saveModal;
saveModal=function(){
  if(!['owner','contract','commission'].includes(editing.type)){const form=$('#modalForm');if(form&&editing.type==='client'){if(!form.reportValidity())return;const fd=Object.fromEntries(new FormData(form).entries());['maxPrice','minBeds','minArea'].forEach(k=>fd[k]=Number(fd[k]||0));const id=editing.id;if(id){const i=db.clients.findIndex(x=>x.id===id);db.clients[i]={...db.clients[i],...fd};pushActivity('○','Perfil atualizado',fd.name);closeModal();saveDB();toast('Perfil e preferências salvos.');return}else{fd.id='C'+uid().slice(-6).toUpperCase();db.clients.push(fd);pushActivity('○','Novo cliente',fd.name);closeModal();saveDB();toast('Cliente cadastrado com perfil de busca.');return}}return v4SaveModal()}
  const form=$('#modalForm');if(!form.reportValidity())return;const fd=Object.fromEntries(new FormData(form).entries()),type=editing.type,key=findType(type);if(type==='contract')fd.value=Number(fd.value||0);if(type==='commission'){['gross','rate','value'].forEach(k=>fd[k]=Number(fd[k]||0));if(!fd.value)fd.value=fd.gross*fd.rate/100}if(type==='owner'&&!editing.id)fd.id='O'+uid().slice(-6).toUpperCase();if(type==='commission'&&!editing.id)fd.id='COM'+uid().slice(-6).toUpperCase();if(editing.id){const i=db[key].findIndex(x=>x.id===editing.id);if(i>=0)db[key][i]={...db[key][i],...fd}}else db[key].push(fd);pushActivity('＋','Registro atualizado',`${type} · ${fd.name||fd.id||fd.deal}`);closeModal();saveDB();toast('Dados salvos com sucesso.')
};

// New render cycle: old modules + connected V5 modules
const v4RenderAll=renderAll;
renderAll=function(){ensureV5Schema();if(typeof ensurePropertyMediaSchema==='function')ensurePropertyMediaSchema();v4RenderAll();renderV5Dashboard();renderMatch();renderOwners();renderDocumentsV5();renderCommissions()};

// New page controls
$('#matchClientSelect')?.addEventListener('change',renderMatch);
$('#ownerSearch')?.addEventListener('input',renderOwners);
$('#ownerExclusivityFilter')?.addEventListener('input',renderOwners);


// V6 · Property detail workspace, editable data and room photo gallery
function ensurePropertyMediaSchema(){
  db.properties ||= [];
  db.properties.forEach(p=>{
    if(!Array.isArray(p.photos))p.photos=[];
    if(!Array.isArray(p.videos))p.videos=[];
    if(p.coverPhoto===undefined)p.coverPhoto='';
    if(p.videoFeaturedId===undefined)p.videoFeaturedId='';
    if(p.tour360Url===undefined)p.tour360Url='';
  });
}
const v5FallbackPropertyImage=propertyImage;
propertyImage=function(p){
  if(!p)return'';
  const photos=Array.isArray(p.photos)?p.photos:[];
  const cover=photos.find(x=>x.id===p.coverPhoto)||photos[0];
  return cover?.src||p.image||v5FallbackPropertyImage(p);
};
function propertyPhotos(p){
  const photos=Array.isArray(p?.photos)?p.photos:[];
  return photos.length?photos:[{id:'fallback',room:'Capa',src:v5FallbackPropertyImage(p),name:'Imagem principal'}];
}
function propertyRoomOptions(selected=''){
  const options=['Fachada','Sala de estar','Sala de jantar','Cozinha','Suíte','Dormitório','Banheiro','Lavabo','Área gourmet','Área externa','Piscina','Garagem','Varanda','Home office','Condomínio','Vista','Outro'];
  return options.map(x=>`<option ${x===selected?'selected':''}>${safe(x)}</option>`).join('');
}
renderProperties=function(){
  const q=$('#propertySearch')?.value.toLowerCase()||'',typ=$('#propertyTypeFilter')?.value||'',pur=$('#propertyPurposeFilter')?.value||'';
  const list=db.properties.filter(p=>(!q||[p.id,p.title,p.address,p.owner].join(' ').toLowerCase().includes(q))&&(!typ||p.type===typ)&&(!pur||p.purpose===pur));
  $('#propertyGrid').innerHTML=list.map(p=>`<article class="card property-card"><div class="property-cover" role="button" tabindex="0" aria-label="Abrir ficha de ${safe(p.title)}" onclick="openPropertyDetails('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPropertyDetails('${p.id}')}" style="background-image:linear-gradient(0deg,rgba(7,27,24,.06),rgba(7,27,24,.02)),url('${propertyImage(p)}')"><span class="property-tag">${safe(p.type)} · ${safe(p.purpose)}</span><span class="property-status" style="background:${p.status==='Disponível'?'var(--success)':p.status==='Reservado'?'var(--warning)':'var(--info)'}">${safe(p.status)}</span><span class="property-code">${safe(p.id)}</span><span class="property-open-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/></svg> Abrir ficha · ${propertyPhotos(p).length} fotos${(p.videos||[]).length?` · ${(p.videos||[]).length} vídeos`:''}</span></div><div class="property-content"><h3>${safe(p.title)}</h3><div class="address">${safe(p.address)}</div><div class="specs"><span>▱ ${p.area||0} m²</span>${p.beds?`<span>▣ ${p.beds} quartos</span>`:''}${p.baths?`<span>◫ ${p.baths} banheiros</span>`:''}${p.parking?`<span>▥ ${p.parking} vagas</span>`:''}</div><div class="price-row"><div><strong>${money(p.price)}</strong><small style="display:block;color:var(--muted);font-size:9px">${safe(p.purpose==='Locação'?'por mês':'valor anunciado')}</small></div><div class="actions"><button class="btn small" onclick="openPropertyDetails('${p.id}')">Ficha</button><button class="btn small" onclick="event.stopPropagation();openPropertyDetails('${p.id}','media')">Vídeos</button><button class="btn small" onclick="event.stopPropagation();editItem('property','${p.id}')">Editar</button><button class="btn small danger" onclick="event.stopPropagation();deleteItem('property','${p.id}')">Excluir</button></div></div></div></article>`).join('')||'<div class="card empty" style="grid-column:1/-1">Nenhum imóvel encontrado.</div>';
};
function getPropertyHistory(p){
  const events=[];
  db.appointments.filter(a=>a.property===p.id).forEach(a=>events.push({date:a.date,type:a.type,title:a.title,text:`${a.client} · ${a.broker}`}));
  db.proposals.filter(x=>x.property===p.id).forEach(x=>events.push({date:x.date,type:'Proposta',title:`${x.id} · ${x.status}`,text:`${x.client} · ${money(x.value)}`}));
  (db.contracts||[]).filter(x=>x.property===p.id).forEach(x=>events.push({date:x.start,type:'Contrato',title:`${x.id} · ${x.status}`,text:`${x.client} · ${money(x.value)}`}));
  events.push({date:p.capture||'2026-08-01',type:'Cadastro',title:'Imóvel incluído na carteira',text:`Proprietário: ${p.owner||'-'}`});
  return events.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function openPropertyDetails(id,tab='overview',photoId=''){
  const p=db.properties.find(x=>x.id===id);if(!p)return;
  const photos=propertyPhotos(p),selected=photos.find(x=>x.id===photoId)||photos.find(x=>x.id===p.coverPhoto)||photos[0];
  const owner=(db.owners||[]).find(o=>o.name===p.owner),features=String(p.amenities||'').split(',').map(x=>x.trim()).filter(Boolean),history=getPropertyHistory(p);
  const data=[['Código',p.id],['Tipo',p.type],['Finalidade',p.purpose],['Status',p.status],['Proprietário',p.owner||'-'],['Ano',p.year||'-'],['Andar / pavimentos',p.floor||'-'],['Condomínio',Number(p.condo)?money(p.condo):'—'],['IPTU anual',Number(p.iptu)?money(p.iptu):'—'],['Cidade',p.city||String(p.address||'').split(',').slice(-2,-1)[0]?.trim()||'-'],['Estado',p.state||((String(p.address||'').match(/-\s*([A-Z]{2})\s*$/)||[])[1])||'-']];
  const body=`<div class="property-workspace" data-property="${p.id}">
    <div class="pw-hero"><div class="pw-gallery"><div class="pw-main-photo" id="pwMainPhoto" style="background-image:url('${selected.src}')"></div><span class="pw-photo-counter" id="pwPhotoCounter">${photos.findIndex(x=>x.id===selected.id)+1} / ${photos.length} fotos</span><span class="pw-photo-room" id="pwPhotoRoom">${safe(selected.room||'Foto')}</span></div><div class="pw-summary"><div class="pw-summary-top"><div><span class="pw-kicker">${safe(p.id)} · ${safe(p.type)} · ${safe(p.purpose)}</span><h2>${safe(p.title)}</h2></div><div class="pw-address">${safe(p.address)}</div><div class="pw-price"><strong>${money(p.price)}</strong><small>${p.purpose==='Locação'?'valor mensal anunciado':'valor de comercialização'}</small></div><div><span class="status ${p.status==='Reservado'?'warn':p.status==='Disponível'?'':'info'}">${safe(p.status)}</span></div></div><div class="pw-summary-actions"><button class="btn primary" onclick="editPropertyFromDetails('${p.id}')">Editar informações</button><button class="btn" onclick="switchPropertyTab('gallery')">＋ Fotos</button></div></div></div>
    <div class="pw-spec-grid"><div class="pw-spec"><span>Área privativa</span><b>${Number(p.area||0).toLocaleString('pt-BR')} m²</b></div><div class="pw-spec"><span>Dormitórios / suítes</span><b>${p.beds||0} / ${p.suites||0}</b></div><div class="pw-spec"><span>Banheiros</span><b>${p.baths||0}</b></div><div class="pw-spec"><span>Vagas</span><b>${p.parking||0}</b></div></div>
    <div class="pw-tabs"><button class="pw-tab ${tab==='overview'?'active':''}" data-pw-tab="overview" onclick="switchPropertyTab('overview')">Visão geral</button><button class="pw-tab ${tab==='details'?'active':''}" data-pw-tab="details" onclick="switchPropertyTab('details')">Ficha técnica</button><button class="pw-tab ${tab==='gallery'?'active':''}" data-pw-tab="gallery" onclick="switchPropertyTab('gallery')">Galeria <span style="opacity:.55">${photos.length}</span></button><button class="pw-tab ${tab==='media'?'active':''}" data-pw-tab="media" onclick="switchPropertyTab('media')">Vídeos <span style="opacity:.55">${(p.videos||[]).length}</span></button><button class="pw-tab ${tab==='history'?'active':''}" data-pw-tab="history" onclick="switchPropertyTab('history')">Histórico</button></div>
    <div class="pw-panel ${tab==='overview'?'active':''}" data-pw-panel="overview"><div class="pw-overview-grid"><div><section class="pw-section"><h3>Sobre o imóvel</h3><p>${safe(p.notes||'Sem descrição cadastrada para este imóvel.')}</p></section><section class="pw-section"><h3>Diferenciais</h3><div class="pw-chips">${features.length?features.map(x=>`<span class="pw-chip">✓ ${safe(x)}</span>`).join(''):'<span style="font-size:9px;color:var(--muted)">Nenhum diferencial cadastrado.</span>'}</div></section></div><aside><section class="pw-section"><h3>Proprietário</h3><div class="pw-owner"><div class="avatar">${initials(p.owner)}</div><div><b>${safe(p.owner||'Não informado')}</b><small>${owner?`${fmtPhone(owner.phone)} · ${safe(owner.exclusivity)}`:'Vínculo cadastrado no imóvel'}</small></div>${owner?`<button class="btn small" onclick="openTimeline('${escJS(owner.name)}')">360°</button>`:''}</div></section><section class="pw-section"><h3>Condições</h3><div class="pw-data-grid">${[['Condomínio',Number(p.condo)?money(p.condo):'—'],['IPTU',Number(p.iptu)?money(p.iptu):'—'],['Ano',p.year||'—'],['Andar',p.floor||'—']].map(x=>`<div class="pw-data"><span>${x[0]}</span><b>${safe(x[1])}</b></div>`).join('')}</div></section></aside></div></div>
    <div class="pw-panel ${tab==='details'?'active':''}" data-pw-panel="details"><div class="pw-edit-note">Você pode alterar qualquer um desses dados pelo botão <b>Editar informações</b>. As fotos permanecem vinculadas ao imóvel durante a edição.</div><div class="pw-data-grid">${data.map(x=>`<div class="pw-data"><span>${x[0]}</span><b>${safe(x[1])}</b></div>`).join('')}</div>${p.landArea?`<div style="margin-top:14px" class="pw-data-grid"><div class="pw-data"><span>Área do terreno</span><b>${Number(p.landArea).toLocaleString('pt-BR')} m²</b></div><div class="pw-data"><span>Área construída</span><b>${Number(p.area||0).toLocaleString('pt-BR')} m²</b></div></div>`:''}</div>
    <div class="pw-panel ${tab==='gallery'?'active':''}" data-pw-panel="gallery"><div class="pw-gallery-toolbar"><div><label for="photoRoomType">Ambiente das novas fotos</label><select id="photoRoomType" class="form-control">${propertyRoomOptions()}</select></div><div><label for="propertyPhotoInput">Selecionar uma ou várias imagens</label><input id="propertyPhotoInput" class="pw-file" type="file" accept="image/*" multiple></div><button class="btn primary" type="button" onclick="addPropertyPhotos('${p.id}',this)">Adicionar à galeria</button></div><div class="pw-gallery-grid">${photos.map(ph=>`<article class="pw-photo-card"><div class="pw-photo-img" style="background-image:url('${ph.src}')" onclick="previewPropertyPhoto('${p.id}','${ph.id}')">${p.coverPhoto===ph.id?'<span class="pw-cover-badge">★ Capa do anúncio</span>':''}</div><div class="pw-photo-meta"><b>${safe(ph.room||'Foto')}</b><small>${safe(ph.name||'Imagem do imóvel')}</small></div><div class="pw-photo-actions">${p.coverPhoto!==ph.id?`<button class="btn" onclick="setPropertyCover('${p.id}','${ph.id}')">Definir capa</button>`:''}<button class="btn" onclick="renamePropertyPhoto('${p.id}','${ph.id}')">Renomear</button>${photos.length>1?`<button class="btn danger" onclick="removePropertyPhoto('${p.id}','${ph.id}')">Excluir</button>`:''}</div></article>`).join('')}</div></div>
    <div class="pw-panel ${tab==='media'?'active':''}" data-pw-panel="media">
      <p class="pw-media-note">Cadastre apenas links. O CRM não armazena o arquivo de vídeo, mantendo o sistema leve. YouTube, Vimeo e arquivos MP4 por URL são suportados no site.</p>
      <div class="pw-media-toolbar">
        <div class="form-group"><label>Título</label><input id="propertyVideoTitle" class="form-control" placeholder="Ex.: Tour completo"></div>
        <div class="form-group"><label>URL do vídeo</label><input id="propertyVideoUrl" class="form-control" placeholder="YouTube, Vimeo ou MP4"></div>
        <div class="form-group"><label>URL da capa / thumbnail</label><input id="propertyVideoThumb" class="form-control" placeholder="Opcional"></div>
        <button class="btn primary" type="button" onclick="addPropertyVideo('${p.id}')">＋ Adicionar vídeo</button>
      </div>
      <div class="pw-media-list">${(p.videos||[]).length?(p.videos||[]).map(v=>`<article class="pw-video-card"><div class="pw-video-thumb" style="background-image:url('${safe(propertyVideoThumb(p,v))}')"></div><div class="pw-video-meta"><b>${safe(v.title||'Vídeo do imóvel')}</b><small>${safe(v.url||'')}</small></div><div class="pw-video-actions">${p.videoFeaturedId!==v.id?`<button class="btn" type="button" onclick="setPropertyFeaturedVideo('${p.id}','${v.id}')">Destacar</button>`:`<button class="btn" type="button" disabled>★ Destaque</button>`}<button class="btn danger" type="button" onclick="removePropertyVideo('${p.id}','${v.id}')">Excluir</button></div></article>`).join(''):'<div class="pw-media-empty">Nenhum vídeo cadastrado neste imóvel.</div>'}</div>
      <div class="pw-tour-box"><div><label>Tour 360° / visita virtual</label><input id="propertyTour360Url" class="form-control" value="${safe(p.tour360Url||'')}" placeholder="Cole o link do tour 360°"></div><button class="btn primary" type="button" onclick="savePropertyTour360('${p.id}')">Salvar tour 360°</button></div>
    </div>
    <div class="pw-panel ${tab==='history'?'active':''}" data-pw-panel="history"><div class="pw-history">${history.map(e=>`<div class="pw-history-item"><time>${brDate(e.date)} · ${safe(e.type)}</time><b>${safe(e.title)}</b><p>${safe(e.text)}</p></div>`).join('')}</div></div>
  </div>`;
  showModal('Ficha do imóvel',body,'');
  $('#modal').classList.add('property-detail-shell');
}
function switchPropertyTab(tab){
  document.querySelectorAll('[data-pw-tab]').forEach(x=>x.classList.toggle('active',x.dataset.pwTab===tab));
  document.querySelectorAll('[data-pw-panel]').forEach(x=>x.classList.toggle('active',x.dataset.pwPanel===tab));
}
function previewPropertyPhoto(propertyId,photoId){
  const p=db.properties.find(x=>x.id===propertyId),photos=propertyPhotos(p),ph=photos.find(x=>x.id===photoId);if(!ph)return;
  const idx=photos.findIndex(x=>x.id===photoId);$('#pwMainPhoto').style.backgroundImage=`url('${ph.src}')`;$('#pwPhotoCounter').textContent=`${idx+1} / ${photos.length} fotos`;$('#pwPhotoRoom').textContent=ph.room||'Foto';
  const modal=$('#modal');if(modal)modal.scrollTo({top:0,behavior:'smooth'});
}
function editPropertyFromDetails(id){const p=db.properties.find(x=>x.id===id);if(p)openModal('property',p)}
function setPropertyCover(propertyId,photoId){const p=db.properties.find(x=>x.id===propertyId);if(!p)return;p.coverPhoto=photoId;saveDB();openPropertyDetails(propertyId,'gallery',photoId);toast('Foto definida como capa.')}
function renamePropertyPhoto(propertyId,photoId){const p=db.properties.find(x=>x.id===propertyId),ph=p?.photos?.find(x=>x.id===photoId);if(!ph)return;const room=prompt('Nome do ambiente / cômodo:',ph.room||'Foto');if(room===null)return;const caption=prompt('Legenda da foto:',ph.name||'') ;ph.room=room.trim()||'Foto';if(caption!==null)ph.name=caption.trim();saveDB();openPropertyDetails(propertyId,'gallery',photoId);toast('Foto atualizada.')}
function removePropertyPhoto(propertyId,photoId){const p=db.properties.find(x=>x.id===propertyId);if(!p||!Array.isArray(p.photos)||p.photos.length<=1)return;if(!confirm('Excluir esta foto da galeria?'))return;p.photos=p.photos.filter(x=>x.id!==photoId);if(p.coverPhoto===photoId)p.coverPhoto=p.photos[0]?.id||'';saveDB();openPropertyDetails(propertyId,'gallery');toast('Foto removida.')}
function compressPropertyImage(file){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight,max=1600;if(w>max||h>max){const r=Math.min(max/w,max/h);w=Math.round(w*r);h=Math.round(h*r)}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',.78))};img.src=reader.result};reader.readAsDataURL(file)});
}
async function addPropertyPhotos(propertyId,btn){
  const p=db.properties.find(x=>x.id===propertyId),input=$('#propertyPhotoInput'),room=$('#photoRoomType')?.value||'Outro';if(!p||!input?.files?.length){toast('Selecione pelo menos uma foto.');return}
  const files=[...input.files];if(btn){btn.disabled=true;btn.textContent='Processando…'}
  try{const additions=[];for(const file of files){const processed=await compressPropertyImage(file);if(!window.AGDriveGateway?.configured?.())throw new Error('Configure o Google Drive via Apps Script em Ajustes antes de enviar fotos.');const stored=await window.AGDriveGateway.uploadImageData(processed,{propertyId,fileName:file.name,room});additions.push({id:'PH'+uid().slice(-8).toUpperCase(),room,src:stored.url,driveFileId:stored.fileId||'',driveWebViewLink:stored.webViewLink||'',name:file.name.replace(/\.[^.]+$/,''),created:todayISO(),watermarked:true,watermark:'AG',storage:'google-drive'})}p.photos=[...(p.photos||[]),...additions];if(!p.coverPhoto&&p.photos[0])p.coverPhoto=p.photos[0].id;try{localStorage.setItem('atlasImobCRM',JSON.stringify(db))}catch(e){p.photos=p.photos.filter(x=>!additions.some(a=>a.id===x.id));toast('Não foi possível atualizar o cache local.');return}saveDB();renderAll();openPropertyDetails(propertyId,'gallery',additions[0]?.id);toast(`${additions.length} ${additions.length===1?'foto enviada':'fotos enviadas'} ao Google Drive.`)}catch(e){console.error(e);toast(e?.message||'Não foi possível processar ou enviar uma das imagens ao Google Drive.')}finally{if(btn){btn.disabled=false;btn.textContent='Adicionar à galeria'}}
}
// Wider property editor with technical and commercial data
const v6OpenModalBase=openModal;
openModal=function(type,data={}){
  if(type!=='property')return v6OpenModalBase(type,data);
  editing={type:'property',id:data.id||null};
  const ownerNames=[...new Set([...(db.owners||[]).map(o=>o.name),...db.properties.map(p=>p.owner).filter(Boolean)])];
  const title=data.id?'Editar imóvel':'Cadastrar imóvel';
  const body=`<form id="modalForm" class="form-grid">${field('id','Código',data.id||`IM${String(db.properties.length+1).padStart(3,'0')}`,'text','required')}${field('title','Título do imóvel',data.title,'text','required')}${selectField('type','Tipo',['Apartamento','Casa','Terreno','Comercial','Rural'],data.type||'Apartamento')}${selectField('purpose','Finalidade',['Venda','Locação'],data.purpose||'Venda')}${field('price','Valor',data.price||'','number','required min="0" step="0.01"')}${selectField('status','Status',['Disponível','Reservado','Vendido','Alugado','Inativo'],data.status||'Disponível')}${field('address','Endereço completo',data.address,'text','full required')}${field('city','Cidade',data.city||'')}${selectField('state','Estado / UF',['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'],data.state||((String(data.address||'').match(/-\s*([A-Z]{2})\s*$/)||[])[1])||'SC')}${field('district','Bairro',data.district||'')}${field('beds','Dormitórios',data.beds||0,'number','min="0"')}${field('suites','Suítes',data.suites||0,'number','min="0"')}${field('baths','Banheiros',data.baths||0,'number','min="0"')}${field('parking','Vagas',data.parking||0,'number','min="0"')}${field('area','Área construída / privativa (m²)',data.area||'','number','min="0" step="0.01"')}${field('landArea','Área do terreno (m²)',data.landArea||'','number','min="0" step="0.01"')}${field('condo','Condomínio mensal',data.condo||'','number','min="0" step="0.01"')}${field('iptu','IPTU anual',data.iptu||'','number','min="0" step="0.01"')}${field('year','Ano de construção',data.year||'','number','min="1800" max="2100"')}${field('floor','Andar / pavimentos',data.floor||'')}${selectField('owner','Proprietário',ownerNames.length?ownerNames:[''],data.owner||ownerNames[0]||'')}${selectField('featured','Destaque',['Não','Sim'],data.featured?'Sim':'Não')}${selectField('published','Publicar no site',['Sim','Não'],data.published===false?'Não':'Sim')}<div class="form-group full"><label>Diferenciais <small style="font-weight:500;color:var(--muted)">separe por vírgula</small></label><input class="form-control" name="amenities" value="${safe(data.amenities||'')}" placeholder="Piscina, varanda gourmet, elevador, 2 vagas..."></div><div class="form-group full"><label>Descrição do imóvel</label><textarea class="form-control" name="notes" style="min-height:110px">${safe(data.notes||'')}</textarea></div></form>`;
  showModal(title,body,'Salvar alterações');
};
const v6SaveModalBase=saveModal;
saveModal=function(){
  if(editing.type!=='property')return v6SaveModalBase();
  const form=$('#modalForm');if(!form?.reportValidity())return;const fd=Object.fromEntries(new FormData(form).entries());
  ['price','beds','suites','baths','parking','area','landArea','condo','iptu','year'].forEach(k=>fd[k]=Number(fd[k]||0));fd.featured=fd.featured==='Sim';fd.siteFeatured=fd.featured;fd.published=fd.published!=='Não';
  const id=editing.id;if(id){const i=db.properties.findIndex(x=>x.id===id);if(i>=0)db.properties[i]={...db.properties[i],...fd}}else{if(db.properties.some(x=>x.id===fd.id)){toast('Já existe um imóvel com este código.');return}fd.photos=[{id:'PH'+uid().slice(-8).toUpperCase(),room:'Capa',src:v5FallbackPropertyImage(fd),name:'Imagem principal',created:todayISO()}];fd.coverPhoto=fd.photos[0].id;db.properties.push(fd)}
  pushActivity('⌂','Imóvel atualizado',`${fd.id} · ${fd.title}`);closeModal();saveDB();toast(fd.published?'Imóvel salvo e enviado para sincronização do site.':'Imóvel salvo sem publicação no site.');
};
// Reset modal sizing between workspaces
const v6ShowModalBase=showModal;
showModal=function(title,body,saveLabel){const m=$('#modal');m?.classList.remove('property-detail-shell');v6ShowModalBase(title,body,saveLabel)};



// ======================================================================
// V7 — Authentication + public website synchronization
// ======================================================================
function ensureV7SiteSchema(){
  db.settings=db.settings||{};
  db.settings.siteBrand=db.settings.siteBrand||db.settings.name||'AG';
  db.settings.siteTagline=db.settings.siteTagline||'Imóveis para viver o próximo capítulo.';
  db.settings.siteWhatsapp=String(db.settings.siteWhatsapp||db.settings.phone||'5547999990000').replace(/\D/g,'');
  db.settings.siteRegion=db.settings.siteRegion||'Jaraguá do Sul e região';
  db.properties.forEach(p=>{if(typeof p.published!=='boolean')p.published=['Disponível','Reservado'].includes(p.status);if(typeof p.siteFeatured!=='boolean')p.siteFeatured=!!p.featured});
}
function publicPropertyPayload(p){
  const photos=propertyPhotos(p).map(ph=>({id:ph.id,room:ph.room||'Foto',name:ph.name||'',src:ph.src}));
  return {id:p.id,title:p.title,type:p.type,purpose:p.purpose,price:Number(p.price||0),address:p.address||'',city:p.city||'',state:p.state||((String(p.address||'').match(/-\s*([A-Z]{2})\s*$/)||[])[1])||'',district:p.district||'',beds:Number(p.beds||0),suites:Number(p.suites||0),baths:Number(p.baths||0),parking:Number(p.parking||0),area:Number(p.area||0),landArea:Number(p.landArea||0),condo:Number(p.condo||0),iptu:Number(p.iptu||0),year:Number(p.year||0),status:p.status||'',notes:p.notes||'',amenities:p.amenities||'',featured:!!p.siteFeatured,photos,coverPhoto:p.coverPhoto||photos[0]?.id||'',videos:(p.videos||[]).map(v=>({id:v.id,title:v.title||'',url:v.url||'',thumb:v.thumb||'',featured:p.videoFeaturedId===v.id})),videoFeaturedId:p.videoFeaturedId||'',tour360Url:p.tour360Url||''};
}
function getPublicCatalog(){
  ensureV7SiteSchema();
  return {version:1,syncedAt:new Date().toISOString(),settings:{brand:db.settings.siteBrand,tagline:db.settings.siteTagline,whatsapp:db.settings.siteWhatsapp,region:db.settings.siteRegion,email:db.settings.email||'',phone:db.settings.phone||'',address:db.settings.address||''},properties:db.properties.filter(p=>p.published&&['Disponível','Reservado'].includes(p.status)).map(publicPropertyPayload)};
}
function syncPublicCatalog(){
  const catalog=getPublicCatalog();
  try{localStorage.setItem('nexoPublicCatalogV1',JSON.stringify(catalog));localStorage.setItem('nexoPublicLastSync',catalog.syncedAt)}catch(e){console.warn('Public catalog sync',e)}
  try{const bc=new BroadcastChannel('nexo-public-catalog');bc.postMessage({type:'catalog-updated',at:catalog.syncedAt});bc.close()}catch(e){}
  if($('#siteLastSync'))$('#siteLastSync').textContent=new Date(catalog.syncedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function updatePublicSyncIndicator(){
  const blocks=[...document.querySelectorAll('#page-site .site-live-dot')];
  const lead=blocks[0]?.parentElement;
  if(!lead)return;
  const title=lead.querySelector('b'),desc=lead.querySelector('small');
  const online=!!window.EIFirebaseCRM?.enabled;
  if(title)title.textContent=online?'Sincronização automática CRM → Site':'Sincronização local CRM → Site';
  if(desc)desc.textContent=online?'Ao salvar um imóvel publicado, o site recebe a alteração automaticamente pelo Firebase.':'O fluxo automático está preparado. Ative o Firebase para o site público receber alterações em qualquer dispositivo.';
}
function escPreview(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function buildSitePreviewHTML(catalog){
  const props=catalog.properties,brand=escPreview(catalog.settings.brand),tag=escPreview(catalog.settings.tagline),region=escPreview(catalog.settings.region||'Imóveis selecionados');
  const fp=props.find(p=>p.featured)||props[0];
  const coverOf=p=>{if(!p)return '';const ph=(p.photos||[]).find(x=>x.id===p.coverPhoto)||(p.photos||[])[0];return ph?.src||propertyImage(p)};
  const cards=props.slice(0,5).map((p,i)=>`<article class="pc ${i===0?'wide':''}"><div class="pic" style="background-image:url('${coverOf(p)}')"><div><span>${escPreview(p.type)} · ${escPreview(p.purpose)}</span><i><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.7 4.95 13.9a4.95 4.95 0 0 1 0-7 4.8 4.8 0 0 1 6.86 0L12 8l.19-.18a4.8 4.8 0 0 1 6.86 0 4.95 4.95 0 0 1 0 7L12 20.7Z"/></svg></i></div><small>${(p.photos||[]).length||1} fotos</small></div><div class="copy"><em>${escPreview(p.district||p.city||p.address)} · ${escPreview(p.id)}</em><h3>${escPreview(p.title)}</h3><div class="facts"><b>${p.area||'—'} m²</b><b>${p.beds||0} quartos</b><b>${p.parking||0} vagas</b></div><div class="bottom"><strong>${money(p.price)}</strong><span>Ver detalhes →</span></div></div></article>`).join('');
  const locs=[...new Map(props.map(p=>[(p.district||p.city||'Região'),p])).entries()].slice(0,4).map(([name,p])=>`<div class="loc" style="background-image:url('${coverOf(p)}')"><div><small>${escPreview(p.city||region)}</small><b>${escPreview(name)}</b></div></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./css/22-styles.css"></head><body><header><div class="brand" aria-label="${brand}"><img src="../assets/ag-logo.png" alt="${brand}" style="height:46px;width:auto;display:block;background:#14253F;border-radius:12px;padding:6px;box-shadow:0 8px 20px rgba(20,37,63,.18)"><span style="position:absolute;left:-9999px">${brand}</span></div><nav><span>Comprar</span><span>Alugar</span><span>Imóveis</span><span>Financiamento</span></nav><button class="cta">Falar com especialista</button></header><section class="hero"><div><small>${region}</small><h1>${tag.replace(/(próximo capítulo\.?)/i,'<b>$1</b>')}</h1><p>Descubra imóveis com mais contexto, menos ruído e uma experiência de busca pensada para ajudar na decisão.</p></div><div class="visual"><div class="photo" style="background-image:url('${coverOf(fp)}')"></div>${fp?`<div class="pinfo"><span>${escPreview(fp.district||fp.city)} · ${escPreview(fp.id)}</span><b>${escPreview(fp.title)}</b></div>`:''}</div></section><div class="search"><div class="field"><label>Onde você quer morar?</label><span>Bairro, cidade, condomínio ou código</span></div><div class="field"><label>Objetivo</label><span>Comprar ou alugar</span></div><div class="field"><label>Tipo</label><span>Todos os tipos</span></div><button>Explorar imóveis</button></div>${locs?`<section class="section"><div class="sectionhead"><h2>Explore por localização</h2><span>Regiões com imóveis publicados</span></div><div class="locs">${locs}</div></section>`:''}<section class="section"><div class="sectionhead"><h2>Imóveis disponíveis</h2><span>${props.length} resultados</span></div><div class="grid">${cards||'<p>Nenhum imóvel publicado.</p>'}</div></section><section class="tools"><div class="tool dark"><small>Jornada completa</small><h2>Da busca até a chave.</h2><p>Curadoria, visita, negociação e organização documental em uma experiência contínua.</p></div><div class="tool"><small>Simulação rápida</small><h2>Planeje o financiamento.</h2><p>Uma estimativa inicial ajuda a entender a ordem de grandeza antes da análise bancária.</p><div class="sim"><div><span>Parcela estimada</span><strong>simule no site</strong></div><span>estimativa ilustrativa</span></div></div></section><section class="band"><div><h2>Não encontrou exatamente o que procura?</h2><p>Conte sua região, orçamento e tipo de imóvel para receber uma curadoria personalizada pelo atendimento.</p></div><div class="image" style="background-image:url('${coverOf(props[1]||fp)}')"></div></section><footer><b>${brand}</b><span>Catálogo sincronizado com o CRM</span></footer></body></html>`;
}
function renderSiteManager(){
  if(!$('#page-site'))return;ensureV7SiteSchema();db.settings.siteBrand='AG';updatePublicSyncIndicator();
  $('#siteBrandInput').value=db.settings.siteBrand||'';$('#siteTaglineInput').value=db.settings.siteTagline||'';$('#siteWhatsappInput').value=db.settings.siteWhatsapp||'';$('#siteRegionInput').value=db.settings.siteRegion||'';
  const published=db.properties.filter(p=>p.published).length;$('#sitePublishedCount').textContent=published;const last=localStorage.getItem('nexoPublicLastSync');$('#siteLastSync').textContent=last?new Date(last).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'agora';
  $('#sitePropertyPublishList').innerHTML=db.properties.map(p=>`<div class="site-publish-row"><div class="site-publish-thumb" style="background-image:url('${propertyImage(p)}')"></div><div class="site-publish-copy"><b>${safe(p.title)}</b><span>${safe(p.id)} · ${safe(p.status)} · ${money(p.price)}</span></div><label class="site-toggle" title="${p.published?'Publicado':'Não publicado'}"><input type="checkbox" data-site-publish="${p.id}" ${p.published?'checked':''}><i></i></label></div>`).join('')||'<div class="site-empty">Nenhum imóvel cadastrado.</div>';
  const frame=$('#sitePreviewFrame');if(frame){frame.removeAttribute('src');const html=window.AG_SITE_PREVIEW_HTML_V92?.(getPublicCatalog())||buildSitePreviewHTML(getPublicCatalog());frame.srcdoc=html;}
}
function setPropertyPublication(id,value){const p=db.properties.find(x=>x.id===id);if(!p)return;p.published=!!value;localStorage.setItem('atlasImobCRM',JSON.stringify(db));syncPublicCatalog();renderSiteManager();renderProperties();toast(value?'Imóvel publicado no site.':'Imóvel removido do site.')}
function initSiteEvents(){
  $('#sitePropertyPublishList')?.addEventListener('change',e=>{const input=e.target.closest('[data-site-publish]');if(input)setPropertyPublication(input.dataset.sitePublish,input.checked)});
  $('#saveSiteSettings')?.addEventListener('click',()=>{db.settings.siteBrand=$('#siteBrandInput').value.trim()||db.settings.name;db.settings.siteTagline=$('#siteTaglineInput').value.trim()||'Imóveis para viver o próximo capítulo.';db.settings.siteWhatsapp=$('#siteWhatsappInput').value.replace(/\D/g,'');db.settings.siteRegion=$('#siteRegionInput').value.trim();localStorage.setItem('atlasImobCRM',JSON.stringify(db));syncPublicCatalog();renderSiteManager();toast('Site atualizado e sincronizado.')});
  $('#refreshSitePreview')?.addEventListener('click',()=>{renderSiteManager();toast('Prévia atualizada.')});
  $('#openPublicSite')?.addEventListener('click',()=>{const url=window.EI_FIREBASE_CONFIG?.publicSiteUrl||'';if(url){window.open(url,'_blank','noopener')}else{toast('Configure publicSiteUrl no firebase-config.js do CRM.')}});
  $('#publishAllAvailable')?.addEventListener('click',()=>{db.properties.forEach(p=>p.published=p.status==='Disponível'||p.status==='Reservado');localStorage.setItem('atlasImobCRM',JSON.stringify(db));syncPublicCatalog();renderSiteManager();toast('Imóveis disponíveis publicados.')});
}
function initLoginV7(){
  const screen=$('#loginScreen'),form=$('#loginForm');
  const firebaseMode=!!window.EI_FIREBASE_CONFIG?.enabled;
  if(!firebaseMode){const session=localStorage.getItem('nexoSessionV1');if(session){document.body.classList.remove('auth-required');screen?.classList.add('hidden')}}
  $('#togglePassword')?.addEventListener('click',()=>{const i=$('#loginPassword');if(!i)return;i.type=i.type==='password'?'text':'password';$('#togglePassword').textContent=i.type==='password'?'Mostrar':'Ocultar'});
  if(firebaseMode)return;
  // Não exibe uma mensagem definitiva antes do módulo de autenticação terminar de carregar.
  // O login-ui-v57 mostra o diagnóstico real caso o Firebase/CDN falhe.
  form?.addEventListener('submit',e=>{
    e.preventDefault();
    const status=$('#loginStatus');
    if(status && !status.textContent) status.textContent='Inicializando autenticação…';
  });
  $('#logoutBtn')?.addEventListener('click',()=>{localStorage.removeItem('nexoSessionV1');document.body.classList.add('auth-required');screen.classList.remove('hidden');$('#loginPassword').focus()});
}
const v7RenderAllBase=renderAll;renderAll=function(){v7RenderAllBase();ensureV7SiteSchema();renderSiteManager()};
const v7SaveDBBase=saveDB;saveDB=function(){localStorage.setItem('atlasImobCRM',JSON.stringify(db));syncPublicCatalog();renderAll()};
ensureV7SiteSchema();syncPublicCatalog();initSiteEvents();initLoginV7();

// Public functions used by inline UI
window.openTimeline=openTimeline;window.quickTimelineAction=quickTimelineAction;window.openJourneyInteraction=openJourneyInteraction;window.saveJourneyInteraction=saveJourneyInteraction;window.openMatchFor=openMatchFor;window.shareMatch=shareMatch;window.openOwnerPortfolio=openOwnerPortfolio;window.previewContract=previewContract;window.openModal=openModal;window.saveModal=saveModal;window.editItem=editItem;window.deleteItem=deleteItem;window.openPropertyDetails=openPropertyDetails;window.switchPropertyTab=switchPropertyTab;window.previewPropertyPhoto=previewPropertyPhoto;window.editPropertyFromDetails=editPropertyFromDetails;window.setPropertyCover=setPropertyCover;window.renamePropertyPhoto=renamePropertyPhoto;window.removePropertyPhoto=removePropertyPhoto;window.addPropertyPhotos=addPropertyPhotos;

ensureV5Schema();
ensurePropertyMediaSchema();

/* V23 — Site → CRM → Corretor → WhatsApp → Follow-up */
function ensureAutomationSchema(){
  db.automation ||= {roundRobin:true,rrIndex:0,slaMinutes:15,followupHours:24};
  db.tasks ||= [];
  db.siteEvents ||= [];
}
function normalizePhone(v){return String(v||'').replace(/\D/g,'')}
function waPhone(v){const d=normalizePhone(v);return d.startsWith('55')&&d.length>=12?d:'55'+d}
function commercialUsers(){return db.users.filter(u=>u.active!==false&&!/finance/i.test(u.role||''))}
function nextBroker(){const list=commercialUsers();if(!list.length)return db.users.find(u=>u.active!==false)?.name||'Sem responsável';if(db.automation.roundRobin===false)return list[0].name;const idx=Number(db.automation.rrIndex||0)%list.length,broker=list[idx].name;db.automation.rrIndex=(idx+1)%list.length;return broker}
function addTimeline(person,type,title,text,date=todayISO(),time=new Date().toTimeString().slice(0,5)){db.timelines ||= [];db.timelines.push({id:'TL'+uid().slice(-7).toUpperCase(),person,date,time,type,title,text})}
function taskDueISO(minutes){return new Date(Date.now()+minutes*60000).toISOString()}
function addAutomationTask(lead,kind='first',dueAt){db.tasks ||= [];const existing=db.tasks.find(t=>t.leadId===lead.id&&t.kind===kind&&t.status!=='Concluída');if(existing)return existing;const title=kind==='first'?`Primeiro contato · ${lead.name}`:`Follow-up · ${lead.name}`;const task={id:'TK'+uid().slice(-7).toUpperCase(),leadId:lead.id,person:lead.name,broker:lead.broker,kind,title,dueAt:dueAt||taskDueISO(kind==='first'?Number(db.automation.slaMinutes||15):Number(db.automation.followupHours||24)*60),status:'Pendente',priority:kind==='first'?'Alta':'Normal',createdAt:new Date().toISOString()};db.tasks.push(task);return task}
function siteEventInterest(ev){if(ev.propertyTitle)return ev.kind==='visit'?`Visita · ${ev.propertyTitle}`:ev.propertyTitle;if(ev.interest)return ev.interest;if(ev.kind==='finance')return 'Financiamento imobiliário';return 'Atendimento pelo site'}
function parseSitePotential(ev){if(Number(ev.propertyValue))return Number(ev.propertyValue);if(Number(ev.budgetValue))return Number(ev.budgetValue);return 0}
function processOneSiteEvent(ev){
  if(!ev?.id||db.siteEvents.some(x=>x.eventId===ev.id))return false;const phone=normalizePhone(ev.phone);if(phone.length<10)return false;
  let lead=db.leads.find(l=>normalizePhone(l.phone)===phone),duplicate=!!lead,broker;
  if(lead){broker=lead.broker;lead.name=lead.name||ev.name;lead.email=lead.email||ev.email||'';lead.interest=siteEventInterest(ev)||lead.interest;lead.lastSiteAt=ev.createdAt||new Date().toISOString();lead.propertyId=ev.propertyId||lead.propertyId||'';if(!lead.value)lead.value=parseSitePotential(ev)}
  else{broker=nextBroker();lead={id:'L'+uid().slice(-6).toUpperCase(),name:ev.name||'Lead do site',phone,email:ev.email||'',interest:siteEventInterest(ev),source:'Site',stage:'Novo',broker,value:parseSitePotential(ev),temp:['visit','property'].includes(ev.kind)?'Quente':'Morno',created:String(ev.createdAt||new Date().toISOString()).slice(0,10),propertyId:ev.propertyId||'',siteKind:ev.kind||'general',lastSiteAt:ev.createdAt||new Date().toISOString()};db.leads.push(lead);addAutomationTask(lead,'first')}
  addTimeline(lead.name,'Site',duplicate?'Nova interação no site':'Lead recebido pelo site',`${ev.kind||'interesse'}${ev.propertyTitle?' · '+ev.propertyTitle:''}${ev.city?' · '+ev.city:''}${duplicate?' · corretor preservado: '+broker:' · distribuído para '+broker}`,String(ev.createdAt||new Date().toISOString()).slice(0,10),new Date(ev.createdAt||Date.now()).toTimeString().slice(0,5));
  if(ev.kind==='visit'&&ev.desiredDate){const exists=db.appointments.some(a=>a.client===lead.name&&a.property===ev.propertyId&&a.date===ev.desiredDate&&a.time===ev.desiredTime);if(!exists)db.appointments.push({id:'A'+uid().slice(-6).toUpperCase(),date:ev.desiredDate,time:ev.desiredTime||'09:00',type:'Visita',title:`Visita · ${ev.propertyTitle||ev.propertyId}`,client:lead.name,broker,property:ev.propertyId||'',source:'Site'})}
  db.siteEvents.push({id:'SE'+uid().slice(-6).toUpperCase(),eventId:ev.id,kind:ev.kind||'general',leadId:lead.id,person:lead.name,phone,broker,propertyId:ev.propertyId||'',propertyTitle:ev.propertyTitle||'',createdAt:ev.createdAt||new Date().toISOString(),processedAt:new Date().toISOString(),duplicate});
  pushActivity('◎',duplicate?'Interação do site recebida':'Novo lead do site',`${lead.name} · ${broker}`);return true
}
function readSiteInbox(){try{return JSON.parse(localStorage.getItem('eiSiteLeadInboxV1')||'[]')}catch(e){return []}}
function persistAutomation(){localStorage.setItem('atlasImobCRM',JSON.stringify(db));try{syncPublicCatalog()}catch(e){}}
function processSiteLeadInbox(showToast=false){ensureAutomationSchema();const inbox=readSiteInbox();let count=0;inbox.forEach(ev=>{if(processOneSiteEvent(ev))count++});if(count){persistAutomation();renderAll();if(showToast)toast(`${count} entrada${count===1?'':'s'} do site processada${count===1?'':'s'}.`)}else if(showToast)toast('Nenhuma entrada nova do site.');return count}
function automationDueLabel(iso){const d=new Date(iso),diff=d-Date.now(),mins=Math.round(Math.abs(diff)/60000);if(diff<0)return `atrasada ${mins<60?mins+' min':Math.round(mins/60)+' h'}`;return mins<60?`em ${mins} min`:`em ${Math.round(mins/60)} h`}
function renderAutomationCenter(){
  ensureAutomationSchema();if(!$('#autoEventList'))return;const today=todayISO(),events=[...db.siteEvents].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),todayEvents=events.filter(e=>String(e.createdAt).slice(0,10)===today),pending=db.tasks.filter(t=>t.status!=='Concluída'),visits=db.appointments.filter(a=>a.source==='Site'),dups=events.filter(e=>e.duplicate);
  $('#autoSiteToday').textContent=todayEvents.length;$('#autoPending').textContent=pending.length;$('#autoVisits').textContent=visits.length;$('#autoDuplicates').textContent=dups.length;$('#navSiteInboxBadge').textContent=pending.length;$('#navSiteInboxBadge').style.display=pending.length?'inline-flex':'none';
  $('#autoEventList').innerHTML=events.slice(0,12).map(e=>{const l=db.leads.find(x=>x.id===e.leadId);return `<div class="auto-event"><div class="auto-event-icon">${e.kind==='visit'?'□':e.kind==='curadoria'?'⌕':e.kind==='finance'?'$':'◎'}</div><div class="auto-event-copy"><b>${safe(e.person)} ${e.duplicate?'<span class="site-origin">RETORNO</span>':'<span class="site-origin">NOVO</span>'}</b><span>${safe(e.propertyTitle||siteEventInterest(e))} · ${fmtPhone(e.phone)}</span></div><div class="auto-event-meta"><b>${safe(e.broker)}</b><span>${new Date(e.createdAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></div></div>`}).join('')||'<div class="auto-empty">Nenhuma entrada do site ainda.</div>';
  $('#autoTaskList').innerHTML=[...pending].sort((a,b)=>String(a.dueAt).localeCompare(String(b.dueAt))).slice(0,14).map(t=>{const l=db.leads.find(x=>x.id===t.leadId),overdue=new Date(t.dueAt)<new Date();return `<div class="auto-task"><div class="auto-task-top"><b>${safe(t.title)}</b><span class="status ${overdue?'danger':'info'}">${safe(automationDueLabel(t.dueAt))}</span></div><p>${safe(t.broker)} · ${l?fmtPhone(l.phone):''} · ${safe(l?.interest||'')}</p><div class="auto-task-actions"><button class="btn small primary" onclick="openLeadWhatsApp('${t.leadId}')">WhatsApp ↗</button><button class="btn small" onclick="completeAutomationTask('${t.id}')">Concluir</button><button class="btn small" onclick="openTimeline('${escJS(t.person)}')">360°</button></div></div>`}).join('')||'<div class="auto-empty">Nenhuma tarefa pendente. A fila está em dia.</div>';
  $('#autoRoundRobinToggle').classList.toggle('on',db.automation.roundRobin!==false);$('#autoSlaInput').value=db.automation.slaMinutes||15;$('#autoFollowupInput').value=db.automation.followupHours||24;$('#autoBrokerOrder').innerHTML=commercialUsers().map((u,i)=>`<span class="auto-broker-chip">${i+1}. ${safe(u.name)}</span>`).join('')||'<span class="auto-broker-chip">Nenhum corretor ativo</span>'
}
function completeAutomationTask(id){ensureAutomationSchema();const t=db.tasks.find(x=>x.id===id);if(!t)return;t.status='Concluída';t.completedAt=new Date().toISOString();addTimeline(t.person,'Tarefa','Tarefa concluída',t.title);saveDB();toast('Tarefa concluída.')}
function scheduleLeadFollowup(leadId){ensureAutomationSchema();const l=db.leads.find(x=>x.id===leadId);if(!l)return;addAutomationTask(l,'followup',taskDueISO(Number(db.automation.followupHours||24)*60));saveDB();toast(`Follow-up programado para ${db.automation.followupHours||24}h.`)}
function openLeadWhatsApp(leadId){ensureAutomationSchema();const l=db.leads.find(x=>x.id===leadId);if(!l)return;db.tasks.filter(t=>t.leadId===leadId&&t.kind==='first'&&t.status!=='Concluída').forEach(t=>{t.status='Concluída';t.completedAt=new Date().toISOString()});if(l.stage==='Novo')l.stage='Contato';addTimeline(l.name,'WhatsApp','Atendimento iniciado',`Contato iniciado por ${l.broker}. Próximo follow-up programado automaticamente.`);addAutomationTask(l,'followup',taskDueISO(Number(db.automation.followupHours||24)*60));persistAutomation();renderAll();const first=String(l.name||'').split(' ')[0],msg=`Olá ${first}, aqui é ${l.broker} da AG. Recebi seu contato pelo nosso site sobre ${l.interest||'um imóvel'}. Posso te ajudar?`;window.open(`https://wa.me/${waPhone(l.phone)}?text=${encodeURIComponent(msg)}`,'_blank')}
function simulateSiteLead(){const props=db.properties.filter(p=>p.published!==false),p=props[Math.floor(Math.random()*Math.max(1,props.length))]||db.properties[0],event={id:'WEB-TEST-'+Date.now(),source:'Site',createdAt:new Date().toISOString(),kind:'property',name:'Cliente Teste Site',phone:'4799'+String(Math.floor(1000000+Math.random()*8999999)),email:'cliente.teste@email.com',propertyId:p?.id||'',propertyTitle:p?.title||'',propertyValue:Number(p?.price||0),interest:p?`${p.title} (${p.id})`:'Imóvel do site',city:p?.city||'',state:p?.state||'',district:p?.district||''};const inbox=readSiteInbox();inbox.push(event);localStorage.setItem('eiSiteLeadInboxV1',JSON.stringify(inbox));processSiteLeadInbox(true)}
function bindAutomationEvents(){
  $('#syncSiteLeads')?.addEventListener('click',()=>processSiteLeadInbox(true));$('#autoRoundRobinToggle')?.addEventListener('click',()=>{$('#autoRoundRobinToggle').classList.toggle('on')});$('#saveAutomationSettings')?.addEventListener('click',()=>{db.automation.roundRobin=$('#autoRoundRobinToggle').classList.contains('on');db.automation.slaMinutes=Math.max(1,Number($('#autoSlaInput').value||15));db.automation.followupHours=Math.max(1,Number($('#autoFollowupInput').value||24));saveDB();toast('Automação atualizada.')});
  window.addEventListener('storage',e=>{if(e.key==='eiSiteLeadPingV1'||e.key==='eiSiteLeadInboxV1')processSiteLeadInbox(false)});try{const bc=new BroadcastChannel('ei-site-leads');bc.onmessage=()=>processSiteLeadInbox(false)}catch(e){}
}
const v23RenderAllBase=renderAll;renderAll=function(){v23RenderAllBase();renderAutomationCenter()};
const v23RenderLeadsBase=renderLeads;renderLeads=function(){const q=$('#leadSearch')?.value.toLowerCase()||'',src=$('#leadSourceFilter')?.value||'',st=$('#leadStatusFilter')?.value||'';const list=db.leads.filter(l=>(!q||[l.name,l.phone,l.email,l.interest].join(' ').toLowerCase().includes(q))&&(!src||l.source===src)&&(!st||l.stage===st));$('#leadTable').innerHTML=list.map(l=>`<tr><td><div class="row-avatar"><div class="avatar">${initials(l.name)}</div><div><b>${safe(l.name)}${l.source==='Site'?'<span class="site-origin">SITE</span>':''}</b><small style="display:block;color:var(--muted)">${fmtPhone(l.phone)}</small></div></div></td><td>${safe(l.interest)}</td><td>${safe(l.source)}</td><td><span class="status ${stageClass(l.stage)}">${safe(l.stage)}</span></td><td>${safe(l.broker)}</td><td><b>${money(l.value)}</b></td><td><div class="actions">${l.phone?`<button class="btn small primary" onclick="openLeadWhatsApp('${l.id}')">WhatsApp</button>`:''}<button class="btn small" onclick="scheduleLeadFollowup('${l.id}')">Follow-up</button><button class="btn small" onclick="openTimeline('${escJS(l.name)}')">360°</button><button class="btn small" onclick="editItem('lead','${l.id}')">Editar</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nenhum lead encontrado.</td></tr>'};
ensureAutomationSchema();processSiteLeadInbox(false);bindAutomationEvents();setInterval(()=>processSiteLeadInbox(false),5000);
window.openLeadWhatsApp=openLeadWhatsApp;window.scheduleLeadFollowup=scheduleLeadFollowup;window.completeAutomationTask=completeAutomationTask;

/* =========================================================
   V25 — PREMIUM CLARO / UI MODULES
   ========================================================= */
let v25CommandIndex = 0;
let v25DraggedPhoto = null;
let v25MetricsAnimated = false;

function v25Normalize(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function v25SessionName(){
  try{
    const session=JSON.parse(localStorage.getItem('nexoSessionV1')||'{}');
    const name=session.name||db.users?.find(u=>u.active)?.name||'Administrador';
    return String(name).trim().split(/\s+/)[0]||'Administrador';
  }catch(e){return 'Administrador'}
}

function v25Greeting(){
  const h=new Date().getHours();
  return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
}

function renderV25Greeting(){
  const intro=document.querySelector('.dashboard-intro');
  if(!intro)return;
  const eyebrow=intro.querySelector('.eyebrow');
  const title=intro.querySelector('h1');
  const date=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date());
  const urgent=(db.tasks||[]).filter(t=>t.status!=='Concluída'&&new Date(t.dueAt||0)<new Date()).length;
  const newLeads=(db.leads||[]).filter(l=>l.stage==='Novo').length;
  const attention=urgent+newLeads;
  if(eyebrow)eyebrow.textContent=`${date} · visão executiva`;
  if(title)title.innerHTML=`${v25Greeting()}, ${safe(v25SessionName())}. <em>${attention?`${attention} ${attention===1?'movimento pede':'movimentos pedem'} atenção.`:'A operação está em dia.'}</em>`;
}

function animateMetric(el,target,formatter){
  if(!el)return;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if(reduce){el.textContent=formatter(target);return}
  const start=performance.now(),duration=780;
  function tick(now){
    const p=Math.min(1,(now-start)/duration);
    const eased=1-Math.pow(1-p,3);
    el.textContent=formatter(target*eased);
    if(p<1)requestAnimationFrame(tick);else el.textContent=formatter(target);
  }
  requestAnimationFrame(tick);
}

function animateV25Metrics(){
  if(v25MetricsAnimated)return;
  v25MetricsAnimated=true;
  const avail=(db.properties||[]).filter(x=>x.status==='Disponível').length;
  const active=(db.leads||[]).filter(x=>x.stage!=='Fechado').length;
  const proposals=(db.proposals||[]).filter(x=>x.status!=='Aprovada').length;
  const closed=(db.leads||[]).filter(x=>x.stage==='Fechado').reduce((a,b)=>a+Number(b.value||0),0);
  const pipeline=(db.leads||[]).filter(x=>x.stage!=='Fechado').reduce((a,b)=>a+Number(b.value||0),0);
  const values=[avail,active,proposals,closed];
  const els=[...document.querySelectorAll('#kpiGrid .kpi strong')];
  els.forEach((el,i)=>animateMetric(el,values[i]||0,i===3?v=>money(Math.round(v)):v=>Math.round(v).toLocaleString('pt-BR')));
  animateMetric(document.querySelector('#heroPipeline'),pipeline,v=>money(Math.round(v)));
}

function renderV25Attention(){
  const root=document.querySelector('#v25AttentionGrid');
  if(!root)return;
  const now=new Date();
  const pendingLeads=(db.leads||[]).filter(l=>l.stage==='Novo');
  const upcoming=(db.appointments||[]).filter(a=>new Date(`${a.date}T${a.time||'00:00'}`)>=now).sort((a,b)=>String(a.date+a.time).localeCompare(String(b.date+b.time)));
  const proposals=(db.proposals||[]).filter(p=>!['Aprovada','Recusada','Cancelada'].includes(p.status));
  const overdue=(db.tasks||[]).filter(t=>t.status!=='Concluída'&&t.dueAt&&new Date(t.dueAt)<now);
  const exclusive=(db.owners||[]).filter(o=>o.exclusivity==='Exclusivo').length;
  const cards=[
    {eyebrow:'Atendimento',value:pendingLeads.length,detail:pendingLeads[0]?`${pendingLeads[0].name} aguarda primeiro movimento`:'Nenhum lead novo aguardando contato',page:'leads'},
    {eyebrow:'Próxima visita',value:upcoming.length,detail:upcoming[0]?`${brDate(upcoming[0].date)} · ${upcoming[0].time} · ${upcoming[0].client}`:'Agenda sem visitas futuras',page:'agenda'},
    {eyebrow:'Negociação',value:proposals.length,detail:proposals[0]?`${proposals[0].client} · ${money(proposals[0].value)}`:'Nenhuma proposta em análise',page:'propostas'},
    {eyebrow:'Prioridade',value:overdue.length,detail:overdue[0]?`${overdue[0].title} · ${overdue[0].person||overdue[0].broker||''}`:`${exclusive} captações exclusivas ativas`,page:'atendimento'}
  ];
  root.innerHTML=cards.map(c=>`<article class="v25-attention-card" role="button" tabindex="0" data-attention-page="${c.page}"><small>${safe(c.eyebrow)}</small><strong>${c.value}</strong><span>${safe(c.detail)}</span></article>`).join('');
  root.querySelectorAll('[data-attention-page]').forEach(card=>{
    const go=()=>navigate(card.dataset.attentionPage);
    card.addEventListener('click',go);
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
  });
}

function renderV25Dashboard(){
  renderV25Greeting();
  renderV25Attention();
  setTimeout(animateV25Metrics,70);
  setTimeout(applyV25Reveal,30);
}

function v25CommandItems(query=''){
  const q=v25Normalize(query);
  const actions=[
    {kind:'action',id:'new-prospecting',icon:'◎',label:'Prospecção',meta:'Cadastrar uma ficha de prospecção de imóvel',hint:'Ação'},
    {kind:'action',id:'new-property',icon:'⌂',label:'Novo imóvel',meta:'Cadastrar um imóvel na carteira',hint:'Ação'},
    {kind:'action',id:'new-visit',icon:'□',label:'Agendar visita',meta:'Criar um compromisso na agenda',hint:'Ação'},
    {kind:'action',id:'new-proposal',icon:'◇',label:'Nova proposta',meta:'Registrar uma negociação',hint:'Ação'},
    {kind:'page',id:'atendimento',icon:'↗',label:'Abrir Atendimento',meta:'SLA, fila e follow-ups',hint:'Página'},
    {kind:'page',id:'funil',icon:'⇢',label:'Abrir Jornada',meta:'Kanban comercial',hint:'Página'}
  ];
  const props=(db.properties||[]).map(p=>({kind:'property',id:p.id,icon:'⌂',label:p.title,meta:`${p.id} · ${p.address} · ${money(p.price)}`,hint:'Imóvel'}));
  const leads=(db.leads||[]).map(l=>({kind:'lead',id:l.id,icon:'◎',label:l.name,meta:`${l.stage} · ${l.interest} · ${l.broker}`,hint:'Lead'}));
  const clients=(db.clients||[]).map(c=>({kind:'client',id:c.id,icon:'○',label:c.name,meta:`${c.type} · ${fmtPhone(c.phone)} · ${c.broker}`,hint:'Cliente'}));
  const all=[...actions,...props,...leads,...clients];
  if(!q)return all.slice(0,14);
  return all.filter(i=>v25Normalize(`${i.label} ${i.meta} ${i.hint}`).includes(q)).slice(0,18);
}

function renderCommandResults(query=''){
  const root=document.querySelector('#v25CommandResults');
  if(!root)return;
  const items=v25CommandItems(query);
  v25CommandIndex=Math.min(v25CommandIndex,Math.max(0,items.length-1));
  root.innerHTML=items.length?items.map((i,idx)=>`<button class="v25-command-item ${idx===v25CommandIndex?'active':''}" data-v25-command="${safe(i.kind)}" data-v25-id="${safe(i.id)}"><span class="v25-command-icon">${i.icon}</span><span class="v25-command-copy"><b>${safe(i.label)}</b><span>${safe(i.meta)}</span></span><small>${safe(i.hint)}</small></button>`).join(''):'<div class="v25-command-empty">Nenhum resultado. Tente nome, código do imóvel ou uma ação.</div>';
}

function openCommandCenter(initial=''){
  const overlay=document.querySelector('#v25CommandCenter');
  const input=document.querySelector('#v25CommandInput');
  if(!overlay||!input)return;
  v25CommandIndex=0;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
  input.value=initial;
  renderCommandResults(initial);
  setTimeout(()=>{input.focus();input.select()},10);
}

function closeCommandCenter(){
  const overlay=document.querySelector('#v25CommandCenter');
  if(!overlay)return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
}

function executeV25Command(kind,id){
  closeCommandCenter();
  if(kind==='page'){navigate(id);return}
  if(kind==='action'){
    const map={'new-prospecting':()=>openModal('prospecting',{}),'new-property':()=>openModal('property',{}),'new-visit':()=>openModal('appointment',{}),'new-proposal':()=>openModal('proposal',{})};
    map[id]?.();return;
  }
  if(kind==='property'){navigate('imoveis');setTimeout(()=>openPropertyDetails(id),30);return}
  if(kind==='lead'){
    const l=(db.leads||[]).find(x=>x.id===id);navigate('leads');if(l)setTimeout(()=>openTimeline(l.name),30);return;
  }
  if(kind==='client'){
    const c=(db.clients||[]).find(x=>x.id===id);navigate('clientes');if(c)setTimeout(()=>openTimeline(c.name),30);
  }
}

function bindV25CommandCenter(){
  const overlay=document.querySelector('#v25CommandCenter');
  const input=document.querySelector('#v25CommandInput');
  const results=document.querySelector('#v25CommandResults');
  if(!overlay||!input||overlay.dataset.bound)return;
  overlay.dataset.bound='1';
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeCommandCenter()});
  results.addEventListener('click',e=>{const item=e.target.closest('[data-v25-command]');if(item)executeV25Command(item.dataset.v25Command,item.dataset.v25Id)});
  input.addEventListener('input',()=>{v25CommandIndex=0;renderCommandResults(input.value)});
  input.addEventListener('keydown',e=>{
    const items=[...results.querySelectorAll('[data-v25-command]')];
    if(e.key==='ArrowDown'){e.preventDefault();v25CommandIndex=Math.min(items.length-1,v25CommandIndex+1);renderCommandResults(input.value)}
    if(e.key==='ArrowUp'){e.preventDefault();v25CommandIndex=Math.max(0,v25CommandIndex-1);renderCommandResults(input.value)}
    if(e.key==='Enter'&&items.length){e.preventDefault();const item=[...results.querySelectorAll('[data-v25-command]')][v25CommandIndex];if(item)executeV25Command(item.dataset.v25Command,item.dataset.v25Id)}
  });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();e.stopImmediatePropagation();openCommandCenter();return;
    }
    if(e.key==='Escape'&&overlay.classList.contains('open')){e.preventDefault();e.stopImmediatePropagation();closeCommandCenter()}
  },true);
  document.querySelector('#globalSearch')?.addEventListener('focus',e=>{if(e.target.dataset.v25Skip==='1')return});
}

function v25ParsePriceToken(token,unit=''){
  let raw=String(token||'').trim();
  let value;
  if(unit&&raw.includes('.')&&!raw.includes(','))value=Number(raw);
  else value=Number(raw.replace(/\./g,'').replace(',','.'));
  if(!Number.isFinite(value))return 0;
  if(unit==='mil')value*=1000;
  if(['mi','milhao','milhoes'].includes(unit))value*=1000000;
  return value;
}

function parsePropertyQuery(text){
  const n=v25Normalize(text);
  const out={raw:n,recognized:false,type:'',purpose:'',maxPrice:0,city:'',district:'',beds:0};
  const types=[['Apartamento',/\bapartamentos?\b/],['Casa',/\bcasas?\b/],['Terreno',/\bterrenos?\b/],['Comercial',/\bcomercia(?:l|is)\b|\bsalas?\b/],['Rural',/\brural\b|\bsitios?\b|\bchacaras?\b/]];
  for(const [value,re] of types){if(re.test(n)){out.type=value;out.recognized=true;break}}
  if(/\b(alugar|aluguel|locacao|locar)\b/.test(n)){out.purpose='Locação';out.recognized=true}
  else if(/\b(comprar|compra|venda)\b/.test(n)){out.purpose='Venda';out.recognized=true}
  const pm=n.match(/\bate\s*(?:r\$\s*)?([\d.,]+)\s*(mil|mi|milhao|milhoes)?\b/);
  if(pm){out.maxPrice=v25ParsePriceToken(pm[1],pm[2]||'');out.recognized=!!out.maxPrice||out.recognized}
  const bm=n.match(/\b(\d+)\s*(?:quartos?|dormitorios?)\b/);
  if(bm){out.beds=Number(bm[1]);out.recognized=true}
  const cities=[...new Set((db.properties||[]).map(p=>p.city||String(p.address||'').split(',').slice(-2,-1)[0]?.trim()).filter(Boolean))];
  const city=cities.find(c=>n.includes(v25Normalize(c)));if(city){out.city=city;out.recognized=true}
  const districts=[...new Set((db.properties||[]).map(p=>p.district).filter(Boolean))];
  const district=districts.find(d=>n.includes(v25Normalize(d)));if(district){out.district=district;out.recognized=true}
  return out;
}

function propertyMatchesSmartQuery(p,parsed){
  if(parsed.type&&p.type!==parsed.type)return false;
  if(parsed.purpose&&p.purpose!==parsed.purpose)return false;
  if(parsed.maxPrice&&Number(p.price||0)>parsed.maxPrice)return false;
  if(parsed.beds&&Number(p.beds||0)<parsed.beds)return false;
  if(parsed.city&&!v25Normalize(`${p.city||''} ${p.address||''}`).includes(v25Normalize(parsed.city)))return false;
  if(parsed.district&&!v25Normalize(`${p.district||''} ${p.address||''}`).includes(v25Normalize(parsed.district)))return false;
  return true;
}

function propertyMarketPulse(p){
  const actualLeads=(db.leads||[]).filter(l=>l.propertyId===p.id||v25Normalize(l.interest).includes(v25Normalize(p.id))||v25Normalize(l.interest).includes(v25Normalize(p.title)));
  const matches=(db.clients||[]).filter(c=>{try{return matchScore(c,p).score>=70}catch(e){return false}});
  const visits=(db.appointments||[]).filter(a=>a.property===p.id&&a.type==='Visita');
  const proposals=(db.proposals||[]).filter(x=>x.property===p.id);
  const metrics=[
    {label:'matches',value:new Set([...actualLeads.map(x=>x.name),...matches.map(x=>x.name)]).size},
    {label:'visitas',value:visits.length},
    {label:'propostas',value:proposals.length},
    {label:'fotos',value:propertyPhotos(p).length}
  ];
  return metrics;
}

function v25PulseHTML(p){
  const metrics=propertyMarketPulse(p);
  return `<div class="v25-market-pulse">${metrics.map(m=>`<div class="v25-pulse-stat"><small>${m.label}</small><b>${m.value}</b></div>`).join('')}</div>`;
}

function sharePropertyV25(id){
  const p=(db.properties||[]).find(x=>x.id===id);if(!p)return;
  const text=`${p.title} · ${p.address}\n${money(p.price)} · ${p.area||0} m²${p.beds?` · ${p.beds} quartos`:''}${p.parking?` · ${p.parking} vagas`:''}`;
  if(navigator.share){navigator.share({title:p.title,text}).catch(()=>{})}
  else if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>toast('Resumo do imóvel copiado.')).catch(()=>toast('Não foi possível copiar.'))}
  else toast('Compartilhamento não disponível neste navegador.');
}

renderProperties=function(){
  const input=$('#propertySearch');
  const q=input?.value||'';
  const parsed=parsePropertyQuery(q);
  const typ=$('#propertyTypeFilter')?.value||'',pur=$('#propertyPurposeFilter')?.value||'';
  const raw=v25Normalize(q);
  const list=(db.properties||[]).filter(p=>{
    if(typ&&p.type!==typ)return false;
    if(pur&&p.purpose!==pur)return false;
    if(parsed.recognized)return propertyMatchesSmartQuery(p,parsed);
    return !raw||v25Normalize([p.id,p.title,p.address,p.owner,p.city,p.district].join(' ')).includes(raw);
  });
  const grid=$('#propertyGrid');if(!grid)return;
  grid.innerHTML=list.map(p=>`<article class="card property-card"><div class="property-cover" role="button" tabindex="0" aria-label="Abrir ficha de ${safe(p.title)}" onclick="openPropertyDetails('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPropertyDetails('${p.id}')}" style="background-image:url('${propertyImage(p)}')"><span class="property-tag">${safe(p.type)} · ${safe(p.purpose)}</span><span class="property-status">${safe(p.status)}</span><span class="property-code">${safe(p.id)}</span>${v25PulseHTML(p)}</div><div class="property-content"><h3>${safe(p.title)}</h3><div class="address">${safe(p.district||'')} ${p.district?'· ':''}${safe(p.city||p.address)}</div><div class="specs"><span>${Number(p.area||0).toLocaleString('pt-BR')} m²</span>${p.beds?`<span>${p.beds} quartos</span>`:''}${p.suites?`<span>${p.suites} suítes</span>`:''}${p.parking?`<span>${p.parking} vagas</span>`:''}</div><div class="price-row"><div><strong>${money(p.price)}</strong><small style="display:block;color:var(--muted);font-size:8px;margin-top:3px">${safe(p.purpose==='Locação'?'por mês':'valor anunciado')}</small></div><div class="actions"><button class="btn small" onclick="event.stopPropagation();sharePropertyV25('${p.id}')">Compartilhar</button><button class="btn small" onclick="event.stopPropagation();editItem('property','${p.id}')">Editar</button><button class="btn small primary" onclick="event.stopPropagation();openPropertyDetails('${p.id}')">Abrir</button></div></div></div></article>`).join('')||'<div class="card empty" style="grid-column:1/-1">Nenhum imóvel encontrado.</div>';
  applyV25Reveal();
};

function v25InterestedPeople(p){
  const map=new Map();
  (db.clients||[]).forEach(c=>{
    try{
      const m=matchScore(c,p);
      if(m.score>=60&&c.type!=='Proprietário')map.set(c.name,{name:c.name,broker:c.broker,phone:c.phone,score:m.score,reasons:m.why,source:'Match'});
    }catch(e){}
  });
  (db.leads||[]).forEach(l=>{
    const actual=l.propertyId===p.id||v25Normalize(l.interest).includes(v25Normalize(p.id))||v25Normalize(l.interest).includes(v25Normalize(p.title));
    if(actual){const prior=map.get(l.name);map.set(l.name,{name:l.name,broker:l.broker,phone:l.phone,score:Math.max(prior?.score||0,88),reasons:[...(prior?.reasons||[]),'interesse registrado'],source:'Lead'})}
  });
  return [...map.values()].sort((a,b)=>b.score-a.score).slice(0,10);
}

function v25DetailRows(items,empty){
  return items.length?`<div class="v25-detail-list">${items.join('')}</div>`:`<div class="pw-section"><p>${safe(empty)}</p></div>`;
}

openPropertyDetails=function(id,tab='overview',photoId=''){
  const p=(db.properties||[]).find(x=>x.id===id);if(!p)return;
  const photos=propertyPhotos(p),selected=photos.find(x=>x.id===photoId)||photos.find(x=>x.id===p.coverPhoto)||photos[0];
  const owner=(db.owners||[]).find(o=>o.name===p.owner),features=String(p.amenities||'').split(',').map(x=>x.trim()).filter(Boolean),history=getPropertyHistory(p);
  const interested=v25InterestedPeople(p);
  const visits=(db.appointments||[]).filter(a=>a.property===p.id).sort((a,b)=>String(b.date+b.time).localeCompare(String(a.date+a.time)));
  const proposals=(db.proposals||[]).filter(x=>x.property===p.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const contracts=(db.contracts||[]).filter(x=>x.property===p.id);
  const broker=owner?.broker||visits[0]?.broker||proposals[0]?.broker||'Não definido';
  const overviewData=[['Código',p.id],['Tipo',p.type],['Finalidade',p.purpose],['Status',p.status],['Cidade',p.city||'-'],['Bairro',p.district||'-'],['Ano',p.year||'-'],['Andar / pavimentos',p.floor||'-'],['Condomínio',Number(p.condo)?money(p.condo):'—'],['IPTU anual',Number(p.iptu)?money(p.iptu):'—']];
  const interestedHTML=v25DetailRows(interested.map(person=>`<article class="v25-match-person"><div class="v25-match-score">${person.score}%</div><div><b>${safe(person.name)}</b><p>${safe(person.broker||'Sem responsável')} · ${person.phone?fmtPhone(person.phone):'sem telefone'}</p><div class="v25-reasons">${person.reasons.slice(0,4).map(r=>`<span>✓ ${safe(r)}</span>`).join('')}</div></div><div class="actions"><button class="btn small" onclick="openTimeline('${escJS(person.name)}')">360°</button></div></article>`),'Nenhum comprador ou lead compatível identificado para este imóvel.');
  const visitsHTML=v25DetailRows(visits.map(a=>`<article class="v25-detail-row"><div class="v25-detail-icon">□</div><div><b>${safe(a.title)}</b><p>${safe(a.client)} · ${safe(a.broker)}</p></div><aside><strong>${brDate(a.date)}</strong><span>${safe(a.time||'')}</span></aside></article>`),'Nenhuma visita registrada para este imóvel.');
  const proposalHTML=v25DetailRows(proposals.map(x=>`<article class="v25-detail-row"><div class="v25-detail-icon">◇</div><div><b>${safe(x.client)}</b><p>${safe(x.id)} · ${safe(x.type)} · ${safe(x.status)}</p></div><aside><strong>${money(x.value)}</strong><span>${brDate(x.date)}</span></aside></article>`),'Nenhuma proposta registrada para este imóvel.');
  const docsHTML=v25DetailRows(contracts.map(x=>`<article class="v25-detail-row"><div class="v25-detail-icon">▤</div><div><b>${safe(x.id)} · ${safe(x.type)}</b><p>${safe(x.client)} · ${safe(x.status)}</p></div><aside><strong>${money(x.value)}</strong><span>${brDate(x.start)}</span></aside></article>`),'Nenhum contrato ou documento vinculado ao imóvel.');
  const body=`<div class="property-workspace" data-property="${p.id}">
    <div class="pw-hero"><div class="pw-gallery"><div class="pw-main-photo" id="pwMainPhoto" style="background-image:url('${selected.src}')"></div><span class="pw-photo-counter" id="pwPhotoCounter">${photos.findIndex(x=>x.id===selected.id)+1} / ${photos.length} fotos</span><span class="pw-photo-room" id="pwPhotoRoom">${safe(selected.room||'Foto')}</span></div><aside class="pw-summary"><div class="pw-summary-top"><div><span class="pw-kicker">${safe(p.id)} · ${safe(p.type)} · ${safe(p.purpose)}</span><h2>${safe(p.title)}</h2></div><div class="pw-address">${safe(p.address)}</div><div class="pw-price"><strong>${money(p.price)}</strong><small>${p.purpose==='Locação'?'valor mensal anunciado':'valor de comercialização'}</small></div><div><span class="status">${safe(p.status)}</span></div></div><div class="v25-property-side internal-only"><div class="v25-property-side-card"><span>Corretor responsável</span><b>${safe(broker)}</b></div><div class="v25-property-side-card"><span>Proprietário</span><b>${safe(p.owner||'Não informado')}</b></div><div class="v25-property-side-card"><span>Captação</span><b>${safe(owner?.exclusivity||'Não informada')}</b></div><div class="v25-property-side-card"><span>Site</span><b>${p.published?'Publicado':'Não publicado'}</b></div></div><div class="pw-summary-actions internal-only"><button class="btn primary" onclick="editPropertyFromDetails('${p.id}')">Editar informações</button><button class="btn" onclick="switchPropertyTab('gallery')">＋ Fotos</button><button class="btn" onclick="switchPropertyTab('media')">▶ Vídeos</button><button class="btn v25-presentation-btn" onclick="togglePresentationMode()">Modo apresentação</button></div></aside></div>
    <div class="pw-spec-grid"><div class="pw-spec"><span>Área privativa</span><b>${Number(p.area||0).toLocaleString('pt-BR')} m²</b></div><div class="pw-spec"><span>Dormitórios / suítes</span><b>${p.beds||0} / ${p.suites||0}</b></div><div class="pw-spec"><span>Banheiros</span><b>${p.baths||0}</b></div><div class="pw-spec"><span>Vagas</span><b>${p.parking||0}</b></div></div>
    <div class="pw-tabs"><button class="pw-tab ${tab==='overview'?'active':''}" data-pw-tab="overview" onclick="switchPropertyTab('overview')">Visão geral</button><button class="pw-tab ${tab==='gallery'?'active':''}" data-pw-tab="gallery" onclick="switchPropertyTab('gallery')">Galeria <span>${photos.length}</span></button><button class="pw-tab ${tab==='media'?'active':''}" data-pw-tab="media" onclick="switchPropertyTab('media')">Vídeos <span>${(p.videos||[]).length}</span></button><button class="pw-tab internal-only ${tab==='interested'?'active':''}" data-pw-tab="interested" onclick="switchPropertyTab('interested')">Interessados <span>${interested.length}</span></button><button class="pw-tab internal-only ${tab==='visits'?'active':''}" data-pw-tab="visits" onclick="switchPropertyTab('visits')">Visitas <span>${visits.length}</span></button><button class="pw-tab internal-only ${tab==='proposals'?'active':''}" data-pw-tab="proposals" onclick="switchPropertyTab('proposals')">Propostas <span>${proposals.length}</span></button><button class="pw-tab internal-only ${tab==='documents'?'active':''}" data-pw-tab="documents" onclick="switchPropertyTab('documents')">Documentos <span>${contracts.length}</span></button><button class="pw-tab internal-only ${tab==='owner'?'active':''}" data-pw-tab="owner" onclick="switchPropertyTab('owner')">Proprietário</button><button class="pw-tab internal-only ${tab==='history'?'active':''}" data-pw-tab="history" onclick="switchPropertyTab('history')">Histórico</button></div>
    <div class="pw-panel ${tab==='overview'?'active':''}" data-pw-panel="overview"><div class="pw-overview-grid"><div><section class="pw-section"><span class="v5-kicker">APRESENTAÇÃO</span><h3>Sobre o imóvel</h3><p>${safe(p.notes||'Sem descrição cadastrada para este imóvel.')}</p></section><section class="pw-section"><span class="v5-kicker">DIFERENCIAIS</span><h3>O que torna este imóvel especial</h3><div class="pw-chips">${features.length?features.map(x=>`<span class="pw-chip">✓ ${safe(x)}</span>`).join(''):'<span style="font-size:9px;color:var(--muted)">Nenhum diferencial cadastrado.</span>'}</div></section><section class="pw-section internal-only"><span class="v5-kicker">FICHA TÉCNICA</span><div class="pw-data-grid">${overviewData.map(x=>`<div class="pw-data"><span>${x[0]}</span><b>${safe(x[1])}</b></div>`).join('')}</div></section></div><aside class="internal-only"><section class="pw-section"><span class="v5-kicker">PULSO COMERCIAL</span><h3>Saúde deste imóvel</h3><div class="pw-data-grid">${propertyMarketPulse(p).map(m=>`<div class="pw-data"><span>${safe(m.label)}</span><b>${m.value}</b></div>`).join('')}</div></section><section class="pw-section"><span class="v5-kicker">PROPRIETÁRIO</span><div class="pw-owner"><div class="avatar">${initials(p.owner)}</div><div><b>${safe(p.owner||'Não informado')}</b><small>${owner?`${fmtPhone(owner.phone)} · ${safe(owner.exclusivity)}`:'Vínculo cadastrado no imóvel'}</small></div>${owner?`<button class="btn small" onclick="openTimeline('${escJS(owner.name)}')">360°</button>`:''}</div></section></aside></div></div>
    <div class="pw-panel ${tab==='gallery'?'active':''}" data-pw-panel="gallery"><div class="pw-gallery-toolbar internal-only"><div><label for="photoRoomType">Ambiente das novas fotos</label><select id="photoRoomType" class="form-control">${propertyRoomOptions()}</select></div><div><label for="propertyPhotoInput">Selecionar uma ou várias imagens</label><input id="propertyPhotoInput" class="pw-file" type="file" accept="image/*" multiple></div><button class="btn primary" type="button" onclick="addPropertyPhotos('${p.id}',this)">Adicionar à galeria</button></div><div class="pw-gallery-grid">${photos.map(ph=>`<article class="pw-photo-card" draggable="true" data-photo-id="${ph.id}" ondragstart="startPhotoDrag(event,'${p.id}','${ph.id}')" ondragend="endPhotoDrag(event)" ondragover="photoDragOver(event)" ondragleave="photoDragLeave(event)" ondrop="dropPhotoBefore(event,'${p.id}','${ph.id}')"><div class="pw-photo-img" style="background-image:url('${ph.src}')" onclick="previewPropertyPhoto('${p.id}','${ph.id}')">${p.coverPhoto===ph.id?'<span class="pw-cover-badge">★ Capa do anúncio</span>':''}</div><div class="pw-photo-meta"><b>${safe(ph.room||'Foto')}</b><small>${safe(ph.name||'Imagem do imóvel')}</small></div><div class="pw-photo-actions internal-only">${p.coverPhoto!==ph.id?`<button class="btn" onclick="setPropertyCover('${p.id}','${ph.id}')">Definir capa</button>`:''}<button class="btn" onclick="renamePropertyPhoto('${p.id}','${ph.id}')">Renomear</button>${photos.length>1?`<button class="btn danger" onclick="removePropertyPhoto('${p.id}','${ph.id}')">Excluir</button>`:''}</div></article>`).join('')}</div></div>
    <div class="pw-panel ${tab==='media'?'active':''}" data-pw-panel="media">
      <section class="pw-section">
        <span class="v5-kicker">MÍDIA DO IMÓVEL</span>
        <h3>Vídeos e Tour 360°</h3>
        <p class="pw-media-note">Cole somente os links dos vídeos. O CRM não armazena o arquivo, então o sistema e o site continuam leves. YouTube, Vimeo e MP4 por URL são aceitos.</p>
        <div class="pw-media-toolbar">
          <div class="form-group"><label>Título</label><input id="propertyVideoTitle" class="form-control" placeholder="Ex.: Tour completo"></div>
          <div class="form-group"><label>URL do vídeo</label><input id="propertyVideoUrl" class="form-control" placeholder="YouTube, Vimeo ou MP4"></div>
          <div class="form-group"><label>URL da capa / thumbnail</label><input id="propertyVideoThumb" class="form-control" placeholder="Opcional"></div>
          <button class="btn primary" type="button" onclick="addPropertyVideo('${p.id}')">＋ Adicionar vídeo</button>
        </div>
        <div class="pw-media-list">${(p.videos||[]).length?(p.videos||[]).map(v=>`<article class="pw-video-card"><div class="pw-video-thumb" style="background-image:url('${safe(propertyVideoThumb(p,v))}')"></div><div class="pw-video-meta"><b>${safe(v.title||'Vídeo do imóvel')}</b><small>${safe(v.url||'')}</small></div><div class="pw-video-actions">${p.videoFeaturedId!==v.id?`<button class="btn" type="button" onclick="setPropertyFeaturedVideo('${p.id}','${v.id}')">Destacar</button>`:`<button class="btn" type="button" disabled>★ Destaque</button>`}<button class="btn danger" type="button" onclick="removePropertyVideo('${p.id}','${v.id}')">Excluir</button></div></article>`).join(''):'<div class="pw-media-empty">Nenhum vídeo cadastrado neste imóvel.</div>'}</div>
        <div class="pw-tour-box">
          <div><label>Tour 360° / visita virtual</label><input id="propertyTour360Url" class="form-control" value="${safe(p.tour360Url||'')}" placeholder="Cole o link do tour 360°"></div>
          <button class="btn primary" type="button" onclick="savePropertyTour360('${p.id}')">Salvar tour 360°</button>
        </div>
      </section>
    </div>
    <div class="pw-panel internal-only ${tab==='interested'?'active':''}" data-pw-panel="interested">${interestedHTML}</div>
    <div class="pw-panel internal-only ${tab==='visits'?'active':''}" data-pw-panel="visits">${visitsHTML}</div>
    <div class="pw-panel internal-only ${tab==='proposals'?'active':''}" data-pw-panel="proposals">${proposalHTML}</div>
    <div class="pw-panel internal-only ${tab==='documents'?'active':''}" data-pw-panel="documents">${docsHTML}</div>
    <div class="pw-panel internal-only ${tab==='owner'?'active':''}" data-pw-panel="owner"><div class="pw-overview-grid"><section class="pw-section"><span class="v5-kicker">PROPRIETÁRIO</span><h3>${safe(owner?.name||p.owner||'Não informado')}</h3><p>${owner?`${safe(owner.doc)} · ${fmtPhone(owner.phone)} · ${safe(owner.email)}`:'Cadastre o proprietário na aba Proprietários para completar esta ficha.'}</p><div class="pw-data-grid" style="margin-top:14px"><div class="pw-data"><span>Captação</span><b>${safe(owner?.exclusivity||'—')}</b></div><div class="pw-data"><span>Captador</span><b>${safe(owner?.broker||'—')}</b></div><div class="pw-data"><span>Data</span><b>${brDate(owner?.capture||'')}</b></div><div class="pw-data"><span>Banco</span><b>${safe(owner?.bank||'—')}</b></div></div></section><section class="pw-section"><span class="v5-kicker">AÇÕES</span><h3>Relacionamento</h3><div class="actions">${owner?`<button class="btn primary" onclick="openTimeline('${escJS(owner.name)}')">Abrir Timeline 360°</button><button class="btn" onclick="editItem('owner','${owner.id}')">Editar proprietário</button>`:'<button class="btn primary" onclick="openModal(\'owner\',{})">Cadastrar proprietário</button>'}</div></section></div></div>
    <div class="pw-panel internal-only ${tab==='history'?'active':''}" data-pw-panel="history"><div class="pw-history">${history.map(e=>`<div class="pw-history-item"><time>${brDate(e.date)} · ${safe(e.type)}</time><b>${safe(e.title)}</b><p>${safe(e.text)}</p></div>`).join('')||'<div class="pw-section"><p>Nenhum evento registrado.</p></div>'}</div></div>
  </div>`;
  showModal('Ficha do imóvel',body,'');
  const modal=$('#modal');modal.classList.add('property-detail-shell');modal.classList.remove('presentation-mode');
};

function togglePresentationMode(){
  const modal=document.querySelector('#modal.property-detail-shell');if(!modal)return;
  const active=modal.classList.toggle('presentation-mode');
  if(active){switchPropertyTab('overview');toast('Modo apresentação ativo. Informações internas ocultadas.')}
  else toast('Modo apresentação encerrado.');
}

function startPhotoDrag(event,propertyId,photoId){
  v25DraggedPhoto={propertyId,photoId};event.currentTarget.classList.add('is-photo-dragging');
  try{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',photoId)}catch(e){}
}
function endPhotoDrag(event){event.currentTarget.classList.remove('is-photo-dragging');document.querySelectorAll('.photo-drop-target').forEach(x=>x.classList.remove('photo-drop-target'))}
function photoDragOver(event){event.preventDefault();event.currentTarget.classList.add('photo-drop-target')}
function photoDragLeave(event){event.currentTarget.classList.remove('photo-drop-target')}
function dropPhotoBefore(event,propertyId,targetPhotoId){
  event.preventDefault();event.currentTarget.classList.remove('photo-drop-target');
  if(!v25DraggedPhoto||v25DraggedPhoto.propertyId!==propertyId||v25DraggedPhoto.photoId===targetPhotoId)return;
  const p=(db.properties||[]).find(x=>x.id===propertyId);if(!p||!Array.isArray(p.photos))return;
  const from=p.photos.findIndex(x=>x.id===v25DraggedPhoto.photoId),to=p.photos.findIndex(x=>x.id===targetPhotoId);if(from<0||to<0)return;
  const [moved]=p.photos.splice(from,1);p.photos.splice(to,0,moved);v25DraggedPhoto=null;saveDB();openPropertyDetails(propertyId,'gallery',moved.id);toast('Ordem das fotos atualizada.');
}


function journeyInteractionOptions(stage){
  const map={
    'Novo':['Tentativa de contato','WhatsApp enviado','Ligação realizada','E-mail enviado','Lead qualificado','Observação'],
    'Contato':['Retorno realizado','WhatsApp','Ligação','Reunião','Qualificação de interesse','Documentos solicitados','Observação'],
    'Visita':['Visita agendada','Visita realizada','Feedback da visita','Reagendamento','Cliente não compareceu','Observação'],
    'Proposta':['Proposta enviada','Contraproposta recebida','Negociação','Documentos em análise','Aceite verbal','Proposta recusada','Observação'],
    'Fechado':['Contrato assinado','Venda concluída','Locação concluída','Entrega de chaves','Pós-venda','Observação']
  };
  return map[stage]||['Contato','Observação'];
}
function journeyLastInteraction(lead){
  const events=(db.timelines||[]).filter(e=>e.leadId===lead.id || e.person===lead.name).sort((a,b)=>`${b.date||''} ${b.time||''}`.localeCompare(`${a.date||''} ${a.time||''}`));
  return events[0]||null;
}
function openJourneyInteraction(leadId){
  const lead=(db.leads||[]).find(x=>x.id===leadId);if(!lead)return;
  const opts=journeyInteractionOptions(lead.stage);
  const body=`<form id="journeyInteractionForm" class="form-grid">
    <div class="journey-status-banner"><span>Status atual da jornada</span><b>${safe(lead.stage)}</b></div>
    <div class="journey-help">A interação ficará vinculada a <b>${safe(lead.name)}</b> e ao status <b>${safe(lead.stage)}</b> da jornada. O histórico também será registrado na Timeline 360°.</div>
    ${selectField('interactionType','Tipo de interação',opts,opts[0])}
    ${selectField('result','Resultado',['Em andamento','Aguardando cliente','Retornar','Interessado','Sem retorno','Não interessado','Concluído'],'Em andamento')}
    ${field('date','Data',todayISO(),'date','required')}
    ${field('time','Hora',new Date().toTimeString().slice(0,5),'time','required')}
    ${field('nextAction','Próxima ação / retorno','','date')}
    ${field('broker','Corretor responsável',lead.broker||'','text','readonly')}
    <div class="form-group full"><label>Interação / observação</label><textarea class="form-control" name="notes" rows="5" required placeholder="Ex.: Cliente confirmou interesse, pediu retorno após conversar com a família..."></textarea></div>
  </form>`;
  showModal(`Interação · ${safe(lead.name)}`,body,'');
  const foot=document.createElement('div');foot.className='modal-foot';foot.innerHTML=`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveJourneyInteraction('${lead.id}')">Salvar interação</button>`;document.querySelector('#modal')?.appendChild(foot);
}
function saveJourneyInteraction(leadId){
  const lead=(db.leads||[]).find(x=>x.id===leadId),form=document.querySelector('#journeyInteractionForm');if(!lead||!form)return;if(!form.reportValidity())return;
  const fd=Object.fromEntries(new FormData(form).entries());db.timelines ||= [];
  const event={id:'TL'+uid().slice(-7).toUpperCase(),leadId:lead.id,person:lead.name,date:fd.date,time:fd.time,type:`Jornada · ${lead.stage}`,title:fd.interactionType,text:`${fd.notes}${fd.result?` · Resultado: ${fd.result}`:''}`,stage:lead.stage,result:fd.result,broker:lead.broker,nextAction:fd.nextAction||''};
  db.timelines.push(event);lead.lastInteractionAt=`${fd.date}T${fd.time}`;lead.lastInteraction=fd.interactionType;lead.lastInteractionResult=fd.result;lead.lastInteractionNote=fd.notes;lead.nextActionDate=fd.nextAction||'';
  pushActivity('↗',`Interação · ${lead.stage}`,`${lead.name} · ${fd.interactionType}`);closeModal();saveDB();toast('Interação registrada na Jornada e na Timeline 360°.');
}

renderKanban=function(){
  const stages=['Novo','Contato','Visita','Proposta','Fechado'];
  const root=$('#kanban');if(!root)return;
  root.innerHTML=stages.map(s=>{const items=(db.leads||[]).filter(l=>l.stage===s);return `<div class="kan-col" data-stage="${s}"><div class="kan-title"><span>${s}</span><span class="kan-count">${items.length}</span></div><div class="kan-cards">${items.map(l=>{const last=journeyLastInteraction(l);return `<div class="lead-card" draggable="true" data-id="${l.id}"><span class="v5-kicker">${safe(l.source||'Lead')} · ${safe(l.temp||'')}</span><h4>${safe(l.name)}</h4><p>${safe(l.interest)} · ${safe(l.broker)}</p><div class="lead-value">${money(l.value)}</div>${last?`<div class="journey-last"><b>Última interação · ${safe(last.stage||l.stage)}</b>${safe(last.title)} · ${brDate(last.date)} ${safe(last.time||'')}</div>`:`<div class="journey-last"><b>Sem interação neste histórico</b>Registre o primeiro movimento deste status.</div>`}<div class="lead-foot"><span class="temp">${safe(l.temp)}</span><span class="avatar" style="width:26px;height:26px;font-size:8px">${initials(l.broker)}</span></div><div class="journey-actions"><button type="button" class="btn interaction-btn" draggable="false" onclick="event.stopPropagation();openJourneyInteraction('${l.id}')">＋ Interação</button><button type="button" class="btn timeline-btn" draggable="false" title="Timeline 360°" onclick="event.stopPropagation();openTimeline('${escJS(l.name)}')">360°</button></div></div>`}).join('')}</div></div>`}).join('');
  $$('.lead-card',root).forEach(c=>{
    c.addEventListener('dragstart',e=>{if(e.target.closest('button')){e.preventDefault();return}c.classList.add('is-dragging');e.dataTransfer.setData('text/plain',c.dataset.id);e.dataTransfer.effectAllowed='move'});
    c.addEventListener('dragend',()=>c.classList.remove('is-dragging'));
  });
  $$('.kan-col',root).forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('dragover')});
    col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('dragover')});
    col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('dragover');const id=e.dataTransfer.getData('text/plain'),lead=(db.leads||[]).find(x=>x.id===id);if(lead){const from=lead.stage,to=col.dataset.stage;if(from!==to){lead.stage=to;addTimeline(lead.name,'Jornada','Etapa alterada',`${from} → ${to}`);const ev=(db.timelines||[])[(db.timelines||[]).length-1];if(ev){ev.leadId=lead.id;ev.stage=to;ev.broker=lead.broker}pushActivity('▥','Lead movido',`${lead.name} → ${lead.stage}`)}col.classList.add('drop-confirmed');setTimeout(()=>col.classList.remove('drop-confirmed'),520);saveDB();toast(from===to?'Lead permaneceu na mesma etapa.':'Etapa atualizada e registrada na timeline.')}});
  });
};

function applyV25Reveal(){
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const nodes=[...document.querySelectorAll('.page.active .card:not([data-v25-reveal]),.page.active .property-card:not([data-v25-reveal]),.page.active .v25-attention-card:not([data-v25-reveal])')];
  nodes.forEach((el,i)=>{
    el.dataset.v25Reveal='1';
    if(reduce)return;
    el.classList.add('v25-reveal');
    setTimeout(()=>el.classList.add('in'),Math.min(280,i*28));
  });
}

function bindV25PropertySearch(){
  ['propertySearch','propertyTypeFilter','propertyPurposeFilter'].forEach(id=>{
    const el=$('#'+id);if(el&&!el.dataset.v25Bound){el.dataset.v25Bound='1';el.addEventListener('input',()=>renderProperties());el.addEventListener('change',()=>renderProperties())}
  });
  const search=$('#propertySearch');if(search)search.placeholder='Busque por código ou tente: apartamento até 900 mil em Jaraguá do Sul com 3 quartos';
}

function bindV25NavigationEnhancements(){
  const global=$('#globalSearch');
  if(global){global.placeholder='Buscar ou abrir Command Center...';global.addEventListener('click',()=>openCommandCenter(global.value||''))}
  const key=document.querySelector('.search-key');if(key)key.textContent='CTRL K';
  const intro=document.querySelector('.intro-actions');if(intro&&!intro.querySelector('[data-v25-command-button]'))intro.insertAdjacentHTML('beforeend','<button class="btn" data-v25-command-button onclick="openCommandCenter()">⌘ Command Center</button>');
}

function renderV25All(){
  renderV25Dashboard();
  applyV25Reveal();
}

const v25RenderAllBase=renderAll;
renderAll=function(){
  v25RenderAllBase();
  renderV25Dashboard();
  applyV25Reveal();
};

bindV25CommandCenter();
bindV25PropertySearch();
bindV25NavigationEnhancements();
window.openCommandCenter=openCommandCenter;
window.closeCommandCenter=closeCommandCenter;
window.renderCommandResults=renderCommandResults;
window.parsePropertyQuery=parsePropertyQuery;
window.togglePresentationMode=togglePresentationMode;
window.sharePropertyV25=sharePropertyV25;
window.startPhotoDrag=startPhotoDrag;
window.endPhotoDrag=endPhotoDrag;
window.photoDragOver=photoDragOver;
window.photoDragLeave=photoDragLeave;
window.dropPhotoBefore=dropPhotoBefore;


renderAll();
