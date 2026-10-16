(() => {
  const $ = (s, r=document) => r.querySelector(s);
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  const sidebar = $('#sidebar');
  const backdrop = document.createElement('div');
  backdrop.className = 'mobile-drawer-backdrop';
  backdrop.id = 'mobileDrawerBackdrop';
  document.body.appendChild(backdrop);
  const syncDrawer = () => {
    const open = !!sidebar?.classList.contains('open');
    backdrop.classList.toggle('show', open);
    document.body.classList.toggle('drawer-open', open);
  };
  if (sidebar) new MutationObserver(syncDrawer).observe(sidebar,{attributes:true,attributeFilter:['class']});
  backdrop.addEventListener('click', () => { sidebar?.classList.remove('open'); syncDrawer(); });
  $('#mobileMoreBtn')?.addEventListener('click', () => { sidebar?.classList.add('open'); syncDrawer(); });
  $('#mobileMenu')?.addEventListener('click', () => setTimeout(syncDrawer, 0));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sidebar?.classList.contains('open')) { sidebar.classList.remove('open'); syncDrawer(); } });

  const installBtn = $('#pwaInstallBtn');
  const sheet = document.createElement('div');
  sheet.className = 'pwa-install-sheet';
  sheet.id = 'pwaInstallSheet';
  sheet.innerHTML = '<div class="pwa-install-card"><h3>Instalar AG CRM</h3><p id="pwaInstallCopy">Instale o CRM na tela inicial para abrir como aplicativo.</p><button class="btn primary" type="button" id="pwaInstallSheetAction">Entendi</button></div>';
  document.body.appendChild(sheet);
  const sheetAction = $('#pwaInstallSheetAction');
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.classList.remove('show'); });
  sheetAction?.addEventListener('click', () => sheet.classList.remove('show'));

  const revealInstall = () => { if (installBtn && !isStandalone()) installBtn.hidden = false; };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; revealInstall(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; if (installBtn) installBtn.hidden = true; });
  if (isIOS() && !isStandalone()) revealInstall();
  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      installBtn.hidden = true;
      return;
    }
    $('#pwaInstallCopy').textContent = isIOS()
      ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
      : 'Abra este endereço pelo Chrome ou Edge em HTTPS e use “Instalar aplicativo” no menu do navegador.';
    sheet.classList.add('show');
  });

  const offline = document.createElement('div');
  offline.className = 'pwa-offline-pill'; offline.id = 'pwaOfflinePill'; offline.textContent = 'Sem conexão · usando conteúdo local';
  document.body.appendChild(offline);
  const syncOnline = () => offline.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', syncOnline); window.addEventListener('offline', syncOnline); syncOnline();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js?v=74', {scope:'./'});
        const updateBar = document.createElement('div');
        updateBar.className = 'pwa-update-bar'; updateBar.innerHTML = '<span>Nova versão do AG CRM disponível.</span><button type="button">Atualizar</button>';
        document.body.appendChild(updateBar);
        const showUpdate = worker => {
          if (!worker) return;
          updateBar.classList.add('show');
          updateBar.querySelector('button').onclick = () => worker.postMessage({type:'SKIP_WAITING'});
        };
        if (reg.waiting) showUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker); });
        });
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) return; refreshing = true; location.reload(); });
      } catch (err) { console.warn('PWA indisponível:', err); }
    });
  }

  // Deep links dos atalhos do manifesto: #imoveis, #leads, #agenda.
  const hashPage = location.hash.replace('#','');
  if (hashPage && document.querySelector(`[data-page="${CSS.escape(hashPage)}"]`)) {
    window.addEventListener('load', () => setTimeout(() => document.querySelector(`[data-page="${CSS.escape(hashPage)}"]`)?.click(), 250));
  }
})();
