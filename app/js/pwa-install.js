/* ════════════════════════════════════════════════════════════════
   IKCP — Installation de l’app (PWA) liée au compte membre
   © 2026 IKCP · Créé par IKCP.EU
   ----------------------------------------------------------------
   Une PWA (Progressive Web App) est un site que le navigateur sait
   installer comme un vrai logiciel : icône sur le bureau, fenêtre
   sans barre d’adresse, même session, mêmes données.

   Ce module :
   - capte l’événement « beforeinstallprompt » (Chrome/Edge/Android) ;
   - expose window.IKCPInstall pour qu’une PAGE offre un bouton
     « Installer » permanent (profil, dashboard) ;
   - propose une bannière discrète, dont le refus n’est plus définitif
     mais mis en veille 21 jours ;
   - donne, quand le navigateur ne propose rien, le chemin de menu
     exact pour installer à la main.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var SNOOZE_KEY = 'ikcp_install_snooze_until';
  var LEGACY_KEY = 'ikcp_install_dismissed';
  var SNOOZE_MS = 21 * 24 * 60 * 60 * 1000; // 21 jours
  var deferred = null;

  // Ancien verrou : un seul clic sur « × » bloquait l’invite POUR TOUJOURS.
  // On le purge une fois pour toutes, remplacé par une mise en veille.
  try { if (localStorage.getItem(LEGACY_KEY)) localStorage.removeItem(LEGACY_KEY); } catch (_) {}

  function snoozed() {
    try { return parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10) > Date.now(); }
    catch (_) { return false; }
  }
  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch (_) {}
  }

  // « display-mode: standalone » = la page tourne dans une fenêtre d’app,
  // pas dans un onglet. C’est la preuve que l’installation a réussi.
  function installed() {
    try {
      if (window.navigator.standalone === true) return true; // iOS
      if (!window.matchMedia) return false;
      return ['standalone', 'minimal-ui', 'window-controls-overlay', 'fullscreen']
        .some(function (m) { return window.matchMedia('(display-mode: ' + m + ')').matches; });
    } catch (_) { return false; }
  }

  function ua() { return navigator.userAgent || ''; }
  function isIOS() { return /iphone|ipad|ipod/i.test(ua()) && !window.MSStream; }

  function browser() {
    var u = ua();
    if (/Edg\//.test(u)) return 'edge';
    if (/OPR\//.test(u)) return 'opera';
    if (/Firefox\//.test(u)) return 'firefox';
    if (isIOS()) return 'ios';
    if (/Chrome|Chromium/.test(u)) return 'chrome';
    if (/Safari/.test(u)) return 'safari';
    return 'autre';
  }

  // Chemins de menu réels. Chrome a déplacé l’entrée selon les versions :
  // on décrit les deux plutôt que d’affirmer une seule formulation.
  var HOWTO = {
    chrome:  'Menu <b>⋮</b> en haut à droite → <b>Installer Marcel IA</b>. Selon la version de Chrome, l’entrée est rangée sous <b>Diffuser, enregistrer et partager</b> → <b>Installer la page en tant qu’application</b>.',
    edge:    'Menu <b>…</b> en haut à droite → <b>Applications</b> → <b>Installer ce site en tant qu’application</b>.',
    opera:   'Menu Opera → <b>Installer</b>. Sinon, ouvrez <b>ikcp.eu/app</b> dans Chrome ou Edge.',
    ios:     'Bouton <b>Partager</b> ⬆️ en bas de Safari → <b>Sur l’écran d’accueil</b>.',
    safari:  'Menu <b>Fichier</b> → <b>Ajouter au Dock</b> (macOS Sonoma et plus récent).',
    firefox: 'Firefox n’installe pas les applications web sur ordinateur. Ouvrez <b>ikcp.eu/app</b> dans Chrome ou Edge.',
    autre:   'Cherchez « Installer l’application » dans le menu de votre navigateur.'
  };

  // ───────── API publique, consommée par profil.html / dashboard.html ─────────
  window.IKCPInstall = {
    installed: installed,
    canPrompt: function () { return !!deferred; },
    browser: browser,
    howto: function () { return HOWTO[browser()] || HOWTO.autre; },
    // Ouvre la vraie boîte de dialogue d’installation du navigateur.
    prompt: function () {
      if (!deferred) return Promise.resolve('unavailable');
      var d = deferred;
      d.prompt();
      return d.userChoice.then(function (c) {
        if (c && c.outcome === 'accepted') deferred = null;
        return (c && c.outcome) || 'dismissed';
      }).catch(function () { return 'error'; });
    },
    // Ré-arme l’invite si elle a été mise en veille.
    reset: function () {
      try { localStorage.removeItem(SNOOZE_KEY); localStorage.removeItem(LEGACY_KEY); } catch (_) {}
    }
  };

  function emit(name) { try { window.dispatchEvent(new CustomEvent(name)); } catch (_) {} }

  // ───────── Bannière (crème, cohérente avec l’app) ─────────
  function banner(html) {
    var b = document.createElement('div');
    b.id = 'ikcp-install';
    b.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:9000;max-width:520px;margin:0 auto;' +
      'background:#FFFDF9;color:#1B2A4A;border:1px solid rgba(201,169,110,.55);border-radius:14px;' +
      'padding:14px 16px;display:flex;align-items:center;gap:12px;font-family:Outfit,system-ui,sans-serif;font-size:13.5px;' +
      'box-shadow:0 18px 44px -18px rgba(27,42,74,.35)';
    b.innerHTML =
      '<span style="font-size:24px">📲</span><div style="flex:1;line-height:1.4">' + html + '</div>' +
      '<button id="ikcp-install-x" aria-label="Plus tard" title="Plus tard" style="background:transparent;border:none;color:#6B5D52;font-size:20px;cursor:pointer;padding:0 4px">×</button>';
    document.body.appendChild(b);
    document.getElementById('ikcp-install-x').onclick = function () { snooze(); b.remove(); };
    return b;
  }

  function show() {
    if (installed() || snoozed()) return;
    if (document.getElementById('ikcp-install')) return;

    if (browser() === 'ios') {
      banner('<b>Installez Marcel sur votre iPhone</b><br>Appuyez sur <b>Partager</b> ⬆️ puis « <b>Sur l’écran d’accueil</b> ».');
      return;
    }
    if (!deferred) return;

    var b = banner('<b>Installez l’application Marcel</b><br>Icône dédiée, plein écran, même session. ' +
      '<button id="ikcp-install-go" style="margin-top:8px;background:#C9A96E;color:#0E1729;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px">Installer →</button>');
    var go = document.getElementById('ikcp-install-go');
    if (go) go.onclick = function () {
      window.IKCPInstall.prompt().then(function () { b.remove(); });
    };
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // on garde la main : c’est nous qui proposons
    deferred = e;
    emit('ikcp:install-ready');  // les pages réaffichent leur bouton
    setTimeout(show, 1500);
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    try { localStorage.removeItem(SNOOZE_KEY); } catch (_) {}
    var b = document.getElementById('ikcp-install');
    if (b) b.remove();
    emit('ikcp:install-done');
  });

  if (browser() === 'ios') setTimeout(show, 2500);
})();
