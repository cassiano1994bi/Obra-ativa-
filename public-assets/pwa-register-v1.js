(() => {
  'use strict';

  const blockedPath = location.pathname.startsWith('/tests/');
  const blockedMode = new URLSearchParams(location.search).has('saasTest');
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const secureOrigin = location.protocol === 'https:' || localHost;
  if (!secureOrigin || blockedPath || blockedMode || !('serviceWorker' in navigator)) return;

  let registration;
  let lastUpdateCheck = 0;
  const checkForUpdate = () => {
    if (!registration || !navigator.onLine || Date.now() - lastUpdateCheck < 60_000) return;
    lastUpdateCheck = Date.now();
    registration.update().catch(() => {});
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.dispatchEvent(new CustomEvent('obraativa:pwa-updated'));
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'OBRAATIVA_PWA_UPDATED') {
      window.dispatchEvent(new CustomEvent('obraativa:pwa-updated', { detail: event.data }));
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
      .then((current) => {
        registration = current;
        current.addEventListener('updatefound', () => {
          window.dispatchEvent(new CustomEvent('obraativa:pwa-update-found'));
        });
        checkForUpdate();
      })
      .catch(() => {
        // A aplicação continua funcionando online mesmo quando o registro não é permitido.
      });
  }, { once: true });

  window.addEventListener('online', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
})();
