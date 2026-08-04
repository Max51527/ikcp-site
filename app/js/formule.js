/* ══════════════════════════════════════════════════════════════════════════
 * IKCP — Moteur de formules guidées (sans code exécutable)
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI : permettre de créer des simulateurs depuis l'interface d'édition
 * SANS jamais évaluer de code saisi. Un simulateur est une liste d'ÉTAPES,
 * chacune choisissant une opération dans une liste fermée (ci-dessous).
 * Aucun eval(), aucun new Function() : une opération inconnue renvoie 0.
 * Une formule malveillante est donc impossible à écrire.
 *
 * BARÈMES 2026 — source unique. À réviser chaque année (loi de finances) :
 * c'est le seul endroit à modifier pour que tous les simulateurs suivent.
 * ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var BAREMES = {
    // IR 2026 (revenus 2025) — LF 2026 art. 4
    ir: [[11600, 0], [29579, .11], [84577, .30], [181917, .41], [Infinity, .45]],
    // Droits de donation/succession en ligne directe — art. 777 CGI
    donation: [[8072, .05], [12109, .10], [15932, .15], [552324, .20],
               [902838, .30], [1805677, .40], [Infinity, .45]],
    // IFI — art. 977 CGI (non assujetti sous 1 300 000 €)
    ifi: [[800000, 0], [1300000, .005], [2570000, .007], [5000000, .01],
          [10000000, .0125], [Infinity, .015]],
  };
  var CONSTANTES = {
    abattement_enfant: 100000,      // art. 779 CGI, par parent et par enfant, 15 ans
    abattement_av_70: 152500,       // art. 990 I CGI, par bénéficiaire
    plafond_per: 88911,             // plafond de déduction 2026
    seuil_ifi: 1300000,
    pfu: 0.30,                      // 12,8 % IR + 17,2 % prélèvements sociaux
    pfu_ir: 0.128, pfu_ps: 0.172,
    is_reduit: 0.15, is_normal: 0.25, is_seuil: 42500,
    abattement_dirigeant_retraite: 500000, // art. 150-0 D ter
  };

  function progressif(base, bareme) {
    var t = 0, prev = 0;
    for (var i = 0; i < bareme.length; i++) {
      var plafond = bareme[i][0], taux = bareme[i][1];
      if (base > prev) { t += (Math.min(base, plafond) - prev) * taux; prev = plafond; }
      else break;
    }
    return t;
  }

  /* Liste FERMÉE des opérations proposées dans l'éditeur. Ajouter une opération
     est un acte de développement (revue de code), jamais une saisie utilisateur. */
  var OPS = {
    additionner:      function (a, b) { return a + b; },
    soustraire:       function (a, b) { return a - b; },
    soustraire_min0:  function (a, b) { return Math.max(a - b, 0); },
    multiplier:       function (a, b) { return a * b; },
    diviser:          function (a, b) { return b === 0 ? 0 : a / b; },
    pourcentage:      function (a, b) { return a * (b / 100); },
    minimum:          function (a, b) { return Math.min(a, b); },
    maximum:          function (a, b) { return Math.max(a, b); },
    bareme_ir:        function (a) { return progressif(Math.max(a, 0), BAREMES.ir); },
    bareme_donation:  function (a) { return progressif(Math.max(a, 0), BAREMES.donation); },
    bareme_ifi:       function (a) { return a < CONSTANTES.seuil_ifi ? 0 : progressif(a, BAREMES.ifi); },
    capitalisation:   function (a, b) { return a * Math.pow(1 + (b / 100), 1); }, // 1 période

    /* Les trois opérations ci-dessous rendent un FACTEUR, pas un montant : le
       moteur n'accepte que des opérations à deux entrées, et la capitalisation
       en demande trois (capital, taux, durée). On calcule donc le facteur ici,
       et l'étape suivante le multiplie par le capital. Les exposants sont
       bornés : un simulateur mal saisi ne doit pas figer le navigateur. */
    puissance: function (a, b) {
      var n = Math.max(-1200, Math.min(1200, b));
      var r = Math.pow(a, n);
      return isFinite(r) ? r : 0;
    },
    /* (1 + taux%)^n — combien un euro devient au bout de n périodes. */
    facteur_capitalisation: function (taux, n) {
      var p = Math.max(0, Math.min(1200, n));
      var r = Math.pow(1 + (taux / 100), p);
      return isFinite(r) ? r : 0;
    },
    /* ((1 + taux%)^n − 1) ÷ taux% — le facteur d'une suite de versements
       constants. Sert aussi bien à l'effort d'épargne qu'à la mensualité
       d'emprunt. Taux nul : le facteur vaut simplement le nombre de périodes. */
    facteur_annuite: function (taux, n) {
      var t = taux / 100;
      var p = Math.max(0, Math.min(1200, n));
      if (t === 0) return p;
      var r = (Math.pow(1 + t, p) - 1) / t;
      return isFinite(r) ? r : 0;
    },
  };

  var LIBELLES = {
    additionner: 'Additionner (A + B)',
    soustraire: 'Soustraire (A − B)',
    soustraire_min0: 'Soustraire sans descendre sous zéro (A − B, min 0)',
    multiplier: 'Multiplier (A × B)',
    diviser: 'Diviser (A ÷ B)',
    pourcentage: 'Pourcentage de A (B %)',
    minimum: 'Le plus petit des deux',
    maximum: 'Le plus grand des deux',
    bareme_ir: 'Barème de l\'impôt sur le revenu 2026 (sur A)',
    bareme_donation: 'Barème des droits de donation en ligne directe (sur A)',
    bareme_ifi: 'Barème de l\'IFI 2026 (sur A)',
    capitalisation: 'Capitaliser A au taux B %',
    puissance: 'A puissance B',
    facteur_capitalisation: 'Facteur de capitalisation — taux A %, sur B périodes',
    facteur_annuite: 'Facteur d\'annuité — taux A %, sur B périodes',
  };

  /* Résout une référence : nom d'un champ, d'une étape précédente,
     « const:NOM » (constante fiscale) ou « nb:123 » (nombre fixe). */
  function resoudre(ref, ctx) {
    if (ref == null || ref === '') return 0;
    var s = String(ref);
    if (s.indexOf('const:') === 0) { var c = CONSTANTES[s.slice(6)]; return c == null ? 0 : c; }
    if (s.indexOf('nb:') === 0) { var n = parseFloat(s.slice(3)); return isFinite(n) ? n : 0; }
    var v = ctx[s];
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  /* Exécute un simulateur. Renvoie { valeurs, resultats:[{label, valeur}] }. */
  function calculer(simu, saisies) {
    var ctx = {};
    (simu.champs || []).forEach(function (c) {
      var v = saisies && saisies[c.cle] != null ? parseFloat(saisies[c.cle]) : parseFloat(c.defaut);
      ctx[c.cle] = isFinite(v) ? v : 0;
    });
    (simu.etapes || []).forEach(function (e) {
      var fn = OPS[e.op];
      ctx[e.cle] = fn ? fn(resoudre(e.a, ctx), resoudre(e.b, ctx)) : 0;
    });
    var libelle = {};
    (simu.champs || []).forEach(function (c) { libelle[c.cle] = c.label; });
    (simu.etapes || []).forEach(function (e) { libelle[e.cle] = e.label; });
    var res = (simu.resultats || []).map(function (k) {
      return { cle: k, label: libelle[k] || k, valeur: ctx[k] || 0 };
    });
    return { valeurs: ctx, resultats: res };
  }

  root.IKCPFormule = {
    OPS_LIBELLES: LIBELLES,
    CONSTANTES: CONSTANTES,
    calculer: calculer,
    listeOps: function () { return Object.keys(LIBELLES); },
    listeConstantes: function () { return Object.keys(CONSTANTES); },
  };
})(typeof window !== 'undefined' ? window : this);
