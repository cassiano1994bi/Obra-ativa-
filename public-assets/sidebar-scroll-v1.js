(() => {
  'use strict';

  const STYLE_ID = 'sidebarWholeScrollV1Style';
  const SIDE_RAIL_QUERY = '(min-width:761px), (orientation:landscape) and (max-height:600px) and (max-width:1024px)';
  let refreshPending = false;
  let railWasActive = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      @media(min-width:761px), (orientation:landscape) and (max-height:600px) and (max-width:1024px){
        #app:not(.public-app) .side{display:flex!important;flex-direction:column!important;height:100dvh!important;max-height:100dvh!important;min-height:0!important;overflow:hidden!important}
        #app:not(.public-app) .side .brand{position:relative!important;z-index:4!important;flex:0 0 auto!important}
        #app:not(.public-app) .side .nav{height:auto!important;max-height:none!important;min-height:0!important;flex:1 1 auto!important;padding-bottom:10px!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;scroll-padding-block:4px 12px!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}
        #app:not(.public-app) .side .nav::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
        #app:not(.public-app) .side .nav .nav-extra-scroll{position:static!important;inset:auto!important;display:grid!important;max-height:none!important;min-height:0!important;flex:0 0 auto!important;overflow:visible!important}
        #app:not(.public-app) .side .nav>button[data-nav-key="home"],
        #app:not(.public-app) .side .nav>button[onclick="go('home')"]{position:sticky!important;top:0!important;z-index:3!important;background:#103864!important;box-shadow:0 5px 8px #082653cc!important}
        #app:not(.public-app) .side .nav>button[data-nav-key="home"].active,
        #app:not(.public-app) .side .nav>button[onclick="go('home')"].active{background:#2b79d3!important}
        #app:not(.public-app) .side .nav .nav-more,
        #app:not(.public-app) .side>.nav-more-docked{display:none!important}
      }
      @media(orientation:landscape) and (max-height:600px) and (max-width:1024px){
        #app:not(.public-app) .side .brand{margin-bottom:8px!important}
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.brand,
        body.responsive-v3-tablet #app:not(.public-app)>.side>.brand{margin-bottom:0!important}
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.nav,
        body.responsive-v3-tablet #app:not(.public-app)>.side>.nav{padding-top:8px!important;padding-bottom:10px!important;scroll-padding-block:8px 12px!important}
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.brand .brand-text,
        body.responsive-v3-tablet #app:not(.public-app)>.side>.brand .brand-text{display:block!important;width:100%!important;margin-top:3px!important;text-align:center!important;line-height:1!important}
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.brand .brand-text small,
        body.responsive-v3-tablet #app:not(.public-app)>.side>.brand .brand-text small{display:none!important}
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.brand .brand-text span,
        body.responsive-v3-tablet #app:not(.public-app)>.side>.brand .brand-text span{display:block!important;margin:0!important;color:#fff!important;font-size:9px!important;font-weight:800!important;letter-spacing:-.02em!important;line-height:1!important;white-space:nowrap!important}
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.brand .brand-text span b,
        body.responsive-v3-tablet #app:not(.public-app)>.side>.brand .brand-text span b{color:#21d66f!important}
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.nav>button[data-nav-key="home"],
        body.responsive-v3-landscape-phone #app:not(.public-app)>.side>.nav>button[onclick="go('home')"],
        body.responsive-v3-tablet #app:not(.public-app)>.side>.nav>button[data-nav-key="home"],
        body.responsive-v3-tablet #app:not(.public-app)>.side>.nav>button[onclick="go('home')"]{top:0!important}
      }
    </style>`);
  }

  function isSideRail() {
    const app = document.getElementById('app');
    return !!app && !app.classList.contains('public-app') && window.matchMedia(SIDE_RAIL_QUERY).matches;
  }

  function refresh() {
    installStyle();
    const railActive = isSideRail();
    const toggle = document.querySelector('#app:not(.public-app) .side .nav-more, #app:not(.public-app) .side>.nav-more-docked');

    if (railActive) {
      railWasActive = true;
      if (toggle && !toggle.classList.contains('open') && typeof window.toggleMoreNavigation === 'function') {
        window.toggleMoreNavigation();
      }
      return;
    }

    if (railWasActive) {
      railWasActive = false;
      if (toggle?.classList.contains('open') && typeof window.toggleMoreNavigation === 'function') {
        window.toggleMoreNavigation();
      }
    }
  }

  function queueRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(() => {
      refreshPending = false;
      refresh();
    });
  }

  function install() {
    installStyle();
    const app = document.getElementById('app');
    if (!app) {
      setTimeout(install, 120);
      return;
    }
    new MutationObserver(queueRefresh).observe(app, { childList: true, subtree: true });
    window.matchMedia(SIDE_RAIL_QUERY).addEventListener?.('change', queueRefresh);
    window.addEventListener('orientationchange', queueRefresh, { passive: true });
    queueRefresh();
  }

  window.SidebarWholeScrollV1 = { refresh: queueRefresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
