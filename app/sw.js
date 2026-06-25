/**
 * Marcel PWA Service Worker
 * Cache offline-first des assets statiques + dernières conversations
 * Région : Cloudflare Pages (souveraineté France)
 */

const CACHE_VERSION = 'marcel-v1.0.9';
const STATIC_CACHE = `marcel-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `marcel-runtime-${CACHE_VERSION}`;

// Assets critiques pré-cachés à l'installation.
// ⚠️ Ne lister que des fichiers RÉELLEMENT présents : sinon cache.addAll()
// rejette en bloc et l'installation du service worker échoue entièrement.
const PRECACHE_URLS = [
  '/app/',
  '/app/index.html',
  '/app/dashboard.html',
  '/app/marcel.html',
  '/app/veille.html',
  '/app/carnet.html',
  '/app/documents.html',
  '/app/profil.html',
  '/app/css/marcel.css',
  '/app/js/api.js',
  '/app/js/appnav.js',
  '/app/manifest.json',
  '/app/icons/marcel.svg',
  '/assets/logos/Marcel-IA_embleme-carre.svg',
  '/app/gestion.html',
  '/app/controle.html',
  '/app/avis.html',
  '/app/amelioration.html',
];

// ───────────── INSTALLATION ─────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      // Résilient : on cache chaque asset indépendamment pour qu'un 404
      // isolé ne fasse jamais échouer toute l'installation du SW.
      .then(cache => Promise.allSettled(
        PRECACHE_URLS.map(u => cache.add(u))
      ))
      .then(() => self.skipWaiting())
  );
});

// ───────────── ACTIVATION ─────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('marcel-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
     // ANTI-PAGE-PÉRIMÉE : à chaque nouvelle version du SW, on recharge les
     // onglets ouverts pour qu'ils prennent le HTML frais (network-first).
     .then(() => self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => { try { c.navigate(c.url); } catch (_) {} })))
  );
});

// ───────────── FETCH STRATEGY ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ❌ Jamais cacher les calls API workers (toujours en réseau)
  if (url.hostname.endsWith('.workers.dev')) {
    return; // pas d'intercept, network direct
  }

  // ✅ Network first pour HTML (toujours frais quand connecté, cache si offline)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/app/index.html')))
    );
    return;
  }

  // ✅ Network first pour le JS applicatif (anti-cache-obsolète : api.js toujours frais en ligne)
  if (url.pathname.startsWith('/app/js/') || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ✅ Cache first pour les assets stables (CSS, images, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache seulement les réponses OK
        if (response.ok && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ───────────── PUSH NOTIFICATIONS ─────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Marcel', body: 'Une nouvelle alerte vous attend.' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Marcel', {
      body: data.body || 'Nouvelle alerte de veille',
      icon: '/app/icons/marcel.svg',
      badge: '/app/icons/marcel.svg',
      tag: data.tag || 'marcel-alert',
      data: { url: data.url || '/app/veille.html' },
      actions: [
        { action: 'open', title: 'Voir' },
        { action: 'dismiss', title: 'Plus tard' },
      ],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/app/veille.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const client = clients.find(c => c.url.includes('/app/'));
      if (client) { client.focus(); client.navigate(url); }
      else self.clients.openWindow(url);
    })
  );
});
