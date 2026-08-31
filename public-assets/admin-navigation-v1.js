(() => {
  'use strict';

  const STYLE_ID = 'permissionHubV1Style';
  let installed = false;
  let permissionHubTab = 'permissions';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      #app:not(.public-app) .permission-hub{display:grid;gap:14px}
      #app:not(.public-app) .permission-hub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      #app:not(.public-app) .permission-hub-head h1{margin:0}
      #app:not(.public-app) .permission-hub-head p{margin:5px 0 0;color:var(--muted)}
      #app:not(.public-app) .permission-hub-tabs{display:flex;gap:7px;overflow-x:auto;padding:1px 1px 4px;scrollbar-width:none}
      #app:not(.public-app) .permission-hub-tabs::-webkit-scrollbar{display:none}
      #app:not(.public-app) .permission-hub-tabs button{flex:0 0 auto;min-height:40px;padding:8px 11px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--muted);font-size:12px;font-weight:800;white-space:nowrap}
      #app:not(.public-app) .permission-hub-tabs button.active{border-color:#70a9ed;background:#eaf3ff;color:#1767c8}
      #app:not(.public-app) .permission-hub-card{padding:17px;border:1px solid var(--line);border-radius:13px;background:#fff}
      #app:not(.public-app) .permission-hub-card h2{margin:0 0 6px;font-size:18px}
      #app:not(.public-app) .permission-hub-card p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}
      #app:not(.public-app) .permission-hub-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
      #app:not(.public-app) .permission-hub-actions .btn{min-height:42px;white-space:normal}
      #app:not(.public-app) .top #cloudTopActions,#app:not(.public-app) .top .top-settings-button{display:none!important}
      @media(max-width:700px){#app:not(.public-app) .permission-hub-head{display:block}#app:not(.public-app) .permission-hub-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}#app:not(.public-app) .permission-hub-tabs button{width:100%;white-space:normal}#app:not(.public-app) .permission-hub-actions{display:grid;grid-template-columns:1fr}#app:not(.public-app) .permission-hub-actions .btn{width:100%}}
      @media(max-width:430px){#app:not(.public-app) .permission-hub-tabs{grid-template-columns:1fr}}
    </style>`);
  }

  function subscriptionPanel() {
    const workspace = typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : null;
    window.exportPermissionSubscriptionData = () => workspace?.exportCurrentBackup?.();
    window.openPermissionSubscriptionDetails = () => workspace?.showSubscription?.();
    const subscription = workspace?.current?.subscription || {};
    const usage = workspace?.current?.usage || {};
    const plans = { essential: 'Essencial', builder: 'Construtora', professional: 'Profissional', custom: 'Personalizado' };
    const limits = { essential: [2, 3], builder: [5, 10], professional: [15, 25], custom: ['Sem limite', 'Sem limite'] }[subscription.plan] || ['—', '—'];
    const status = workspace?.statusLabel?.(subscription.status) || subscription.status || '—';
    const endDate = subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString('pt-BR') : '—';
    return `<section class="permission-hub-card"><h2>Minha assinatura</h2><p>Plano atual: <b>${escapeHtml(plans[subscription.plan] || 'Teste')}</b> · ${escapeHtml(status)}</p><div class="notice" style="margin-top:13px">Obras ativas: <b>${usage.active_works || 0}</b> de ${limits[0]}<br>Usuários ativos: <b>${usage.active_users || 0}</b> de ${limits[1]}<br>Fotos registradas: <b>${usage.photo_count || 0}</b><br>Teste até: <b>${escapeHtml(endDate)}</b></div><div class="permission-hub-actions"><button class="btn alt" type="button" onclick="exportPermissionSubscriptionData()">Exportar dados</button><button class="btn" type="button" onclick="openPermissionSubscriptionDetails()">Abrir detalhes da assinatura</button></div></section>`;
  }

  function settingsPanel() {
    return `<section class="permission-hub-card"><h2>Configurações</h2><p>Abra as configurações originais do aplicativo por esta área. Nenhuma informação será modificada sem a sua ação.</p><div class="permission-hub-actions"><button class="btn" type="button" onclick="openModal('settings')">⚙️ Abrir configurações</button></div></section>`;
  }

  function salesPanel() {
    if (!window.CloudSync?.isSalesAdmin) return '<section class="permission-hub-card"><p>Esta área está disponível somente para o administrador do aplicativo.</p></section>';
    if (AdminCenter.loading) return '<section class="permission-hub-card admin-loading">Carregando vendas e liberações...</section>';
    if (AdminCenter.error) return `<section class="admin-alert">${escapeHtml(AdminCenter.error)} <button class="btn sm alt" onclick="adminLoad(true)">Tentar novamente</button></section>`;
    return adminSales().replace('Vendas e atendimento', 'Vendas e liberações');
  }

  function adminPanel(adminPageOriginal) {
    if (!window.CloudSync?.isSalesAdmin) return '<section class="permission-hub-card"><p>Esta área está disponível somente para o administrador do aplicativo.</p></section>';
    if (!AdminCenter.loaded && !AdminCenter.loading) setTimeout(() => adminLoad(), 0);
    return adminPageOriginal()
      .replace(/<button class="[^"]*" onclick="adminTab\('sales'\)">Vendas e atendimento<\/button>/, '');
  }

  function cleanTopActions() {
    const companyActions = document.getElementById('cloudTopActions');
    if (companyActions) companyActions.hidden = true;
    const settingsButton = document.querySelector('.top .top-settings-button');
    if (settingsButton) settingsButton.hidden = true;
  }

  function install() {
    if (installed) return;
    if (typeof renderTop !== 'function' || typeof salesPage !== 'function' || typeof permissionControlCenter !== 'function' || typeof adminPage !== 'function') {
      setTimeout(install, 80);
      return;
    }
    installed = true;
    installStyle();

    const permissionControlCenterBeforeHub = permissionControlCenter;
    const adminPageBeforeUnifiedHub = adminPage;
    permissionControlCenter = function permissionControlCenterHub() {
      const isSales = permissionHubTab === 'sales';
      const isAdmin = permissionHubTab === 'admin';
      const tabs = `<nav class="permission-hub-tabs" aria-label="Áreas administrativas"><button class="${permissionHubTab === 'permissions' ? 'active' : ''}" onclick="openPermissionHub('permissions')">Permissões e convites</button><button class="${permissionHubTab === 'subscription' ? 'active' : ''}" onclick="openPermissionHub('subscription')">Minha assinatura</button><button class="${permissionHubTab === 'settings' ? 'active' : ''}" onclick="openPermissionHub('settings')">Configurações</button>${window.CloudSync?.isSalesAdmin ? `<button class="${isSales ? 'active' : ''}" onclick="openPermissionHub('sales')">Vendas e liberações</button><button class="${isAdmin ? 'active' : ''}" onclick="openPermissionHub('admin')">Central administrativa</button>` : ''}</nav>`;
      const content = permissionHubTab === 'subscription' ? subscriptionPanel() : permissionHubTab === 'settings' ? settingsPanel() : isSales ? salesPanel() : isAdmin ? adminPanel(adminPageBeforeUnifiedHub) : permissionControlCenterBeforeHub();
      if (permissionHubTab === 'permissions') setTimeout(() => loadPermissionInvitePanel(), 0);
      if (isSales && window.CloudSync?.isSalesAdmin && !AdminCenter.loaded && !AdminCenter.loading) setTimeout(() => adminLoad(), 0);
      return `<main class="permission-hub"><div class="permission-hub-head"><div><h1 class="page-title">Administrador</h1><p>Permissões, conta, configurações, vendas e administração em um só lugar.</p></div></div>${tabs}<div class="permission-hub-content">${content}</div></main>`;
    };

    window.openPermissionHub = function openPermissionHub(tab) {
      permissionHubTab = tab;
      if (page !== 'permissions') go('permissions');
      else render();
    };

    adminPage = function adminPageWithoutSales() {
      if (AdminCenter.tab === 'sales') AdminCenter.tab = 'overview';
      return adminPageBeforeUnifiedHub()
        .replace(/<button class="[^"]*" onclick="adminTab\('sales'\)">Vendas e atendimento<\/button>/, '');
    };

    const renderTopBeforePermissionHub = renderTop;
    renderTop = function renderTopWithPermissionHub() {
      renderTopBeforePermissionHub();
      cleanTopActions();
      const permissionsButton = [...document.querySelectorAll('#nav button')]
        .find((button) => String(button.getAttribute('onclick') || '').includes("go('permissions')"));
      const salesButton = [...document.querySelectorAll('#nav button')]
        .find((button) => String(button.getAttribute('onclick') || '').includes("go('sales')"));
      if (salesButton) salesButton.remove();
      if (permissionsButton) {
        permissionsButton.textContent = '🛡️ Administrador';
        permissionsButton.title = 'Abrir administração, permissões e configurações';
        permissionsButton.setAttribute('aria-label', 'Administrador');
      }
    };

    salesPage = function salesPageInsideAdmin() {
      permissionHubTab = 'admin';
      return permissionControlCenter();
    };

    renderTop();
    render();
    new MutationObserver(cleanTopActions)
      .observe(document.querySelector('.top') || document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
