// V55 — abas de Ajustes + acesso direto às configurações de automação
(()=>{
  const tabs=[...document.querySelectorAll('[data-settings-tab]')];
  const panels=[...document.querySelectorAll('[data-settings-panel]')];
  if(!tabs.length||!panels.length)return;

  function activateSettingsTab(name){
    const chosen=tabs.find(btn=>btn.dataset.settingsTab===name);
    if(!chosen||chosen.hidden)name='geral';
    tabs.forEach(btn=>{
      const active=btn.dataset.settingsTab===name;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-selected',active?'true':'false');
    });
    panels.forEach(panel=>panel.classList.toggle('active',panel.dataset.settingsPanel===name));
    try{localStorage.setItem('agSettingsTab',name)}catch(e){}
  }

  tabs.forEach(btn=>btn.addEventListener('click',()=>activateSettingsTab(btn.dataset.settingsTab)));

  const openAutomation=document.getElementById('openAutomationSettings');
  openAutomation?.addEventListener('click',()=>{
    if(typeof navigate==='function')navigate('configuracoes');
    activateSettingsTab('automacoes');
  });

  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-open-settings-tab]');
    if(!trigger)return;
    if(typeof navigate==='function')navigate('configuracoes');
    activateSettingsTab(trigger.dataset.openSettingsTab||'geral');
  });

  let saved='geral';
  try{saved=localStorage.getItem('agSettingsTab')||'geral'}catch(e){}
  if(!panels.some(p=>p.dataset.settingsPanel===saved))saved='geral';
  activateSettingsTab(saved);

  window.activateSettingsTab=activateSettingsTab;
})();
