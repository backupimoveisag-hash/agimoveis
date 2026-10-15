(() => {
  const mq = window.matchMedia('(max-width: 900px)');
  const $ = (s, r=document) => r.querySelector(s);
  const sidebar = $('#sidebar');
  const bottom = $('#mobileBottom');
  const search = $('#globalSearch');

  const pageNames = {
    dashboard:'Visão', imoveis:'Imóveis', leads:'Leads', atendimento:'Atendimento', funil:'Jornada',
    match:'Match', clientes:'Pessoas', proprietarios:'Proprietários', agenda:'Agenda', propostas:'Documentos',
    financeiro:'Financeiro', site:'Site', configuracoes:'Ajustes', relatorios:'Relatórios'
  };

  function normalizeMobile(){
    if (!mq.matches) return;
    if (search) search.placeholder = 'Buscar no CRM';
    // Mantém apenas uma barra inferior e impede que o More herde estado ativo de outra tela.
    $('#mobileMoreBtn')?.classList.toggle('active', !!sidebar?.classList.contains('open'));
  }

  function syncDrawer(){
    if (!mq.matches) return;
    const open = !!sidebar?.classList.contains('open');
    document.body.classList.toggle('drawer-open', open);
    $('#mobileMoreBtn')?.classList.toggle('active', open);
  }

  if (sidebar) new MutationObserver(syncDrawer).observe(sidebar,{attributes:true,attributeFilter:['class']});

  document.addEventListener('click', e => {
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && mq.matches) {
      const page = pageBtn.dataset.page;
      document.documentElement.dataset.mobilePage = pageNames[page] || page || '';
    }
  });

  if (bottom) {
    // Evita que o toque na tab bar arraste a página ou selecione texto.
    bottom.addEventListener('touchstart', () => {}, {passive:true});
  }

  if (mq.addEventListener) mq.addEventListener('change', () => { normalizeMobile(); syncDrawer(); });
  else mq.addListener(() => { normalizeMobile(); syncDrawer(); });

  normalizeMobile();
  syncDrawer();
})();
