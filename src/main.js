// main.js — boot: load state, init audio voices, register service worker, wire UI.
'use strict';

(function () {
  State.load();
  Audio101.initVoices();
  UI.init();

  // PWA: register the service worker for offline use. Ignored on file:// and in
  // browsers without SW support; the app still runs.
  //
  // The cache is cache-first, so a deployed change is invisible until the new
  // worker takes over — which used to mean "clear the browser's storage and hope."
  // Now the page watches for a waiting worker and offers a reload, and checks for
  // one again whenever you come back to the app (an installed PWA can sit in the
  // background for days without ever re-requesting sw.js).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        // updateViaCache:'none' — never let the HTTP cache answer for sw.js
        // itself, or the update check can be served the very file it's checking.
        .register('sw.js', { updateViaCache: 'none' })
        .then(reg => {
          reg.addEventListener('updatefound', () => {
            const fresh = reg.installing;
            if (!fresh) return;
            fresh.addEventListener('statechange', () => {
              // A worker that reaches "installed" while one is already in control
              // is an update, not a first install.
              if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
                UI.offerUpdate(() => fresh.postMessage('SKIP_WAITING'));
              }
            });
          });
          if (reg.waiting && navigator.serviceWorker.controller) {
            UI.offerUpdate(() => reg.waiting.postMessage('SKIP_WAITING'));
          }
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden) reg.update().catch(() => {});
          });
        })
        .catch(() => { /* offline-only nicety */ });

      // The new worker took over — reload once so the page matches the cache.
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    });
  }
})();
