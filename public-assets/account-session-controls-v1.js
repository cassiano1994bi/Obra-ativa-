(() => {
  'use strict';

  const REMEMBER_KEY = 'obraativa.remembered-account.v1';
  const SESSION_KEYS = ['controleObraCloudSession', 'controleObraSaasTestSession'];
  let installed = false;
  let queued = false;
  let originalShowAuth = null;
  let originalSignOut = null;
  let originalShowRecovery = null;
  let originalShowPasswordReset = null;
  let originalShowOnboarding = null;
  let originalShowLoading = null;
  let lastAuthEmail = '';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function humanizeAuthMessage(message) {
    const text = String(message || '').trim();
    if (!text) return '';
    const normalized = text.toLocaleLowerCase('pt-BR');
    if (/invalid login|invalid credentials|email or password/.test(normalized)) return 'E-mail ou senha não conferem. Revise os dados e tente novamente.';
    if (/email not confirmed|email.*confirm/.test(normalized)) return 'Confirme o e-mail enviado para sua caixa de entrada antes de entrar.';
    if (/already registered|already exists|user.*registered/.test(normalized)) return 'Este e-mail já possui uma conta. Entre normalmente ou use “Esqueci minha senha”.';
    if (/password.*(least|characters|weak)|senha.*(fraca|caracteres)/.test(normalized)) return 'Crie uma senha com 8 caracteres, incluindo letra maiúscula, minúscula e número.';
    if (/failed to fetch|network|networkerror|load failed/.test(normalized)) return 'Não conseguimos conectar agora. Verifique sua internet e tente novamente.';
    if (/rate limit|too many requests|too many attempts/.test(normalized)) return 'Foram feitas muitas tentativas. Aguarde alguns minutos e tente novamente.';
    return text;
  }

  function passwordToggleMarkup(visible) {
    return visible
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.3 0 9 5 9 5s-1.2 1.6-3.1 3M6.6 6.6C4.4 8 3 10 3 10s3.7 5 9 5c1.1 0 2.1-.2 3-.5"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.7-5 9-5 9 5 9 5-3.7 5-9 5-9-5-9-5Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
  }

  function authMode(card) {
    const title = String($('h1', card)?.textContent || '').toLocaleLowerCase('pt-BR');
    if (title.includes('criar acesso')) return 'signup';
    if (title.includes('entrar')) return 'signin';
    if (title.includes('recuperar senha')) return 'recovery';
    if (title.includes('nova senha')) return 'reset';
    if (title.includes('criar sua empresa')) return 'onboarding';
    return 'generic';
  }

  function passwordScore(value) {
    const password = String(value || '');
    const checks = [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password)];
    return { checks, score: checks.filter(Boolean).length };
  }

  function updatePasswordStrength(input) {
    const strength = input?.closest('.field')?.querySelector('.obraativa-password-strength');
    if (!strength) return;
    const result = passwordScore(input.value);
    const labels = ['Comece a digitar', 'Fraca', 'Boa', 'Forte'];
    strength.dataset.score = String(result.score);
    const label = $('[data-password-strength-label]', strength);
    if (label) label.textContent = labels[result.score];
    strength.querySelectorAll('[data-password-rule]').forEach((item, index) => {
      item.classList.toggle('done', Boolean(result.checks[index]));
      const icon = $('i', item);
      if (icon) icon.textContent = result.checks[index] ? '✓' : '•';
    });
  }

  function enhancePasswordInput(input, showStrength = false) {
    if (!input || input.closest('.obraativa-password-shell')) return;
    const field = input.closest('.field');
    if (!field) return;
    const shell = document.createElement('div');
    shell.className = 'obraativa-password-shell';
    input.parentNode.insertBefore(shell, input);
    shell.appendChild(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'obraativa-password-toggle';
    toggle.dataset.passwordToggle = '1';
    toggle.setAttribute('aria-label', 'Mostrar senha');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.title = 'Mostrar senha';
    toggle.innerHTML = passwordToggleMarkup(false);
    shell.appendChild(toggle);
    if (!showStrength) return;
    const strength = document.createElement('div');
    const strengthId = `${input.id || input.name || 'password'}Strength`;
    strength.id = strengthId;
    strength.className = 'obraativa-password-strength';
    strength.dataset.score = '0';
    strength.setAttribute('aria-live', 'polite');
    strength.innerHTML = '<div class="obraativa-password-meter"><i></i></div><b data-password-strength-label>Comece a digitar</b><ul><li data-password-rule><i>•</i> 8 ou mais caracteres</li><li data-password-rule><i>•</i> letra maiúscula e minúscula</li><li data-password-rule><i>•</i> pelo menos um número</li></ul>';
    shell.insertAdjacentElement('afterend', strength);
    input.setAttribute('aria-describedby', strengthId);
    updatePasswordStrength(input);
  }

  function labelInputs(card) {
    card.querySelectorAll('.field').forEach((field, index) => {
      const input = $('input,select,textarea', field);
      const label = $('label', field);
      if (!input || !label) return;
      if (!input.id) input.id = `obraativaAuthField${index + 1}`;
      label.htmlFor = input.id;
    });
  }

  function localSessionKey() {
    const params = new URLSearchParams(location.search);
    return location.hostname === '127.0.0.1' || location.hostname === 'localhost'
      ? (params.get('saasTest') === '1' ? 'controleObraSaasTestSession' : 'controleObraCloudSession')
      : 'controleObraCloudSession';
  }

  function readRemembered() {
    try {
      const value = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
      if (!value || typeof value !== 'object' || !value.session?.refresh_token) return null;
      return value;
    } catch (error) {
      return null;
    }
  }

  function rememberSession(session) {
    if (!session?.refresh_token || !session?.user?.id) return false;
    try {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({
        email: String(session.user.email || '').trim(),
        userId: String(session.user.id),
        session: {
          access_token: session.access_token || '',
          refresh_token: session.refresh_token,
          expires_at: session.expires_at || 0,
          expires_in: session.expires_in || 0,
          token_type: session.token_type || 'bearer',
          user: session.user
        },
        savedAt: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function forgetRemembered() {
    try { localStorage.removeItem(REMEMBER_KEY); } catch (error) { /* armazenamento opcional */ }
  }

  function clearActiveSession() {
    SESSION_KEYS.forEach((key) => {
      try { localStorage.removeItem(key); } catch (error) { /* limpeza local opcional */ }
      try { sessionStorage.removeItem(key); } catch (error) { /* limpeza local opcional */ }
    });
  }

  function ensureDialog() {
    let backdrop = $('.obraativa-account-dialog');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'obraativa-account-dialog';
    backdrop.hidden = true;
    backdrop.innerHTML = '<section class="obraativa-account-dialog-card" role="dialog" aria-modal="true" aria-labelledby="obraativaAccountDialogTitle"><button type="button" class="obraativa-account-dialog-close" data-account-close aria-label="Fechar">×</button><small class="obraativa-account-dialog-kicker">CONTA E SEGURANÇA</small><h2 id="obraativaAccountDialogTitle">Sair da conta</h2><p>Você pode sair agora e escolher se esta conta deve ficar lembrada neste dispositivo.</p><label class="obraativa-account-remember"><input type="checkbox" data-account-remember><span><b>Lembrar esta conta neste dispositivo</b><small>Não salvamos sua senha. Guardamos apenas a sessão segura para você entrar novamente com um toque.</small></span></label><footer><button type="button" class="btn alt" data-account-close>Cancelar</button><button type="button" class="btn" data-account-confirm>Sair da conta</button></footer></section>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('[data-account-close]')) closeDialog();
      if (event.target.closest('[data-account-confirm]')) confirmSignOut();
    });
    return backdrop;
  }

  function openSignOut() {
    if (!window.CloudSync?.session) return;
    const backdrop = ensureDialog();
    const checkbox = $('[data-account-remember]', backdrop);
    if (checkbox) checkbox.checked = Boolean(readRemembered());
    backdrop.hidden = false;
    document.body.classList.add('obraativa-account-dialog-open');
    window.setTimeout(() => checkbox?.focus(), 0);
  }

  function closeDialog() {
    const backdrop = $('.obraativa-account-dialog');
    if (!backdrop) return;
    backdrop.hidden = true;
    document.body.classList.remove('obraativa-account-dialog-open');
  }

  async function confirmSignOut() {
    const backdrop = ensureDialog();
    const remember = Boolean($('[data-account-remember]', backdrop)?.checked);
    const session = window.CloudSync?.session;
    try { window.ObraAtivaUsage?.end(); } catch { /* medição nunca impede sair */ }
    closeDialog();
    if (remember && session) {
      if (!rememberSession(session)) {
        alert('Não foi possível guardar a conta neste dispositivo. Você será desconectado sem guardar a sessão.');
        forgetRemembered();
      } else {
        clearActiveSession();
        window.CloudSync.session = null;
        window.CloudSync.ready = false;
        window.CloudSync.syncing = false;
        window.CloudSync.showAuth('signin', 'Conta lembrada neste dispositivo. Use “Entrar novamente” para continuar.');
        return;
      }
    } else {
      forgetRemembered();
      clearActiveSession();
    }
    if (typeof originalSignOut === 'function') await originalSignOut.call(window.CloudSync);
  }

  function rememberedMarkup(record) {
    const email = escapeHtml(record.email || record.session?.user?.email || 'Conta neste dispositivo');
    return `<section class="obraativa-remembered-account" data-remembered-account><div><small>CONTA LEMBRADA NESTE DISPOSITIVO</small><b>${email}</b><span>A sessão segura está pronta para continuar.</span></div><button type="button" class="btn" data-resume-account>Entrar novamente</button><button type="button" class="cloud-link" data-forget-account>Usar outra conta</button></section>`;
  }

  function enhanceLoading() {
    const loading = $('#cloudGate .cloud-loading');
    if (!loading || loading.dataset.authUx === '1') return;
    loading.dataset.authUx = '1';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.setAttribute('aria-busy', 'true');
    loading.insertAdjacentHTML('afterbegin', '<img class="obraativa-loading-mark" src="/public-assets/obraativa-app-icon-v2-192.png" alt=""><i class="obraativa-auth-spinner" aria-hidden="true"></i>');
  }

  function enhanceOnboarding(card) {
    const form = $('.form', card);
    if (!form || form.querySelector('.obraativa-auth-optional')) return;
    const companyField = $('[name="company"]', form)?.closest('.field');
    const optionalFields = ['responsible', 'whatsapp', 'city', 'firstWork', 'firstService']
      .map((name) => $(`[name="${name}"]`, form)?.closest('.field'))
      .filter(Boolean);
    if (!companyField || !optionalFields.length) return;
    const details = document.createElement('details');
    details.className = 'obraativa-auth-optional';
    details.innerHTML = '<summary>Adicionar informações agora <small>(opcional)</small></summary><div class="obraativa-auth-optional-grid"></div>';
    companyField.insertAdjacentElement('afterend', details);
    const grid = $('.obraativa-auth-optional-grid', details);
    optionalFields.forEach((field) => grid.appendChild(field));
    const submit = $('button[type="submit"]', form);
    if (submit) submit.textContent = 'Criar empresa e começar grátis';
  }

  function enhanceAuthCard(card) {
    if (!card) return;
    const mode = authMode(card);
    const form = $('.form', card);
    if (mode === 'signin' && !card.querySelector('[data-remembered-account]')) {
      const record = readRemembered();
      if (record && form) form.insertAdjacentHTML('beforebegin', rememberedMarkup(record));
    }
    if (card.dataset.authUx === '1') return;
    card.dataset.authUx = '1';
    card.classList.add('obraativa-auth-experience', `obraativa-auth-${mode}`);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const heading = $('h1', card);
    if (heading) {
      if (!heading.id) heading.id = 'obraativaAuthTitle';
      card.setAttribute('aria-labelledby', heading.id);
    }
    if (!card.querySelector('.cloud-close') && ['recovery', 'reset', 'onboarding'].includes(mode)) {
      card.insertAdjacentHTML('afterbegin', '<button type="button" class="cloud-close" aria-label="Fechar esta tela" title="Fechar" onclick="CloudSync.closeAuth()">×</button>');
    }
    if (mode === 'signup' && heading) heading.insertAdjacentHTML('beforebegin', '<span class="obraativa-auth-step">ETAPA 1 DE 2 · SUA CONTA</span>');
    if (mode === 'onboarding' && heading) heading.insertAdjacentHTML('beforebegin', '<span class="obraativa-auth-step">ETAPA 2 DE 2 · SUA EMPRESA</span>');
    labelInputs(card);
    const email = $('input[name="email"]', card);
    if (email && lastAuthEmail && !email.value) email.value = lastAuthEmail;
    card.querySelectorAll('input[type="password"]').forEach((input, index) => enhancePasswordInput(input, ['signup', 'reset'].includes(mode) && index === 0));
    const submit = $('button[type="submit"]', card);
    if (submit) {
      submit.classList.add('obraativa-auth-primary');
      if (mode === 'signup') submit.textContent = 'Criar minha conta grátis';
      if (mode === 'recovery') submit.textContent = 'Enviar instruções por e-mail';
    }
    const message = $('.cloud-message', card);
    if (message) {
      message.textContent = humanizeAuthMessage(message.textContent);
      const success = !message.classList.contains('error');
      message.classList.toggle('success', success);
      message.setAttribute('role', success ? 'status' : 'alert');
      message.setAttribute('aria-live', success ? 'polite' : 'assertive');
    }
    const notice = $('.notice', card);
    if (notice && ['signin', 'signup'].includes(mode)) notice.classList.add('obraativa-auth-trust');
    if (mode === 'onboarding') enhanceOnboarding(card);
  }

  async function resumeRemembered() {
    const record = readRemembered();
    if (!record?.session?.refresh_token || !window.CloudSync) return;
    window.CloudSync.showLoading('Entrando com a conta lembrada...');
    try {
      let session = record.session;
      const expiresAt = Number(session.expires_at || 0) * 1000;
      if (!session.access_token || !expiresAt || expiresAt < Date.now() + 60000) {
        session = await window.CloudSync.refreshSession(session);
      } else {
        window.CloudSync.saveSession(session);
      }
      window.CloudSync.session = session;
      rememberSession(session);
      await window.CloudSync.activate();
    } catch (error) {
      forgetRemembered();
      clearActiveSession();
      window.CloudSync.showAuth('signin', 'A sessão lembrada expirou. Entre com sua senha novamente.', true);
    }
  }

  function forgetAndShowAuth() {
    forgetRemembered();
    window.CloudSync?.showAuth('signin');
  }

  function injectSidebarAction() {
    const side = $('#app:not(.public-app) .side');
    if (!side) return;
    const footers = [...side.querySelectorAll('.obraativa-account-session-footer')];
    const footer = footers[0] || null;
    footers.slice(1).forEach((duplicate) => duplicate.remove());
    let target = footer;
    if (!target) {
      target = document.createElement('div');
      target.className = 'obraativa-account-session-footer';
      side.appendChild(target);
    }
    if (!target.querySelector('button')) target.innerHTML = '<button type="button" aria-label="Sair da conta" title="Sair da conta"><span aria-hidden="true">↪</span><span>Sair da conta</span></button>';
    const button = $('button', target);
    if (button && button.dataset.accountBound !== '1') {
      button.dataset.accountBound = '1';
      button.addEventListener('click', openSignOut);
    }
  }

  function injectMobileAction() {
    document.querySelectorAll('#app:not(.public-app) .obraativa-mobile-account-action').forEach((action) => action.remove());
  }

  function removeDuplicateActions() {
    document.querySelectorAll('#app:not(.public-app) .sign-out-from-settings, #app:not(.public-app) .obraativa-mobile-account-action')
      .forEach((action) => action.remove());
  }

  function refresh() {
    queued = false;
    removeDuplicateActions();
    injectSidebarAction();
    injectMobileAction();
    enhanceLoading();
    document.querySelectorAll('#cloudGate .cloud-auth-card').forEach(enhanceAuthCard);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    const frame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    frame(refresh);
  }

  function install() {
    if (installed) return;
    if (!window.CloudSync || !document.body) { window.setTimeout(install, 100); return; }
    installed = true;
    originalShowAuth = window.CloudSync.showAuth?.bind(window.CloudSync);
    originalSignOut = window.CloudSync.signOut?.bind(window.CloudSync);
    originalShowRecovery = window.CloudSync.showRecovery?.bind(window.CloudSync);
    originalShowPasswordReset = window.CloudSync.showPasswordReset?.bind(window.CloudSync);
    originalShowLoading = window.CloudSync.showLoading?.bind(window.CloudSync);
    originalShowOnboarding = window.CompanyWorkspace?.showOnboarding?.bind(window.CompanyWorkspace);
    if (originalShowAuth) {
      window.CloudSync.showAuth = function (...args) {
        if (args[1]) args[1] = humanizeAuthMessage(args[1]);
        const result = originalShowAuth(...args);
        schedule();
        return result;
      };
    }
    if (originalShowRecovery) {
      window.CloudSync.showRecovery = function (...args) {
        if (args[0]) args[0] = humanizeAuthMessage(args[0]);
        const result = originalShowRecovery(...args);
        schedule();
        return result;
      };
    }
    if (originalShowPasswordReset) {
      window.CloudSync.showPasswordReset = function (...args) {
        if (args[0]) args[0] = humanizeAuthMessage(args[0]);
        const result = originalShowPasswordReset(...args);
        schedule();
        return result;
      };
    }
    if (originalShowLoading) {
      window.CloudSync.showLoading = function (...args) {
        const result = originalShowLoading(...args);
        schedule();
        return result;
      };
    }
    if (originalShowOnboarding) {
      window.CompanyWorkspace.showOnboarding = function (...args) {
        if (args[0]) args[0] = humanizeAuthMessage(args[0]);
        const result = originalShowOnboarding(...args);
        schedule();
        return result;
      };
    }
    if (originalSignOut) window.CloudSync.signOut = () => openSignOut();
    document.body.addEventListener('click', (event) => {
      if (event.target.closest('[data-resume-account]')) resumeRemembered();
      if (event.target.closest('[data-forget-account]')) forgetAndShowAuth();
      const toggle = event.target.closest('[data-password-toggle]');
      if (toggle) {
        const input = $('input', toggle.closest('.obraativa-password-shell'));
        if (!input) return;
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        toggle.innerHTML = passwordToggleMarkup(visible);
        toggle.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
        toggle.title = visible ? 'Ocultar senha' : 'Mostrar senha';
        toggle.setAttribute('aria-pressed', String(visible));
        input.focus();
      }
    });
    document.body.addEventListener('input', (event) => {
      if (event.target.matches('#cloudGate input[name="email"]')) lastAuthEmail = event.target.value.trim();
      if (event.target.matches('#cloudGate input[name="password"], #cloudGate input[name="confirmation"]')) updatePasswordStrength(event.target);
    });
    document.body.addEventListener('submit', (event) => {
      const form = event.target.closest('#cloudGate form');
      if (!form) return;
      const email = $('input[name="email"]', form);
      if (email) lastAuthEmail = email.value.trim();
      const submit = $('button[type="submit"]', form);
      if (!submit) return;
      const mode = authMode(form.closest('.cloud-auth-card'));
      const labels = { signin: 'Entrando…', signup: 'Criando sua conta…', recovery: 'Enviando…', reset: 'Salvando…', onboarding: 'Preparando sua empresa…' };
      submit.disabled = true;
      submit.classList.add('is-loading');
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = labels[mode] || 'Aguarde…';
    }, true);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.ObraAtivaAccountControls = Object.freeze({ openSignOut, resumeRemembered, forgetRemembered, humanizeAuthMessage, passwordScore });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
