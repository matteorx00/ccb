/* Service worker — COIN COIN BLÉ (PWA)
   Stratégie "réseau d'abord, cache en repli" : on sert toujours la version
   la plus récente quand le réseau répond, et on garde une copie hors-ligne.
   Cela évite de servir d'anciennes versions en cache (problème déjà rencontré). */
const CACHE = 'ccb-cache-v2';
const ASSETS = [
  './', './index.html', './engine.js', './backend.js', './characters.js', './audio.js',
  './monsters.js', './level1.js', './level2.js', './level3.js', './duck.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // ne pas intercepter les appels API (Supabase) : toujours réseau direct
  if (req.url.includes('supabase.co')) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
