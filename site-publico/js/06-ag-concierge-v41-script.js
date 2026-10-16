(() => {
  const $ = (s,root=document)=>root.querySelector(s);
  const launcher=$('#agConciergeLauncher'), panel=$('#agConcierge'), closeBtn=$('#agConciergeClose'), body=$('#agChatBody'), teaser=$('#agConciergeTeaser');
  if(!launcher||!panel||!body) return;

  const state={step:'start',purpose:'',city:'',type:'',budget:'',name:'',phone:''};
  let started=false, busy=false;
  const time=()=>new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const scroll=()=>{body.scrollTop=body.scrollHeight};
  const escapeHTML=(v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function row(text,user=false){
    const el=document.createElement('div');el.className='ag-msg-row'+(user?' user':'');
    el.innerHTML=`<div class="ag-msg">${escapeHTML(text)}<small>${time()}</small></div>`;body.appendChild(el);scroll();return el;
  }
  function typing(ms=520){
    return new Promise(resolve=>{const el=document.createElement('div');el.className='ag-msg-row';el.innerHTML='<div class="ag-typing"><i></i><i></i><i></i></div>';body.appendChild(el);scroll();setTimeout(()=>{el.remove();resolve()},ms)});
  }
  function clearControls(){body.querySelectorAll('.ag-chat-actions,.ag-chat-form,.ag-chat-success').forEach(el=>el.remove())}
  function chips(items,handler){
    const wrap=document.createElement('div');wrap.className='ag-chat-actions';
    items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='ag-chat-chip';b.textContent=item.label;b.dataset.value=item.value;b.addEventListener('click',()=>handler(item));wrap.appendChild(b)});
    body.appendChild(wrap);scroll();
  }
  function inputForm({label,placeholder,type='text',inputmode='',submit='Continuar',onSubmit}){
    const form=document.createElement('form');form.className='ag-chat-form';
    form.innerHTML=`<label>${escapeHTML(label)}</label><input class="ag-chat-input" ${type?`type="${type}"`:''} ${inputmode?`inputmode="${inputmode}"`:''} placeholder="${escapeHTML(placeholder)}"><button class="ag-chat-continue" type="submit">${escapeHTML(submit)}</button><div class="ag-chat-error"></div>`;
    form.addEventListener('submit',e=>{e.preventDefault();const input=$('.ag-chat-input',form),err=$('.ag-chat-error',form);onSubmit(input.value.trim(),err,form)});
    body.appendChild(form);setTimeout(()=>$('.ag-chat-input',form)?.focus(),80);scroll();
  }

  async function start(){
    if(started) return;started=true;
    row('Olá! Sou o assistente virtual da AG. Posso entender rapidamente o que você procura e direcionar seu atendimento.');
    await typing();
    row('Você está buscando um imóvel para comprar ou alugar?');
    chips([
      {label:'Quero comprar',value:'Comprar'},
      {label:'Quero alugar',value:'Alugar'},
      {label:'Só estou pesquisando',value:'Pesquisa'}
    ],async item=>{
      clearControls();state.purpose=item.value;row(item.label,true);await typing();askCity();
    });
  }
  function askCity(){
    row('Em qual cidade ou região você prefere procurar?');
    inputForm({label:'Cidade ou região',placeholder:'Ex.: Jaraguá do Sul',onSubmit:async(v,err)=>{
      if(v.length<2){err.textContent='Digite uma cidade ou região.';return}
      clearControls();state.city=v;row(v,true);await typing();askType();
    }});
  }
  function askType(){
    row('Qual tipo de imóvel combina mais com o que você procura?');
    chips([
      {label:'Casa',value:'Casa'},{label:'Apartamento',value:'Apartamento'},{label:'Terreno',value:'Terreno'},
      {label:'Comercial',value:'Comercial'},{label:'Estou aberto a opções',value:'Indiferente'}
    ],async item=>{clearControls();state.type=item.value;row(item.label,true);await typing();askBudget()});
  }
  function askBudget(){
    row('E qual faixa de investimento você tem em mente?');
    chips([
      {label:'Até R$ 500 mil',value:'Até R$ 500 mil'},
      {label:'R$ 500 mil a R$ 1 mi',value:'R$ 500 mil a R$ 1 mi'},
      {label:'R$ 1 mi a R$ 2 mi',value:'R$ 1 mi a R$ 2 mi'},
      {label:'Acima de R$ 2 mi',value:'Acima de R$ 2 mi'},
      {label:'Prefiro conversar',value:'A definir'}
    ],async item=>{clearControls();state.budget=item.value;row(item.label,true);await typing();askName()});
  }
  function askName(){
    row('Ótimo. Como posso chamar você?');
    inputForm({label:'Seu nome',placeholder:'Digite seu nome',onSubmit:async(v,err)=>{
      if(v.length<2){err.textContent='Informe seu nome.';return}
      clearControls();state.name=v;row(v,true);await typing();askPhone();
    }});
  }
  function askPhone(){
    row(`Perfeito, ${state.name.split(' ')[0]}. Qual é o seu WhatsApp para um corretor da AG continuar esse atendimento?`);
    inputForm({label:'Seu WhatsApp',placeholder:'(47) 99999-0000',type:'tel',inputmode:'tel',submit:'Enviar meu contato',onSubmit:submitLead});
  }
  async function submitLead(v,err,form){
    if(busy) return;
    const phone=String(v||'').replace(/\D/g,'');
    if(phone.length<10){err.textContent='Informe um WhatsApp válido com DDD.';return}
    busy=true;err.textContent='';
    state.phone=v;
    clearControls();row(v,true);await typing(650);
    let result;
    try{
      result=typeof queueSiteLead==='function' ? queueSiteLead({
        kind:'chat',name:state.name,phone:state.phone,city:state.city,
        purpose:state.purpose,type:state.type,budgetText:state.budget,
        interest:`${state.purpose} · ${state.type} · ${state.city} · ${state.budget}`,
        origin:'Concierge AG'
      }) : {ok:false,error:'Não foi possível registrar o contato agora.'};
    }catch(e){result={ok:false,error:'Não foi possível registrar o contato agora.'}}
    if(!result?.ok){row(result?.error||'Não foi possível registrar o contato agora.');busy=false;askPhone();return}
    try{sessionStorage.setItem('agConciergeLeadSent','1')}catch(e){}
    row(`Obrigado, ${state.name.split(' ')[0]}. Recebi seus dados e sua preferência. Um corretor da AG poderá continuar com você a partir daqui.`);
    const box=document.createElement('div');box.className='ag-chat-success';
    const wa=String(window.catalog?.settings?.whatsapp||'').replace(/\D/g,'');
    const msg=`Olá! Meu nome é ${state.name}. Acabei de preencher meu perfil no site da AG. Procuro: ${state.purpose}, ${state.type}, ${state.city}, ${state.budget}.`;
    box.innerHTML=`<b>Resumo da sua busca</b><br>${escapeHTML(state.purpose)} · ${escapeHTML(state.type)}<br>${escapeHTML(state.city)} · ${escapeHTML(state.budget)}<div class="ag-chat-success-actions"><a class="primary" target="_blank" rel="noopener" href="${wa?`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`:'#'}">Continuar no WhatsApp</a><button class="secondary" type="button" id="agChatSeeProperties">Ver imóveis</button></div>`;
    body.appendChild(box);scroll();
    $('#agChatSeeProperties',box)?.addEventListener('click',()=>{panel.classList.remove('open');launcher.setAttribute('aria-expanded','false');document.getElementById('properties')?.scrollIntoView({behavior:'smooth',block:'start'})});
    busy=false;
  }
  function open(){panel.classList.add('open');launcher.setAttribute('aria-expanded','true');teaser?.classList.remove('show');start()}
  function close(){panel.classList.remove('open');launcher.setAttribute('aria-expanded','false')}

  launcher.addEventListener('click',()=>panel.classList.contains('open')?close():open());
  closeBtn?.addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

  // Mostra apenas um convite discreto; não finge que há uma pessoa digitando ao vivo.
  setTimeout(()=>{if(!panel.classList.contains('open'))teaser?.classList.add('show')},3500);
  setTimeout(()=>teaser?.classList.remove('show'),11000);
})();
