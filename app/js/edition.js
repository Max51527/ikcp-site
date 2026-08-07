/* ════════════════════════════════════════════════════════════════
   IKCP — Mode édition en direct (© 2026 IKCP · ORIAS 23001568)
   ----------------------------------------------------------------
   Le geste WordPress sur la plateforme souveraine : le propriétaire
   clique un texte du site, le modifie sur place, enregistre. Chaque
   zone modifiable est un [data-cms] ; l'écriture passe par l'endpoint
   atelier déjà verrouillé côté serveur (isOwner) — ce script n'ouvre
   aucun droit, il donne une poignée à ceux qui existent.

   Activation : localStorage ikcp_edition = '1' (posé par la Régie).
   Limite assumée v1 : Notion reste la source des textes — une
   modification directe doit y être reportée, sinon la prochaine
   synchronisation la remplace. La barre le rappelle.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  var API = 'https://ikcp-client.maxime-ead.workers.dev';
  function tok() { try { return localStorage.getItem('ikcp_token') || ''; } catch (_) { return ''; } }
  if (!tok()) return;

  var modifies = {};   // cle → nouvelle valeur
  var barre, compteur;

  function zones() { return document.querySelectorAll('[data-cms]'); }

  function style() {
    var s = document.createElement('style');
    s.textContent =
      '[data-cms][contenteditable]{outline:2px dashed rgba(201,169,110,.85);outline-offset:3px;cursor:text;min-width:1ch}' +
      '[data-cms][contenteditable]:hover{outline-color:#C24722}' +
      '[data-cms][contenteditable]:focus{outline:2px solid #1B2A4A;background:rgba(201,169,110,.08)}' +
      '#ikcpEdBar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;' +
      'display:flex;gap:10px;align-items:center;background:#1B2A4A;color:#FAF8F4;border-radius:14px;' +
      'padding:10px 14px;font-family:Outfit,system-ui,sans-serif;font-size:13.5px;' +
      'box-shadow:0 18px 40px -18px rgba(14,23,41,.6);max-width:94vw;flex-wrap:wrap}' +
      '#ikcpEdBar b{color:#E2C896}' +
      '#ikcpEdBar button{border:0;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;' +
      'font-size:13px;padding:9px 14px}' +
      '#ikcpEdSave{background:linear-gradient(135deg,#E2C896,#C9A96E);color:#20180c}' +
      '#ikcpEdQuit{background:transparent;border:1px solid rgba(226,200,150,.4)!important;color:#E2C896}' +
      '#ikcpEdBar .note{font-size:11px;color:#B3AC9F;flex-basis:100%;line-height:1.4}';
    document.head.appendChild(s);
  }

  function majCompteur() {
    var n = Object.keys(modifies).length;
    compteur.innerHTML = n ? ('<b>' + n + '</b> zone' + (n > 1 ? 's' : '') + ' modifiée' + (n > 1 ? 's' : '')) : 'Cliquez un texte encadré pour le modifier';
    document.getElementById('ikcpEdSave').disabled = !n;
  }

  function armer() {
    zones().forEach(function (el) {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      if (!el.dataset.edInit) {
        el.dataset.edInit = '1';
        el.dataset.edOrigine = el.hasAttribute('data-cms-html') ? el.innerHTML : el.textContent;
        el.addEventListener('input', function () {
          var cle = el.getAttribute('data-cms');
          var val = el.hasAttribute('data-cms-html') ? el.innerHTML : el.textContent;
          if (val === el.dataset.edOrigine) delete modifies[cle]; else modifies[cle] = val;
          majCompteur();
        });
      }
    });
  }

  function enregistrer() {
    var btn = document.getElementById('ikcpEdSave');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    var cles = Object.keys(modifies);
    var fait = 0, rate = 0;
    function suivant() {
      if (!cles.length) {
        btn.textContent = rate ? (fait + ' ok · ' + rate + ' en échec') : '✓ Enregistré';
        if (!rate) { modifies = {}; zones().forEach(function (el) { el.dataset.edOrigine = el.hasAttribute('data-cms-html') ? el.innerHTML : el.textContent; }); }
        setTimeout(function () { btn.textContent = 'Enregistrer'; majCompteur(); }, 1800);
        return;
      }
      var cle = cles.shift();
      fetch(API + '/api/v1/atelier/contenu', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cle: cle, valeur: modifies[cle] }),
      }).then(function (r) { r.ok ? fait++ : rate++; suivant(); })
        .catch(function () { rate++; suivant(); });
    }
    suivant();
  }

  function quitter() {
    try { localStorage.removeItem('ikcp_edition'); } catch (_) {}
    location.reload();
  }

  function barreUI() {
    barre = document.createElement('div');
    barre.id = 'ikcpEdBar';
    barre.innerHTML =
      '<span>✏️ Mode édition</span><span id="ikcpEdCpt"></span>' +
      '<button id="ikcpEdSave" disabled>Enregistrer</button>' +
      '<button id="ikcpEdQuit">Quitter</button>' +
      '<span class="note">Vos modifications partent sur le site immédiatement (mémoire tampon ≈ 60 s). ' +
      'Notion reste la source : reportez-y le texte, sinon la prochaine synchronisation le remplacera.</span>';
    document.body.appendChild(barre);
    compteur = document.getElementById('ikcpEdCpt');
    document.getElementById('ikcpEdSave').addEventListener('click', enregistrer);
    document.getElementById('ikcpEdQuit').addEventListener('click', quitter);
    majCompteur();
  }

  /* Le vrai verrou est côté serveur : un non-propriétaire verra la barre mais
     chaque enregistrement lui répondra 403. On vérifie quand même la session
     pour ne pas afficher un outil mort à un simple membre. */
  fetch(API + '/api/v1/me', { headers: { 'Authorization': 'Bearer ' + tok() } })
    .then(function (r) { return r.json(); })
    .then(function (me) {
      if (!me || !me.email) return;
      style(); barreUI(); armer();
    })
    .catch(function () {});
})();
