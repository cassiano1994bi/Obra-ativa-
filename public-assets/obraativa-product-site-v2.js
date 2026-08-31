(function () {
  'use strict';

  const ICONS = Object.freeze({
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<path d="m9 11 3 3L22 4"/><path d="M21 12a9 9 0 1 1-5.3-8.2"/>',
    works: '<path d="M3 21h18M5 21V8l7-4v17M15 21V11h4v10M8 9h1m-1 4h1m-1 4h1"/>',
    money: '<circle cx="12" cy="12" r="9"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8m4-10v12"/>',
    chart: '<path d="M3 3v18h18M7 16l4-5 3 3 6-8"/><path d="M16 6h4v4"/>',
    vehicle: '<path d="M3 16V6h13l4 5v5M5 16h14"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    report: '<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>',
    budget: '<path d="M7 2h10v4H7zM5 6h14v16H5z"/><path d="M9 11h6M9 15h6"/>',
    bot: '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/>',
    shield: '<path d="M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  });

  function icon(name, className = '') {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.check}</svg>`;
  }

  function safe(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function productBrand() {
    return `<span class="oa-public-brand"><img src="public-assets/obraativa-app-icon-v2-192.png" alt=""><span><b>Obra<span>Ativa</span></b><small>GESTÃO INTELIGENTE DE OBRAS</small></span></span>`;
  }

  function dashboardPreview() {
    return `<div class="oa-dashboard" aria-label="Prévia visual demonstrativa do painel ObraAtiva">
      <div class="oa-dashboard-top"><span>${productBrand()}</span><b>Painel Geral</b><small>Construtora Exemplo<br>Administrador</small></div>
      <div class="oa-dashboard-body">
        <aside><b>▥ Visão geral</b><span>♙ Equipe</span><span>✓ Presença</span><span>▦ Obras</span><span>R$ Pagamentos</span><span>↗ Financeiro</span><span>▤ Relatórios</span><span>⚙ Configurações</span></aside>
        <div class="oa-dashboard-main">
          <small>Resumo do mês · dados demonstrativos</small>
          <div class="oa-dashboard-kpis"><article><small>Obras ativas</small><b>12</b></article><article><small>Equipe ativa</small><b>28</b></article><article><small>Presenças</small><b>24</b></article><article><small>Recebimentos</small><b>R$ 84.750</b></article></div>
          <div class="oa-dashboard-panels">
            <article><b>Financeiro do mês</b><strong>R$ 84.750,00</strong><small>Receitas</small><div class="oa-line-chart"><i></i></div></article>
            <article><b>Presença por dia</b><div class="oa-bar-chart">${[35,70,48,80,60,88,52,76,43,92].map((height) => `<i style="--h:${height}%"></i>`).join('')}</div></article>
            <article><b>Obras em andamento</b><p><span>Obra Alphaville</span><em>60%</em></p><p><span>Residencial Bela Vista</span><em>40%</em></p><p><span>Corporativo Parque</span><em>20%</em></p></article>
            <article><b>Atividades recentes</b><p>Pagamento realizado <em>Hoje</em></p><p>Presença registrada <em>Hoje</em></p><p>Novo gasto adicionado <em>Ontem</em></p></article>
          </div>
        </div>
      </div>
    </div>`;
  }

  function modulesMarkup() {
    const modules = [
      ['team', 'Equipe', 'Cadastre e organize sua equipe por função e grupo.'],
      ['check', 'Presença', 'Registre a presença diária de forma rápida e clara.'],
      ['works', 'Obras', 'Acompanhe o andamento de cada etapa da obra.'],
      ['money', 'Pagamentos', 'Calcule e registre pagamentos por quinzena e grupo.'],
      ['chart', 'Financeiro', 'Controle receitas, despesas e o fluxo de cada obra.'],
      ['vehicle', 'Veículos', 'Gerencie combustível, manutenção e ocorrências.'],
      ['report', 'Relatórios', 'Informações organizadas para decisões melhores.'],
      ['budget', 'Orçamentos', 'Crie propostas e acompanhe o que foi aprovado.'],
      ['bot', 'Assistente IA', 'Sua funcionária digital para análises e sugestões.']
    ];
    return modules.map(([key, title, copy], index) => `<article class="oa-module-card">${index === 8 ? '<span class="oa-new-badge">NOVO</span>' : ''}${icon(key)}<h3>${title}</h3><p>${copy}</p></article>`).join('');
  }

  function devicesMarkup() {
    return `<div class="oa-devices" aria-label="ObraAtiva em computador, tablet e celular">
      <div class="oa-laptop"><span><img src="public-assets/obraativa-ui-financial-v2.png" alt="Tela financeira do ObraAtiva" loading="lazy" decoding="async"></span></div>
      <div class="oa-tablet"><span><img src="public-assets/obraativa-ui-attendance-v2.png" alt="Tela de presença do ObraAtiva" loading="lazy" decoding="async"></span></div>
      <div class="oa-phone"><span><img src="public-assets/obraativa-ui-works-v2.png" alt="Tela de obras do ObraAtiva" loading="lazy" decoding="async"></span></div>
    </div>`;
  }

  function plansMarkup() {
    const plans = Array.isArray(PRODUCT_PLANS) ? PRODUCT_PLANS : [];
    return plans.map((plan) => `<article class="oa-price-card ${plan.featured ? 'featured' : ''}">
      ${plan.featured ? '<span class="oa-choice">MAIS ESCOLHIDO</span>' : ''}
      <h3>${safe(plan.name)}</h3><div class="oa-price">${safe(plan.price)}</div><p>${safe(plan.works)} · ${safe(plan.users)}</p>
      <ul>${plan.items.map((item) => `<li>✓ ${safe(item)}</li>`).join('')}</ul>
      <a class="oa-button ${plan.featured ? '' : 'outline'}" href="${productSalesUrl(productSalesMessage(plan.name))}" target="_blank" rel="noopener">Falar no WhatsApp</a>
    </article>`).join('');
  }

  function creatorContact() {
    const number = String(PRODUCT_SALES_WHATSAPP_DEFAULT || '').replace(/\D/g, '');
    const local = number.replace(/^55/, '');
    const display = local.length === 11 ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}` : local;
    const url = `https://wa.me/${number}?text=${encodeURIComponent('Olá! Vi que a AplicAtivo Tecnologia desenvolveu o ObraAtiva e gostaria de conversar sobre a criação de um aplicativo.')}`;
    return { display, url };
  }

  function renderPremiumProductSite() {
    const contact = creatorContact();
    const startUrl = `${location.pathname}?app=1&onboarding=1`;
    const loginUrl = `${location.pathname}?app=1`;
    const demoUrl = typeof demoPageUrl === 'function' ? demoPageUrl() : `${location.pathname}?demo=1`;
    document.title = 'ObraAtiva | Gestão inteligente de obras';
    document.body.innerHTML = `<main class="oa-public-site">
      <nav class="oa-public-nav"><div class="oa-public-shell">${productBrand()}<div class="oa-public-links"><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#perguntas">Perguntas</a><a href="#contato">Contato</a></div><a class="oa-login-button" href="${loginUrl}">${icon('lock')} Entrar</a></div></nav>

      <section class="oa-public-hero"><div class="oa-public-shell oa-hero-grid">
        <div class="oa-hero-copy"><span class="oa-kicker">GESTÃO FEITA PARA QUEM VIVE A OBRA</span><h1>Sua obra já dá<br>trabalho demais.<br>O <em>controle não<br>precisa dar.</em></h1><p>Equipe, presença, pagamentos e financeiro por obra em um lugar simples de usar.</p><div class="oa-hero-actions"><a class="oa-button" href="${startUrl}">▣ Começar teste grátis por 14 dias</a><a class="oa-button outline" href="${productSalesUrl(productSalesMessage())}" target="_blank" rel="noopener">◉ Falar no WhatsApp</a></div><div class="oa-hero-note">● Não precisa de cartão de crédito · <a href="${demoUrl}">Ver demonstração segura</a></div></div>
        <div class="oa-hero-dashboard">${dashboardPreview()}</div>
      </div></section>

      <section class="oa-public-section oa-modules" id="recursos"><div class="oa-public-shell"><div class="oa-center-heading"><h2>Tudo que sua obra precisa em um só lugar</h2></div><div class="oa-module-grid">${modulesMarkup()}</div></div></section>

      <section class="oa-public-section oa-device-section"><div class="oa-public-shell oa-device-grid">${devicesMarkup()}<div class="oa-device-copy"><span class="oa-kicker">CONTROLE NA PALMA DA MÃO</span><h2>Leve o controle da sua obra para qualquer lugar</h2><p>Acesse pelo computador, tablet ou celular. Registre presença, envie fotos, acompanhe pagamentos e muito mais.</p><div class="oa-store-row"><span>App Store <small>EM BREVE</small></span><span>Google Play <small>EM BREVE</small></span><a href="downloads/escritorio-da-minha-obra.apk">Baixar APK Android</a></div></div></div></section>

      <section class="oa-public-section oa-audience"><div class="oa-public-shell"><div class="oa-center-heading"><h2>Feito para quem vive a obra</h2><p>Solução completa para profissionais da construção civil</p></div><div class="oa-audience-grid"><article>${icon('team')}<h3>Mestres de Obras</h3><p>Tenha o controle total da sua obra e equipe na palma da mão.</p></article><article>${icon('user')}<h3>Empreiteiros</h3><p>Gerencie múltiplas obras e equipes com eficiência.</p></article><article>${icon('check')}<h3>Encarregados</h3><p>Facilite o dia a dia da obra com ferramentas práticas.</p></article><article>${icon('works')}<h3>Construtoras</h3><p>Padronize processos e tenha visão completa dos resultados.</p></article></div></div></section>

      <section class="oa-public-section oa-steps"><div class="oa-public-shell"><div class="oa-center-heading"><h2>Como funciona</h2><p>Simples em 3 passos</p></div><div class="oa-step-grid"><article><b>1</b>${icon('user')}<h3>Cadastre sua equipe</h3><p>Adicione sua equipe, defina funções e organize por grupos de trabalho.</p></article><article><b>2</b>${icon('check')}<h3>Controle sua obra</h3><p>Registre presença, acompanhe o andamento, gastos e pagamentos em tempo real.</p></article><article><b>3</b>${icon('chart')}<h3>Acompanhe resultados</h3><p>Tenha relatórios completos e tome decisões mais assertivas.</p></article></div></div></section>

      <section class="oa-public-section oa-plans-section" id="planos"><div class="oa-public-shell"><div class="oa-plan-layout"><aside class="oa-security-card">${icon('shield')}<div><h2>Seus dados estão seguros</h2><p>Boas práticas de segurança, acesso protegido e dados separados por empresa.</p></div><div class="oa-security-points"><span>↻<b>Backup diário automático</b></span><span>▣<b>Acesso seguro</b></span><span>▤<b>Dados separados por empresa</b></span></div></aside><div><div class="oa-center-heading"><h2>Planos que cabem no seu negócio</h2><p>Teste grátis por 14 dias e escolha o plano ideal.</p></div><div class="oa-trial-strip"><b>Teste grátis de 14 dias</b><span>Acesso completo para conhecer o sistema. Sem cartão nesta fase.</span><a class="oa-button" href="${startUrl}">Começar agora</a></div></div></div><div class="oa-price-grid">${plansMarkup()}</div></div></section>

      <section class="oa-public-section oa-faq-section" id="perguntas"><div class="oa-public-shell"><div class="oa-center-heading"><h2>Perguntas frequentes</h2></div><div class="oa-faq-grid"><details><summary>Como funciona o teste grátis?</summary><p>Você usa o ObraAtiva por 14 dias, sem informar cartão nesta fase.</p></details><details><summary>Posso usar no celular?</summary><p>Sim. O sistema funciona no navegador e também oferece o APK para Android.</p></details><details><summary>Posso cancelar quando quiser?</summary><p>Sim. O cancelamento não apaga automaticamente os dados da empresa.</p></details><details><summary>Quantos usuários posso adicionar?</summary><p>O limite depende do plano escolhido e aparece claramente em cada opção.</p></details><details><summary>Meus dados ficam seguros?</summary><p>As empresas possuem dados separados e controles de acesso próprios.</p></details><details><summary>Como funciona o suporte?</summary><p>O atendimento comercial e de suporte pode ser iniciado pelo WhatsApp.</p></details></div></div></section>

      <section class="oa-final-cta" id="contato"><div class="oa-public-shell"><div><h2>Pronto para ter o controle total da sua obra?</h2><p>Teste grátis por 14 dias e transforme a gestão da sua obra.</p></div><a class="oa-button" href="${startUrl}">▣ Começar teste grátis por 14 dias</a><small>● Não precisa de cartão de crédito</small></div></section>

      <footer class="oa-public-footer"><div class="oa-public-shell oa-footer-grid"><div>${productBrand()}<p>Tecnologia e gestão trabalhando juntas para construir resultados reais.</p></div><nav><b>Produto</b><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="${productUrl('&documento=privacidade')}">Privacidade</a></nav><nav><b>Empresa</b><a href="#contato">Contato</a><a href="${productUrl('&documento=termos')}">Termos de uso</a><a href="${productUrl('&documento=cancelamento')}">Cancelamento</a></nav><nav><b>Suporte</b><a href="${productSalesUrl(productSalesMessage())}" target="_blank" rel="noopener">WhatsApp</a><a href="${loginUrl}">Entrar</a></nav><aside class="oa-creator-credit"><small>APLICATIVO DESENVOLVIDO POR</small><img src="public-assets/aplicativo-studio-logo-v1.svg" alt="AplicAtivo Tecnologia"><p>Criação de aplicativos e soluções digitais.</p><a href="${contact.url}" target="_blank" rel="noopener">WhatsApp ${safe(contact.display)}</a></aside></div><div class="oa-public-shell oa-footer-bottom"><span>© 2026 ObraAtiva</span><span>Um produto desenvolvido pela AplicAtivo Tecnologia</span></div></footer>
    </main>`;
  }

  function isolatePublicPageRenderers() {
    if (typeof renderTop === 'function') renderTop = function publicPageRenderTop() {};
    if (typeof render === 'function') render = function publicPageRender() {};
  }

  const params = new URLSearchParams(location.search);
  if (typeof isProductPage === 'function' && isProductPage() && !params.get('documento')) {
    renderPremiumProductSite();
    isolatePublicPageRenderers();
  }
  window.ObraAtivaProductSite = Object.freeze({ render: renderPremiumProductSite, creatorContact });
})();
