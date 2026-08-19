// Service worker minimal : cache la coquille (chargement instantané). Le solde n'est
// JAMAIS mis en cache — il exige le réseau (autorité serveur, chap. 19.5).
const SHELL = 'jotay-shell-v2';
const ASSETS = ['/', '/index.html', '/app.js', '/dom.js', '/config.js', '/manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS))));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Ne jamais servir /portal/* depuis le cache : données vivantes uniquement.
  if (url.pathname.startsWith('/portal/')) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
