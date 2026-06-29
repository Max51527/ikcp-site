/* ════════════════════════════════════════════════════════════════
   IKCP — Invite d'installation de l'app (PWA) liée au compte membre
   © 2026 IKCP · Créé par IKCP.EU
   ----------------------------------------------------------------
   - Android/Chrome : capte beforeinstallprompt → bouton « Installer ».
   - iOS Safari : affiche les instructions « Partager → écran d'accueil ».
   - Ne s'affiche pas si déjà installé (mode standalone) ou déjà refusé.
   - L'app installée partage la session (jeton localStorage) → reste connectée.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (standalone) return; // déjà installée
  try { if (localStorage.getItem('ikcp_install_dismissed')) return; } catch (_) {}

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var deferred = null;

  function banner(html) {
    var b = document.createElement('div');
    b.id = 'ikcp-install';
    b.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:74px;z-index:9000;max-width:520px;margin:0 auto;' +
      'background:#1B2A4A;color:#FAF7F0;border:1px solid rgba(201,169,110,.4);border-radius:14px;' +
      'padding:14px 16px;display:flex;align-items:center;gap:12px;font-family:Outfit,system-ui,sans-serif;font-size:13.5px;' +
      'box-shadow:0 16px 40px -16px rgba(0,0,0,.5)';
    b.innerHTML =
      '<span style="font-size:24px">📲</span><div style="flex:1;line-height:1.4">' + html + '</div>' +
      '<button id="ikcp-install-x" aria-label="Fermer" style="background:transparent;border:none;color:rgba(250,247,240,.5);font-size:20px;cursor:pointer;padding:0 4px">×</button>';
    document.body.appendChild(b);
    document.getElementById('ikcp-install-x').onclick = function () {
      try { localStorage.setItem('ikcp_install_dismissed', '1'); } catch (_) {}
      b.remove();
    };
    return b;
  }

  function show() {
    if (document.getElementById('ikcp-install')) return;
    if (isIOS) {
      banner('<b>Installez Marcel sur votre iPhone</b><br>Appuyez sur <b>Partager</b> ⬆️ puis « <b>Sur l\'écran d\'accueil</b> ».');
    } else if (deferred) {
      var b = banner('<b>Installez l\'application Marcel</b><br>Accès direct depuis votre écran d\'accueil, hors-ligne. <button id="ikcp-install-go" style="margin-top:8px;background:#C9A96E;color:#0E1729;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px">Installer →</button>');
      var go = document.getElementById('ikcp-install-go');
      if (go) go.onclick = function () {
        deferred.prompt();
        deferred.userChoice && deferred.userChoice.finally(function () { deferred = null; b.remove(); });
      };
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    setTimeout(show, 1500); // laisse la page se charger avant de proposer
  });

  // iOS n'émet pas beforeinstallprompt → on propose après un court délai
  if (isIOS) setTimeout(show, 2500);
})();
