(() => {
  'use strict';

  const REMEMBER_PREFERENCE_KEY = 'obraativa.auth.remember-device.v1';
  const OAUTH_PROVIDER_KEY = 'obraativa.auth.oauth-provider.v1';
  const PROVIDERS = Object.freeze({
    google: Object.freeze({ supabase: 'google', label: 'Google', scopes: '' }),
    microsoft: Object.freeze({ supabase: 'azure', label: 'Microsoft', scopes: 'email openid profile' })
  });
  let installed = false;
  let availability = Object.freeze({ google: false, microsoft: false, checked: false });

  function cloudConfig() {
    try { return typeof CLOUD_CONFIG !== 'undefined' ? CLOUD_CONFIG : null; } catch (error) { return null; }
  }

  function sessionKey() {
    return String(cloudConfig()?.sessionKey || 'controleObraCloudSession');
  }

  function wantsPersistentSession() {
    try { return localStorage.getItem(REMEMBER_PREFERENCE_KEY) !== '0'; } catch (error) { return true; }
  }

  function setPersistentSessionPreference(value) {
    try { localStorage.setItem(REMEMBER_PREFERENCE_KEY, value ? '1' : '0'); } catch (error) { /* preferência opcional */ }
  }

  function temporarySession() {
    try { return JSON.parse(sessionStorage.getItem(sessionKey()) || 'null'); } catch (error) { return null; }
  }

  function cleanOAuthLocation() {
    const url = new URL(location.href);
    ['code', 'error', 'error_code', 'error_description'].forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    history.replaceState(null, '', `${url.pathname}${url.search}`);
  }

  function oauthParameters() {
    const hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const query = new URLSearchParams(location.search);
    return {
      accessToken: hash.get('access_token') || '',
      refreshToken: hash.get('refresh_token') || '',
      expiresIn: Number(hash.get('expires_in') || 0),
      tokenType: hash.get('token_type') || 'bearer',
      type: hash.get('type') || '',
      error: hash.get('error') || query.get('error') || '',
      errorCode: hash.get('error_code') || query.get('error_code') || '',
      errorDescription: (hash.get('error_description') || query.get('error_description') || '').replace(/\+/g, ' ')
    };
  }

  function providerFromPending() {
    try { return sessionStorage.getItem(OAUTH_PROVIDER_KEY) || ''; } catch (error) { return ''; }
  }

  function clearPendingProvider() {
    try { sessionStorage.removeItem(OAUTH_PROVIDER_KEY); } catch (error) { /* armazenamento opcional */ }
  }

  function providerFailureMessage(provider, detail = '') {
    const label = PROVIDERS[provider]?.label || 'provedor escolhido';
    const normalized = String(detail || '').toLocaleLowerCase('pt-BR');
    if (/cancel|denied|access_denied/.test(normalized)) return `O login com ${label} foi cancelado. Você pode tentar novamente ou entrar com e-mail e senha.`;
    if (/provider.*not.*enabled|unsupported provider/.test(normalized)) return `O login com ${label} ainda precisa ser habilitado pelo administrador do ObraAtiva.`;
    return `Não foi possível autenticar com ${label}. Tente novamente ou entre com e-mail e senha.`;
  }

  function dispatchAvailability(next) {
    availability = Object.freeze({ ...next, checked: true });
    window.dispatchEvent(new CustomEvent('obraativa:auth-providers', { detail: availability }));
  }

  async function checkProviderAvailability() {
    try {
      const settings = await window.CloudSync.request('/auth/v1/settings');
      dispatchAvailability({ google: settings?.external?.google === true, microsoft: settings?.external?.azure === true });
    } catch (error) {
      dispatchAvailability({ google: false, microsoft: false });
    }
    return availability;
  }

  function redirectUrl() {
    const url = new URL(location.href);
    url.hash = '';
    ['code', 'error', 'error_code', 'error_description'].forEach((key) => url.searchParams.delete(key));
    return url.href;
  }

  async function signInWithProvider(provider) {
    const definition = PROVIDERS[provider];
    if (!definition || !window.CloudSync) return;
    if (!availability.checked) await checkProviderAvailability();
    if (!availability[provider]) {
      window.CloudSync.showAuth('signin', `O login com ${definition.label} está preparado, mas ainda precisa ser habilitado no painel de autenticação.`, true);
      return;
    }
    const remember = document.querySelector('[data-auth-remember]')?.checked !== false;
    setPersistentSessionPreference(remember);
    try { sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider); } catch (error) { /* armazenamento opcional */ }
    const config = cloudConfig();
    if (!config?.url) {
      window.CloudSync.showAuth('signin', 'Não foi possível iniciar o login social agora.', true);
      return;
    }
    const authorize = new URL(`${config.url}/auth/v1/authorize`);
    authorize.searchParams.set('provider', definition.supabase);
    authorize.searchParams.set('redirect_to', redirectUrl());
    if (definition.scopes) authorize.searchParams.set('scopes', definition.scopes);
    window.CloudSync.showLoading(`Abrindo o acesso com ${definition.label}...`);
    location.assign(authorize.href);
  }

  async function handleOAuthCallback() {
    const callback = oauthParameters();
    const provider = providerFromPending();
    if (callback.error || callback.errorDescription) {
      cleanOAuthLocation();
      clearPendingProvider();
      window.CloudSync.showAuth('signin', providerFailureMessage(provider, callback.errorDescription || callback.error || callback.errorCode), true);
      return true;
    }
    if (!callback.accessToken || callback.type === 'recovery') return false;
    window.CloudSync.showLoading('Confirmando seu acesso seguro...');
    try {
      const user = await window.CloudSync.request('/auth/v1/user', {}, callback.accessToken);
      const session = {
        access_token: callback.accessToken,
        refresh_token: callback.refreshToken,
        expires_in: callback.expiresIn,
        expires_at: callback.expiresIn ? Math.floor(Date.now() / 1000) + callback.expiresIn : 0,
        token_type: callback.tokenType,
        user
      };
      window.CloudSync.saveSession(session);
      cleanOAuthLocation();
      clearPendingProvider();
      await window.CloudSync.activate();
    } catch (error) {
      cleanOAuthLocation();
      clearPendingProvider();
      window.CloudSync.showAuth('signin', providerFailureMessage(provider, error?.message), true);
    }
    return true;
  }

  function installSessionPreference() {
    if (window.CloudSync.__obraativaSessionPreferenceInstalled) return;
    window.CloudSync.__obraativaSessionPreferenceInstalled = true;
    const originalSaveSession = window.CloudSync.saveSession.bind(window.CloudSync);
    const originalSessionFromStorage = window.CloudSync.sessionFromStorage.bind(window.CloudSync);
    window.CloudSync.saveSession = function (session) {
      this.session = session;
      if (wantsPersistentSession()) {
        try { sessionStorage.removeItem(sessionKey()); } catch (error) { /* armazenamento opcional */ }
        return originalSaveSession(session);
      }
      try {
        localStorage.removeItem(sessionKey());
        sessionStorage.setItem(sessionKey(), JSON.stringify(session));
      } catch (error) {
        return originalSaveSession(session);
      }
    };
    window.CloudSync.sessionFromStorage = function () {
      return temporarySession() || originalSessionFromStorage();
    };
  }

  async function resumeTemporarySession() {
    const stored = temporarySession();
    if (!stored?.access_token || window.CloudSync.session) return false;
    window.CloudSync.showLoading('Retomando sua sessão segura...');
    try {
      let session = stored;
      const expiresAt = Number(session.expires_at || 0) * 1000;
      if (!expiresAt || expiresAt < Date.now() + 60000) session = await window.CloudSync.refreshSession(session);
      else window.CloudSync.saveSession(session);
      window.CloudSync.session = session;
      await window.CloudSync.activate();
    } catch (error) {
      try { sessionStorage.removeItem(sessionKey()); } catch (storageError) { /* armazenamento opcional */ }
      window.CloudSync.showAuth('signin', 'Sua sessão terminou. Entre novamente para continuar.', true);
    }
    return true;
  }

  async function install() {
    if (installed) return;
    if (!window.CloudSync?.request || !cloudConfig()) { window.setTimeout(install, 100); return; }
    installed = true;
    installSessionPreference();
    window.CloudSync.signInWithProvider = signInWithProvider;
    document.body.addEventListener('change', (event) => {
      const checkbox = event.target.closest('[data-auth-remember]');
      if (checkbox) setPersistentSessionPreference(checkbox.checked);
    });
    document.body.addEventListener('click', (event) => {
      const button = event.target.closest('[data-oauth-provider]');
      if (button && !button.disabled) signInWithProvider(button.dataset.oauthProvider);
    });
    const callbackHandled = await handleOAuthCallback();
    if (!callbackHandled) await resumeTemporarySession();
    checkProviderAvailability();
    window.ObraAtivaSocialAuth = Object.freeze({
      providers: PROVIDERS,
      get availability() { return availability; },
      checkProviderAvailability,
      signInWithProvider,
      setPersistentSessionPreference,
      wantsPersistentSession
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
