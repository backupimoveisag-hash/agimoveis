/* AG Imobiliária — popup de saída, exclusivamente desktop. */
(() => {
  'use strict';
  const overlay = document.getElementById('agExitOverlay');
  const dialog = document.getElementById('agExitDialog');
  const close = document.getElementById('agExitClose');
  const dismiss = document.getElementById('agExitDismiss');
  const contact = document.getElementById('agExitContact');
  if (!overlay || !dialog || !close || !dismiss || !contact) return;
  const sessionKey = 'agExitIntentSeenV1';
  const desktop = () => window.matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)').matches;
  const alreadyShown = () => { try { return sessionStorage.getItem(sessionKey) === '1'; } catch (_) { return window.__agExitSeen === true; } };
  const markShown = () => { window.__agExitSeen = true; try { sessionStorage.setItem(sessionKey, '1'); } catch (_) {} };
  const openDialogs = () => !!document.querySelector('.modal-bg.show,.visit-modal-bg.show,.drawer-bg.show,.lightbox.show,.ag-concierge.open,.ag-concierge.show,.ag-exit-overlay.is-visible');
  let active = false;
  let lastFocus = null;
  let mouseWasInside = false;
  const readyAt = Date.now() + 5000;
  function hide() {
    if (!active) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    active = false;
    document.removeEventListener('keydown', onKeydown, true);
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll:true });
  }
  function onKeydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide(); }
    if (event.key === 'Tab') {
      const controls = [close, contact, dismiss];
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && (index <= 0)) { event.preventDefault(); dismiss.focus(); }
      else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); close.focus(); }
    }
  }
  function show() {
    if (active || !desktop() || alreadyShown() || openDialogs() || Date.now() < readyAt) return;
    // Evita interromper formulários e digitação.
    if (document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
    markShown();
    active = true;
    lastFocus = document.activeElement;
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden','false');
    close.focus({ preventScroll:true });
    document.addEventListener('keydown', onKeydown, true);
  }
  document.addEventListener('mousemove', event => {
    if (event.clientY > 80 && event.clientY < window.innerHeight - 10) mouseWasInside = true;
  }, { passive:true });
  document.addEventListener('mouseout', event => {
    if (!mouseWasInside || event.relatedTarget || event.toElement || event.clientY > 12 || event.clientY < -35) return;
    show();
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) hide(); });
  close.addEventListener('click', hide);
  dismiss.addEventListener('click', hide);
  contact.addEventListener('click', () => {
    hide();
    // O botão existente abre o cadastro básico e envia os dados para o fluxo de atendimento já integrado.
    document.getElementById('navWhatsapp')?.click();
  });
  window.addEventListener('resize', () => { if (!desktop()) hide(); }, { passive:true });
})();
