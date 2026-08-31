(() => {
  'use strict';

  let installed = false;
  let queued = false;

  const $ = (selector, scope = document) => scope.querySelector(selector);

  function receptionMode(card) {
    const classes = [...card.classList];
    const declared = classes.find((name) => name.startsWith('obraativa-auth-') && name !== 'obraativa-auth-experience');
    if (declared) return declared.replace('obraativa-auth-', '');
    const title = String($('h1', card)?.textContent || '').toLocaleLowerCase('pt-BR');
    if (title.includes('criar acesso')) return 'signup';
    if (title.includes('recuperar senha')) return 'recovery';
    if (title.includes('nova senha')) return 'reset';
    if (title.includes('criar sua empresa')) return 'onboarding';
    if (title.includes('entrar') || title.includes('acesse') || title.includes('bem-vindo')) return 'signin';
    return 'generic';
  }

  function receptionConfig() {
    return window.ObraAtivaReceptionConfig || { socialProof: { verified: false, items: [] }, stores: {} };
  }

  function isLocalPreview() {
    return ['127.0.0.1', 'localhost'].includes(location.hostname);
  }

  function proofIcon(name) {
    const paths = {
      users: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M2.5 19c.5-4 2.8-6 5.5-6s5 2 5.5 6M13 14c3.8-.8 6.5 1.1 7 4.5"/>',
      works: '<path d="M4 20V8l7-4v16M11 10h8v10M7 11h1M7 15h1M14 13h2M14 17h2"/>',
      chart: '<path d="M4 20V10M10 20V5M16 20v-8M22 20V2"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.chart}</svg>`;
  }

  function proofMarkup() {
    const proof = receptionConfig().socialProof || {};
    if (!proof.verified && !isLocalPreview()) return '';
    const items = Array.isArray(proof.items) ? proof.items.slice(0, 3) : [];
    if (!items.length) return '';
    return `<section class="obraativa-reception-proof" aria-label="Indicadores do ObraAtiva">
      ${items.map((item) => `<article>${proofIcon(item.icon)}<span><b>${String(item.value || '')}</b><small>${String(item.label || '')}</small></span></article>`).join('')}
      ${proof.verified ? '' : '<em>Prévia visual · números configuráveis</em>'}
    </section>`;
  }

  function storyMarkup(mode) {
    const compact = !['signin', 'signup'].includes(mode);
    return `<aside class="obraativa-reception-story ${compact ? 'is-compact' : ''}" aria-label="Apresentação do ObraAtiva">
      <header class="obraativa-reception-brand">
        <img src="/public-assets/obraativa-app-icon-v2-192.png" alt="">
        <span><strong>Obra<b>Ativa</b></strong><small>GESTÃO INTELIGENTE DE OBRAS</small></span>
      </header>
      <div class="obraativa-reception-copy">
        <span class="obraativa-reception-eyebrow">CONTROLE PARA QUEM FAZ A OBRA ACONTECER</span>
        <h2><span>Mais controle <br>na obra.</span><em>Menos perdas <br>no caminho.</em></h2>
        <p>Organize obras, equipes, presença, pagamentos e resultados em um só lugar.</p>
      </div>
      ${proofMarkup()}
      <article class="obraativa-reception-ai" aria-label="Assistente inteligente integrada ao ObraAtiva">
        <span class="obraativa-reception-ai-avatar" aria-hidden="true"><img src="/public-assets/assistant-avatar-v1.png" alt=""><i></i></span>
        <span class="obraativa-reception-ai-copy"><small>ASSISTENTE INTELIGENTE <i>IA</i></small><b>Sua aliada na gestão de obras.</b><em>Mais dados, melhores decisões.</em></span>
      </article>
      <blockquote><i aria-hidden="true">“</i><span>Tecnologia e gestão trabalhando juntas para construir resultados reais.</span></blockquote>
    </aside>`;
  }

  function lockMarkup() {
    return '<span class="obraativa-reception-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>';
  }

  function googleIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 9l3.4-2.6Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 3.1 7.6l3.4 2.6A5.9 5.9 0 0 1 12 6.1Z"/></svg>';
  }

  function microsoftIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f25022" d="M2 2h9v9H2z"/><path fill="#7fba00" d="M13 2h9v9h-9z"/><path fill="#00a4ef" d="M2 13h9v9H2z"/><path fill="#ffb900" d="M13 13h9v9h-9z"/></svg>';
  }

  function signinExtrasMarkup() {
    return `<section class="obraativa-reception-social" data-reception-social aria-label="Outras formas de entrar">
      <div class="obraativa-reception-separator"><span>ou continue com</span></div>
      <div class="obraativa-reception-social-buttons">
        <button type="button" data-oauth-provider="google" disabled aria-disabled="true">${googleIcon()}<span>Google</span><small data-provider-status>Verificando</small></button>
        <button type="button" data-oauth-provider="microsoft" disabled aria-disabled="true">${microsoftIcon()}<span>Microsoft</span><small data-provider-status>Verificando</small></button>
      </div>
    </section>`;
  }

  function supportMarkup() {
    const stores = receptionConfig().stores || {};
    const appleLabel = stores.apple?.status === 'available' ? 'App Store' : 'App Store · Em breve';
    const playLabel = stores.googlePlay?.status === 'available' ? 'Google Play' : 'Google Play · Em breve';
    return `<section class="obraativa-reception-support" aria-label="Segurança e disponibilidade">
      <article class="obraativa-reception-security"><span aria-hidden="true">✓</span><div><b>Seus dados estão protegidos</b><small>Utilizamos boas práticas de segurança para proteger suas informações.</small></div></article>
      <article class="obraativa-reception-app"><span class="obraativa-reception-phone" aria-hidden="true"></span><div><b>ObraAtiva na palma da mão</b><small>Leve o controle da sua obra para qualquer lugar.</small><p><span>${appleLabel}</span><span>${playLabel}</span></p></div></article>
    </section>`;
  }

  function fieldIconMarkup(type) {
    return type === 'email'
      ? '<span class="obraativa-reception-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span>'
      : '<span class="obraativa-reception-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>';
  }

  function enhanceFields(card) {
    const email = $('input[name="email"]', card);
    const password = $('input[name="password"]', card);
    [[email, 'email'], [password, 'password']].forEach(([input, type]) => {
      const field = input?.closest('.field');
      if (!field || field.dataset.receptionIcon) return;
      field.dataset.receptionIcon = type;
      const target = input.closest('.obraativa-password-shell') || input;
      target.insertAdjacentHTML('beforebegin', fieldIconMarkup(type));
    });
  }

  function rememberMarkup() {
    const remembered = window.ObraAtivaSocialAuth?.wantsPersistentSession?.() !== false;
    return `<label class="obraativa-reception-remember"><input type="checkbox" data-auth-remember ${remembered ? 'checked' : ''}><span aria-hidden="true"></span><b>Lembrar de mim</b></label>`;
  }

  function updateProviderButtons(next = window.ObraAtivaSocialAuth?.availability) {
    const state = next || { google: false, microsoft: false, checked: false };
    document.querySelectorAll('[data-oauth-provider]').forEach((button) => {
      const enabled = state.checked === true && state[button.dataset.oauthProvider] === true;
      button.disabled = !enabled;
      button.setAttribute('aria-disabled', String(!enabled));
      button.classList.toggle('is-ready', enabled);
      const status = $('[data-provider-status]', button);
      if (status) status.textContent = enabled ? 'Disponível' : (state.checked ? 'Em configuração' : 'Verificando');
    });
  }

  function enhanceSignin(card) {
    const title = $('h1', card);
    const subtitle = $('h1 + p', card);
    const invite = /convite/i.test(String(title?.textContent || ''));
    if (!invite && title) title.textContent = 'Bem-vindo de volta!';
    if (!invite && subtitle) subtitle.textContent = 'Faça login para acessar sua conta e gerenciar suas obras.';
    if (title && !card.querySelector('.obraativa-reception-lock')) title.insertAdjacentHTML('beforebegin', lockMarkup());
    enhanceFields(card);
    const form = $('form', card);
    const submit = $('button[type="submit"]', form);
    const forgot = [...card.querySelectorAll('.cloud-link')].find((button) => /esqueci minha senha/i.test(button.textContent));
    if (form && submit && !form.querySelector('.obraativa-reception-options')) {
      const options = document.createElement('div');
      options.className = 'obraativa-reception-options';
      options.innerHTML = rememberMarkup();
      if (forgot) options.appendChild(forgot);
      submit.insertAdjacentElement('beforebegin', options);
    }
    if (submit && !submit.querySelector('span')) submit.innerHTML = '<b>Entrar</b><span aria-hidden="true">→</span>';
    if (!card.querySelector('[data-reception-social]')) form?.insertAdjacentHTML('afterend', signinExtrasMarkup());
    const create = [...card.querySelectorAll('.cloud-link')].find((button) => /criar meu primeiro acesso|criar minha conta/i.test(button.textContent));
    if (create) {
      create.classList.add('obraativa-reception-create-account');
      create.textContent = 'Ainda não tem conta? Criar minha conta';
      card.querySelector('[data-reception-social]')?.insertAdjacentElement('afterend', create);
    }
    updateProviderButtons();
  }

  function refineCard(card, mode) {
    const brand = $('.top-brand, .obraativa-auth-brand', card);
    if (brand) brand.setAttribute('aria-hidden', 'true');
    if (mode === 'signin') enhanceSignin(card);
    else {
      const title = $('h1', card);
      if (title && !card.querySelector('.obraativa-reception-lock')) title.insertAdjacentHTML('beforebegin', lockMarkup());
      enhanceFields(card);
    }
  }

  function enhanceCard(card) {
    if (!card || card.closest('.obraativa-reception-shell')) return;
    const gate = card.closest('#cloudGate');
    if (!gate) return;
    const mode = receptionMode(card);
    const shell = document.createElement('div');
    shell.className = 'obraativa-reception-shell';
    shell.dataset.receptionMode = mode;
    shell.innerHTML = `${storyMarkup(mode)}<main class="obraativa-reception-access" aria-label="Acesso ao ObraAtiva"></main>`;
    card.replaceWith(shell);
    const access = $('.obraativa-reception-access', shell);
    access.appendChild(card);
    refineCard(card, mode);
    if (mode === 'signin') access.insertAdjacentHTML('beforeend', supportMarkup());
    gate.classList.add('obraativa-reception-gate');
    gate.dataset.receptionMode = mode;
  }

  function enhanceLoading(loading) {
    const gate = loading?.closest('#cloudGate');
    if (!gate) return;
    gate.classList.remove('obraativa-reception-gate');
    gate.classList.add('obraativa-reception-loading');
  }

  function refresh() {
    queued = false;
    document.querySelectorAll('#cloudGate .cloud-auth-card').forEach(enhanceCard);
    document.querySelectorAll('#cloudGate .cloud-loading').forEach(enhanceLoading);
    updateProviderButtons();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0)))(refresh);
  }

  function install() {
    if (installed) return;
    installed = true;
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('obraativa:auth-providers', (event) => updateProviderButtons(event.detail));
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
