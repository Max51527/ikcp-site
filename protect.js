/* ════════════════════════════════════════════════════════════════
   IKCP — Dissuasion copie + attribution + filigrane
   © 2026 IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568
   ----------------------------------------------------------------
   Honnête : ce sont des DISSUASIONS (copier-coller, clic droit,
   capture). Un utilisateur déterminé (devtools) peut contourner —
   la vraie protection juridique = mentions légales + dépôt.
   Objectif : décourager le vol casual + tracer l'origine partout.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ATTRIB = 'Créé par IKCP.EU — cabinet de gestion de patrimoine indépendant · Ardèche · Combloux · Megève. Reproduction interdite.';
  var CONTACT = 'maxime@ikcp.eu';

  // ── 1. Interception du copier (Ctrl+C / clic droit Copier) ──
  document.addEventListener('copy', function (e) {
    try {
      var sel = (window.getSelection && window.getSelection().toString()) || '';
      if (!sel) return;
      var payload;
      if (sel.length > 240) {
        // Grosse sélection = tentative de pillage → on remplace par un leurre + attribution
        payload =
          '⚠ CONTENU PROTÉGÉ ⚠\n' +
          ATTRIB + '\n\n' +
          'La copie intégrale de ce contenu est désactivée. ' +
          'Pour toute réutilisation, demande écrite à ' + CONTACT + '.\n' +
          '« Vous lisez une analyse propriétaire. La recopier ne la rend pas vôtre. »';
      } else {
        // Petite sélection (citation) tolérée, mais signée
        payload = sel + '\n\n— ' + ATTRIB;
      }
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', payload);
        e.clipboardData.setData('text/html', '<p>' + payload.replace(/\n/g, '<br>') + '</p>');
        e.preventDefault();
      }
    } catch (_) { /* ne jamais casser la page */ }
  });

  // ── 2. Couper (Ctrl+X) traité comme copier ──
  document.addEventListener('cut', function (e) {
    try {
      var sel = (window.getSelection && window.getSelection().toString()) || '';
      if (!sel) return;
      if (e.clipboardData) { e.clipboardData.setData('text/plain', '⚠ ' + ATTRIB); e.preventDefault(); }
    } catch (_) {}
  });

  // ── 3. Clic droit : message d'attribution (dissuasion douce) ──
  // Désactivable par data-allow-context sur <body> (ex. pages de test).
  if (!document.body || !document.body.hasAttribute('data-allow-context')) {
    document.addEventListener('contextmenu', function (e) {
      // sur les champs de saisie on laisse le menu (UX)
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      e.preventDefault();
    });
  }

  // ── 4. Filigrane discret (visible aussi sur capture d'écran) ──
  // Très faible opacité pour préserver le rendu premium + lisibilité.
  // Activé par défaut ; désactivable via data-no-watermark sur <body>.
  function addWatermark() {
    if (!document.body || document.body.hasAttribute('data-no-watermark')) return;
    if (document.getElementById('ikcp-wm')) return;
    var txt = 'IKCP.EU · IKCP.EU · IKCP.EU · ';
    var svg =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'>" +
        "<text x='0' y='110' transform='rotate(-24 0 110)' " +
        "font-family='Arial' font-size='15' fill='%231B2A4A' fill-opacity='0.035'>" + txt + "</text></svg>"
      );
    var wm = document.createElement('div');
    wm.id = 'ikcp-wm';
    wm.setAttribute('aria-hidden', 'true');
    wm.style.cssText =
      'position:fixed;inset:0;z-index:2147483640;pointer-events:none;' +
      "background-image:url(\"" + svg + "\");background-repeat:repeat;";
    document.body.appendChild(wm);

    // Crédit permanent discret en bas (toujours visible, capture incluse)
    var credit = document.createElement('div');
    credit.id = 'ikcp-credit';
    credit.setAttribute('aria-hidden', 'true');
    credit.textContent = 'Créé par IKCP.EU · Ardèche · Combloux · Megève';
    credit.style.cssText =
      'position:fixed;bottom:4px;right:8px;z-index:2147483641;pointer-events:none;' +
      'font:600 9px/1 Arial,sans-serif;letter-spacing:.08em;color:rgba(27,42,74,.22);' +
      'text-transform:uppercase;user-select:none;';
    document.body.appendChild(credit);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addWatermark);
  else addWatermark();

  // ── 5. Helper de partage propre (icônes prévues) ──
  // window.ikcpShare('linkedin'|'email'|'copy', {url, title})
  window.ikcpShare = function (platform, opts) {
    opts = opts || {};
    var url = opts.url || location.href;
    var title = opts.title || document.title;
    var signed = title + ' — via IKCP.EU (Ardèche · Combloux · Megève) ' + url;
    if (platform === 'linkedin') {
      window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url), '_blank', 'noopener');
    } else if (platform === 'email') {
      window.location.href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(signed);
    } else if (platform === 'copy') {
      try { navigator.clipboard.writeText(signed); } catch (_) {}
    }
  };
})();
