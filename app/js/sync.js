/* ════════════════════════════════════════════════════════════════
   IKCP — Synchro cross-device de l'espace membre (coffre /state)
   © 2026 IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568
   ----------------------------------------------------------------
   But : que les données du membre le suivent sur TOUS ses appareils.
   Le patrimoine (biens) est déjà synchronisé par le Dashboard ; ce
   module ajoute la SOCIÉTÉ (ikcp_societe) et le SCORE (ikcp_score).

   Comment : le worker ikcp-patrimoine expose /state = un coffre JSON
   par compte, gated par le jeton validé (fix IDOR), avec FUSION serveur
   (Object.assign : on ne remplace que les clés envoyées). Donc :
     - au chargement → GET /state → on hydrate le localStorage manquant ;
     - au départ/périodiquement → POST /state → on pousse l'état local.
   Sans jeton (déconnecté) : le module ne fait RIEN (no-op).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  var token = ''; try { token = localStorage.getItem('ikcp_token') || ''; } catch (_) {}
  if (!token) return; // pas connecté → pas de synchro serveur

  var PAT = 'https://ikcp-patrimoine.maxime-ead.workers.dev';
  var H = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  // Clés simples (objet JSON) synchronisées via le coffre. (Les biens patrimoniaux
  // gardent leur propre flux dans le Dashboard.)
  var KEYS = ['ikcp_societe', 'ikcp_score'];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  // ── PULL : hydrate au chargement (sans jamais écraser une valeur locale existante) ──
  fetch(PAT + '/state', { headers: H })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var d = (res && res.data) || {};
      var changed = false;
      KEYS.forEach(function (k) {
        var serverKey = k.replace('ikcp_', '');            // societe | score
        if (d[serverKey] != null && !lsGet(k)) {           // le serveur a la donnée, pas ce device
          lsSet(k, JSON.stringify(d[serverKey])); changed = true;
        }
      });
      if (changed) window.dispatchEvent(new Event('ikcp-sync-hydrated'));
    })
    .catch(function () {});

  // ── PUSH : pousse l'état local vers le coffre (uniquement les clés présentes) ──
  function snapshot() {
    var p = {};
    KEYS.forEach(function (k) {
      var v = lsGet(k); if (!v) return;
      try { p[k.replace('ikcp_', '')] = JSON.parse(v); } catch (_) {}
    });
    return p;
  }
  function push() {
    var p = snapshot(); if (!Object.keys(p).length) return;
    try { fetch(PAT + '/state', { method: 'POST', headers: H, body: JSON.stringify(p), keepalive: true }).catch(function () {}); } catch (_) {}
  }
  window.IKCPSync = { push: push, snapshot: snapshot };

  // Pousse une fois après chargement (capte une carto/score faits dans la foulée),
  // au départ de la page, et quand un autre onglet modifie le stockage.
  setTimeout(push, 5000);
  window.addEventListener('beforeunload', push);
  var t; window.addEventListener('storage', function () { clearTimeout(t); t = setTimeout(push, 2000); });
})();
