/* AG CRM V130 — sala de reunião nativa WebRTC, sem Jitsi/Meet/Zoom */
(async()=>{
  const cfg=window.EI_FIREBASE_CONFIG||{};
  if(!cfg.enabled||!cfg.apiKey||!cfg.projectId)return;
  const [{getApps},{getAuth,onAuthStateChanged},{getFirestore,doc,setDoc,getDoc,getDocs,updateDoc,collection,addDoc,onSnapshot,query,where,serverTimestamp,deleteDoc}]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);
  let app=getApps()[0];
  if(!app){
    await new Promise(resolve=>window.addEventListener('ag:firebase-ready',resolve,{once:true}));
    app=getApps()[0];
  }
  if(!app)return;
  const auth=getAuth(app), fs=getFirestore(app,cfg.databaseId||'(default)');
  let currentUser=null,meetings=[],meetingUnsub=null,msgUnsub=null,roomMeeting=null,lastAdminMode=null,directoryUsers=[],meetingIdsSignature='';
  let localStream=null,screenStream=null,rtcParticipantsUnsub=null,rtcInboxUnsub=null,roomMeetingUnsub=null,rtcHeartbeat=null,roomClosing=false;
  const rtcPeers=new Map(),rtcParticipantCache=new Map();
  const RTC_ICE_SERVERS=Array.isArray(cfg.rtcIceServers)&&cfg.rtcIceServers.length?cfg.rtcIceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const profile=()=>window.EIFirebaseCRM?.getProfile?.()||null;
  const isAdmin=()=>profile()?.active!==false&&profile()?.role==='Administrador';
  const displayName=()=>profile()?.name||currentUser?.displayName||currentUser?.email||'Usuário';
  const meetingId=()=>`M${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const today=()=>new Date().toISOString().slice(0,10);
  const fmtDate=d=>{if(!d)return'—';const [y,m,day]=String(d).split('-');return `${day}/${m}/${y}`};
  const fmtBytes=n=>{n=Number(n||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`};
  const meetingRef=id=>doc(fs,'meetings',id);
  const appointmentsSectionRef=()=>doc(fs,'workspaces',cfg.workspaceId||'main','sections','appointments');
  const meetingDeletionsSectionRef=()=>doc(fs,'workspaces',cfg.workspaceId||'main','sections','meetingDeletions');
  const deletedMeetingIds=new Set();
  function deletionList(){try{return (typeof db!=='undefined'&&Array.isArray(db.meetingDeletions))?db.meetingDeletions:[]}catch(e){return[]}}
  function isTombstoned(a){const aid=String(a?.id||'').trim(),mid=String(a?.meetingId||a?.id||'').trim();return deletionList().some(d=>(aid&&String(d?.appointmentId||'')===aid)||(mid&&String(d?.meetingId||'')===mid))}
  function rememberDeletion(appointmentId,meetingId,title=''){if(typeof db==='undefined')return;db.meetingDeletions=deletionList();const aid=String(appointmentId||''),mid=String(meetingId||'');if(db.meetingDeletions.some(d=>(aid&&String(d?.appointmentId||'')===aid)||(mid&&String(d?.meetingId||'')===mid)))return;db.meetingDeletions.push({id:`D${Date.now().toString(36).toUpperCase()}`,appointmentId:aid,meetingId:mid,title:String(title||''),deletedAt:new Date().toISOString(),deletedBy:currentUser?.uid||''});if(db.meetingDeletions.length>500)db.meetingDeletions=db.meetingDeletions.slice(-500)}
  // V121: os participantes da reunião são lidos diretamente da coleção users do Firestore.
  // Mantemos o cadastro local apenas como contingência para bases antigas.
  const userAuthUid=u=>String(u?.firebaseUid||u?.uid||'').trim();
  const validDirectoryUser=u=>u&&u.active!==false&&u.approvalStatus!=='pending'&&u.approvalStatus!=='rejected'&&userAuthUid(u)&&userAuthUid(u)!==currentUser?.uid;
  function users(){
    try{
      const map=new Map();
      (directoryUsers||[]).forEach(u=>{const uid=userAuthUid(u);if(validDirectoryUser(u))map.set(uid,u)});
      ((typeof db!=='undefined'&&Array.isArray(db.users))?db.users:[]).forEach(u=>{const uid=userAuthUid(u);if(validDirectoryUser(u)&&!map.has(uid))map.set(uid,u)});
      return [...map.values()].sort((a,b)=>String(a.name||a.email||'').localeCompare(String(b.name||b.email||''),'pt-BR'));
    }catch(e){return[]}
  }
  async function refreshMeetingDirectory(){
    if(!currentUser||!isAdmin())return users();
    // Fonte principal: o mesmo diretório que alimenta Ajustes > Usuários.
    // Ele já sabe alternar entre SDK do Firestore e HTTPS autenticado.
    try{
      const shared=await window.EIFirebaseCRM?.listUsers?.();
      if(Array.isArray(shared)){
        directoryUsers=shared.map(u=>({uid:userAuthUid(u)||u.uid||'',firebaseUid:userAuthUid(u)||u.uid||'',...u}));
        if(users().length)return users();
      }
    }catch(err){
      console.warn('AG CRM: diretório unificado indisponível para a reunião.',err);
    }
    // Contingência: leitura direta do Firestore.
    try{
      const snap=await getDocs(collection(fs,'users'));
      directoryUsers=[];
      snap.forEach(d=>directoryUsers.push({uid:d.id,firebaseUid:d.id,...d.data()}));
      return users();
    }catch(err){
      console.warn('AG CRM: não foi possível carregar usuários para a reunião.',err);
      return users();
    }
  }

  function injectAgenda(){
    const page=$('page-agenda'); if(!page||$('agMeetingZone'))return;
    const head=page.querySelector('.page-head .head-actions');
    if(head){head.classList.add('ag-meeting-head-actions');const btn=document.createElement('button');btn.className='btn primary';btn.id='agNewVideoMeeting';btn.type='button';btn.innerHTML='▣ Nova reunião por vídeo';btn.style.display=isAdmin()?'':'none';head.prepend(btn);btn.onclick=()=>openMeetingForm();}
    const zone=document.createElement('article');zone.className='card ag-meeting-zone';zone.id='agMeetingZone';zone.innerHTML=`<div class="card-head"><div class="ag-meeting-zone-title"><span class="ag-meeting-icon">▣</span><div><h3>Sala de reuniões</h3><small>Reuniões da agenda com vídeo, chat e arquivos.</small></div></div><span class="status info" id="agMeetingCloudState">Sincronizando</span></div><div class="ag-meeting-list" id="agMeetingList"><div class="ag-meeting-empty">Carregando reuniões…</div></div>`;page.appendChild(zone);
    injectOverlays();
  }
  function injectOverlays(){
    if(!$('agMeetingFormOverlay'))document.body.insertAdjacentHTML('beforeend',`<div class="ag-meeting-overlay" id="agMeetingFormOverlay"><div class="ag-meeting-dialog"><div class="ag-meeting-dialog-head"><h2 id="agMeetingFormTitle">Nova reunião</h2><button class="close" id="agMeetingFormClose">×</button></div><div class="ag-meeting-dialog-body"><form id="agMeetingForm" class="ag-meeting-form-grid"><div class="form-group full"><label>Assunto da reunião</label><input class="form-control" name="title" required placeholder="Ex.: Reunião comercial semanal"></div><div class="form-group"><label>Data</label><input class="form-control" name="date" type="date" required></div><div class="form-group"><label>Horário</label><input class="form-control" name="time" type="time" required></div><div class="form-group full"><label>Observações / pauta</label><textarea class="form-control" name="notes" rows="3" placeholder="Pauta, decisões esperadas ou orientações…"></textarea></div><div class="form-group full"><label>Participantes / @menções</label><div class="ag-meeting-participants-tools"><select class="form-control" id="agMeetingGroup"><option value="">Selecionar grupo…</option><option value="ALL">Todos os usuários</option><option value="BROKERS">Corretores</option><option value="Atendimento">Atendimento</option><option value="Marketing">Marketing</option><option value="Financeiro">Financeiro</option><option value="Gerente">Gerência</option></select><button class="btn small" type="button" id="agMeetingClearPeople">Limpar seleção</button></div><div class="ag-meeting-participants" id="agMeetingPeople"></div><small>O Administrador é incluído automaticamente. Os convidados verão a reunião na própria Agenda.</small></div><input type="hidden" name="meetingId"></form></div><div class="ag-meeting-dialog-foot"><button class="btn" id="agMeetingCancel" type="button">Cancelar</button><button class="btn primary" id="agMeetingSave" type="button">Salvar reunião</button></div></div></div>`);
    if(!$('agRoomOverlay'))document.body.insertAdjacentHTML('beforeend',`<div class="ag-room-overlay" id="agRoomOverlay"><div class="ag-room-top"><button class="btn small" id="agRoomLeave" type="button">← Sair</button><div class="ag-room-title"><b id="agRoomTitle">Sala de reunião</b><small id="agRoomSubtitle">AG CRM · sala própria</small></div><span class="ag-room-status" id="agRoomStatus">Conectando…</span><button class="btn small ag-room-end" id="agRoomEnd" type="button" hidden>Encerrar para todos</button></div><div class="ag-room-layout"><section class="ag-room-video"><div class="ag-rtc-grid" id="agRtcGrid"></div><div class="ag-room-wait" id="agRoomWait"><div><strong>Preparando sala…</strong><p>Ativando câmera, microfone e conexão segura entre os participantes.</p></div></div><div class="ag-rtc-controls" id="agRtcControls"><button type="button" id="agRtcMic" class="ag-rtc-control active" title="Microfone">🎤<span>Microfone</span></button><button type="button" id="agRtcCamera" class="ag-rtc-control active" title="Câmera">📹<span>Câmera</span></button><button type="button" id="agRtcScreen" class="ag-rtc-control" title="Compartilhar tela">🖥️<span>Apresentar</span></button><button type="button" id="agRtcPeople" class="ag-rtc-control" title="Participantes">👥<span id="agRtcPeopleCount">1</span></button></div></section><aside class="ag-room-side"><div class="ag-room-tabs"><button class="active" data-room-tab="chat">Chat</button><button data-room-tab="files">Arquivos</button><button data-room-tab="people">Pessoas</button></div><div class="ag-room-panel active" data-room-panel="chat"><div class="ag-chat-list" id="agChatList"></div><div class="ag-chat-compose"><input class="form-control" id="agChatInput" placeholder="Escreva uma mensagem…"><button class="btn primary" id="agChatSend" type="button">Enviar</button></div></div><div class="ag-room-panel" data-room-panel="files"><div class="ag-file-list" id="agFileList"></div><div class="ag-file-upload"><input type="file" id="agMeetingFile" hidden><button class="btn primary" id="agMeetingFileBtn" type="button" style="width:100%">＋ Enviar arquivo</button><small style="display:block;margin-top:7px;color:#7a838c">Até 10 MB por arquivo · salvo no Google Drive do CRM.</small></div></div><div class="ag-room-panel" data-room-panel="people"><div class="ag-rtc-people-list" id="agRtcPeopleList"></div></div></aside></div></div>`);
    $('agMeetingFormClose').onclick=closeMeetingForm;$('agMeetingCancel').onclick=closeMeetingForm;$('agMeetingSave').onclick=saveMeetingForm;$('agMeetingClearPeople').onclick=()=>document.querySelectorAll('#agMeetingPeople input').forEach(i=>i.checked=false);
    $('agMeetingGroup').onchange=e=>selectGroup(e.target.value);
    $('agRoomLeave').onclick=closeRoom;$('agRoomEnd').onclick=endMeeting;$('agChatSend').onclick=sendChat;$('agChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});
    $('agRtcMic').onclick=toggleMicrophone;$('agRtcCamera').onclick=toggleCamera;$('agRtcScreen').onclick=toggleScreenShare;$('agRtcPeople').onclick=()=>switchRoomTab('people');
    document.querySelectorAll('[data-room-tab]').forEach(b=>b.onclick=()=>switchRoomTab(b.dataset.roomTab));
    $('agMeetingFileBtn').onclick=()=>$('agMeetingFile').click();$('agMeetingFile').onchange=uploadMeetingFile;
  }
  function renderPeople(selected=[]){const set=new Set(selected);const box=$('agMeetingPeople');if(!box)return;box.innerHTML=users().map(u=>{const authUid=userAuthUid(u);return `<label class="ag-meeting-person"><input type="checkbox" value="${esc(authUid)}" ${set.has(authUid)?'checked':''}><span><b>@${esc(u.name||u.email)}</b><small>${esc(u.role||'Usuário')} · ${esc(u.email||'')}</small></span></label>`}).join('')||'<div class="ag-meeting-empty">Nenhum outro usuário ativo e aprovado foi encontrado. Confira Ajustes → Usuários e permissões.</div>'}
  const roleKey=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isBrokerRole=u=>{const r=roleKey(u?.role);return r==='corretor'||r==='corretora'||r.startsWith('corretor ')||r.startsWith('corretora ')||r==='broker'};
  function selectGroup(group){
    const groupKey=roleKey(group);
    document.querySelectorAll('#agMeetingPeople input').forEach(i=>{
      const u=users().find(x=>userAuthUid(x)===i.value);if(!u)return;
      const matches=group==='ALL'||(group==='BROKERS'&&isBrokerRole(u))||roleKey(u.role)===groupKey;
      i.checked=matches;
    });
  }
  async function openMeetingForm(m=null){
    if(!isAdmin())return;
    injectAgenda();
    const form=$('agMeetingForm');
    form.reset();
    form.elements.title.value=m?.title||'';
    form.elements.date.value=m?.date||today();
    form.elements.time.value=m?.time||'09:00';
    form.elements.notes.value=m?.notes||'';
    form.elements.meetingId.value=m?.id||'';
    $('agMeetingFormTitle').textContent=m?'Editar reunião':'Nova reunião por vídeo';
    $('agMeetingPeople').innerHTML='<div class="ag-meeting-empty">Carregando usuários cadastrados…</div>';
    $('agMeetingFormOverlay').classList.add('show');
    await refreshMeetingDirectory();
    renderPeople((m?.participantUids||[]).filter(x=>x!==currentUser?.uid));
  }
  function closeMeetingForm(){$('agMeetingFormOverlay')?.classList.remove('show')}
  async function saveMeetingForm(){if(!isAdmin()||!currentUser)return;const form=$('agMeetingForm');if(!form.reportValidity())return;const participantUids=[...document.querySelectorAll('#agMeetingPeople input:checked')].map(i=>i.value);if(!participantUids.length){toast?.('Selecione pelo menos um participante.');return}const all=users();const participantNames=participantUids.map(id=>all.find(u=>userAuthUid(u)===id)?.name||all.find(u=>userAuthUid(u)===id)?.email||id);const id=form.elements.meetingId.value||meetingId();const existing=meetings.find(x=>x.id===id);const payload={id,title:form.elements.title.value.trim(),date:form.elements.date.value,time:form.elements.time.value,notes:form.elements.notes.value.trim(),participantUids:[currentUser.uid,...participantUids],participantNames:[displayName(),...participantNames],createdBy:existing?.createdBy||currentUser.uid,createdByName:existing?.createdByName||displayName(),status:existing?.status||'scheduled',videoEngine:'native-webrtc',roomName:existing?.roomName||`AGCRM_${id}`.replace(/[^a-zA-Z0-9_]/g,''),updatedAt:serverTimestamp(),...(existing?{}:{createdAt:serverTimestamp()})};try{await setDoc(meetingRef(id),payload,{merge:true});}catch(err){console.error('Falha ao salvar reunião no Firestore',err);toast(err?.message||'Não foi possível criar a sala. Verifique as regras do Firestore.');return}
    try{const ix=db.appointments.findIndex(a=>a.meetingId===id);const ap={...(ix>=0?db.appointments[ix]:{}),id:ix>=0?db.appointments[ix].id:`A${Math.random().toString(36).slice(2,8).toUpperCase()}`,date:payload.date,time:payload.time,type:'Reunião',title:payload.title,client:'Reunião interna',broker:displayName(),property:'',meetingId:id,participantUids:payload.participantUids,participantNames:payload.participantNames,createdByUid:payload.createdBy,source:'Sala de Reuniões'};if(ix>=0)db.appointments[ix]=ap;else db.appointments.push(ap);saveDB();}catch(e){console.warn('Agenda local da reunião',e)}closeMeetingForm();toast('Reunião criada. A sala está pronta e aguarda o Administrador iniciar.');}
  function canSeeAppointment(a){if(isTombstoned(a))return false;if(a?.meetingId&&deletedMeetingIds.has(String(a.meetingId)))return false;if(a?.type!=='Reunião'||!Array.isArray(a.participantUids)||!a.participantUids.length)return true;if(isAdmin())return true;return !!currentUser&&a.participantUids.includes(currentUser.uid)}
  async function openMeetingFromAgenda(id){
    if(!isAdmin()||!id)return;
    let m=meetings.find(x=>x.id===id);
    if(!m){try{const snap=await getDoc(meetingRef(id));if(snap.exists())m={id:snap.id,...snap.data()}}catch(e){console.warn('Falha ao abrir reunião pela Agenda',e)}}
    if(m)return openMeetingForm(m);
    toast?.('Não foi possível localizar os dados desta reunião.');
  }
  function decorateAgendaMeetingActions(){
    if(typeof db==='undefined'||!Array.isArray(db.appointments))return;
    const list=$('appointmentList');if(!list)return;
    const now=today();
    const ap=[...db.appointments].filter(a=>a.date>=now&&canSeeAppointment(a)).sort((a,b)=>String(a.date+a.time).localeCompare(String(b.date+b.time))).slice(0,8);
    [...list.querySelectorAll('.mini-item')].forEach((row,i)=>{
      const a=ap[i];if(!a?.meetingId)return;
      const right=row.querySelector('.right');if(!right)return;
      if(isAdmin())right.innerHTML=`<div class="actions ag-agenda-meeting-actions"><button class="btn small" type="button" data-ag-agenda-meeting-edit="${esc(a.meetingId)}">Editar</button><button class="btn small danger" type="button" data-ag-agenda-appointment-delete="${esc(a.id||'')}" data-ag-agenda-meeting-id="${esc(a.meetingId||'')}">Excluir</button></div>`;
      else right.innerHTML=`<div class="actions ag-agenda-meeting-actions"><button class="btn small" type="button" data-ag-agenda-meeting-open="${esc(a.meetingId)}">Abrir reunião</button></div>`;
    });
    list.querySelectorAll('[data-ag-agenda-meeting-edit]').forEach(b=>b.onclick=()=>openMeetingFromAgenda(b.dataset.agAgendaMeetingEdit));
    list.querySelectorAll('[data-ag-agenda-appointment-delete]').forEach(b=>b.onclick=()=>deleteAgendaAppointment(b.dataset.agAgendaAppointmentDelete,b.dataset.agAgendaMeetingId));
    list.querySelectorAll('[data-ag-agenda-meeting-open]').forEach(b=>b.onclick=()=>openRoomById(b.dataset.agAgendaMeetingOpen));
  }
  function patchCalendar(){if(window.renderCalendar?.__agMeetingPatched)return;const base=window.renderCalendar;if(typeof base!=='function')return;const wrapped=function(){if(typeof db==='undefined'||!Array.isArray(db.appointments))return base();const all=db.appointments;db.appointments=all.filter(canSeeAppointment);try{const result=base();decorateAgendaMeetingActions();return result}finally{db.appointments=all}};wrapped.__agMeetingPatched=true;window.renderCalendar=wrapped;try{renderCalendar=wrapped}catch(e){};try{wrapped()}catch(e){}}
  function meetingStateLabel(s){return s==='live'?'Em andamento':s==='starting'?'Administrador entrando…':s==='ended'?'Encerrada':'Agendada'}
  function renderMeetings(){const list=$('agMeetingList');if(!list)return;const sorted=[...meetings].sort((a,b)=>String(a.date+a.time).localeCompare(String(b.date+b.time)));if(!sorted.length){list.innerHTML='<div class="ag-meeting-empty">Nenhuma reunião encontrada na sua agenda.</div>';return}list.innerHTML=sorted.map(m=>{const people=(m.participantNames||[]).filter(Boolean);const chips=people.slice(0,4).map(n=>`<span class="ag-meeting-chip">@${esc(n)}</span>`).join('')+(people.length>4?`<span class="ag-meeting-chip">+${people.length-4}</span>`:'');let action='';if(isAdmin()){if(m.status==='scheduled')action=`<button class="btn primary small" data-meeting-start="${m.id}">Iniciar sala</button>`;else if(m.status==='starting'||m.status==='live')action=`<button class="btn primary small" data-meeting-join="${m.id}">Entrar</button>`;action+=`<button class="btn small" data-meeting-edit="${m.id}">Editar</button><button class="btn danger small" data-meeting-delete="${m.id}">Excluir</button>`}else{action=m.status==='live'?`<button class="btn primary small" data-meeting-join="${m.id}">Entrar na sala</button>`:`<span style="font-size:11px;color:var(--muted)">${m.status==='ended'?'Reunião encerrada':'Aguardando Administrador'}</span>`}return `<div class="ag-meeting-row"><div><h4>${esc(m.title)}</h4><p>${esc(m.notes||'Sem pauta informada.')}</p><div class="ag-meeting-meta">${chips}</div></div><div class="ag-meeting-when"><b>${fmtDate(m.date)}</b><small>${esc(m.time||'')}</small></div><div><span class="ag-meeting-status ${esc(m.status||'scheduled')}">${meetingStateLabel(m.status)}</span></div><div class="ag-meeting-actions">${action}</div></div>`}).join('');list.querySelectorAll('[data-meeting-start]').forEach(b=>b.onclick=()=>startMeeting(b.dataset.meetingStart));list.querySelectorAll('[data-meeting-join]').forEach(b=>b.onclick=()=>openRoomById(b.dataset.meetingJoin));list.querySelectorAll('[data-meeting-edit]').forEach(b=>b.onclick=()=>openMeetingForm(meetings.find(m=>m.id===b.dataset.meetingEdit)));list.querySelectorAll('[data-meeting-delete]').forEach(b=>b.onclick=()=>deleteMeeting(b.dataset.meetingDelete));}
  async function persistAgendaAfterDelete(){
    // V128: grava diretamente os compromissos E a lista de exclusões.
    // A marca de exclusão impede um aparelho com cache antigo de ressuscitar a reunião.
    try{window.EICRMBridge?.persistLocal?.()}catch(e){try{localStorage.setItem('atlasImobCRM',JSON.stringify(db))}catch(_){}}
    const appointments=JSON.parse(JSON.stringify(db.appointments||[]));
    const deletions=JSON.parse(JSON.stringify(deletionList()));
    try{
      await Promise.all([
        setDoc(appointmentsSectionRef(),{value:appointments,updatedAt:serverTimestamp()},{merge:true}),
        setDoc(meetingDeletionsSectionRef(),{value:deletions,updatedAt:serverTimestamp()},{merge:true})
      ]);
      return;
    }catch(err){
      console.warn('V128: gravação direta da exclusão falhou; usando sincronizador central.',err);
      if(window.EIFirebaseCRM?.saveStateNow){await window.EIFirebaseCRM.saveStateNow(true);return}
      throw err;
    }
  }
  async function cleanupMeetingCloud(meetingId){
    meetingId=String(meetingId||'').trim();
    if(!meetingId)return;
    try{
      const msgSnap=await getDocs(collection(fs,'meetings',meetingId,'messages'));
      await Promise.all(msgSnap.docs.map(d=>deleteDoc(d.ref)));
    }catch(e){console.warn('V126: chat da reunião não pôde ser limpo.',e)}
    try{
      const rtcSnap=await getDocs(collection(fs,'meetings',meetingId,'rtc'));
      for(const p of rtcSnap.docs){
        try{const inbox=await getDocs(collection(fs,'meetings',meetingId,'rtc',p.id,'inbox'));await Promise.all(inbox.docs.map(x=>deleteDoc(x.ref)))}catch(_){}
        try{await deleteDoc(p.ref)}catch(_){}
      }
    }catch(e){console.warn('V130: sinalização WebRTC não pôde ser limpa.',e)}
    try{await deleteDoc(meetingRef(meetingId));}catch(e){console.warn('V126: sala já removida ou indisponível.',e)}
    meetings=meetings.filter(x=>String(x.id)!==meetingId);
    deletedMeetingIds.add(meetingId);
  }
  async function deleteAgendaAppointment(appointmentId,meetingId,options={}){
    if(!isAdmin()||!currentUser)return;
    appointmentId=String(appointmentId||'').trim();
    meetingId=String(meetingId||'').trim();
    if(typeof db==='undefined'||!Array.isArray(db.appointments))return;

    // A exclusão da Agenda é feita pelo ID do compromisso, não pelo ID da sala.
    // Isso permite apagar compromissos órfãos cuja sala /meetings/{id} já sumiu.
    let ap=appointmentId?db.appointments.find(a=>String(a?.id||'')===appointmentId):null;
    if(!ap&&meetingId)ap=db.appointments.find(a=>String(a?.meetingId||'')===meetingId)||null;
    let m=meetingId?meetings.find(x=>String(x.id)===meetingId)||null:null;
    if(!m&&meetingId){
      try{const snap=await getDoc(meetingRef(meetingId));if(snap.exists())m={id:snap.id,...snap.data()}}catch(e){console.warn('V126: sala não encontrada; continuando pela Agenda.',e)}
    }
    if(!ap&&!m){
      toast?.('Este compromisso já não existe. Atualizando a Agenda…');
      try{renderCalendar?.()}catch(e){}
      return;
    }

    const title=ap?.title||m?.title||'Sem título';
    const date=ap?.date||m?.date||'';
    const time=ap?.time||m?.time||'';
    const when=[fmtDate(date),time].filter(Boolean).join(' às ');
    if(!options.skipConfirm){
      const ok=confirm(`Excluir a reunião “${title}”${when?` (${when})`:''}?\n\nEla será removida definitivamente da Agenda de todos os participantes. Esta ação não pode ser desfeita.`);
      if(!ok)return;
    }

    // Remove primeiro o compromisso visível e persiste usando o sincronizador
    // central do CRM. A sala é uma limpeza complementar e nunca bloqueia a Agenda.
    const before=db.appointments.length;
    rememberDeletion(appointmentId||ap?.id||'',meetingId||ap?.meetingId||'',title);
    db.appointments=db.appointments.filter(a=>{
      if(appointmentId&&String(a?.id||'')===appointmentId)return false;
      if(meetingId&&String(a?.meetingId||'')===meetingId)return false;
      if(isTombstoned(a))return false;
      return true;
    });
    if(before===db.appointments.length&&ap){
      db.appointments=db.appointments.filter(a=>a!==ap);
    }

    try{
      await persistAgendaAfterDelete();
      if(roomMeeting?.id===meetingId)closeRoom();
      await cleanupMeetingCloud(meetingId);
      renderMeetings();
      try{renderCalendar?.()}catch(e){}
      toast?.('Reunião removida definitivamente da Agenda.');
    }catch(err){
      console.error('V126: falha ao persistir exclusão na Agenda',err);
      toast?.(err?.message||'Não foi possível gravar a exclusão da Agenda.');
      try{renderCalendar?.()}catch(e){}
    }
  }
  async function deleteMeeting(id){
    id=String(id||'').trim();
    if(!id)return;
    const ap=(typeof db!=='undefined'&&Array.isArray(db.appointments))?db.appointments.find(a=>String(a?.meetingId||'')===id):null;
    return deleteAgendaAppointment(ap?.id||'',id);
  }
  function visibleMeetingIds(){if(!currentUser||typeof db==='undefined'||!Array.isArray(db.appointments))return[];return [...new Set(db.appointments.filter(a=>a?.meetingId&&canSeeAppointment(a)).map(a=>String(a.meetingId)).filter(Boolean))].sort()}
  async function repairMeetingAccessFromAgenda(list){
    if(!isAdmin()||typeof db==='undefined'||!Array.isArray(db.appointments))return;
    const jobs=[];
    for(const m of (list||[])){
      const ap=db.appointments.find(a=>String(a?.meetingId||'')===String(m?.id||''));
      if(!ap||!Array.isArray(ap.participantUids)||!ap.participantUids.length)continue;
      const desired=[...new Set(ap.participantUids.map(x=>String(x||'').trim()).filter(Boolean))].sort();
      const current=[...new Set((Array.isArray(m.participantUids)?m.participantUids:[]).map(x=>String(x||'').trim()).filter(Boolean))].sort();
      if(desired.join('|')!==current.join('|'))jobs.push(updateDoc(meetingRef(m.id),{participantUids:desired,participantNames:Array.isArray(ap.participantNames)?ap.participantNames:(m.participantNames||[]),updatedAt:serverTimestamp()}));
    }
    if(jobs.length)await Promise.allSettled(jobs);
  }
  function subscribeMeetings(){
    meetingUnsub?.();meetingUnsub=null;if(!currentUser)return;
    if(isAdmin()){
      meetingIdsSignature='ADMIN';
      const q=query(collection(fs,'meetings'));
      meetingUnsub=onSnapshot(q,snap=>{meetings=snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!deletionList().some(x=>String(x?.meetingId||'')===String(m.id)));if($('agMeetingCloudState'))$('agMeetingCloudState').textContent='Online';renderMeetings();patchCalendar();repairMeetingAccessFromAgenda(meetings).catch(e=>console.warn('V128: reparo de participantes',e))},err=>{console.error('Reuniões admin',err);if($('agMeetingCloudState'))$('agMeetingCloudState').textContent='Erro de sincronização'});
      return;
    }
    // V128: convidados não consultam a coleção inteira. Lemos apenas os documentos
    // das reuniões já presentes na própria Agenda, o que casa exatamente com as regras.
    const ids=visibleMeetingIds();meetingIdsSignature=ids.join('|');
    if(!ids.length){meetings=[];if($('agMeetingCloudState'))$('agMeetingCloudState').textContent='Online';renderMeetings();patchCalendar();return}
    const map=new Map(),unsubs=[];
    const refresh=()=>{meetings=[...map.values()].sort((a,b)=>String(a.date+a.time).localeCompare(String(b.date+b.time)));if($('agMeetingCloudState'))$('agMeetingCloudState').textContent='Online';renderMeetings();patchCalendar()};
    ids.forEach(id=>{unsubs.push(onSnapshot(meetingRef(id),snap=>{if(snap.exists())map.set(id,{id:snap.id,...snap.data()});else map.delete(id);refresh()},err=>{console.warn('Reunião individual',id,err);map.delete(id);refresh()}))});
    meetingUnsub=()=>unsubs.forEach(u=>{try{u()}catch(e){}});
  }

