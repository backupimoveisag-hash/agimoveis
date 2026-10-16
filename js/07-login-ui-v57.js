(() => {
  const $ = (s) => document.querySelector(s);
  const signin = $('#loginSigninFields');
  const register = $('#loginRegisterPanel');
  const status = $('#loginStatus');
  const error = $('#loginError');
  const createBtn = $('#loginCreateAccountToggle');
  const backBtn = $('#loginBackToSignIn');
  const registerBtn = $('#loginRegisterSubmit');

  function showRegister(show) {
    signin?.classList.toggle('hidden', show);
    register?.classList.toggle('hidden', !show);
    if (error) error.textContent = '';
    if (status) {
      status.textContent = show ? 'Crie sua conta. Após o cadastro, o administrador aprova o acesso.' : '';
      status.dataset.tone = show ? 'info' : '';
    }
    if (show) setTimeout(() => $('#registerName')?.focus(), 0);
    else setTimeout(() => $('#loginEmail')?.focus(), 0);
  }

  createBtn?.addEventListener('click', () => showRegister(true));
  backBtn?.addEventListener('click', () => showRegister(false));

  // Basic UI must keep working even if the Firebase module/CDN fails to load.
  let firebaseReady = false;
  window.addEventListener('ag:firebase-ready', () => { firebaseReady = true; });
  registerBtn?.addEventListener('click', () => {
    if (firebaseReady) return;
    // Give the module a short moment to initialize; if it has not, show a useful diagnostic.
    setTimeout(() => {
      if (!firebaseReady && register && !register.classList.contains('hidden') && error && !error.textContent) {
        error.textContent = location.protocol === 'file:'
          ? 'Para criar a conta, abra o CRM pela hospedagem/servidor (http ou https), não diretamente pelo arquivo local.'
          : 'O Firebase ainda não carregou. Verifique a conexão e tente novamente.';
      }
    }, 900);
  }, {capture:true});

  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (/firebase|gstatic|module|import/i.test(msg) && error) {
      error.textContent = 'Não foi possível carregar o Firebase. Atualize a página e verifique a conexão.';
    }
  });
})();
