(() => {
  'use strict';

  let queued = false;
  let sourceObserver = null;

  function companyLogoSource() {
    const source = document.querySelector('#app:not(.public-app) .side .brand-logo');
    const value = source?.getAttribute('src') || source?.currentSrc || '';
    return value || 'public-assets/obraativa-app-icon-v2-192.png';
  }

  function ensureTopLogo() {
    const top = document.querySelector('#app:not(.public-app) .top');
    if (!top) return;
    let logo = top.querySelector('.obraativa-mobile-top-logo');
    if (!logo) {
      logo = document.createElement('img');
      logo.className = 'obraativa-mobile-top-logo';
      logo.alt = '';
      logo.setAttribute('aria-hidden', 'true');
      top.prepend(logo);
    }
    const source = companyLogoSource();
    if (logo.getAttribute('src') !== source) logo.setAttribute('src', source);
    const companyLogo = document.querySelector('#app:not(.public-app) .side .brand-logo');
    if (companyLogo && !sourceObserver) {
      sourceObserver = new MutationObserver(schedule);
      sourceObserver.observe(companyLogo, { attributes: true, attributeFilter: ['src', 'class'] });
    }
  }

  function refresh() {
    queued = false;
    ensureTopLogo();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    const frame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    frame(refresh);
  }

  function install() {
    const app = document.getElementById('app');
    if (!app) { window.setTimeout(install, 100); return; }
    new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
