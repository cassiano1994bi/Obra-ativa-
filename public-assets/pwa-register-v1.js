(() => {
  'use strict';

  const blockedPath = location.pathname.startsWith('/tests/');
  const blockedMode = new URLSearchParams(location.search).has('saasTest');
  const secureOrigin = location.protocol === 'https:';
  if (!secureOrigin || blockedPath || blockedMode || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {
      // A aplicação continua funcionando online mesmo quando o registro não é permitido.
    });
  }, { once: true });
})();
