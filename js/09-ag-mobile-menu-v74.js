(() => {
  const mobile = () => window.matchMedia('(max-width: 900px)').matches;
  const sidebar = document.getElementById('sidebar');
  const nav = document.getElementById('sideNav');
  if (!sidebar || !nav) return;

  // Remove os listeners antigos dos dois gatilhos sem alterar seus IDs/visual.
  const replaceControl = id => {
    const old = document.getElementById(id);
    if (!old) return null;
    const fresh = old.cloneNode(true);
    old.replaceWith(fresh);
    return fresh;
  };
  const menuBtn = replaceControl('mobileMenu');
  const moreBtn = replaceControl('mobileMoreBtn');

  // O antigo item de coração era rotulado por pseudo-elemento como "Favoritos".
  // No CRM atual ele representa o Match; no mobile mostramos a legenda correta.
  const matchButton = nav.querySelector('.nav-heart[data-page="match"]');
  if (matchButton && !matchButton.querySelector('.ag-mobile-label')) {
    const label = document.createElement('span');
    label.className = 'ag-mobile-label';
    label.textContent = 'Match';
    matchButton.appendChild(label);
  }

  // Botão de fechar real dentro do drawer.
  const brand = sidebar.querySelector('.brand');
  let closeBtn = sidebar.querySelector('.ag-mobile-drawer-close');
  if (!closeBtn && brand) {
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ag-mobile-drawer-close';
    closeBtn.setAttribute('aria-label', 'Fechar menu');
    closeBtn.textContent = '×';
    brand.appendChild(closeBtn);
  }

  // Reaproveita o backdrop do PWA; se ainda não existir, cria um.
  let backdrop = document.getElementById('mobileDrawerBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'mobile-drawer-backdrop';
    backdrop.id = 'mobileDrawerBackdrop';
    document.body.appendChild(backdrop);
  }

  const sync = () => {
    const open = sidebar.classList.contains('open') && mobile();
    backdrop.classList.toggle('show', open);
    document.body.classList.toggle('drawer-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
    moreBtn?.setAttribute('aria-expanded', String(open));
    sidebar.setAttribute('aria-hidden', String(!open && mobile()));
  };
  const open = () => {
    if (!mobile()) return;
    sidebar.classList.add('open');
    sync();
    requestAnimationFrame(() => closeBtn?.focus({preventScroll:true}));
  };
  const close = ({restoreFocus=true}={}) => {
    const wasOpen = sidebar.classList.contains('open');
    sidebar.classList.remove('open');
    sync();
    if (wasOpen && restoreFocus && mobile()) requestAnimationFrame(() => menuBtn?.focus({preventScroll:true}));
  };

  menuBtn?.setAttribute('aria-controls', 'sidebar');
  menuBtn?.setAttribute('aria-expanded', 'false');
  menuBtn?.setAttribute('aria-label', 'Abrir menu');
  moreBtn?.setAttribute('aria-controls', 'sidebar');
  moreBtn?.setAttribute('aria-expanded', 'false');
  moreBtn?.setAttribute('aria-label', 'Abrir mais opções');

  menuBtn?.addEventListener('click', e => { e.preventDefault(); sidebar.classList.contains('open') ? close() : open(); });
  moreBtn?.addEventListener('click', e => { e.preventDefault(); open(); });
  closeBtn?.addEventListener('click', () => close());
  backdrop.addEventListener('click', () => close());

  nav.addEventListener('click', e => {
    const item = e.target.closest('[data-page]');
    if (!item || !mobile()) return;
    // O app.js continua responsável por navigate(); aqui apenas fechamos o drawer.
    setTimeout(() => close({restoreFocus:false}), 0);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
  });

  const mq = window.matchMedia('(max-width: 900px)');
  const onBreakpoint = () => {
    if (!mq.matches) {
      sidebar.classList.remove('open');
      document.body.classList.remove('drawer-open');
      backdrop.classList.remove('show');
      sidebar.removeAttribute('aria-hidden');
    }
    sync();
  };
  if (mq.addEventListener) mq.addEventListener('change', onBreakpoint);
  else mq.addListener(onBreakpoint);
  onBreakpoint();
})();
