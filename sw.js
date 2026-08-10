// sw.js — offline app shell cache. Bump CACHE when files change so clients update.
const CACHE = 'c101-v23';
const ASSETS = [
  '.', 'index.html', 'style.css', 'manifest.webmanifest',
  'src/config.js', 'src/content.js', 'src/lang-map.js', 'src/lang.js',
  'src/pinyin.js', 'src/state.js', 'src/srs.js',
  'src/session.js', 'src/audio.js', 'src/ui.js', 'src/main.js',
  'content/chapter-01.js',
  'content/gnr-chapter-01.js',
  'content/gnr-chapter-02.js',
  'content/gnr-chapter-03.js',
  'content/gnr-chapter-04.js',
  'content/gnr-chapter-05.js',
  'content/gnr-chapter-06.js',
  'content/gnr-chapter-07.js',
  'content/gnr-reference.js',
  'content/basics-01-sounds.js',
  'content/basics-02-tones.js',
  'content/basics-03-radicals.js',
  'content/basics-04-core.js',
  'icons/icon.svg', 'icons/icon-maskable.svg',
  // Course 101 watercolor set dressing (per-section) for the learning path
  'assets/star.png', 'assets/book-tree.png',
  // UI sounds — Kenney "Interface Sounds" (CC0). Small enough to precache; the
  // app falls back to synthesised tones if any of them fail to load.
  'assets/sfx/tap.wav', 'assets/sfx/correct.wav', 'assets/sfx/wrong.wav',
  'assets/sfx/finish.wav', 'assets/sfx/tick.wav'
];

// Cache each asset on its own. `addAll` is all-or-nothing: one 404 rejects the
// whole install, the new worker never activates, and every client keeps being
// served the previous version *forever* — a broken deploy that no amount of
// reloading fixes. A missing file should cost us that one file, nothing more.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(
      ASSETS.map(url => c.add(url).catch(() => {
        console.warn('[sw] could not cache', url);
      }))
    ))
  );
  // Deliberately no skipWaiting() here: the page asks for the update (below)
  // rather than having the worker swap itself out mid-lesson.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page found a waiting worker and the learner accepted the reload.
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
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
