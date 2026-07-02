/* ════════════════════════════════════════════════════════════════
   IKCP — Dissuasion copie + attribution + filigrane traçable
   © 2026 IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568
   ----------------------------------------------------------------
   Honnête : ce sont des DISSUASIONS (copier-coller, clic droit,
   capture, impression). Un utilisateur déterminé (devtools, view-source)
   peut contourner — la vraie protection juridique = mentions légales,
   dépôt, et la TRAÇABILITÉ (filigrane nominatif côté membre connecté).
   Objectif : décourager le vol casual + tracer l'origine partout +
   rendre tout screenshot d'un membre identifiable.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ATTRIB = 'Créé par IKCP.EU — cabinet de gestion de patrimoine indépendant · Ardèche · Combloux · Megève. Reproduction interdite.';
  var CONTACT = 'maxime@ikcp.eu';
  var IN_APP = (function () { try { return location.pathname.indexOf('/app/') === 0; } catch (_) { return false; } });

  // ── 0. Toast de dissuasion (message visible, premium, auto-disparition) ──
  var _toastTimer = null;
  function shield(msg) {
    try {
      var t = document.getElementById('ikcp-shield');
      if (!t) {
        t = document.createElement('div');
        t.id = 'ikcp-shield';
        t.setAttribute('role', 'status');
        t.style.cssText =
          'position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);' +
          'z-index:2147483646;max-width:min(92vw,520px);padding:13px 18px;border-radius:13px;' +
          'background:rgba(14,23,41,.96);color:#FAFAF8;border:1px solid rgba(201,169,110,.5);' +
          'box-shadow:0 18px 50px rgba(0,0,0,.4);font:500 13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;' +
          'letter-spacing:.01em;opacity:0;transition:opacity .22s ease,transform .22s ease;pointer-events:none;text-align:center;';
        document.body.appendChild(t);
      }
      t.innerHTML = '<span style="color:#E2C896;font-weight:700">⬡ Contenu IKCP protégé.</span> ' + msg;
      requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
      clearTimeout(_toastTimer);
      _toastTimer = setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(12px)'; }, 3200);
    } catch (_) {}
  }

  // ── 1. Interception du copier (Ctrl+C / clic droit Copier) ──
  document.addEventListener('copy', function (e) {
    return; // Copie LIBRE partout — interception « contenu protégé » retirée (gêne user/admin). Traçabilité = filigrane + mentions légales.
    try {
      var sel = (window.getSelection && window.getSelection().toString()) || '';
      if (!sel) return;
      // Exemption : zones explicitement partageables (ex. réponses de démo en direct)
      // marquées [data-allow-copy] → copie normale autorisée (bouche-à-oreille).
      try {
        var _an = window.getSelection().anchorNode;
        var _el = _an && (_an.nodeType === 1 ? _an : _an.parentElement);
        if (_el && _el.closest && _el.closest('[data-allow-copy]')) return;
      } catch (_) {}
      var payload;
      if (sel.length > 600) {
        // Grosse sélection = tentative de pillage → on remplace par un leurre + attribution
        payload =
          '⚠ CONTENU PROTÉGÉ ⚠\n' +
          ATTRIB + '\n\n' +
          'La copie intégrale de ce contenu est désactivée. ' +
          'Pour toute réutilisation, demande écrite à ' + CONTACT + '.\n' +
          '« Vous lisez une analyse propriétaire. La recopier ne la rend pas vôtre. »';
        shield('Copie intégrale désactivée — toute reproduction est tracée (art. L.111-1 CPI).');
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
    return; // Couper libre partout.
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
      return; // Clic droit libre partout.
      // sur les champs de saisie on laisse le menu (UX)
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      e.preventDefault();
      shield('Clic droit désactivé. Pour réutiliser un contenu : ' + CONTACT + '.');
    });
  }

  // ── 3b. Raccourcis de capture/source/impression : interception + dissuasion ──
  // On NE bloque pas dans les champs de saisie. Ctrl/Cmd + S (enregistrer),
  // U (source), P (imprimer). La capture écran OS n'est pas interceptable JS
  // → c'est le filigrane nominatif (module 4) qui la couvre.
  document.addEventListener('keydown', function (e) {
    return; // Raccourcis clavier libres partout.
    try {
      var t = e.target, tag = (t && t.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      var mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      var k = (e.key || '').toLowerCase();
      if (k === 's') { e.preventDefault(); shield('Enregistrement de page désactivé. Le contenu reste la propriété d\'IKCP.'); }
      else if (k === 'u') { e.preventDefault(); shield('Affichage du code source désactivé.'); }
      else if (k === 'p') { /* on laisse l\'impression mais on la marque (module 6) */ }
    } catch (_) {}
  });

  // ── 4. Filigrane : RETIRÉ (décision Maxime 02/07/2026 — rendu épuré, traçabilité assurée
  //    par les mentions légales + l'attribution à la copie + le bandeau d'impression). ──


  // ── 5. Anti-glisser / anti-enregistrement des images ──
  document.addEventListener('dragstart', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'IMG' || tag === 'svg' || tag === 'CANVAS' || tag === 'PICTURE') { e.preventDefault(); }
  });

  // ── 6. Protection à l'impression (PDF / Ctrl+P) : bandeau d'attribution ──
  try {
    var ps = document.createElement('style');
    ps.id = 'ikcp-print-guard';
    ps.textContent =
      '@media print{' +
      'body::before{content:"' + (IN_APP() ? 'IKCP — Espace confidentiel · reproduction interdite' : 'IKCP.EU — contenu protégé · reproduction interdite') + '";' +
      'display:block;text-align:center;font:700 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;' +
      'color:#8B6F3F;border-bottom:1px solid #C9A96E;padding:6px 0;margin-bottom:8px;}' +
      'body::after{content:"© IKCP · ORIAS 23001568 · maxime@ikcp.eu · toute reproduction est tracée";' +
      'position:fixed;bottom:0;left:0;right:0;text-align:center;font:600 8px Arial,sans-serif;color:#6B5D52;padding:4px 0;}' +
      '}';
    (document.head || document.documentElement).appendChild(ps);
  } catch (_) {}

  // ── 7. Helper de partage propre (icônes prévues) ──
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
