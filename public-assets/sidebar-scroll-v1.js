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
        #app:not(.public-app) .side{overflow:hidden!important}
        #app:not(.public-app) .side .nav{height:auto!important;max-height:none!important;min-height:0!important;flex:1 1 auto!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;scrollbar-width:none!important}
        #app:not(.public-app) .side .nav::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
        #app:not(.public-app) .side .nav .nav-extra-scroll{position:static!important;inset:auto!important;display:grid!important;max-height:none!important;min-height:0!important;flex:0 0 auto!important;overflow:visible!important}
        #app:not(.public-app) .side .nav>button[data-nav-key="home"],
        #app:not(.public-app) .side .nav>button[onclick="go('home')"]{position:sticky!important;top:0!important;z-index:3!important;background:#103864!important;box-shadow:0 5px 8px #082653cc!important}
        #app:not(.public-app) .side .nav>button[data-nav-key="home"].active,
        #app:not(.public-app) .side .nav>button[onclick="go('home')"].active{background:#2b79d3!important}
        #app:not(.public-app) .side .nav .nav-more,
        #app:not(.public-app) .side>.nav-more-docked{display:none!important}
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
