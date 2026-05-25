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
})();
