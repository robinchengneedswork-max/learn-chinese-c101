// sw.js — offline app shell cache. Bump CACHE when files change so clients update.
const CACHE = 'c101-v6';
const ASSETS = [
  '.', 'index.html', 'style.css', 'manifest.webmanifest',
  'src/config.js', 'src/content.js', 'src/state.js', 'src/srs.js',
  'src/session.js', 'src/audio.js', 'src/ui.js', 'src/main.js',
  'content/chapter-01.js',
  'icons/icon.svg', 'icons/icon-maskable.svg',
  // Course 101 watercolor set dressing (per-section) for the learning path
  'assets/star.png', 'assets/book-tree.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: instant loads and full offline once installed.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
