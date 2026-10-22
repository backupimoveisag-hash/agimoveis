/* AG CRM V119 — Agenda colaborativa: participantes, vídeo, chat e arquivos */
(function(){
  'use strict';

  const $id=id=>document.getElementById(id);
  const norm=v=>String(v||'').trim().toLowerCase();
  let meetingPoll=null;
  let jitsiApi=null;
  let jitsiPromise=null;
  let activeMeetingId='';

  function session(){
    try{return JSON.parse(localStorage.getItem('nexoSessionV1')||'{}')||{}}catch(e){return {}}
  }
  function profile(){
    try{return window.EIFirebaseCRM?.getProfile?.()||{}}catch(e){return {}}
  }
  function me(){
    const s=session(),p=profile();
    return {
      uid:String(s.uid||p.uid||''),
      name:String(p.name||s.name||p.email||s.email||'Usuário'),
      email:String(p.email||s.email||''),
      role:String(p.role||s.role||'Usuário')
    };
  }
  function isAdmin(){return me().role==='Administrador'}
  function appointmentById(id){return (db.appointments||[]).find(a=>String(a.id)===String(id))||null}
  function isVideoMeeting(a){return !!(a&&a.type==='Reunião'&&a.meeting?.enabled)}
  function participantMatch(a,user=me()){
    if(!a)return false;
    const parts=Array.isArray(a.meeting?.participants)?a.meeting.participants:[];
    return parts.some(p=>
      (user.uid&&String(p.uid||'')===user.uid) ||
      (user.email&&norm(p.email)===norm(user.email)) ||
      (user.name&&norm(p.name)===norm(user.name))
    );
  }
  function canSee(a){
    if(isAdmin())return true;
    const u=me();
    if(participantMatch(a,u))return true;
    if(u.uid&&String(a.ownerUid||'')===u.uid)return true;
    if(u.name&&norm(a.broker)===norm(u.name))return true;
    if(u.email&&norm(a.brokerEmail)===norm(u.email))return true;
    return false;
  }
  function canEdit(a){
    if(isAdmin())return true;
    if(isVideoMeeting(a))return false;
    const u=me();
    return (u.uid&&String(a.ownerUid||'')===u.uid)||(u.name&&norm(a.broker)===norm(u.name));
  }
  function visibleAppointments(){return (db.appointments||[]).filter(canSee)}
  function esc(v){return typeof safe==='function'?safe(v):String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function js(v){return String(v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
  function fmtDateTime(iso){
    if(!iso)return'—';
    try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso))}catch(e){return iso}
  }
  function roomStatus(a){
    if(!isVideoMeeting(a))return {key:'normal',label:a?.type||'Compromisso'};
    if(a.meeting?.endedAt)return {key:'ended',label:'Reunião encerrada'};
    if(a.meeting?.startedAt)return {key:'live',label:'Reunião em andamento'};
    return {key:'waiting',label:'Aguardando o Administrador iniciar'};
  }
  function randomRoom(){
    const bytes=new Uint8Array(14);crypto.getRandomValues(bytes);
    return 'AGCRM-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  function activeUsers(){
    return (db.users||[]).filter(u=>u&&u.active!==false&&String(u.role||'')!=='Administrador').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
  }
  function userUid(u){return String(u.firebaseUid||u.uid||u.id||'')}

  function participantPicker(data){
    const selected=Array.isArray(data?.meeting?.participants)?data.meeting.participants:[];
    const selectedKeys=new Set(selected.flatMap(p=>[String(p.uid||''),norm(p.email),norm(p.name)]).filter(Boolean));
    const users=activeUsers();
    if(!users.length)return '<div class="ag-meet-empty">Nenhum usuário ativo disponível. Cadastre/aprove os usuários em Ajustes → Usuários.</div>';
    return users.map(u=>{
      const uid=userUid(u),email=String(u.email||''),name=String(u.name||email||'Usuário');
      const checked=selectedKeys.has(uid)||selectedKeys.has(norm(email))||selectedKeys.has(norm(name));
      return `<label class="ag-meet-person"><input type="checkbox" data-ag-meeting-participant value="${esc(uid)}" data-name="${esc(name)}" data-email="${esc(email)}" ${checked?'checked':''}><span class="ag-meet-avatar">${esc(typeof initials==='function'?initials(name):name.slice(0,1).toUpperCase())}</span><span><b>${esc(name)}</b><small>${esc(u.role||'Usuário')}${email?' · '+esc(email):''}</small></span></label>`;
    }).join('');
  }

  const baseOpenModal=window.openModal||openModal;
  const enhancedOpenModal=function(type,data={}){
    if(type!=='appointment')return baseOpenModal.apply(this,arguments);
    if(data?.id&&isVideoMeeting(data)&&!canEdit(data)){
      return window.agOpenMeetingDetails(data.id);
    }
    editing={type:'appointment',id:data.id||null};
    const brokers=(db.users||[]).filter(u=>u.active!==false).map(u=>u.name).filter(Boolean);
    const u=me();
    const brokerValue=data.broker||u.name||brokers[0]||'';
    const admin=isAdmin();
    const meetingEnabled=!!(data.meeting?.enabled||data.videoMeeting);
    const body=`<form id="modalForm" class="form-grid ag-appointment-form">
      ${field('date','Data',data.date||todayISO(),'date','required')}
      ${field('time','Hora',data.time||'09:00','time','required')}
      ${selectField('type','Tipo',['Visita','Retorno','Reunião','Assinatura','Tarefa'],data.type||'Visita')}
      ${field('title','Título',data.title,'text','required')}
      ${field('client','Cliente / assunto',data.client||'','text','required')}
      ${selectField('broker','Responsável',brokers.length?brokers:[brokerValue],brokerValue)}
      ${selectField('property','Imóvel',['',...(db.properties||[]).map(p=>p.id)],data.property||'')}
      <div class="form-group full"><label>Observações</label><textarea class="form-control" name="notes" rows="3">${esc(data.notes||'')}</textarea></div>
      ${admin?`<section class="ag-meeting-config full" id="agMeetingConfig">
        <div class="ag-meeting-config-head"><div><span class="v5-kicker">REUNIÃO COLABORATIVA</span><h3>Vídeo, chat e arquivos pela Agenda</h3></div><label class="ag-meet-switch"><input type="checkbox" id="agVideoMeetingEnabled" ${meetingEnabled?'checked':''}><span>Reunião por vídeo</span></label></div>
        <p>Selecione as pessoas envolvidas. O compromisso aparecerá automaticamente na agenda delas. A sala só será liberada depois que o Administrador iniciar a reunião.</p>
        <div id="agMeetingPeopleWrap" ${meetingEnabled?'':'hidden'}><label class="ag-meet-label">Mencionar participantes</label><div class="ag-meet-people" id="agMeetingParticipants">${participantPicker(data)}</div></div>
      </section>`:''}
    </form>`;
    showModal(data.id?'Editar compromisso':'Novo compromisso',body,'Salvar');
    setTimeout(()=>{
      const typeEl=document.querySelector('#modalForm [name="type"]');
      const toggle=$id('agVideoMeetingEnabled');
      const wrap=$id('agMeetingPeopleWrap');
      const sync=()=>{
        if(!toggle||!wrap)return;
        const isMeeting=typeEl?.value==='Reunião';
        toggle.disabled=!isMeeting;
        if(!isMeeting)toggle.checked=false;
        wrap.hidden=!isMeeting||!toggle.checked;
      };
      typeEl?.addEventListener('change',sync);
      toggle?.addEventListener('change',sync);
      sync();
    },0);
  };
  try{openModal=enhancedOpenModal}catch(e){}
  window.openModal=enhancedOpenModal;

  const baseSaveModal=window.saveModal||saveModal;
  const enhancedSaveModal=function(){
    if(editing?.type!=='appointment'||!document.querySelector('#modalForm.ag-appointment-form'))return baseSaveModal.apply(this,arguments);
    const form=document.querySelector('#modalForm');
    if(!form.reportValidity())return;
    const fd=Object.fromEntries(new FormData(form).entries());
    const existing=editing.id?appointmentById(editing.id):null;
    const u=me();
    if(!editing.id)fd.id='A'+uid().slice(-6).toUpperCase();
    else fd.id=editing.id;
    fd.ownerUid=existing?.ownerUid||u.uid||'';
    fd.ownerName=existing?.ownerName||u.name||'';
    fd.ownerEmail=existing?.ownerEmail||u.email||'';
    fd.updatedAt=new Date().toISOString();
    if(!existing)fd.createdAt=fd.updatedAt;

    const videoEnabled=isAdmin()&&fd.type==='Reunião'&&!!$id('agVideoMeetingEnabled')?.checked;
    if(videoEnabled){
      const participants=[...document.querySelectorAll('[data-ag-meeting-participant]:checked')].map(el=>({
        uid:String(el.value||''),name:String(el.dataset.name||''),email:String(el.dataset.email||'')
      }));
      const prev=existing?.meeting||{};
      fd.meeting={
        ...prev,
        enabled:true,
        organizerUid:prev.organizerUid||u.uid||'',
        organizerName:prev.organizerName||u.name||'Administrador',
        organizerEmail:prev.organizerEmail||u.email||'',
        participants,
        chat:Array.isArray(prev.chat)?prev.chat:[],
        files:Array.isArray(prev.files)?prev.files:[]
      };
    }else if(existing?.meeting){
      fd.meeting={...existing.meeting,enabled:false};
    }

    if(existing){
      const i=(db.appointments||[]).findIndex(a=>a.id===existing.id);
      if(i>=0)db.appointments[i]={...existing,...fd};
    }else{
      db.appointments=db.appointments||[];
      db.appointments.push(fd);
    }
    pushActivity('□','Compromisso atualizado',`${fd.type} · ${fd.title}`);
    closeModal();saveDB();
    toast(videoEnabled?'Reunião salva e adicionada às agendas dos participantes.':'Compromisso salvo com sucesso.');
  };
  try{saveModal=enhancedSaveModal}catch(e){}
  window.saveModal=enhancedSaveModal;

  function actionButtons(a){
    if(!a)return'';
    if(isVideoMeeting(a)){
      const st=roomStatus(a);
      if(isAdmin()){
        if(st.key==='waiting')return `<button class="btn small primary" onclick="agStartMeeting('${js(a.id)}')">▶ Iniciar reunião</button><button class="btn small" onclick="editItem('appointment','${js(a.id)}')">Editar</button>`;
        if(st.key==='live')return `<button class="btn small primary" onclick="agOpenMeetingRoom('${js(a.id)}')">Entrar na sala</button><button class="btn small danger" onclick="agEndMeeting('${js(a.id)}')">Encerrar</button>`;
        return `<button class="btn small" onclick="agOpenMeetingDetails('${js(a.id)}')">Detalhes</button><button class="btn small" onclick="editItem('appointment','${js(a.id)}')">Editar</button>`;
      }
      if(!participantMatch(a)&&!canSee(a))return'';
      if(st.key==='live')return `<button class="btn small primary" onclick="agOpenMeetingRoom('${js(a.id)}')">Entrar na reunião</button>`;
      return `<button class="btn small" onclick="agOpenMeetingDetails('${js(a.id)}')">${st.key==='waiting'?'Aguardando início':'Ver reunião'}</button>`;
    }
    return canEdit(a)?`<button class="btn small" onclick="editItem('appointment','${js(a.id)}')">Editar</button>`:'';
  }

  const enhancedRenderCalendar=function(){
    const y=calendarDate.getFullYear(),m=calendarDate.getMonth();
    const title=$id('calendarTitle');if(!title)return;
    title.textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(calendarDate).replace(/^./,s=>s.toUpperCase());
    const all=visibleAppointments();
    const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
    let html=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<div class="dow">${d}</div>`).join('');
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const iso=d.toISOString().slice(0,10),events=all.filter(a=>a.date===iso),muted=d.getMonth()!==m,today=iso===todayISO();
      html+=`<div class="day ${muted?'muted':''} ${today?'today':''}" data-date="${iso}"><b>${d.getDate()}</b>${events.slice(0,2).map(e=>{const st=roomStatus(e);return `<button type="button" class="event-chip ${e.type==='Visita'?'visit':''} ${isVideoMeeting(e)?'ag-meeting-chip '+st.key:''}" onclick="${isVideoMeeting(e)?`agOpenMeetingDetails('${js(e.id)}')`:`editItem('appointment','${js(e.id)}')`}" title="${esc(e.title)}">${esc(e.time)} ${isVideoMeeting(e)?'● ':''}${esc(e.title)}</button>`}).join('')}${events.length>2?`<small>+${events.length-2}</small>`:''}</div>`;
    }
    $id('calendarGrid').innerHTML=html;
    const now=todayISO();
    const ap=all.filter(a=>a.date>=now).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,12);
    $id('appointmentList').innerHTML=ap.map(a=>{
      const st=roomStatus(a),parts=Array.isArray(a.meeting?.participants)?a.meeting.participants:[];
      return `<div class="mini-item ag-agenda-item ${isVideoMeeting(a)?'is-meeting':''}"><div class="thumb">${isVideoMeeting(a)?'▣':a.type==='Visita'?'⌂':'□'}</div><div class="ag-agenda-copy"><b>${esc(a.title)}</b><small>${brDate(a.date)} · ${esc(a.time)} · ${esc(a.client)}</small>${isVideoMeeting(a)?`<div class="ag-meeting-meta"><span class="ag-meeting-status ${st.key}">${esc(st.label)}</span><span>${parts.length} participante${parts.length===1?'':'s'}</span></div>`:''}</div><div class="right ag-agenda-actions">${actionButtons(a)}</div></div>`;
    }).join('')||'<div class="empty">Sem compromissos.</div>';
  };
  try{renderCalendar=enhancedRenderCalendar}catch(e){}
  window.renderCalendar=enhancedRenderCalendar;

  try{
    const baseDashboard=renderDashboardLists;
    const wrappedDashboard=function(){
      if(isAdmin())return baseDashboard.apply(this,arguments);
      const original=db.appointments;db.appointments=visibleAppointments();
      try{return baseDashboard.apply(this,arguments)}finally{db.appointments=original}
    };
    renderDashboardLists=wrappedDashboard;window.renderDashboardLists=wrappedDashboard;
  }catch(e){console.warn('AG V119 dashboard filter',e)}

  function ensureOverlay(){
    let ov=$id('agMeetingOverlay');if(ov)return ov;
    ov=document.createElement('div');ov.id='agMeetingOverlay';ov.className='ag-meeting-overlay';ov.hidden=true;
    ov.innerHTML=`<div class="ag-meeting-shell" role="dialog" aria-modal="true" aria-label="Sala de reunião">
      <header class="ag-meeting-room-head"><div><span class="v5-kicker">AGENDA · REUNIÃO</span><h2 id="agMeetingRoomTitle">Reunião</h2><p id="agMeetingRoomSubtitle"></p></div><div class="ag-meeting-room-actions" id="agMeetingRoomActions"></div><button class="close ag-meeting-close" type="button" aria-label="Fechar" onclick="agCloseMeetingRoom()">×</button></header>
      <div class="ag-meeting-room-grid">
        <section class="ag-meeting-video"><div id="agMeetingVideoStage" class="ag-meeting-video-stage"></div></section>
        <aside class="ag-meeting-collab">
          <section class="ag-meeting-panel"><div class="ag-meeting-panel-head"><h3>Chat</h3><span id="agMeetingChatCount">0</span></div><div id="agMeetingChat" class="ag-meeting-chat"></div><div class="ag-meeting-chat-compose"><textarea id="agMeetingChatInput" rows="2" placeholder="Escreva uma mensagem…"></textarea><button class="btn primary" type="button" onclick="agSendMeetingChat()">Enviar</button></div></section>
          <section class="ag-meeting-panel ag-meeting-files-panel"><div class="ag-meeting-panel-head"><h3>Arquivos</h3><button class="btn small" type="button" onclick="document.getElementById('agMeetingFileInput').click()">＋ Enviar</button><input id="agMeetingFileInput" type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.ppt,.pptx"></div><div id="agMeetingFiles" class="ag-meeting-files"></div><div id="agMeetingUploadState" class="ag-meeting-upload-state"></div></section>
        </aside>
      </div>
    </div>`;
    document.body.appendChild(ov);
    $id('agMeetingFileInput')?.addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(f)await uploadMeetingFile(f)});
    $id('agMeetingChatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.agSendMeetingChat()}});
    return ov;
  }

  function detailsHtml(a){
    const st=roomStatus(a),parts=Array.isArray(a.meeting?.participants)?a.meeting.participants:[];
    const people=parts.map(p=>`<span class="ag-meet-mentioned">@${esc(p.name||p.email||'Usuário')}</span>`).join('')||'<span class="ag-meet-muted">Nenhum participante mencionado.</span>';
    let controls='';
    if(isAdmin()){
      if(st.key==='waiting')controls=`<button class="btn primary" onclick="closeModal();agStartMeeting('${js(a.id)}')">▶ Iniciar reunião</button>`;
      else if(st.key==='live')controls=`<button class="btn primary" onclick="closeModal();agOpenMeetingRoom('${js(a.id)}')">Entrar na sala</button><button class="btn danger" onclick="closeModal();agEndMeeting('${js(a.id)}')">Encerrar reunião</button>`;
      else controls=`<button class="btn" onclick="closeModal();editItem('appointment','${js(a.id)}')">Editar compromisso</button>`;
    }else if(st.key==='live')controls=`<button class="btn primary" onclick="closeModal();agOpenMeetingRoom('${js(a.id)}')">Entrar na reunião</button>`;
    else controls=`<button class="btn" disabled>${st.key==='waiting'?'Aguardando o Administrador iniciar':'Reunião encerrada'}</button>`;
    return `<div class="ag-meeting-details"><div class="ag-meeting-hero ${st.key}"><span class="ag-meeting-status ${st.key}">${esc(st.label)}</span><h3>${esc(a.title)}</h3><p>${brDate(a.date)} às ${esc(a.time)} · ${esc(a.client)}</p></div><div class="ag-meeting-detail-grid"><div><span>Organizador</span><b>${esc(a.meeting?.organizerName||a.broker||'Administrador')}</b></div><div><span>Participantes</span><b>${parts.length}</b></div><div><span>Início</span><b>${a.meeting?.startedAt?fmtDateTime(a.meeting.startedAt):'Ainda não iniciada'}</b></div><div><span>Arquivos</span><b>${Array.isArray(a.meeting?.files)?a.meeting.files.length:0}</b></div></div><div class="ag-meeting-mentions"><label>Pessoas envolvidas</label>${people}</div><div class="ag-meeting-detail-actions">${controls}</div></div>`;
  }

  window.agOpenMeetingDetails=function(id){
    const a=appointmentById(id);if(!a||!canSee(a))return toast('Você não tem acesso a esta reunião.');
    showModal('Reunião da Agenda',detailsHtml(a),'');
  };

  window.agStartMeeting=function(id){
    if(!isAdmin())return toast('Somente o Administrador pode iniciar a reunião.');
    const a=appointmentById(id);if(!a||!isVideoMeeting(a))return toast('Reunião por vídeo não encontrada.');
    a.meeting=a.meeting||{};
    if(!a.meeting.roomName)a.meeting.roomName=randomRoom();
    a.meeting.startedAt=new Date().toISOString();
    a.meeting.endedAt='';
    a.meeting.startedByUid=me().uid||'';
    a.meeting.startedByName=me().name||'Administrador';
    saveDB();toast('Reunião iniciada. Os participantes já podem entrar.');
    window.agOpenMeetingRoom(id);
  };

  window.agEndMeeting=function(id){
    if(!isAdmin())return toast('Somente o Administrador pode encerrar a reunião.');
    const a=appointmentById(id);if(!a?.meeting)return;
    if(!confirm('Encerrar esta reunião para todos os participantes?'))return;
    a.meeting.endedAt=new Date().toISOString();
    a.meeting.endedByUid=me().uid||'';
    saveDB();
    if(activeMeetingId===id){refreshMeetingRoom();disposeJitsi()}
    toast('Reunião encerrada.');
  };

  function loadJitsi(){
    if(window.JitsiMeetExternalAPI)return Promise.resolve(window.JitsiMeetExternalAPI);
    if(jitsiPromise)return jitsiPromise;
    jitsiPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://meet.jit.si/external_api.js';s.async=true;
      s.onload=()=>window.JitsiMeetExternalAPI?resolve(window.JitsiMeetExternalAPI):reject(new Error('API de vídeo indisponível.'));
      s.onerror=()=>reject(new Error('Não foi possível carregar a sala de vídeo. Verifique a conexão com a internet.'));
      document.head.appendChild(s);
    });
    return jitsiPromise;
  }
  function disposeJitsi(){try{jitsiApi?.dispose?.()}catch(e){}jitsiApi=null}
  async function mountJitsi(a){
    if(jitsiApi||!a?.meeting?.roomName||a.meeting?.endedAt)return;
    const stage=$id('agMeetingVideoStage');if(!stage)return;
    stage.innerHTML='<div class="ag-meeting-loading"><span class="ag-meet-spinner"></span><b>Carregando sala de vídeo…</b><small>Permita acesso à câmera e ao microfone quando o navegador solicitar.</small></div>';
    try{
      await loadJitsi();
      stage.innerHTML='';
      const u=me();
      jitsiApi=new window.JitsiMeetExternalAPI('meet.jit.si',{
        roomName:a.meeting.roomName,
        parentNode:stage,
        width:'100%',height:'100%',lang:'ptBR',
        userInfo:{displayName:u.name,email:u.email||undefined},
        configOverwrite:{prejoinPageEnabled:true,startWithAudioMuted:false,startWithVideoMuted:false},
        interfaceConfigOverwrite:{MOBILE_APP_PROMO:false,SHOW_JITSI_WATERMARK:false}
      });
    }catch(err){stage.innerHTML=`<div class="ag-meeting-wait"><b>Não foi possível abrir o vídeo.</b><p>${esc(err.message||err)}</p><button class="btn" onclick="agRetryMeetingVideo()">Tentar novamente</button></div>`}
  }
  window.agRetryMeetingVideo=function(){disposeJitsi();const a=appointmentById(activeMeetingId);if(a)mountJitsi(a)};

  function refreshMeetingRoom(){
    const a=appointmentById(activeMeetingId);if(!a)return;
    const st=roomStatus(a),parts=Array.isArray(a.meeting?.participants)?a.meeting.participants:[];
    const title=$id('agMeetingRoomTitle'),sub=$id('agMeetingRoomSubtitle');
    if(title)title.textContent=a.title||'Reunião';
    if(sub)sub.textContent=`${brDate(a.date)} às ${a.time} · ${parts.length} participante${parts.length===1?'':'s'} · ${st.label}`;
    const actions=$id('agMeetingRoomActions');
    if(actions)actions.innerHTML=isAdmin()&&st.key==='live'?`<button class="btn danger small" onclick="agEndMeeting('${js(a.id)}')">Encerrar para todos</button>`:'';
    const stage=$id('agMeetingVideoStage');
    if(stage){
      if(st.key==='waiting'){
        disposeJitsi();
        stage.innerHTML=`<div class="ag-meeting-wait"><span>▣</span><b>Aguardando o Administrador iniciar</b><p>Quando a reunião for iniciada, a sala de vídeo será liberada automaticamente.</p>${isAdmin()?`<button class="btn primary" onclick="agStartMeeting('${js(a.id)}')">▶ Iniciar agora</button>`:''}</div>`;
      }else if(st.key==='ended'){
        disposeJitsi();
        stage.innerHTML=`<div class="ag-meeting-wait ended"><span>✓</span><b>Reunião encerrada</b><p>Encerrada em ${fmtDateTime(a.meeting.endedAt)}.</p></div>`;
      }else if(!jitsiApi){mountJitsi(a)}
    }
    renderMeetingChat(a,st.key==='live');
    renderMeetingFiles(a,st.key==='live');
  }

  function renderMeetingChat(a,enabled){
    const chat=Array.isArray(a.meeting?.chat)?a.meeting.chat:[];
    const box=$id('agMeetingChat'),count=$id('agMeetingChatCount'),input=$id('agMeetingChatInput');
    if(count)count.textContent=chat.length;
    if(input){input.disabled=!enabled;input.placeholder=enabled?'Escreva uma mensagem…':'O chat é liberado quando o Administrador iniciar a reunião.'}
    if(!box)return;
    const u=me();
    box.innerHTML=chat.length?chat.map(m=>`<div class="ag-chat-msg ${String(m.senderUid||'')===u.uid?'mine':''}"><div><b>${esc(m.senderName||'Usuário')}</b><time>${fmtDateTime(m.at)}</time></div><p>${esc(m.text||'')}</p></div>`).join(''):'<div class="ag-meet-empty">Nenhuma mensagem ainda.</div>';
    box.scrollTop=box.scrollHeight;
  }
  window.agSendMeetingChat=function(){
    const a=appointmentById(activeMeetingId),input=$id('agMeetingChatInput');
    if(!a||roomStatus(a).key!=='live'||!input)return;
    const text=String(input.value||'').trim();if(!text)return;
    if(!canSee(a))return toast('Você não participa desta reunião.');
    const u=me();a.meeting.chat=Array.isArray(a.meeting.chat)?a.meeting.chat:[];
    a.meeting.chat.push({id:'M'+uid(),senderUid:u.uid,senderName:u.name,senderEmail:u.email,text:text.slice(0,3000),at:new Date().toISOString()});
    input.value='';saveDB();renderMeetingChat(a,true);
  };

  function renderMeetingFiles(a,enabled){
    const files=Array.isArray(a.meeting?.files)?a.meeting.files:[];
    const box=$id('agMeetingFiles'),inp=$id('agMeetingFileInput');if(inp)inp.disabled=!enabled;
    if(!box)return;
    box.innerHTML=files.length?files.map(f=>`<button type="button" class="ag-meeting-file" onclick="agDownloadMeetingFile('${js(f.id||'')}','${js(f.name||'Arquivo')}')"><span>↓</span><div><b>${esc(f.name||'Arquivo')}</b><small>${esc(f.uploadedBy||'Usuário')} · ${fmtDateTime(f.at)}</small></div></button>`).join(''):'<div class="ag-meet-empty">Nenhum arquivo compartilhado.</div>';
  }
  function fileDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Falha ao ler o arquivo.'));r.readAsDataURL(file)})}
  async function uploadMeetingFile(file){
    const a=appointmentById(activeMeetingId),state=$id('agMeetingUploadState');
    if(!a||roomStatus(a).key!=='live')return toast('A reunião precisa estar em andamento para enviar arquivos.');
    if(!canSee(a))return toast('Você não participa desta reunião.');
    if(file.size>10*1024*1024)return toast('Envie arquivos de até 10 MB.');
    if(!window.AGDriveGateway?.configured?.())return toast('Configure o Google Drive em Ajustes antes de enviar arquivos.');
    const allowed=/^(application\/pdf|image\/(jpeg|png|webp)|text\/(plain|csv)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation))$/i;
    if(file.type&&!allowed.test(file.type))return toast('Formato não permitido. Use PDF, Office, texto/CSV ou imagem.');
    try{
      if(state)state.textContent='Enviando '+file.name+' para o Google Drive…';
      const dataUrl=await fileDataUrl(file),u=me();
      const r=await window.AGDriveGateway.request('uploadMeetingFile',{dataUrl,fileName:file.name,mimeType:file.type||'application/octet-stream',meetingId:a.id,meetingTitle:a.title,uploadedBy:u.name});
      a.meeting.files=Array.isArray(a.meeting.files)?a.meeting.files:[];
      a.meeting.files.push({id:r.fileId||('F'+uid()),name:r.fileName||file.name,mimeType:file.type||'',uploadedBy:u.name,uploadedByUid:u.uid,at:new Date().toISOString()});
      saveDB();renderMeetingFiles(a,true);if(state)state.textContent='Arquivo enviado com sucesso.';toast('Arquivo compartilhado na reunião.');
    }catch(err){if(state)state.textContent=err.message||String(err);toast('Não foi possível enviar o arquivo.');}
  }


  window.agDownloadMeetingFile=async function(fileId,fileName){
    if(!fileId)return toast('Arquivo inválido.');
    if(!window.AGDriveGateway?.configured?.())return toast('Google Drive não configurado.');
    const state=$id('agMeetingUploadState');
    try{
      if(state)state.textContent='Preparando '+String(fileName||'arquivo')+'…';
      const r=await window.AGDriveGateway.request('getMeetingFile',{fileId:String(fileId)});
      if(!r?.dataUrl)throw new Error('O arquivo não foi retornado pelo Google Drive.');
      const a=document.createElement('a');a.href=r.dataUrl;a.download=r.fileName||fileName||'arquivo';document.body.appendChild(a);a.click();a.remove();
      if(state)state.textContent='Arquivo baixado.';
    }catch(err){if(state)state.textContent=err.message||String(err);toast('Não foi possível baixar o arquivo.');}
  };

  window.agOpenMeetingRoom=function(id){
    const a=appointmentById(id);if(!a||!canSee(a))return toast('Você não tem acesso a esta reunião.');
    if(!isVideoMeeting(a))return toast('Este compromisso não possui sala de vídeo.');
    const st=roomStatus(a);
    if(st.key==='waiting'&&!isAdmin())return window.agOpenMeetingDetails(id);
    activeMeetingId=id;ensureOverlay().hidden=false;document.body.classList.add('ag-meeting-open');
    refreshMeetingRoom();clearInterval(meetingPoll);meetingPoll=setInterval(refreshMeetingRoom,1800);
  };
  window.agCloseMeetingRoom=function(){
    clearInterval(meetingPoll);meetingPoll=null;disposeJitsi();activeMeetingId='';
    const ov=$id('agMeetingOverlay');if(ov)ov.hidden=true;document.body.classList.remove('ag-meeting-open');
  };

  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$id('agMeetingOverlay')?.hidden)window.agCloseMeetingRoom()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeMeetingId)refreshMeetingRoom()});

  setTimeout(()=>{try{renderCalendar()}catch(e){}},300);
})();
