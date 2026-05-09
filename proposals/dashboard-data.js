/**
 * IKCP Family Office — données de démo pour le dashboard backtesté.
 *
 * Tout est mock. Cette structure est le "contrat" que le futur endpoint
 * `GET /v1/dashboard/me` (Worker `ikcp-client`) devra retourner. Garder
 * ce shape stable permet de remplacer la source par un fetch réel sans
 * toucher au rendu.
 *
 * Famille mockée : "Marc & Sophie Dupont", patrimoine ~4,2 M€ net.
 */

window.IKCP_DASHBOARD = (function () {

  const NOW = new Date('2026-05-09T10:00:00+02:00');

  const client = {
    id: 'cli_dupont_001',
    family_name: 'Famille Dupont',
    members: [
      { first: 'Marc', last: 'Dupont', age: 58, role: 'principal' },
      { first: 'Sophie', last: 'Dupont', age: 56, role: 'co-titulaire' },
      { first: 'Emma', last: 'Dupont', age: 30, role: 'enfant' },
      { first: 'Thomas', last: 'Dupont', age: 28, role: 'enfant' },
    ],
    member_since: '2024-04-12',
    cgp: 'Maxime Juveneton',
    tier: 'Family Office augmenté',
  };

  // Patrimoine consolidé — par classe d'actif
  // Net worth = somme des valeurs nettes (après dettes)
  const patrimoine = {
    net_worth: 4247000,
    variation_trimestre_pct: 2.3,
    variation_an_pct: 6.8,
    classes: [
      { key: 'immo',     label: 'Immobilier',         valeur_nette: 1600000, pct: 38, dettes: 800000, valeur_brute: 2400000, color: '#c4a273' },
      { key: 'cote',     label: 'Financier coté',     valeur_nette: 1040000, pct: 24, color: '#9bb88f' },
      { key: 'av',       label: 'Assurance-vie',      valeur_nette:  540000, pct: 13, color: '#7fae7d' },
      { key: 'art',      label: "Marché de l'art",    valeur_nette:  380000, pct:  9, color: '#d4a85a' },
      { key: 'pe',       label: 'Société / PE',       valeur_nette:  480000, pct: 11, color: '#a08555' },
      { key: 'cash',     label: 'Liquidités',         valeur_nette:   87000, pct:  2, color: '#5e5851' },
      { key: 'autre',    label: 'Autre',              valeur_nette:  120000, pct:  3, color: '#3e3a35' },
    ],
    allocation_cible: {
      immo: 35, cote: 28, av: 12, art: 8, pe: 12, cash: 3, autre: 2
    },
    drift_max_pct: 4, // immo +3, pe -1, cote -4 ⇒ drift modéré
    drift_severity: 'moderate', // none | moderate | high
  };

  // Échéances fiscales et patrimoniales (8 prochaines)
  const echeances = [
    { date: '2026-05-15', label: '2e tiers IR (mensualisation refusée)', montant: 4200, source: 'DGFiP', status: 'a_venir', urgent: false },
    { date: '2026-05-20', label: 'Déclaration 2042 / 2042-C-PRO en ligne', source: 'DGFiP zone 2', status: 'preparé_par_marcel', urgent: true },
    { date: '2026-05-31', label: 'Déclaration 2071 — SCI La Roseraie à l\'IR', source: 'DGFiP', status: 'a_preparer', urgent: false },
    { date: '2026-06-15', label: 'Déclaration 2065 IS — SARL DupSoft (clôture 31/12)', montant: null, source: 'DGFiP', status: 'sous_traite_expert_comptable', urgent: false },
    { date: '2026-06-30', label: 'Acompte taxe foncière (mensualisation)', montant: 2380, source: 'DGFiP', status: 'preleve_auto', urgent: false },
    { date: '2026-07-15', label: '2e acompte IS — SARL DupSoft', montant: 12500, source: 'DGFiP', status: 'a_venir', urgent: false },
    { date: '2026-07-31', label: 'Avis CFE / IFER en ligne — SARL DupSoft', source: 'DGFiP', status: 'a_venir', urgent: false },
    { date: '2026-09-15', label: 'Renouvellement contrat AV (option démembrement clause)', source: 'IKCP suivi', status: 'analyse_en_cours', urgent: false },
  ];

  // Conversations Marcel récentes — par thème
  const conversations = [
    {
      id: 'conv_001', theme: 'transmission', theme_label: "Transmission d'entreprise",
      title: "Donation-cession SARL DupSoft à Emma et Thomas",
      last_message: "Marcel a comparé 4 schémas — Dutreil familial sort 1,4 M€ moins cher que la cession brute.",
      last_question: "Comparer cession vs Dutreil familial sur 4,8 M€",
      date: '2026-05-07', agents: ['Triage', 'Fiscal', 'Juridique', 'Reporting'],
      status: 'en_attente_arbitrage_maxime',
    },
    {
      id: 'conv_002', theme: 'fiscal', theme_label: 'Ingénierie fiscale',
      title: 'Donation 200 k€ à Emma — antériorité ?',
      last_message: 'Droits dus ≈ 18 195 € si pas d\'antériorité < 15 ans. Marcel propose 3 leviers d\'optimisation.',
      last_question: "Si je donne 200 k€ à Emma maintenant, quels droits ?",
      date: '2026-04-28', agents: ['Fiscal', 'Reporting'],
      status: 'cloturee',
    },
    {
      id: 'conv_003', theme: 'art', theme_label: "Marché de l'art",
      title: "Estimation Soulages 1959 — assurance & succession",
      last_message: "Estimation médiane 1,4 M€ (14 ventes Artprice). IFI : exclu. Schéma SC dédiée à étudier > 4 M€.",
      last_question: "Mon Soulages vaut combien et entre-t-il dans l'IFI ?",
      date: '2026-04-21', agents: ['Documents', 'Fiscal', 'Reporting'],
      status: 'cloturee',
    },
    {
      id: 'conv_004', theme: 'immo', theme_label: 'Actifs immobiliers',
      title: 'SCI Roseraie — micro-foncier vs réel 2026',
      last_message: 'À 32 k€ de loyers + 9 k€ d\'intérêts d\'emprunt, le réel économise ~2 100 €/an (TMI 41%).',
      last_question: 'Faut-il basculer la SCI Roseraie au réel ?',
      date: '2026-04-15', agents: ['Fiscal', 'Reporting'],
      status: 'arbitrage_valide_maxime',
    },
    {
      id: 'conv_005', theme: 'markets', theme_label: 'Marchés financiers',
      title: 'Drift LVMH dans le PEA Marc',
      last_message: 'Position LVMH à 32% du PEA vs cible 25%. 3 arbitrages possibles — sentiment Bigdata.com 7j +0,32.',
      last_question: 'Que faire avec LVMH ?',
      date: '2026-04-08', agents: ['Triage', 'Fiscal', 'Reporting', 'Suivi'],
      status: 'en_attente_arbitrage_maxime',
    },
  ];

  // Arbitrages en attente de validation Maxime — la file de travail humaine
  const arbitrages = [
    {
      id: 'arb_001', titre: 'Donation-cession SARL DupSoft (Schéma D Dutreil)',
      contexte: 'Société valorisée 4,8 M€. Marc 58 ans, Emma 30 + Thomas 28. Pacte Dutreil + donation NP enfants → assiette taxable 25% × 4,8 M€ = 1,2 M€.',
      reco_marcel: 'Privilégier Dutreil familial complet (CGI 787 B). Économie nette ~1,4 M€ vs cession à un tiers (PFU 30%). Conditions à formaliser : engagement collectif 2 ans avec Marc + Sophie, fonction de direction maintenue par Marc 3 ans après transmission.',
      sources: ['CGI 787 B', 'CGI 200 A', 'Cass. com. 2024 holding animatrice', 'Pappers — DupSoft'],
      gain_estime: 1400000,
      status: 'en_attente', // en_attente | en_discussion | valide | refuse
      preparé_le: '2026-05-07',
      conv_id: 'conv_001',
    },
    {
      id: 'arb_002', titre: 'Allègement LVMH dans PEA Marc',
      contexte: 'Position 32% du PEA vs cible 25%. PV latente sur 3 ans, antériorité PEA > 8 ans (PV exonérée IR, PS 17,2% uniquement).',
      reco_marcel: 'Cession partielle 1/3 → réinvestissement ETF Stoxx 600 ESG. Fiscalité PEA mature : zéro IR, ~3 200 € de PS sur la PV. Maintien de la diversification globale luxury via les fonds.',
      sources: ['CGI 150-0 D PEA', 'Bigdata.com sentiment LVMH', 'Allocation cible IKCP'],
      gain_estime: 0,  // arbitrage de risque, pas de gain monétaire direct
      gain_qualitatif: 'Réduction concentration -7 pts',
      status: 'en_attente',
      preparé_le: '2026-04-08',
      conv_id: 'conv_005',
    },
    {
      id: 'arb_003', titre: 'Don familial 31 865 € à Thomas (CGI 790 G)',
      contexte: 'Thomas 28 ans, abattement parental non encore consommé, Marc < 80 ans → cumul possible avec abattement 100 k€/15 ans.',
      reco_marcel: 'Verser 31 865 € (cash via virement) + acter par déclaration 2735. Effet immédiat, aucun droit dû, ne consomme pas l\'abattement classique 100 k€.',
      sources: ['CGI 790 G — don TEPA', 'BOFIP-ENR-DMTG-20-30-20'],
      gain_estime: 31865 * 0.20, // = 6 373 € de droits évités si fait dans abattement classique
      status: 'en_discussion',
      preparé_le: '2026-04-28',
      conv_id: 'conv_002',
    },
  ];

  // Documents indexés par Marcel/Documents-agent
  const documents = [
    { id: 'doc_001', type: 'avis_ir', label: 'Avis IR 2024', annee: 2024, date_recu: '2025-09-18', tags: ['fiscal', 'foyer'], pages: 3 },
    { id: 'doc_002', type: 'kbis', label: 'K-bis SARL DupSoft', date_recu: '2025-12-04', tags: ['société'], pages: 2 },
    { id: 'doc_003', type: 'statuts', label: 'Statuts SCI La Roseraie (mise à jour 2024)', date_recu: '2024-11-22', tags: ['immo', 'juridique'], pages: 14 },
    { id: 'doc_004', type: 'acte', label: 'Acte de donation Marc → Emma 2023 (partage)', annee: 2023, date_recu: '2024-04-12', tags: ['transmission', 'notarié'], pages: 8 },
    { id: 'doc_005', type: 'av_contrat', label: 'AV Generali · Marc · n°41028xxxx', date_recu: '2024-06-15', tags: ['av', 'patrimoine'], pages: 22 },
    { id: 'doc_006', type: 'av_contrat', label: 'AV Spirica · Sophie · n°81023xxxx', date_recu: '2024-06-15', tags: ['av', 'patrimoine'], pages: 18 },
    { id: 'doc_007', type: 'releve_pea', label: 'Relevé PEA Marc Q1 2026', annee: 2026, date_recu: '2026-04-12', tags: ['pea', 'financier'], pages: 4 },
    { id: 'doc_008', type: 'compromis', label: "Compromis acquisition appart Megève (en cours)", date_recu: '2026-03-28', tags: ['immo', 'projet'], pages: 32 },
    { id: 'doc_009', type: 'attestation', label: 'Attestation Artprice — Soulages 1959', date_recu: '2026-04-21', tags: ['art', 'estimation'], pages: 1 },
    { id: 'doc_010', type: 'rapport', label: 'Bilan patrimonial Q1 2026 — IKCP', annee: 2026, date_recu: '2026-04-30', tags: ['rapport', 'IKCP'], pages: 18, generated: true },
  ];

  // Reportings & livrables prêts (générés par agent Reporting)
  const livrables = [
    { id: 'liv_001', type: 'bilan_trimestriel', label: 'Bilan patrimonial Q1 2026', date: '2026-04-30', signed: true, pages: 18 },
    { id: 'liv_002', type: 'reporting_alloc', label: 'Reporting allocation portefeuille Q1 2026', date: '2026-04-30', signed: false, pages: 6 },
    { id: 'liv_003', type: 'der',  label: 'DER 2024 (mis à jour avril 2026)', date: '2026-04-12', signed: true, pages: 4 },
    { id: 'liv_004', type: 'memo', label: 'Mémo comparatif transmission DupSoft (4 schémas)', date: '2026-05-07', signed: false, pages: 12, requires_signature: true },
    { id: 'liv_005', type: 'plan_action', label: 'Plan d\'action 2026 — 5 leviers identifiés', date: '2026-01-22', signed: true, pages: 8 },
  ];

  // ─── UNIVERS PERSONNELS — patrimoine émotionnel de la famille ───
  // Marcel surveille les marchés de chaque univers et notifie quand quelque
  // chose bouge (cote, comparable, pré-vente, opportunité).
  const univers_perso = [
    {
      key: 'voitures', icon: '🏎', label: 'Voitures de collection',
      items: [
        { titre: 'Porsche 911 2.7 RS Touring 1973', etat: 'État #2', valeur_estimee: 645000, source: 'Hagerty + Artcurial', tendance: '-8% / 12 mois' },
        { titre: 'Porsche 911 GT3 RS 992 (2024)', etat: 'État #1, 280 km', valeur_estimee: 348000, source: 'Classic.com', tendance: '+4% / 12 mois' },
      ],
      total_estime: 993000,
      derniere_alerte: 'Une 2.7 RS Touring s\'est vendue 645 k€ chez Artcurial Le Mans — baseline confirmée.',
    },
    {
      key: 'vins', icon: '🍷', label: 'Cave d\'investissement',
      items: [
        { titre: 'Pétrus 2009', etat: '4 caisses 12 btl', valeur_estimee: 192000, source: 'Liv-ex Mid-Price', tendance: '+12% / 24 mois' },
        { titre: 'Château Margaux 2010', etat: '8 caisses 12 btl', valeur_estimee: 168000, source: 'iDealwine', tendance: '+6% / 24 mois' },
        { titre: 'Château Lafite 2015', etat: '6 caisses 12 btl', valeur_estimee: 134000, source: 'Liv-ex', tendance: '+9% / 24 mois' },
      ],
      total_estime: 494000,
      derniere_alerte: 'Pétrus 2009 +3% sur Liv-ex en avril — surveillance Marcel active.',
    },
    {
      key: 'art_collection', icon: '🎨', label: 'Œuvres d\'art',
      items: [
        { titre: 'Soulages — huile 1959 100×81 cm', etat: 'Provenance Galerie de France', valeur_estimee: 1400000, source: 'Artprice + Christie\'s', tendance: 'stable / 36 mois' },
        { titre: 'Hartung — gouache 1962', etat: 'Cadre original', valeur_estimee: 280000, source: 'Artnet', tendance: '+15% / 12 mois' },
        { titre: 'Photo Sebastião Salgado — Genesis 2013', etat: 'Tirage 5/30 signé', valeur_estimee: 38000, source: 'Sotheby\'s', tendance: 'stable' },
      ],
      total_estime: 1718000,
      derniere_alerte: 'Pré-vente Christie\'s 18 juin : Soulages encre 1971 estimé 240-320 k€ — opportunité dénicheur.',
    },
    {
      key: 'montres', icon: '⌚', label: 'Collection montres',
      items: [
        { titre: 'Patek Philippe 5167A 2018', etat: 'Full set', valeur_estimee: 28000, source: 'Chrono24', tendance: '-6% / 12 mois' },
        { titre: 'AP Royal Oak 15400ST 2019', etat: 'Full set', valeur_estimee: 38000, source: 'WatchCharts', tendance: '-12% / 12 mois' },
      ],
      total_estime: 66000,
      derniere_alerte: 'Marché stabilisé Q4 2025 — bon moment pour reprendre des positions sur les modèles discontinués.',
    },
    {
      key: 'voyages', icon: '✈', label: 'Voyages & destinations',
      items: [
        { titre: 'NYC juillet 2026 — 7 jours', etat: 'ESTA à renouveler · billets non émis', valeur_estimee: null, source: 'John Paul', tendance: null },
        { titre: 'Megève — chalet familial', etat: 'Acquisition 2018 · 250 m²', valeur_estimee: 4625000, source: 'Knight Frank', tendance: '+9% / 5 ans' },
      ],
      total_estime: 4625000,
      derniere_alerte: 'Off-market Combloux 4,8 M€ disponible (cf. dénicheur d\'offres) — Marcel l\'a matché à votre profil.',
    },
    {
      key: 'immo_prestige', icon: '🏛', label: 'Immobilier prestige',
      items: [
        { titre: 'Résidence principale Paris 16e — 4 ch.', etat: '180 m², 6e étage, vue Seine', valeur_estimee: 2380000, source: 'BIEN Notaires + DVF', tendance: '+11% / 5 ans' },
        { titre: 'Chalet Megève (cf. voyages)', etat: '250 m², 4 ch.', valeur_estimee: 4625000, source: 'Knight Frank', tendance: '+9% / 5 ans' },
      ],
      total_estime: 7005000,
      derniere_alerte: '12 propriétés Saint-Gervais 2-4 M€ remontées par Knight Frank — alternative Megève.',
    },
  ];

  // ─── DÉNICHEUR D'OFFRES — la pièce maîtresse d'un FO digital ───
  // Marcel score chaque opportunité par adéquation au profil (allocation,
  // patrimoine, conversations passées, échéances fiscales). 0 → 100.
  // Sources : réseau partenaires whitelistés + APIs (Bigdata, Artprice, off-market notaires).
  const opportunites = [
    {
      id: 'opp_001',
      categorie: 'Immobilier off-market',
      titre: "Maison contemporaine Combloux 8 ch · vue Mont-Blanc",
      pitch: "À 12 min de Megève. 380 m². Pré-MEM accessible avant mise sur marché public dans 4 semaines.",
      ticket_min: 4800000, ticket_max: 4800000,
      deadline: '2026-06-05',
      source: 'Étude Bertrand · réseau notaires Haute-Savoie',
      fit_score: 78,
      fit_reasons: ['Présence Megève déjà établie', 'Capacité Lombard 1,2 M€ disponible', 'Intérêt résidence secondaire évoqué Q1'],
      cta: 'Demander la visite',
    },
    {
      id: 'opp_002',
      categorie: 'Co-investissement PE',
      titre: "Série A · SaaS B2B finance 6 M€ levée — ticket 50-200 k€",
      pitch: "Plateforme conformité MIF II pour CGP. ARR 1,2 M€, +180% YoY. Lead Serena Capital. Co-invest LPs IKCP.",
      ticket_min: 50000, ticket_max: 200000,
      deadline: '2026-05-30',
      source: 'Pipeline IKCP · DD partagé',
      fit_score: 92,
      fit_reasons: ['Marc dirigeant SaaS DupSoft — connaît le secteur', 'Apport-cession holding éligible 150-0 B ter', 'Thèse PE déjà alloc. cible 12%'],
      cta: 'Recevoir le memo + term sheet',
    },
    {
      id: 'opp_003',
      categorie: 'Fenêtre fiscale',
      titre: "Don logement neuf 100 k€ — exonération CGI 790 A bis avant 31/12/2026",
      pitch: "Donation supplémentaire 100 k€/parent/enfant pour acquisition logement neuf ou rénovation énergétique. Cumulable avec abattement 100 k€/15 ans.",
      ticket_min: 100000, ticket_max: 200000,
      deadline: '2026-12-31',
      source: 'Veille fiscale IKCP · CGI 790 A bis',
      fit_score: 88,
      fit_reasons: ['Emma cherche acquisition Lyon depuis 2025', 'Abattement 100k€ Marc→Emma déjà entamé', 'Économie nette ~20 k€ vs donation classique'],
      cta: 'Calculer avec Marcel',
    },
    {
      id: 'opp_004',
      categorie: "Marché de l'art",
      titre: "Soulages encre 1971 · pré-vente Christie's 18 juin",
      pitch: "Œuvre sur papier 65×50 cm. Provenance Galerie de France. Estimation 240-320 k€. Possibilité offre conditionnelle pré-vente.",
      ticket_min: 240000, ticket_max: 320000,
      deadline: '2026-06-18',
      source: "Christie's France · alerte Marcel sur Soulages",
      fit_score: 81,
      fit_reasons: ['Collection Soulages déjà initiée (1959)', 'Liquidités disponibles (87 k€) + Lombard', 'Hors IFI'],
      cta: "Demander la fiche d'œuvre",
    },
    {
      id: 'opp_005',
      categorie: 'Renégociation tarifs',
      titre: "Lombard mieux placé : Edmond de Rothschild OAT+85 pb",
      pitch: "Votre offre actuelle BNP Wealth est OAT+110 pb. Edmond de Rothschild propose OAT+85 pb pour profil >2 M€ AUM. Économie ~5 800 €/an sur ligne 2 M€.",
      ticket_min: null, ticket_max: null,
      deadline: '2026-07-31',
      source: 'IKCP · mise en concurrence systématique',
      fit_score: 95,
      fit_reasons: ['Lombard actif chez BNP Wealth', 'AUM dépasse seuil 2 M€', 'Garantie cross-collateral PEA + AV'],
      cta: 'Lancer la mise en concurrence',
    },
    {
      id: 'opp_006',
      categorie: 'Produit structuré',
      titre: "Capital protégé 100% · sous-jacent EuroStoxx 50 · 6 ans",
      pitch: "Coupon conditionnel 8% si EuroStoxx 50 ≥ niveau initial à chaque date d'observation annuelle. Capital garanti à échéance même en cas de baisse.",
      ticket_min: 50000, ticket_max: 500000,
      deadline: '2026-06-15',
      source: 'Émetteur BNP · proposé par Nortia',
      fit_score: 64,
      fit_reasons: ['Allocation coté légèrement sous-pondérée vs cible', 'Profil prudent (protection capital)', 'Liquidité 6 ans acceptable'],
      cta: 'Lire la documentation',
    },
  ];

  // ─── SERVICES PREMIUM — au-delà du conseil patrimonial ───
  const services_premium = [
    {
      key: 'governance',
      label: 'Family governance',
      pitch: 'Charte familiale · conseil de famille trimestriel · règles transmission + valeurs',
      status: 'a_initier',
      detail: 'Document fondateur qui aligne Marc, Sophie, Emma et Thomas sur la vision long terme.',
    },
    {
      key: 'nextgen',
      label: 'Programme NextGen',
      pitch: 'Modules pédagogiques pour Emma & Thomas · vision patrimoniale, fiscalité, transmission',
      status: 'inscription_proposee',
      detail: 'Emma 30 ans + Thomas 28 ans. Préparation à recevoir la transmission DupSoft.',
    },
    {
      key: 'cyber',
      label: 'Cyber-protection famille',
      pitch: 'Audit annuel données personnelles · alerte fuite identité · VPN famille · gestion 2FA',
      status: 'audit_planifie_juin',
      detail: 'Audit prévu 12-15 juin par partenaire IKCP (CYRPA). Suite à demande Sophie en mars.',
    },
    {
      key: 'health',
      label: 'Health concierge',
      pitch: 'Bilan préventif annuel American Hospital · accès rapide spécialistes · 2nd avis médical',
      status: 'actif',
      detail: 'Marc bilan effectué oct 2025. Sophie programmé sept 2026.',
    },
    {
      key: 'insurance_audit',
      label: 'Audit assurances complet',
      pitch: 'RC vie privée · cyber · K&R · responsabilité dirigeants · invalidité TNS',
      status: 'realise_q1_2026',
      detail: 'Effectué février 2026. 2 lacunes identifiées : RC dirigeant DupSoft sous-dimensionnée, K&R inexistant pour Megève. Devis en cours.',
    },
    {
      key: 'negociated_rates',
      label: 'Tarifs négociés écosystème',
      pitch: 'Lombard · signature · banques privées · plateformes PE · galeries — 3 offres mises en concurrence',
      status: 'permanent',
      detail: 'Mise en concurrence systématique sur chaque décision > 50 k€. 5 800 €/an économisés sur Lombard détectés ce mois (cf. opportunités).',
    },
  ];

  // Services & conciergerie
  const services = {
    rdv_prochain: {
      date: '2026-05-23T14:30:00+02:00',
      type: 'visio',
      sujet: 'Arbitrage transmission DupSoft + don Thomas',
      avec: 'Maxime Juveneton',
    },
    voyages_planifies: [
      { destination: 'New York', dates: '2026-07-08 → 2026-07-15', status: 'visa_ESTA_a_renouveler', via: 'John Paul (concierge)' },
    ],
    partenaires: [
      { role: 'Notaire', nom: 'Étude Maître Bertrand', ville: 'Paris 16', last_contact: '2024-04-12', sujet: 'Donation-partage' },
      { role: 'Expert-comptable', nom: 'Cabinet Léonard & Associés', ville: 'Annonay', last_contact: '2026-03-12', sujet: 'Liasse 2025 SARL DupSoft' },
      { role: 'Gestionnaire locatif', nom: 'Castor Gestion', ville: 'Paris', last_contact: '2026-04-30', sujet: 'Reddition Q1' },
      { role: 'Avocat fiscaliste', nom: 'Mtre Garcia (CMS)', ville: 'Paris', last_contact: '2025-11-08', sujet: 'Validation Dutreil' },
    ],
  };

  // ─── La VALEUR AJOUTÉE mesurée — ce qui change vs un family office classique ───
  // C'est la "value scorecard" mise en hero du dashboard.
  const value_scorecard = {
    periode_label: 'Mai 2026 (mois en cours)',
    questions_traitees: 12,
    documents_classes_auto: 3,
    arbitrages_prepares: 1,
    optimisations_identifiees_eur: 24700, // ce mois (don familial Thomas + drift LVMH frais)
    prochaines_echeances: 3,
    next_deadline_days: 6, // 15 mai = J+6
  };

  const backtest_12m = {
    periode_label: '12 mois glissants (mai 2025 → mai 2026)',
    metrics: [
      { label: 'Heures économisées en gestion administrative',  value: '24 h',         detail: 'Documents classés + rappels fiscaux + relances partenaires' },
      { label: 'Occasions saisies grâce à l\'IA',                value: '5',           detail: 'Don familial 31 865 €, micro→réel SCI, allègement LVMH, donation Emma 2025, optimisation PER Q4' },
      { label: 'Erreurs évitées',                                value: '2',           detail: 'Échéance CFE 2025 (rappel J-8), clause bénéficiaire AV Sophie incompatible (corrigée)' },
      { label: 'Gains nets identifiés',                          value: '47 200 €',    detail: 'Cumul des optimisations validées : -2 100 € IR/an SCI réel, -6 373 € donation Thomas, -38 700 € PV pacte Dutreil pré-positionné' },
      { label: 'Économie potentielle Dutreil DupSoft (en attente)',value: '1 400 000 €', detail: 'Mémo comparatif 4 schémas livré le 07/05 — décision à prendre par Marc & Sophie' },
    ],
    vs_family_office_classique: {
      cout_annuel: 'IKCP : honoraires forfait 6 800 € + commissions transparentes',
      cout_classique: 'Family Office classique : 0,5-1% AUM + honoraires = ~25-40 k€/an',
      delta_temps_traitement: '-70% sur la préparation de dossier (90 min IA → 25 min Maxime)',
    },
  };

  // ─── Activité IA récente (audit log Marcel) ───
  const activity = [
    { ts: '2026-05-09T08:14:00Z', who: 'Documents-agent',  what: 'Classement automatique de l\'avis CFE 2026 reçu sur admin@ikcp.eu' },
    { ts: '2026-05-08T17:42:00Z', who: 'Suivi-agent',      what: 'Rappel fiscal envoyé : déclaration 2042 dans 12 jours (zone 2)' },
    { ts: '2026-05-07T11:08:00Z', who: 'Marcel',           what: 'Mémo comparatif transmission DupSoft — 4 schémas analysés et chiffrés' },
    { ts: '2026-05-05T15:22:00Z', who: 'Triage-agent',     what: 'Question de Marc routée vers Fiscal + Juridique (transmission DupSoft)' },
    { ts: '2026-05-02T09:35:00Z', who: 'Reporting-agent',  what: 'Bilan patrimonial Q1 2026 généré (18 pages) — en attente signature Marc & Sophie' },
    { ts: '2026-04-30T14:50:00Z', who: 'Suivi-agent',      what: 'Drift allocation détecté : LVMH +7 pts vs cible — arbitrage préparé' },
    { ts: '2026-04-28T10:12:00Z', who: 'Marcel',           what: 'Calcul donation 200 k€ Emma : 18 195 € de droits, 3 leviers d\'optimisation' },
    { ts: '2026-04-21T16:08:00Z', who: 'Documents-agent',  what: 'Estimation Artprice Soulages 1959 — 14 comparables indexés' },
  ];

  return {
    NOW,
    client,
    patrimoine,
    echeances,
    conversations,
    arbitrages,
    documents,
    livrables,
    services,
    univers_perso,
    opportunites,
    services_premium,
    value_scorecard,
    backtest_12m,
    activity,
  };

})();
