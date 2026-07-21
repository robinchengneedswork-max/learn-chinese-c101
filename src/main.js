// main.js — boot: load state, init audio voices, register service worker, wire UI.
'use strict';

(function () {
  State.load();
  Audio101.initVoices();
  UI.init();

  // PWA: register the service worker for offline use. Ignored on file:// and in
  // browsers without SW support; the app still runs.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline-only nicety */ });
    });
  }
})();
