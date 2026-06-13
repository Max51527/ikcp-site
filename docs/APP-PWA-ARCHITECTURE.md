# App IKCP Family Office — Architecture PWA

> Document d'architecture pour la vraie application mobile / PWA (au-delà du mockup).
> Statut : prospectif · à coder Sprint 2-3 quand bêta a 10+ familles actives.

---

## Choix techniques

### Framework
- **PWA pure** : pas de React Native / Flutter / Capacitor. Vanilla HTML+JS+CSS + Service Worker.
- **Pourquoi** : zero App Store, déploiement immédiat, installable iOS/Android via "Ajouter à l'écran d'accueil", **100 % souverain** (pas d'intermédiaire Apple/Google).
- **Hébergement** : Cloudflare Pages (WEUR Paris).

### Stack
- HTML5 + CSS3 (variables CSS unifiées avec family-office-v4.html)
- JavaScript vanilla ES modules
- **Service Worker** pour offline + cache + push notifications (opt-in uniquement)
- **Web App Manifest** pour install + icônes
- **IndexedDB** pour cache local des univers + alertes + profil
- **Web Push API** (futur, opt-in) pour notifications alertes (via web-push.org + Cloudflare worker push)

### Pas de framework lourd
- Pas de React (perf + souveraineté)
- Pas de Tailwind compilé (CSS variables suffisent)
- Pas de bundler — chargement direct des modules ES

## Pages / écrans

### Tab 1 — Marcel (chat)
- Interface conversation avec Marcel (worker ikcp-chat)
- Historique session locale (IndexedDB)
- Boutons follow-ups parsés depuis `<!--follow_ups:[...]-->`
- Upload PDF (avis d'imposition, bilan société) → Files API Anthropic

### Tab 2 — Vos univers
- Grille des 12 univers (statut LIVE/DÉMO)
- Tap sur un univers → vue détaillée avec dernières données
- Filtre par catégorie (Patrimoine · Art de vivre · Passions)

### Tab 3 — Vos passions (mockup actuel = inspiration)
- Liste des alertes du collector (ikcp-collector)
- Cards avec gradient catégoriel
- Tap → détail + action (réserver, confirmer, voir l'offre)

### Tab 4 — Profil
- Profil collectionneur (montres, voitures, lego, vins, etc.)
- Édition inline avec sync ikcp-collector
- Réglages : ZDR Anthropic confirmé, opt-in notifications push

### Bottom nav (sticky)
- 4 icônes : Marcel · Univers · Passions · Profil
- Style cohérent navy/cream/terra

## Service Worker

```js
// sw.js (simplified)
const CACHE_NAME = 'ikcp-fo-v1';
const STATIC_ASSETS = [
  '/',
  '/app.html',
  '/styles.css',
  '/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('fetch', e => {
  // Strategy : network-first pour les API (Marcel, collector),
  // cache-first pour les assets statiques.
  if (e.request.url.includes('.workers.dev')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});

self.addEventListener('push', e => {
  // Notification push opt-in (futur)
  const data = e.data.json();
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    data: data.url,
  }));
});
```

## Manifest

```json
{
  "name": "IKCP Family Office",
  "short_name": "IKCP",
  "description": "Votre Family Office augmenté, 100% souverain France.",
  "start_url": "/app.html",
  "display": "standalone",
  "background_color": "#FAF6EE",
  "theme_color": "#1B2A4A",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "categories": ["finance", "lifestyle", "productivity"],
  "screenshots": []
}
```

## Authentification

- **Magic link** via worker `ikcp-client` (existant)
- Email envoyé via Brevo (FR) ou MailChannels (gratuit Cloudflare)
- Token JWT stocké dans IndexedDB (HttpOnly impossible en JS pur, donc XSS-resistant via CSP strict)
- Session 30 jours par défaut

## Sécurité

- CSP strict (script-src 'self', frame-ancestors 'none')
- HTTPS only
- Service Worker fetch handler : strip Authorization sur les requêtes vers tiers
- Pas de service tiers analytics (Plausible souverain FR optionnel plus tard)

## Roadmap PWA

| Sprint | Livrable |
|---|---|
| **Sprint 2** | MVP 1 tab Marcel (chat seul) installable iOS/Android |
| **Sprint 3** | Tabs Univers + Passions branchées sur workers |
| **Sprint 4** | Tab Profil + édition + sync collector |
| **Sprint 5** | Notifications push opt-in (alertes collector) |
| **Sprint 6** | Mode offline complet (toutes les vues consultables sans réseau) |

## Métrique de succès

- Install rate : > 60 % des bêta-testeurs installent en 7 jours
- Engagement : > 3 sessions/semaine en moyenne
- Latence Marcel < 3s 95e percentile
- 0 fuite RGPD (audit Témoin)

---

© 2026 IKCP · Architecture PWA — version 0.1
