/* ══════════════════════════════════════════════════════════════
 * IKCP — Hydratation CMS (sans build)
 * Lit les fichiers _data/*.json et applique les valeurs aux éléments
 * tagués data-cms="prefix.chemin.cle". Le HTML conserve son texte par
 * défaut (SEO + fallback si JS off). Une édition dans /admin/ (Sveltia
 * → commit Git → Pages publie) apparaît alors automatiquement sur le site.
 *
 * Préfixes : home → _data/homepage.json · fo → _data/family-office.json
 *            global → _data/global.json · news → _data/newsletter.json
 *
 * Usage HTML :
 *   <span data-cms="home.hero.headline_1">Texte par défaut</span>
 *   <p data-cms-html data-cms="home.services.description">…</p>  (autorise le HTML)
 * ══════════════════════════════════════════════════════════════ */
(function () {
  var SOURCES = {
    home:   '/_data/homepage.json',
    fo:     '/_data/family-office.json',
    global: '/_data/global.json',
    news:   '/_data/newsletter.json',
  };

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return (o && o[k] != null) ? o[k] : undefined;
    }, obj);
  }

  function applyPrefix(prefix, data) {
    document.querySelectorAll('[data-cms^="' + prefix + '."]').forEach(function (el) {
      var key = el.getAttribute('data-cms').slice(prefix.length + 1);
      var val = getPath(data, key);
      if (val == null || val === '') return;
      if (el.hasAttribute('data-cms-html')) el.innerHTML = val;
      else el.textContent = val;
    });
  }

  Object.keys(SOURCES).forEach(function (prefix) {
    // Ne charge le JSON que si la page contient au moins un tag de ce préfixe
    if (!document.querySelector('[data-cms^="' + prefix + '."]')) return;
    fetch(SOURCES[prefix])
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) applyPrefix(prefix, d); })
      .catch(function () { /* silencieux : le HTML par défaut reste affiché */ });
  });

  // ── Surcharges éditées en direct depuis /app/redaction (stockées en base) ──
  // Appliquées APRÈS les JSON : une modification faite dans l'interface d'édition
  // l'emporte, sans redéploiement. En cas d'indisponibilité, le site garde le
  // texte des JSON, puis celui du HTML — deux filets de sécurité.
  if (document.querySelector('[data-cms]')) {
    fetch('https://ikcp-client.maxime-ead.workers.dev/api/v1/contenu')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) {
        if (!o) return;
        Object.keys(o).forEach(function (cle) {
          document.querySelectorAll('[data-cms="' + cle + '"]').forEach(function (el) {
            if (o[cle] == null || o[cle] === '') return;
            if (el.hasAttribute('data-cms-html')) el.innerHTML = o[cle];
            else el.textContent = o[cle];
          });
        });
      })
      .catch(function () { /* silencieux */ });
  }
})();

/* ── Mode édition en direct ─────────────────────────────────────────────
   Quand la Régie a posé le drapeau, on charge l'éditeur sur cette page.
   Un seul point d'inclusion : toute page qui hydrate ses textes sait
   aussi les éditer. Le verrou réel reste côté serveur (propriétaire). */
(function () {
  try {
    if (localStorage.getItem('ikcp_edition') === '1' && localStorage.getItem('ikcp_token')) {
      var s = document.createElement('script');
      s.src = '/app/js/edition.js'; s.defer = true;
      document.head.appendChild(s);
    }
  } catch (_) {}
})();
