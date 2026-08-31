(() => {
  'use strict';

  const REMEMBER_KEY = 'obraativa.remembered-account.v1';
  const SESSION_KEYS = ['controleObraCloudSession', 'controleObraSaasTestSession'];
  let installed = false;
  let queued = false;
  let originalShowAuth = null;
  let originalSignOut = null;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

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
    }
    if (typeof originalSignOut === 'function') await originalSignOut.call(window.CloudSync);
  }

  function rememberedMarkup(record) {
    const email = escapeHtml(record.email || record.session?.user?.email || 'Conta neste dispositivo');
    return `<section class="obraativa-remembered-account" data-remembered-account><div><small>CONTA LEMBRADA NESTE DISPOSITIVO</small><b>${email}</b><span>A sessão segura está pronta para continuar.</span></div><button type="button" class="btn" data-resume-account>Entrar novamente</button><button type="button" class="cloud-link" data-forget-account>Usar outra conta</button></section>`;
  }

  function enhanceAuthCard(card) {
    if (!card || card.querySelector('[data-remembered-account]')) return;
    const title = String($('h1', card)?.textContent || '').toLocaleLowerCase('pt-BR');
    if (!title.includes('entrar')) return;
    const record = readRemembered();
    if (!record) return;
    const form = $('.form', card);
    if (!form) return;
    form.insertAdjacentHTML('beforebegin', rememberedMarkup(record));
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
    const existing = document.querySelectorAll('#app:not(.public-app) .obraativa-mobile-account-action');
    if (!window.matchMedia('(max-width:760px)').matches) {
      existing.forEach((action) => action.remove());
      return;
    }
    const scroller = $('#app:not(.public-app) #nav .nav-extra-scroll');
    if (!scroller || scroller.querySelector('.obraativa-mobile-account-action')) return;
    const target = $('.mobile-more-group:last-of-type', scroller) || scroller;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'obraativa-mobile-account-action';
    button.innerHTML = '<span class="mobile-nav-icon" aria-hidden="true">↪</span><span class="mobile-nav-label">Sair da conta</span>';
    button.addEventListener('click', openSignOut);
    target.appendChild(button);
  }

  function refresh() {
    queued = false;
    injectSidebarAction();
    injectMobileAction();
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
    if (originalShowAuth) {
      window.CloudSync.showAuth = function (...args) {
        const result = originalShowAuth(...args);
        schedule();
        return result;
      };
    }
    if (originalSignOut) window.CloudSync.signOut = () => openSignOut();
    document.body.addEventListener('click', (event) => {
      if (event.target.closest('[data-resume-account]')) resumeRemembered();
      if (event.target.closest('[data-forget-account]')) forgetAndShowAuth();
    });
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.ObraAtivaAccountControls = Object.freeze({ openSignOut, resumeRemembered, forgetRemembered });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
