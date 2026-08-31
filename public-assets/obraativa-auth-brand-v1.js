(() => {
  'use strict';

  let queued = false;

  function enhanceCard(card) {
    const brand = card.querySelector('.top-brand');
    if (brand && !brand.classList.contains('obraativa-auth-brand')) {
      brand.classList.add('obraativa-auth-brand');
      brand.innerHTML = '<img src="public-assets/obraativa-app-icon-v2-192.png" alt="" aria-hidden="true"><span><small>GESTÃO INTELIGENTE DE OBRAS</small><strong>Obra<b>Ativa</b></strong></span>';
    }
    const title = card.querySelector('h1');
    if (title && title.textContent.trim() === 'Entrar no Controle de Obra') title.textContent = 'Entrar no ObraAtiva';
  }

  function refresh() {
    queued = false;
    document.querySelectorAll('#cloudGate .cloud-auth-card').forEach(enhanceCard);
    document.querySelectorAll('#cloudGate .cloud-loading b').forEach((label) => {
      if (label.textContent.includes('Controle de Obra')) label.textContent = 'ObraAtiva';
    });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    const frame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    frame(refresh);
  }

  function install() {
    const observerTarget = document.body;
    if (!observerTarget) { window.setTimeout(install, 100); return; }
    new MutationObserver(schedule).observe(observerTarget, { childList: true, subtree: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
