/* AG CRM V118 — distribuição de leads: roleta sequencial ou atribuição manual */
(function(){
  const PENDING='Aguardando atribuição';

  function profile(){try{return window.EIFirebaseCRM?.getProfile?.()||JSON.parse(localStorage.getItem('nexoSessionV1')||'null')}catch(e){return null}}
  function isAdmin(){return profile()?.role==='Administrador'}
  function userKey(u){return String(u?.uid||u?.id||u?.email||u?.name||'').trim()}
  function distributionUsers(){
    const list=(db.users||[]).filter(u=>u&&u.active!==false&&/^(Corretor|Corretora|Gerente)$/i.test(String(u.role||'Corretor')));
    return list.length?list:(db.users||[]).filter(u=>u&&u.active!==false&&!/Financeiro|Marketing/i.test(String(u.role||'')));
  }
  function ensureDistributionSchema(){
    db.automation ||= {};
    if(!db.automation.distributionMode) db.automation.distributionMode=db.automation.roundRobin===false?'manual':'roulette';
    if(!Array.isArray(db.automation.rouletteOrder)) db.automation.rouletteOrder=[];
    db.automation.rrIndex=Math.max(0,Number(db.automation.rrIndex||0));
    const users=distributionUsers(),valid=new Set(users.map(userKey));
    db.automation.rouletteOrder=db.automation.rouletteOrder.filter(k=>valid.has(k));
    users.forEach(u=>{const k=userKey(u);if(k&&!db.automation.rouletteOrder.includes(k))db.automation.rouletteOrder.push(k)});
    db.automation.roundRobin=db.automation.distributionMode==='roulette';
  }
  function orderedUsers(){
    ensureDistributionSchema();
    const users=distributionUsers(),byKey=new Map(users.map(u=>[userKey(u),u]));
    const ordered=(db.automation.rouletteOrder||[]).map(k=>byKey.get(k)).filter(Boolean);
    users.forEach(u=>{if(!ordered.some(x=>userKey(x)===userKey(u)))ordered.push(u)});
    return ordered;
  }

  // Substitui a escolha antiga: no manual nenhum corretor é assumido automaticamente.
  nextBroker=function(){
    ensureDistributionSchema();
    if(db.automation.distributionMode==='manual')return PENDING;
    const list=orderedUsers();
    if(!list.length)return PENDING;
    const idx=Number(db.automation.rrIndex||0)%list.length;
    const broker=list[idx]?.name||PENDING;
    db.automation.rrIndex=(idx+1)%list.length;
    return broker;
  };
  window.nextBroker=nextBroker;

  // Não cria SLA de atendimento enquanto um lead manual ainda não possui corretor.
  const baseAddAutomationTask=addAutomationTask;
  addAutomationTask=function(lead,kind='first',dueAt){
    if(!lead||lead.broker===PENDING||!String(lead.broker||'').trim())return null;
    return baseAddAutomationTask(lead,kind,dueAt);
  };
  window.addAutomationTask=addAutomationTask;

  function moveOrder(key,dir){
    ensureDistributionSchema();
    const a=db.automation.rouletteOrder,i=a.indexOf(key),j=i+dir;
    if(i<0||j<0||j>=a.length)return;
    [a[i],a[j]]=[a[j],a[i]];
    renderDistributionSettings();
  }
  window.agMoveRouletteBroker=moveOrder;

  function renderDistributionSettings(){
    ensureDistributionSchema();
    const mode=db.automation.distributionMode;
    document.querySelectorAll('[data-lead-distribution-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.leadDistributionMode===mode));
    const hiddenToggle=document.getElementById('autoRoundRobinToggle');
    if(hiddenToggle){hiddenToggle.classList.toggle('on',mode==='roulette');hiddenToggle.closest('.auto-switch-row')?.classList.add('ag-v118-hidden-old-toggle')}
    const seq=document.getElementById('autoBrokerOrder');
    const title=document.querySelector('.ag-auto-broker-title');
    if(title)title.style.display=mode==='roulette'?'':'none';
    if(seq){
      seq.style.display=mode==='roulette'?'grid':'none';
      seq.innerHTML=orderedUsers().map((u,i)=>{const k=userKey(u);return `<div class="ag-roulette-row"><span class="ag-roulette-position">${i+1}</span><div class="ag-roulette-person"><b>${safe(u.name||'Corretor')}</b><small>${safe(u.role||'Corretor')}</small></div><div class="ag-roulette-actions"><button type="button" class="btn small" onclick="agMoveRouletteBroker('${String(k).replace(/'/g,"\\'")}',-1)" ${i===0?'disabled':''}>↑</button><button type="button" class="btn small" onclick="agMoveRouletteBroker('${String(k).replace(/'/g,"\\'")}',1)" ${i===orderedUsers().length-1?'disabled':''}>↓</button></div></div>`}).join('')||'<div class="ag-distribution-empty">Nenhum corretor ativo para a roleta.</div>';
    }
    const help=document.getElementById('agLeadDistributionHelp');
    if(help)help.innerHTML=mode==='roulette'?'<b>Roleta sequencial ativa.</b> Cada novo lead vai para o próximo corretor da ordem abaixo.':'<b>Atribuição manual ativa.</b> Novos leads entram sem corretor e ficam aguardando o Administrador definir o responsável.';
  }

  document.addEventListener('click',e=>{
    const modeBtn=e.target.closest('[data-lead-distribution-mode]');
    if(modeBtn){
      db.automation.distributionMode=modeBtn.dataset.leadDistributionMode;
      db.automation.roundRobin=db.automation.distributionMode==='roulette';
      if(db.automation.distributionMode==='roulette')db.automation.rrIndex=0;
      renderDistributionSettings();
      return;
    }
  });

  const baseRenderAutomationCenter=renderAutomationCenter;
  renderAutomationCenter=function(){
    const r=baseRenderAutomationCenter.apply(this,arguments);
    renderDistributionSettings();
    return r;
  };
  window.renderAutomationCenter=renderAutomationCenter;

  // O botão existente continua salvando SLA/follow-up; esta camada salva modo e ordem junto.
  document.getElementById('saveAutomationSettings')?.addEventListener('click',()=>{
    ensureDistributionSchema();
    db.automation.roundRobin=db.automation.distributionMode==='roulette';
    saveDB();
  });

  function assignmentOptions(selected=''){
    const users=distributionUsers();
    return ['<option value="">Selecione o corretor</option>',...users.map(u=>`<option value="${safe(u.name)}" ${u.name===selected?'selected':''}>${safe(u.name)} · ${safe(u.role||'Corretor')}</option>`)].join('');
  }
  function openAssignment(leadId){
    if(!isAdmin()){toast('Somente o Administrador pode atribuir leads manualmente.');return}
    const lead=(db.leads||[]).find(l=>l.id===leadId);if(!lead)return;
    editing={type:'leadAssignment',id:leadId};
    showModal('Atribuir lead',`<form id="modalForm" class="form-grid"><div class="form-group full"><label>Contato</label><div class="ag-assignment-contact"><b>${safe(lead.name||'Lead')}</b><span>${safe(fmtPhone(lead.phone)||lead.email||'')}</span></div></div><div class="form-group full"><label>Corretor responsável</label><select class="form-control" name="broker" required>${assignmentOptions(lead.broker===PENDING?'':lead.broker)}</select></div></form>`,'Confirmar atribuição');
  }
  window.agOpenLeadAssignment=openAssignment;

  const baseSaveModal=saveModal;
  saveModal=async function(){
    if(editing.type==='leadAssignment'){
      const form=document.getElementById('modalForm');if(!form?.reportValidity())return;
      const lead=(db.leads||[]).find(l=>l.id===editing.id);if(!lead)return;
      const broker=new FormData(form).get('broker');
      const u=distributionUsers().find(x=>x.name===broker);
      lead.broker=broker;lead.ownerUid=u?.uid||u?.id||'';lead.ownerEmail=u?.email||'';lead.assignedAt=new Date().toISOString();lead.assignedBy=profile()?.name||'Administrador';
      addAutomationTask(lead,'first');
      try{addTimeline(lead.name,'Distribuição','Lead atribuído',`Responsável: ${broker}`)}catch(e){}
      closeModal();saveDB();toast(`Lead atribuído para ${broker}.`);return;
    }
    if(editing.type==='lead'){
      const form=document.getElementById('modalForm');if(!form?.reportValidity())return;
      const fd=Object.fromEntries(new FormData(form).entries());
      const current=editing.id?(db.leads||[]).find(x=>x.id===editing.id):null;
      const p=profile();let broker=current?.broker||'';
      if(!current){
        if(p&&p.role!=='Administrador'&&p.name)broker=p.name;
        else broker=nextBroker();
      }
      const ownerUser=distributionUsers().find(u=>u.name===broker);
      const record={...(current||{}),...fd,id:current?.id||('L'+uid().slice(-6).toUpperCase()),source:current?.source||'Cadastro manual',stage:current?.stage||'Novo',broker:broker||PENDING,ownerUid:current?.ownerUid||ownerUser?.uid||ownerUser?.id||(p?.role!=='Administrador'?p?.uid||'':''),ownerEmail:current?.ownerEmail||ownerUser?.email||(p?.role!=='Administrador'?p?.email||'':''),value:Number(current?.value||0),temp:current?.temp||'Morno',created:current?.created||todayISO()};
      if(current){const i=db.leads.findIndex(x=>x.id===current.id);db.leads[i]=record}else{db.leads.push(record);addAutomationTask(record,'first')}
      pushActivity('◎',current?'Contato atualizado':'Novo contato',`${record.name} · ${record.interest}`);
      closeModal();try{saveDB();toast(record.broker===PENDING?'Contato salvo e aguardando atribuição.':'Contato salvo com sucesso.')}catch(e){console.error(e);toast('Não foi possível salvar o contato.')}return;
    }
    return baseSaveModal.apply(this,arguments);
  };
  window.saveModal=saveModal;

  // Lista mostra claramente o responsável e permite atribuição/retribuição pelo Administrador.
  renderLeads=function(){
    ensureDistributionSchema();
    const q=document.getElementById('leadSearch')?.value.toLowerCase()||'';
    const interest=document.getElementById('leadSourceFilter')?.value||'';
    const list=(db.leads||[]).filter(l=>(!q||[l.name,l.phone,l.email,l.interest,l.broker].join(' ').toLowerCase().includes(q))&&(!interest||l.interest===interest));
    const tbody=document.getElementById('leadTable');if(!tbody)return;
    tbody.innerHTML=list.map(l=>`<tr>
      <td><div class="row-avatar"><div class="avatar">${initials(l.name)}</div><div><b>${safe(l.name)}</b><small>${fmtPhone(l.phone)}</small></div></div></td>
      <td>${safe(l.email||'—')}</td>
      <td><b class="v98-interest">${safe(l.interest||'—')}</b></td>
      <td><span class="ag-lead-owner ${l.broker===PENDING||!l.broker?'pending':''}">${safe(l.broker||PENDING)}</span></td>
      <td><div class="actions">${l.phone&&l.broker!==PENDING?`<button class="btn small primary" onclick="openLeadWhatsApp('${l.id}')">WhatsApp</button>`:''}${isAdmin()?`<button class="btn small gold" onclick="agOpenLeadAssignment('${l.id}')">${l.broker===PENDING||!l.broker?'Atribuir':'Reatribuir'}</button>`:''}<button class="btn small" onclick="editItem('lead','${l.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('lead','${l.id}')">Excluir</button></div></td>
    </tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhum contato encontrado.</td></tr>';
  };
  window.renderLeads=renderLeads;

  ensureDistributionSchema();
  try{renderDistributionSettings();renderLeads()}catch(e){console.warn('Distribuição V118',e)}
})();