const rtcParticipantRef=(mid,uid)=>doc(fs,'meetings',mid,'rtc',uid);
const rtcInboxCol=(mid,uid)=>collection(fs,'meetings',mid,'rtc',uid,'inbox');
const rtcConfig=()=>({iceServers:RTC_ICE_SERVERS,iceCandidatePoolSize:4});
const ownRtcState=()=>({audio:!!localStream?.getAudioTracks().some(t=>t.enabled),video:!!localStream?.getVideoTracks().some(t=>t.enabled),screen:!!screenStream});
function roomSessionId(m){return String(m?.rtcSessionId||'').trim()}
async function sendRtcSignal(toUid,type,payload={}){
  if(!roomMeeting||!currentUser||!toUid||toUid===currentUser.uid)return;
  try{await addDoc(rtcInboxCol(roomMeeting.id,toUid),{fromUid:currentUser.uid,toUid,type,payload,sessionId:roomSessionId(roomMeeting),createdAt:serverTimestamp(),createdAtMs:Date.now()})}
  catch(err){console.warn('V130 sinal WebRTC',type,toUid,err)}
}
function tileId(uid){return `agRtcTile_${String(uid||'').replace(/[^a-zA-Z0-9_-]/g,'_')}`}
function ensureVideoTile(uid,name,isLocal=false){
  const grid=$('agRtcGrid');if(!grid)return null;
  let tile=$(tileId(uid));
  if(!tile){tile=document.createElement('div');tile.id=tileId(uid);tile.className='ag-rtc-tile'+(isLocal?' local':'');tile.innerHTML=`<video autoplay playsinline ${isLocal?'muted':''}></video><div class="ag-rtc-avatar">${esc((name||'?').trim().charAt(0).toUpperCase()||'?')}</div><div class="ag-rtc-tile-foot"><span class="ag-rtc-name">${esc(name||'Participante')}${isLocal?' · Você':''}</span><span class="ag-rtc-media-state"></span></div><div class="ag-rtc-connection">Conectando…</div>`;grid.appendChild(tile)}
  return tile;
}
function setTileStream(uid,stream,name,isLocal=false){
  const tile=ensureVideoTile(uid,name,isLocal);if(!tile)return;const video=tile.querySelector('video');if(video&&video.srcObject!==stream)video.srcObject=stream||null;tile.classList.toggle('has-video',!!stream?.getVideoTracks()?.length);if(video)video.play?.().catch(()=>{});
}
function setTileConnection(uid,label,state=''){const tile=$(tileId(uid));if(!tile)return;const el=tile.querySelector('.ag-rtc-connection');if(el){el.textContent=label||'';el.dataset.state=state||''}}
function removePeerTile(uid){$(tileId(uid))?.remove()}
function updatePeoplePanel(){
  const people=$('agRtcPeopleList'),count=$('agRtcPeopleCount');
  const items=[{uid:currentUser?.uid,name:displayName(),active:true,local:true,state:ownRtcState()},...[...rtcParticipantCache.values()].filter(p=>p.uid!==currentUser?.uid&&p.active!==false&&p.sessionId===roomSessionId(roomMeeting))];
  if(count)count.textContent=String(items.length);
  if(people)people.innerHTML=items.map(p=>`<div class="ag-rtc-person-row"><span class="ag-rtc-person-avatar">${esc(String(p.name||'?').charAt(0).toUpperCase())}</span><div><b>${esc(p.name||'Participante')}${p.local?' (você)':''}</b><small>${p.state?.audio===false?'🔇':'🎤'} ${p.state?.video===false?'📷 desligada':'📹'} ${p.state?.screen?'· apresentando':''}</small></div><span class="ag-rtc-online">online</span></div>`).join('')||'<div class="ag-meeting-empty">Nenhum participante conectado.</div>';
}
async function updateOwnPresence(extra={}){
  if(!roomMeeting||!currentUser)return;
  const payload={uid:currentUser.uid,name:displayName(),email:currentUser.email||'',active:true,sessionId:roomSessionId(roomMeeting),state:ownRtcState(),lastSeenMs:Date.now(),lastSeenAt:serverTimestamp(),...extra};
  try{await setDoc(rtcParticipantRef(roomMeeting.id,currentUser.uid),payload,{merge:true})}catch(err){console.warn('V130 presença WebRTC',err)}
}
async function getLocalMedia(){
  if(localStream)return localStream;
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Este navegador não oferece acesso à câmera/microfone por WebRTC.');
  try{localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'}})}
  catch(first){
    console.warn('V130 câmera+microfone indisponíveis; tentando somente áudio.',first);
    try{localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false})}
    catch(second){console.warn('V130 áudio também indisponível; entrando sem mídia.',second);localStream=new MediaStream();toast?.('Você entrou sem câmera e microfone. Verifique as permissões do navegador.')}
  }
  return localStream;
}
function closePeer(uid){const p=rtcPeers.get(uid);if(p){try{p.pc.onicecandidate=null;p.pc.ontrack=null;p.pc.close()}catch(_){}rtcPeers.delete(uid)}removePeerTile(uid);updatePeoplePanel()}
async function createPeer(uid,shouldOffer=false){
  if(!roomMeeting||!uid||uid===currentUser?.uid)return null;
  let entry=rtcPeers.get(uid);if(entry)return entry;
  const pc=new RTCPeerConnection(rtcConfig());entry={uid,pc,pending:[],offered:false};rtcPeers.set(uid,entry);
  (localStream?.getTracks()||[]).forEach(track=>{try{pc.addTrack(track,localStream)}catch(_){}});
  pc.onicecandidate=e=>{if(e.candidate)sendRtcSignal(uid,'candidate',e.candidate.toJSON?e.candidate.toJSON():e.candidate)};
  pc.ontrack=e=>{const stream=e.streams?.[0]||new MediaStream([e.track]);const p=rtcParticipantCache.get(uid);setTileStream(uid,stream,p?.name||'Participante',false);setTileConnection(uid,'Conectado','connected')};
  pc.onconnectionstatechange=()=>{const st=pc.connectionState;if(st==='connected')setTileConnection(uid,'Conectado','connected');else if(st==='failed')setTileConnection(uid,'Falha de conexão','failed');else if(st==='disconnected')setTileConnection(uid,'Reconectando…','disconnected');else if(st==='closed')removePeerTile(uid)};
  const rp=rtcParticipantCache.get(uid);ensureVideoTile(uid,rp?.name||'Participante',false);
  if(shouldOffer){entry.offered=true;setTimeout(()=>makeOffer(uid).catch(e=>console.warn('V130 offer',e)),80)}
  return entry;
}
async function makeOffer(uid){const e=await createPeer(uid,false);if(!e||e.pc.signalingState==='closed')return;if(e.pc.signalingState!=='stable')return;const offer=await e.pc.createOffer();await e.pc.setLocalDescription(offer);await sendRtcSignal(uid,'offer',e.pc.localDescription.toJSON?e.pc.localDescription.toJSON():e.pc.localDescription)}
async function flushCandidates(e){if(!e?.pc?.remoteDescription)return;const arr=e.pending.splice(0);for(const c of arr){try{await e.pc.addIceCandidate(c)}catch(err){console.warn('V130 ICE pendente',err)}}}
async function processRtcSignal(data){
  if(!roomMeeting||!currentUser||!data||data.sessionId!==roomSessionId(roomMeeting)||data.toUid!==currentUser.uid||data.fromUid===currentUser.uid)return;
  const from=data.fromUid;let e=await createPeer(from,false);if(!e)return;
  try{
    if(data.type==='offer'){await e.pc.setRemoteDescription(data.payload);await flushCandidates(e);const answer=await e.pc.createAnswer();await e.pc.setLocalDescription(answer);await sendRtcSignal(from,'answer',e.pc.localDescription.toJSON?e.pc.localDescription.toJSON():e.pc.localDescription)}
    else if(data.type==='answer'){if(e.pc.signalingState!=='closed'){await e.pc.setRemoteDescription(data.payload);await flushCandidates(e)}}
    else if(data.type==='candidate'){if(e.pc.remoteDescription)await e.pc.addIceCandidate(data.payload);else e.pending.push(data.payload)}
    else if(data.type==='renegotiate'){await makeOffer(from)}
    else if(data.type==='bye'){closePeer(from)}
  }catch(err){console.warn('V130 processar sinal',data.type,err)}
}
function subscribeRtcInbox(){
  rtcInboxUnsub?.();if(!roomMeeting||!currentUser)return;
  rtcInboxUnsub=onSnapshot(rtcInboxCol(roomMeeting.id,currentUser.uid),snap=>{snap.docChanges().filter(c=>c.type==='added').forEach(async c=>{try{await processRtcSignal(c.doc.data())}finally{deleteDoc(c.doc.ref).catch(()=>{})}})},err=>console.warn('V130 inbox WebRTC',err));
}
function subscribeRtcParticipants(){
  rtcParticipantsUnsub?.();if(!roomMeeting||!currentUser)return;
  const col=collection(fs,'meetings',roomMeeting.id,'rtc');
  rtcParticipantsUnsub=onSnapshot(col,snap=>{
    const seen=new Set();snap.docs.forEach(d=>{const p={uid:d.id,...d.data()};if(p.sessionId!==roomSessionId(roomMeeting)||p.active===false)return;seen.add(p.uid);rtcParticipantCache.set(p.uid,p);if(p.uid!==currentUser.uid){ensureVideoTile(p.uid,p.name||'Participante',false);if(!rtcPeers.has(p.uid)){const offer=currentUser.uid.localeCompare(p.uid)<0;createPeer(p.uid,offer)}}});
    [...rtcParticipantCache.keys()].forEach(uid=>{if(uid!==currentUser.uid&&!seen.has(uid)){rtcParticipantCache.delete(uid);closePeer(uid)}});updatePeoplePanel();
  },err=>console.warn('V130 participantes WebRTC',err));
}
function subscribeRoomMeeting(){
  roomMeetingUnsub?.();if(!roomMeeting)return;roomMeetingUnsub=onSnapshot(meetingRef(roomMeeting.id),snap=>{if(!snap.exists()){toast?.('A reunião foi removida.');closeRoom();return}const m={id:snap.id,...snap.data()};roomMeeting={...roomMeeting,...m};if(m.status==='ended'&&!roomClosing){toast?.('O Administrador encerrou a reunião.');closeRoom()}},err=>console.warn('V130 estado da sala',err));
}
function setControlState(id,on){const b=$(id);if(b)b.classList.toggle('active',!!on)}
async function toggleMicrophone(){const tracks=localStream?.getAudioTracks()||[];if(!tracks.length){toast?.('Nenhum microfone disponível.');return}const next=!tracks.some(t=>t.enabled);tracks.forEach(t=>t.enabled=next);setControlState('agRtcMic',next);await updateOwnPresence();updatePeoplePanel()}
async function toggleCamera(){const tracks=localStream?.getVideoTracks()||[];if(!tracks.length){toast?.('Nenhuma câmera disponível.');return}const next=!tracks.some(t=>t.enabled);tracks.forEach(t=>t.enabled=next);setControlState('agRtcCamera',next);await updateOwnPresence();updatePeoplePanel()}
async function toggleScreenShare(){
  if(screenStream){await stopScreenShare();return}
  if(!navigator.mediaDevices?.getDisplayMedia){toast?.('Compartilhamento de tela não disponível neste navegador.');return}
  try{
    screenStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const track=screenStream.getVideoTracks()[0];if(!track)return;
    for(const [uid,e] of rtcPeers){let sender=e.pc.getSenders().find(s=>s.track?.kind==='video');if(sender)await sender.replaceTrack(track);else{e.pc.addTrack(track,screenStream);await makeOffer(uid)}}
    setTileStream(currentUser.uid,screenStream,displayName(),true);setControlState('agRtcScreen',true);track.onended=()=>stopScreenShare();await updateOwnPresence();updatePeoplePanel();
  }catch(err){if(err?.name!=='NotAllowedError')console.warn('V130 compartilhar tela',err)}
}
async function stopScreenShare(){
  if(!screenStream)return;screenStream.getTracks().forEach(t=>t.stop());screenStream=null;const cam=localStream?.getVideoTracks()?.[0]||null;
  for(const [uid,e] of rtcPeers){const sender=e.pc.getSenders().find(s=>s.track?.kind==='video'||(!s.track&&s.track?.kind==='video'));if(sender)try{await sender.replaceTrack(cam)}catch(_){}}
  setTileStream(currentUser.uid,localStream,displayName(),true);setControlState('agRtcScreen',false);await updateOwnPresence();updatePeoplePanel();
}
async function startMeeting(id){
  if(!isAdmin())return;const m=meetings.find(x=>x.id===id);if(!m)return;
  try{const startedAt=serverTimestamp(),session=`S${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,6).toUpperCase()}`;await updateDoc(meetingRef(id),{status:'live',videoEngine:'native-webrtc',rtcSessionId:session,startedBy:currentUser.uid,startedByName:displayName(),startedAt,liveAt:startedAt});await openRoom({...m,status:'live',videoEngine:'native-webrtc',rtcSessionId:session},true)}catch(err){console.error('Falha ao iniciar reunião',err);toast(err?.message||'Não foi possível iniciar a sala de reunião.')}
}
async function openRoomById(id){
  try{const snap=await getDoc(meetingRef(id));if(!snap.exists()){toast?.('Esta reunião não existe mais.');return}const m={id:snap.id,...snap.data()};if(!isAdmin()&&m.status!=='live'){toast?.('A sala ainda não foi iniciada pelo Administrador.');return}if(m.status==='ended'){toast?.('Esta reunião já foi encerrada.');return}await openRoom(m,false)}catch(err){console.error('V130 abrir sala',err);toast?.(err?.message||'Não foi possível abrir a sala.')}
}
async function openRoom(m,starting){
  if(roomMeeting)await closeRoom(false);roomClosing=false;roomMeeting=m;$('agRoomOverlay').classList.add('show');$('agRoomTitle').textContent=m.title||'Reunião';$('agRoomSubtitle').textContent=`${fmtDate(m.date)} · ${m.time||''} · AG CRM`;$('agRoomEnd').hidden=!isAdmin();$('agRoomStatus').textContent='Entrando…';const wait=$('agRoomWait');wait.style.display='grid';wait.style.pointerEvents='auto';wait.innerHTML='<div><strong>Preparando sala própria…</strong><p>Autorize câmera e microfone quando o navegador solicitar.</p></div>';$('agRtcGrid').innerHTML='';rtcParticipantCache.clear();subscribeMessages(m.id);
  try{await getLocalMedia();setTileStream(currentUser.uid,localStream,displayName(),true);setControlState('agRtcMic',!!localStream.getAudioTracks().some(t=>t.enabled));setControlState('agRtcCamera',!!localStream.getVideoTracks().some(t=>t.enabled));setControlState('agRtcScreen',false);subscribeRtcInbox();subscribeRtcParticipants();subscribeRoomMeeting();await updateOwnPresence({joinedAt:serverTimestamp()});rtcHeartbeat=setInterval(()=>updateOwnPresence().catch(()=>{}),15000);wait.style.display='none';wait.style.pointerEvents='none';$('agRoomStatus').textContent='Ao vivo';updatePeoplePanel()}
  catch(err){console.error('V130 sala WebRTC',err);wait.style.display='grid';wait.style.pointerEvents='auto';wait.innerHTML=`<div><strong>Não foi possível ativar a sala</strong><p>${esc(err.message||err)}</p><p>Confira as permissões de câmera/microfone e se o site está em HTTPS.</p></div>`;$('agRoomStatus').textContent='Falha na conexão'}
}
async function closeRoom(sendBye=true){
  if(roomClosing)return;roomClosing=true;const mid=roomMeeting?.id,uid=currentUser?.uid;
  try{if(sendBye&&roomMeeting&&currentUser)await Promise.allSettled([...rtcPeers.keys()].map(p=>sendRtcSignal(p,'bye',{})))}catch(_){}
  if(mid&&uid)try{await setDoc(rtcParticipantRef(mid,uid),{active:false,lastSeenMs:Date.now(),leftAt:serverTimestamp()},{merge:true})}catch(_){}
  clearInterval(rtcHeartbeat);rtcHeartbeat=null;rtcParticipantsUnsub?.();rtcParticipantsUnsub=null;rtcInboxUnsub?.();rtcInboxUnsub=null;roomMeetingUnsub?.();roomMeetingUnsub=null;msgUnsub?.();msgUnsub=null;
  for(const uid of [...rtcPeers.keys()])closePeer(uid);rtcPeers.clear();rtcParticipantCache.clear();
  if(screenStream){try{screenStream.getTracks().forEach(t=>t.stop())}catch(_){}screenStream=null}if(localStream){try{localStream.getTracks().forEach(t=>t.stop())}catch(_){}localStream=null}
  roomMeeting=null;$('agRoomOverlay')?.classList.remove('show');if($('agRtcGrid'))$('agRtcGrid').innerHTML='';roomClosing=false;
}
async function endMeeting(){if(!isAdmin()||!roomMeeting)return;if(!confirm('Encerrar esta reunião para todos os participantes?'))return;try{await updateDoc(meetingRef(roomMeeting.id),{status:'ended',endedAt:serverTimestamp(),endedBy:currentUser.uid});toast?.('Reunião encerrada.')}catch(err){console.error(err);toast?.('Não foi possível encerrar a reunião.')}await closeRoom()}
  function switchRoomTab(tab){document.querySelectorAll('[data-room-tab]').forEach(b=>b.classList.toggle('active',b.dataset.roomTab===tab));document.querySelectorAll('[data-room-panel]').forEach(p=>p.classList.toggle('active',p.dataset.roomPanel===tab))}
  function subscribeMessages(mid){msgUnsub?.();const col=collection(fs,'meetings',mid,'messages');msgUnsub=onSnapshot(col,snap=>{const arr=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.createdAt?.toDate?.()?.toISOString?.()||a.createdAt||'').localeCompare(String(b.createdAt?.toDate?.()?.toISOString?.()||b.createdAt||'')));renderChat(arr.filter(x=>x.type!=='file'));renderFiles(arr.filter(x=>x.type==='file'))},e=>console.error('Chat',e))}
  function renderChat(arr){const el=$('agChatList');if(!el)return;el.innerHTML=arr.map(m=>`<div class="ag-chat-msg ${m.authorUid===currentUser?.uid?'mine':''}"><b>${esc(m.authorName||'Usuário')}</b>${esc(m.text||'')}<time>${esc(m.timeLabel||'')}</time></div>`).join('')||'<div class="ag-meeting-empty">Nenhuma mensagem ainda.</div>';el.scrollTop=el.scrollHeight}
  async function sendChat(){const input=$('agChatInput');const text=String(input?.value||'').trim();if(!text||!roomMeeting||!currentUser)return;input.value='';await addDoc(collection(fs,'meetings',roomMeeting.id,'messages'),{type:'text',text,authorUid:currentUser.uid,authorName:displayName(),createdAt:serverTimestamp(),timeLabel:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})})}
  function renderFiles(arr){const el=$('agFileList');if(!el)return;el.innerHTML=arr.map(f=>`<div class="ag-file-row"><span class="file-ico">▤</span><div><b>${esc(f.fileName||'Arquivo')}</b><small>${esc(f.authorName||'')} · ${fmtBytes(f.fileSize)}</small></div><button class="btn small" data-file-download="${esc(f.fileId||'')}">Baixar</button></div>`).join('')||'<div class="ag-meeting-empty">Nenhum arquivo enviado.</div>';el.querySelectorAll('[data-file-download]').forEach(b=>b.onclick=()=>downloadMeetingFile(b.dataset.fileDownload))}
  async function uploadMeetingFile(e){const file=e.target.files?.[0];e.target.value='';if(!file||!roomMeeting)return;if(file.size>10*1024*1024){toast?.('O arquivo deve ter no máximo 10 MB.');return}if(!window.AGDriveGateway?.configured?.()){toast?.('Configure o Google Drive em Ajustes para enviar arquivos.');return}const btn=$('agMeetingFileBtn');const old=btn.textContent;btn.disabled=true;btn.textContent='Enviando…';try{const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const up=await window.AGDriveGateway.request('uploadMeetingFile',{meetingId:roomMeeting.id,meetingTitle:roomMeeting.title,fileName:file.name,mimeType:file.type||'application/octet-stream',dataUrl,uploadedBy:displayName()});await addDoc(collection(fs,'meetings',roomMeeting.id,'messages'),{type:'file',fileId:up.fileId,fileName:up.fileName||file.name,fileSize:file.size,mimeType:file.type||'',authorUid:currentUser.uid,authorName:displayName(),createdAt:serverTimestamp(),timeLabel:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});toast?.('Arquivo enviado para a reunião.')}catch(err){console.error(err);toast?.(err.message||'Falha ao enviar arquivo.')}finally{btn.disabled=false;btn.textContent=old}}
  async function downloadMeetingFile(fileId){if(!fileId)return;try{const r=await window.AGDriveGateway.request('getMeetingFile',{fileId});const a=document.createElement('a');a.href=r.dataUrl;a.download=r.fileName||'arquivo';document.body.appendChild(a);a.click();a.remove()}catch(err){console.error(err);toast?.(err.message||'Não foi possível baixar o arquivo.')}}

  onAuthStateChanged(auth,user=>{currentUser=user;injectAgenda();setTimeout(()=>{const b=$('agNewVideoMeeting');if(b)b.style.display=isAdmin()?'':'none';patchCalendar();subscribeMeetings()},250)});
  window.addEventListener('ag:firebase-ready',()=>setTimeout(()=>{injectAgenda();patchCalendar()},200));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectAgenda();setTimeout(patchCalendar,400)});else{injectAgenda();setTimeout(patchCalendar,400)}
  setInterval(()=>{const mode=isAdmin();const sig=mode?'ADMIN':visibleMeetingIds().join('|');if(mode!==lastAdminMode||sig!==meetingIdsSignature){lastAdminMode=mode;const b=$('agNewVideoMeeting');if(b)b.style.display=mode?'':'none';if(currentUser)subscribeMeetings();}},1200);
  window.AGMeetingRooms={openMeetingForm,startMeeting,openRoomById,deleteMeeting};
})();
