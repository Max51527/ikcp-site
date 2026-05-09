/**
 * IKCP Family Office — agents interactifs (page v4-live).
 *
 * Architecture : la page appelle **directement le Worker Marcel existant**
 * (`ikcp-chat.maxime-ead.workers.dev`) avec un préambule thématique injecté en
 * tête du message. Marcel orchestre déjà :
 *  - tool calling déterministe (calc_impot_revenu, calc_droits_succession, …)
 *  - web search natif Anthropic
 *  - prompt caching MIF II
 *
 * Pas de nouvel endpoint à déployer pour démarrer : on réutilise l'existant.
 * L'endpoint canonique `api.ikcp.eu/v1/agents/ask` (à venir) sera un proxy
 * Worker→Worker vers Marcel — la même contractuelle.
 *
 * Si Marcel est inatteignable (CORS / panne / dev offline), on bascule sur les
 * réponses mock thématiques pour que la démo reste fonctionnelle.
 */

const MARCEL_URL = (window.IKCP_MARCEL_URL || 'https://ikcp-chat.maxime-ead.workers.dev').replace(/\/$/, '');
const STREAM_DELAY_MS = 12;

/**
 * Pour chaque thématique :
 *  - `agents`  : agents transversaux mobilisés (cf. docs/FAMILY-OFFICE-AGENTS-AUDIT.md §3)
 *  - `apis`    : sources affichées en chips (la promesse "auditable")
 *  - `prompts` : 3 questions prédéfinies pour amorcer
 *  - `preamble`: ligne injectée en tête du message envoyé à Marcel — focalise
 *                la réponse sur la thématique, demande les sources et le format.
 *  - `mock`    : réponse de secours (si Marcel inatteignable)
 */
const THEMES = [
  {
    key: 'art',
    numeral: 'i.',
    title: "Marché de l'art",
    desc: "Estimation, comparables d'enchères, fiscalité de la collection, structuration via OBO.",
    agents: ['Triage', 'Documents', 'Fiscal', 'Reporting'],
    apis: ['Artprice', 'Artnet', "Christie's", "Sotheby's", 'Wikidata'],
    prompts: [
      "Estimer un Soulages 1959 100×81 cm",
      "L'art entre-t-il dans l'IFI ?",
      "Comment structurer une collection de 4 M€ ?"
    ],
    preamble:
      "[Famille Office · Marché de l'art] Tu réponds avec : (1) ordre de grandeur " +
      "d'estimation si possible, (2) régime fiscal applicable (IFI — exclusion CGI 885 I, " +
      "PV cession CGI 150 V bis, mutations), (3) si patrimoine art > 1 M€, mentionne 1-2 " +
      "schémas de structuration (SC dédiée, fondation, OBO art). Cite tes sources.",
    mock: {
      text: "Pour un **Soulages 1959 huile sur toile 100×81 cm**, l'historique Artprice 2022-2025 montre 14 ventes comparables, médiane **1,2-1,8 M€** (max 2,4 M€ Christie's juin 2024).\n\n**IFI** : les œuvres d'art sont exclues de l'assiette IFI (CGI 885 I) — avantage majeur vs immobilier. Aucune déclaration spécifique tant que le bien reste dans le patrimoine privé.\n\n**Cession** : taxation forfaitaire 6,5% du prix (CGI 150 V bis), ou option PV régime général avec exonération totale après 22 ans.\n\n**Au-delà de 4 M€**, *piste de réflexion* : (i) SC familiale dédiée pour transmission progressive, (ii) fondation abritée pour pièces muséales, (iii) OBO art via holding.\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'Artprice — historique 14 ventes' },
        { name: 'CGI 885 I — exclusion IFI' },
        { name: 'CGI 150 V bis — taxation cession' }
      ],
      next_action: "Demander à Maxime un mémo structurant"
    }
  },
  {
    key: 'markets',
    numeral: 'ii.',
    title: "Marchés financiers",
    desc: "Actions, obligations, ETF, OPCVM, structurés. Sélection 100% indépendante, sourcée.",
    agents: ['Triage', 'Fiscal', 'Reporting', 'Suivi'],
    apis: ['Bigdata.com', 'Yahoo Finance', 'Quantalys', 'Nortia', 'AMF GECO'],
    prompts: [
      "LVMH : tearsheet + sentiment 7 jours",
      "Drift de mon allocation 60/40",
      "ETF MSCI World vs Stoxx 600 — 5 ans"
    ],
    preamble:
      "[Famille Office · Marchés financiers] Si la question porte sur une valeur cotée, " +
      "donne données indicatives (prix, P/E, momentum, sentiment 7j Bigdata) et 2-3 " +
      "arbitrages possibles avec impact fiscal (PEA / AV / CTO / PER). Cite Bigdata.com / " +
      "Quantalys et le CGI.",
    mock: {
      text: "Sur **LVMH (MC.PA)** au 08/05/2026 : prix 678,40€, P/E forward 22,4×, dividende yield 1,9%. Sentiment **Bigdata.com** 7 jours : **+0,32** (positif modéré, momentum tiré par luxury Asia).\n\nDans une allocation type 25% allocation cible, une position à **32% du PEA** présente un drift de +7 pts.\n\n*Pistes de réflexion* :\n- Allègement partiel 1/3 dans PEA → réinvestissement ETF Stoxx 600 ESG\n- Couverture via put 650€ échéance 6 mois (delta -0,30)\n- Conservation et écrêtage par futurs versements (allocation glissante)\n\n**Impact fiscal** PEA > 5 ans d'antériorité : PV exonérée d'IR, prélèvements sociaux 17,2% uniquement (CGI 150-0 D).\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'Bigdata.com — sentiment LVMH' },
        { name: 'Quantalys — peers luxury' },
        { name: 'CGI 150-0 D — PEA' }
      ],
      next_action: "Soumettre l'arbitrage à Maxime"
    }
  },
  {
    key: 'fiscal',
    numeral: 'iii.',
    title: "Ingénierie fiscale",
    desc: "IR, IFI, succession, donation. Chaque calcul cite l'article CGI et le millésime.",
    agents: ['Fiscal', 'Reporting', 'Documents'],
    apis: ['Légifrance', 'BOFIP', 'Insee', 'DGFiP barèmes'],
    prompts: [
      "Donation 200k€ à mon fils — antériorité ?",
      "IFI 2026 sur 1,8 M€ d'immo locatif",
      "Plafond PER pour TNS 80k€ BNC"
    ],
    preamble:
      "[Famille Office · Ingénierie fiscale] Utilise systématiquement tes tools de calcul " +
      "(calc_impot_revenu, calc_droits_succession, et les nouveaux : calc_donation, calc_ifi). " +
      "Cite l'article CGI applicable et le millésime du barème.",
    mock: {
      text: "*L'essentiel : un parent peut donner **100 000 € net de droits** par enfant tous les 15 ans (art. 779 I CGI), cumulable avec le don familial 31 865 € (art. 790 G CGI).*\n\nPour une **donation de 200 000 € parent → enfant** en 2026 :\n- Abattement applicable : 100 000 € (CGI 779 I)\n- Reste imposable : 100 000 €\n- Barème DMTG progressif (CGI 777) → **droits dus ≈ 18 195 €**\n\n**Antériorité** : si donation antérieure < 15 ans, l'abattement est partiellement consommé.\n\n*Pistes de réflexion* :\n- Donation-partage avec démembrement (NP seul → assiette réduite ~60% âge 60-69 ans)\n- Don familial 31 865 € (CGI 790 G) cumulable si parent < 80 ans + enfant majeur\n- Don logement neuf/rénovation +100 000 € jusqu'au 31/12/2026 (CGI 790 A bis)\n\nUn couple avec 2 enfants peut transmettre **527 460 € sans droits** sur un cycle de 15 ans en cumulant ces dispositifs.\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'CGI 779 I — abattement' },
        { name: 'CGI 777 — barème DMTG' },
        { name: 'CGI 790 G — don TEPA' },
        { name: 'BOFIP-ENR-DMTG-10-50' }
      ],
      next_action: "Demander la simulation chiffrée détaillée"
    }
  },
  {
    key: 'juridique',
    numeral: 'iv.',
    title: "Juridique & succession",
    desc: "Lecture d'actes, clauses bénéficiaires, pactes Dutreil, mandats de protection.",
    agents: ['Documents', 'Juridique', 'Fiscal', 'Reporting'],
    apis: ['Légifrance', 'Notaires de France', 'Pappers', 'Infogreffe'],
    prompts: [
      "Analyser ma clause bénéficiaire AV",
      "Pacte Dutreil + donation : conditions 2026",
      "Mandat de protection future — checklist"
    ],
    preamble:
      "[Famille Office · Juridique & succession] Réponds en citant le Code civil, le CGI et " +
      "la jurisprudence pertinente. Pour les pactes Dutreil, rappelle les 4 conditions " +
      "(engagement collectif 2 ans, engagement individuel 4 ans, fonction de direction, " +
      "holding animatrice si pertinent).",
    mock: {
      text: "*L'essentiel : le pacte Dutreil (CGI 787 B) permet **75% d'abattement DMTG** sur la transmission d'entreprise familiale, sous 4 conditions strictes.*\n\n**Pacte Dutreil — conditions 2026** (CGI 787 B) :\n\n1. **Engagement collectif** : 2 ans minimum, signé avec un ou plusieurs associés détenant ensemble ≥ 17% droits financiers + 34% droits de vote (sociétés non cotées).\n2. **Engagement individuel** : 4 ans après transmission, par chaque héritier/donataire.\n3. **Fonction de direction** : un signataire de l'engagement collectif OU un héritier doit exercer une fonction de direction pendant 3 ans après transmission.\n4. **Holding animatrice** : si la société transmise est une holding, elle doit être animatrice — la jurisprudence Cass. com. 2024 durcit l'appréciation.\n\n*Combinaison fiscale* : Dutreil 75% + donation NP + abattement 100 k€ → taxation effective potentiellement < 5% sur entreprise familiale 2-5 M€.\n\n*Pour analyser un cas précis, Marcel a besoin du K-bis, des statuts et de la dernière liasse fiscale.*\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'CGI 787 B' },
        { name: 'BOFIP-ENR-DMTG-10-20-40' },
        { name: 'Cass. com. 2024 holding animatrice' },
        { name: 'Pappers — extrait société' }
      ],
      next_action: "Lancer le diagnostic Dutreil avec SIREN"
    }
  },
  {
    key: 'immo',
    numeral: 'v.',
    title: "Actifs immobiliers",
    desc: "Estimation, gestion locative, IFI, LMNP, PV. Données de marché en direct.",
    agents: ['Documents', 'Fiscal', 'Reporting', 'Suivi'],
    apis: ['DVF', 'PriceHubble', 'Insee IRL', 'BAN', 'Géoportail'],
    prompts: [
      "Estimer un appart 80 m² Paris 16e",
      "Micro-foncier vs réel — seuil 2026",
      "PV cession résidence locative 18 ans"
    ],
    preamble:
      "[Famille Office · Actifs immobiliers] Pour les estimations, indique que la source est " +
      "DVF (api.gouv.fr — données officielles ventes). Pour la fiscalité, cite CGI 150 U " +
      "(abattement durée détention) et le BOFIP IFI-VAL.",
    mock: {
      text: "*L'essentiel : Paris 16e, segment 75-85 m² avec ascenseur, médiane DVF 2024-2025 = **11 800 €/m²**.*\n\n**Estimation 80 m² Paris 16e**\n- DVF (api.gouv.fr) sur 942 transactions : médiane **944 000 €** (range 816k - 1 072k selon étage/exposition/état)\n- Q1-Q3 : 10 200 - 13 400 €/m²\n\n**Pour IFI 2026** : assiette = valeur vénale au 1er janvier (CGI 964). DGFiP accepte une estimation argumentée -10% pour précaution → assiette ≈ 850 k€ pour ce bien.\n\n**Si vente** :\n- PV = prix cession - prix acquisition revalorisé (frais 7,5% + travaux justifiés)\n- Abattement durée détention CGI 150 U : exonération IR à 22 ans, prélèvements sociaux à 30 ans\n- Surtaxe PV élevée (CGI 1609 nonies G) : 2-6% si > 50 k€\n\n*Pour affiner l'estimation, Marcel a besoin de l'adresse exacte (DVF géolocalise au numéro).*\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'DVF api.gouv.fr — 942 transactions' },
        { name: 'CGI 964 — IFI assiette' },
        { name: 'CGI 150 U — abattement durée' },
        { name: 'BOFIP IFI-VAL-30' }
      ],
      next_action: "Préciser l'adresse pour estimation fine"
    }
  },
  {
    key: 'pe',
    numeral: 'vi.',
    title: "Private Equity",
    desc: "Sélection FCPR/FPCI, term sheets, ticket, distribution, fiscalité 150-0 B ter.",
    agents: ['Triage', 'Juridique', 'Fiscal', 'Reporting'],
    apis: ['France Invest', 'AMF GECO', 'Crunchbase', 'Caceis'],
    prompts: [
      "Apport-cession 150-0 B ter : 3 ans + 60% ?",
      "Comparer 2 FPCI Tech 2026",
      "IR-PME 2026 — plafond et conditions"
    ],
    preamble:
      "[Famille Office · Private Equity] Maîtrise CGI 150-0 B ter (apport-cession holding), " +
      "CGI 199 terdecies-0 A (IR-PME), exonération PV holding (CGI 219 I a quinquies). Pour " +
      "les FPCI, mentionne les conditions 75% titres éligibles non cotés.",
    mock: {
      text: "*L'essentiel : l'apport-cession (CGI 150-0 B ter) reporte la PV — sous condition de **réinvestissement ≥ 60%** dans une activité éligible si cession < 3 ans.*\n\n**Apport-cession 150-0 B ter** — règles 2026 :\n\n1. **Holding** soumise à l'IS, contrôle de l'apporteur > 50%\n2. **Si cession titres apportés < 3 ans** : réinvestissement obligatoire **≥ 60%** du produit dans activité éligible (entreprise opérationnelle / FCPR / FPCI éligibles)\n3. Conservation du réinvestissement **≥ 5 ans**\n4. **Cession entre 3 et 8 ans** : pas de réinvestissement obligatoire, report maintenu\n5. **Cession > 8 ans** : report définitif (purgé si liquidation/donation/décès)\n\n**Activités éligibles** : industrielle, commerciale, artisanale, agricole, libérale, financière. **Exclus** : gestion patrimoine immobilier passif, gestion VM.\n\n**FPCI éligibles** : > 75% actifs en titres reçus en contrepartie de souscriptions au capital ou prêts ≥ 5 ans à des sociétés européennes opérationnelles non cotées.\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'CGI 150-0 B ter' },
        { name: 'BOFIP RPPM-PVBMI-30-10-60' },
        { name: 'AMF GECO — FPCI agréés' },
        { name: 'France Invest — stats marché' }
      ],
      next_action: "Lancer le screening FPCI 2026"
    }
  },
  {
    key: 'transmission',
    numeral: 'vii.',
    title: "Transmission d'entreprise",
    desc: "Cession, OBO, donation-cession, holding apport. 4 schémas comparés.",
    agents: ['Triage', 'Documents', 'Fiscal', 'Juridique', 'Reporting'],
    apis: ['Pappers', 'Infogreffe', 'BODACC', 'Datagouv DGFiP-IS'],
    prompts: [
      "Comparer cession vs Dutreil familial sur 8 M€",
      "OBO 4 M€ — fiscalité et financement",
      "Lettre d'intention — checklist due-dil"
    ],
    preamble:
      "[Famille Office · Transmission d'entreprise] Pour toute valorisation > 1 M€, compare " +
      "**4 schémas** : (A) cession 100% à un tiers, (B) donation-cession enfants avant cession, " +
      "(C) holding apport CGI 150-0 B ter, (D) Dutreil familial complet CGI 787 B. Chiffre " +
      "l'impact fiscal de chacun.",
    mock: {
      text: "*L'essentiel : pour 8 M€ valorisation, le delta fiscal entre cession brute et Dutreil familial peut dépasser **2 M€**.*\n\n**PME 8 M€ — dirigeant 58 ans, 2 enfants — 4 schémas comparés** :\n\n**A. Cession 100% à un tiers**\nPV brute 7,8 M€ → PFU 30% = **2,34 M€ d'impôt**. Net cédant : 5,46 M€. *Délai : 6-12 mois.*\n\n**B. Donation-cession enfants** (avant cession)\nDonation NP enfants : abattement 100 k€ × 2 + barème DMTG ≈ **620 k€ droits**. Cession ensuite : PV purgée pour la part enfants. Net famille : **7,16 M€**.\n\n**C. Holding apport** (CGI 150-0 B ter) + cession partielle\nApport titres → holding IS, report PV. Cession 60% holding → réinvestissement obligatoire. **0 € impôt immédiat**. Net cédant : 8 M€ avec 4,8 M€ réinvestis sous contrôle.\n\n**D. Pacte Dutreil familial** (CGI 787 B)\nEngagement collectif 2 ans + transmission donation NP avec abattement 75% : assiette taxable 25% × 8 M€ = 2 M€. DMTG ≈ **140 k€ droits**. *Conserve l'entreprise dans la famille.*\n\nLe choix dépend du projet de vie : sortie cash (A), transmission familiale (B/D), réinvestissement actif (C).\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'CGI 787 B — Dutreil' },
        { name: 'CGI 150-0 B ter — apport-cession' },
        { name: 'CGI 200 A — PFU' },
        { name: 'Pappers — valorisation peers' }
      ],
      next_action: "Construire le mémo comparatif détaillé"
    }
  },
  {
    key: 'financement',
    numeral: 'viii.',
    title: "Financement",
    desc: "Crédit hypothécaire, Lombard, dette privée. Mise en concurrence systématique.",
    agents: ['Triage', 'Fiscal', 'Juridique', 'Reporting'],
    apis: ['Banque de France OAT 10y', 'CAFPI', 'Younited', 'Insee'],
    prompts: [
      "Crédit Lombard sur 2 M€ AV — taux marché",
      "Acquisition immo 1,5 M€ — TAEG 2026",
      "Déductibilité intérêts SCI à l'IS"
    ],
    preamble:
      "[Famille Office · Financement] Pour le Lombard, base les taux sur OAT 10y + spread " +
      "bancaire (90-110 pb private banking) ; LTV typique 60-65%. Mentionne risque margin call.",
    mock: {
      text: "*L'essentiel : un crédit Lombard sur AV permet une levée jusqu'à **60% LTV** sans cession d'actifs — taux 2026 indicatif **3,9-4,2% TAEG**.*\n\n**Crédit Lombard sur AV 2 M€** (collatéral éligible UC + euro) :\n\nTaux indicatifs 2026 Q2 (OAT 10y ~3,12% + spread bancaire) :\n- BNP Wealth Lombard : OAT + 90 pb ≈ **4,0% TAEG**, LTV max 60%\n- Edmond de Rothschild : OAT + 110 pb ≈ **4,2%**, LTV 65%\n- Société Générale Private : OAT + 80 pb ≈ **3,9%**, LTV 60%\n\n**Levée mobilisable** : 1,2 M€ (60% LTV sur 2 M€).\n\n*Avantages* :\n- Pas de revente d'actifs (PV non purgée, antériorité PEA/AV conservée)\n- Intérêts déductibles si acquisition immo locatif (régime réel) ou apport société IS\n- Effet de levier sur performance UC sous-jacente\n\n*Risques* :\n- Appel de marge si AV baisse > 25%\n- Coût supérieur à rendement euro (≈ 2,5% net 2025) → pertinent uniquement si UC à rendement attendu > 5%\n- Pas d'API self-service côté banques privées : dossier humain.\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'Banque de France — OAT 10y' },
        { name: 'CGI 31 — déductibilité' },
        { name: 'Insee — IRL Q1 2026' }
      ],
      next_action: "Lancer la consultation 3 banques privées"
    }
  },
  {
    key: 'philanthropie',
    numeral: 'ix.',
    title: "Philanthropie",
    desc: "Fonds de dotation, fondation abritée, FRUP, mécénat IS. Mesure d'impact.",
    agents: ['Triage', 'Juridique', 'Fiscal', 'Reporting'],
    apis: ['CGI 200', 'CGI 978', 'CGI 238 bis', 'JOAFE', 'Loi 2008-776'],
    prompts: [
      "Fonds de dotation 500k€ — fiscalité",
      "FRUP vs fondation abritée : différences ?",
      "Mécénat IS 60% — plafond 2026"
    ],
    preamble:
      "[Famille Office · Philanthropie] Compare fonds de dotation (loi 2008-776) / fondation " +
      "abritée / FRUP. Cite la fiscalité dotateur : IR 66% (CGI 200), IFI 75% (CGI 978), IS " +
      "60% (CGI 238 bis).",
    mock: {
      text: "*L'essentiel : un don de 500 k€ d'un particulier en TMI 45% peut bénéficier d'une **réduction IR effective 330 k€** (CGI 200) — coût net du don : 170 k€.*\n\n**3 véhicules philanthropiques** :\n\n*Fonds de dotation* (loi 2008-776) — création par déclaration préfecture (4 semaines), dotation min 15 000 €, capacité juridique pleine. Pas de contrôle public renforcé. **Souple, rapide.**\n\n*Fondation abritée* (sous Fondation de France ou Institut de France) — création par convention 8-12 semaines, dotation min 50-100 k€. Pas de personnalité juridique propre, **bénéficie de la reconnaissance d'utilité publique de l'abritante**.\n\n*FRUP* — décret en Conseil d'État, dotation min ~1,5 M€, **18-24 mois** d'instruction. Personnalité juridique pleine, prestige institutionnel.\n\n**Fiscalité dotateur 2026** :\n- Particulier : réduction IR **66%** du don (CGI 200), plafond 20% revenu imposable, report 5 ans.\n- IFI : réduction **75%** du don (CGI 978), plafond 50 000 €/an.\n- Société : réduction IS **60%** du don (CGI 238 bis), plafond 20 000 € OU 0,5% CA HT (le plus élevé).\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'CGI 200 — IR don' },
        { name: 'CGI 978 — IFI don' },
        { name: 'CGI 238 bis — mécénat IS' },
        { name: 'Loi 2008-776 — fonds dotation' }
      ],
      next_action: "Choisir le véhicule selon la cause"
    }
  },
  {
    key: 'admin',
    numeral: 'x.',
    title: "Conciergerie & admin",
    desc: "Échéances fiscales, courrier sensible, voyage, scolarité, prestataires whitelisted.",
    agents: ['Triage', 'Documents', 'Suivi'],
    apis: ['Cloudflare Email', 'Calendly', 'Amadeus', 'Pennylane'],
    prompts: [
      "Mes prochaines échéances fiscales",
      "Visa ESTA + voyage USA 7 jours en juillet",
      "Vérifier mon avis CFE 2026"
    ],
    preamble:
      "[Famille Office · Conciergerie & admin] Pour les échéances fiscales, donne le " +
      "calendrier DGFiP du trimestre. Pour la conciergerie, indique que IKCP coordonne " +
      "avec un prestataire white-label (John Paul) — pas d'auto-booking direct.",
    mock: {
      text: "*L'essentiel : 6 échéances fiscales clés sur mai-juillet 2026.*\n\n**Calendrier fiscal IKCP — mai à juillet 2026** :\n\n*Mai 2026*\n- **15 mai** : 2e tiers IR (si mensualisation refusée)\n- **20 mai** : déclaration 2042 / 2042-C-PRO en ligne (résidents zone 2)\n- **31 mai** : déclaration 2071 SCI à l'IR\n\n*Juin 2026*\n- **15 juin** : déclaration 2065 IS (clôture 31/12)\n- **30 juin** : taxe foncière acompte (mensualisation)\n\n*Juillet 2026*\n- **15 juillet** : 2e acompte IS (si exercice civil)\n- **31 juillet** : avis CFE / IFER en ligne\n\n*Conciergerie* : Marcel scrute la boîte `admin@ikcp.eu` (si activée) — un courrier RAR DGFiP arrive : *agent Documents* le classe, *agent Suivi* déclenche le rappel 8 jours avant échéance, *agent Fiscal* prévalide le montant attendu.\n\n*Pour les voyages*, IKCP coordonne avec John Paul (prestataire white-label) en respectant vos préférences mémorisées.\n\n*Ces informations sont pédagogiques. Pour une analyse de votre situation, Maxime peut vous accompagner.*",
      sources: [
        { name: 'Calendrier fiscal DGFiP 2026' },
        { name: 'Cloudflare Email Routing' },
        { name: 'John Paul — partenaire conciergerie' }
      ],
      next_action: "Activer la boîte admin@ikcp.eu"
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Mémoire conversationnelle légère par thème (pour reprendre une conversation)
const conversations = Object.create(null);

// ─────────────────────────────────────────────────────────────────────────────
// Rendu des cartes thématiques

function renderThemes() {
  const root = document.getElementById('themes');
  if (!root) return;
  THEMES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.dataset.theme = t.key;
    card.innerHTML = `
      <div class="theme-numeral">${t.numeral}</div>
      <div class="theme-title">${t.title}</div>
      <div class="theme-desc">${t.desc}</div>
      <div class="theme-meta">
        ${t.apis.map(a => `<span class="api-chip">${a}</span>`).join('')}
      </div>
      <div class="theme-trigger">
        <span>Demander à Marcel</span>
        <span class="arrow">→</span>
      </div>
    `;
    card.addEventListener('click', () => togglePanel(t.key));
    root.appendChild(card);

    const panel = document.createElement('div');
    panel.className = 'theme-panel';
    panel.dataset.panel = t.key;
    panel.innerHTML = renderPanelHTML(t);
    root.appendChild(panel);
  });

  THEMES.forEach(t => bindPanel(t));
}

function renderPanelHTML(t) {
  return `
    <div class="panel-head">
      <div class="panel-head-l">
        <div class="panel-agent-line">
          ${t.agents.join(' · ')} <span style="color:var(--ink-faint)">— orchestré par Marcel</span>
        </div>
        <div class="panel-title">${t.title}</div>
        <div class="panel-sub">Posez votre question. Marcel route vers le bon agent, croise les sources, prépare la synthèse — Maxime arbitre.</div>
      </div>
      <button class="panel-close" data-close="${t.key}" aria-label="Fermer">Fermer ✕</button>
    </div>

    <div class="panel-prompts">
      ${t.prompts.map(p => `<button class="prompt-chip" data-prompt="${escapeAttr(p)}">${p}</button>`).join('')}
    </div>

    <div class="panel-input-row">
      <input class="panel-input" type="text" placeholder="Votre question — ex. ${t.prompts[0].toLowerCase()}…" data-input="${t.key}">
      <button class="panel-send" data-send="${t.key}">Envoyer</button>
    </div>

    <div class="panel-loader" data-loader="${t.key}">
      <span class="pulse"></span>
      <span>Marcel orchestre les agents…</span>
    </div>

    <div class="panel-response" data-response="${t.key}"></div>

    <div class="panel-sources" data-sources="${t.key}">
      <span class="panel-sources-label">Sources citées —</span>
    </div>

    <div class="panel-footer">
      <div class="panel-footer-note">
        Cette réponse est <em>une préparation</em>, pas une recommandation. Toute reco ne part qu'après validation de Maxime (MIF II / DDA).
      </div>
      <a href="mailto:maxime@ikcp.fr?subject=${encodeURIComponent('IKCP — '+t.title+' : suite à donner')}" class="panel-cta-maxime" data-next="${t.key}">
        Continuer avec Maxime →
      </a>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle panel (un seul ouvert à la fois)

function togglePanel(key) {
  const card = document.querySelector(`.theme-card[data-theme="${key}"]`);
  const panel = document.querySelector(`.theme-panel[data-panel="${key}"]`);
  if (!card || !panel) return;

  const wasOpen = panel.classList.contains('open');

  document.querySelectorAll('.theme-card.open').forEach(c => c.classList.remove('open'));
  document.querySelectorAll('.theme-panel.open').forEach(p => p.classList.remove('open'));

  if (!wasOpen) {
    card.classList.add('open');
    panel.classList.add('open');
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    const input = panel.querySelector('input.panel-input');
    if (input) setTimeout(() => input.focus(), 350);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Binding interactions

function bindPanel(theme) {
  const panel = document.querySelector(`.theme-panel[data-panel="${theme.key}"]`);
  if (!panel) return;

  panel.querySelector(`[data-close="${theme.key}"]`).addEventListener('click', e => {
    e.stopPropagation();
    togglePanel(theme.key);
  });

  panel.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = panel.querySelector('input.panel-input');
      input.value = chip.dataset.prompt;
      submitQuestion(theme);
    });
  });

  panel.querySelector(`[data-send="${theme.key}"]`).addEventListener('click', () => submitQuestion(theme));

  panel.querySelector(`[data-input="${theme.key}"]`).addEventListener('keydown', e => {
    if (e.key === 'Enter') submitQuestion(theme);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Soumission : Marcel direct, fallback mock

async function submitQuestion(theme) {
  const panel = document.querySelector(`.theme-panel[data-panel="${theme.key}"]`);
  const input = panel.querySelector('input.panel-input');
  const sendBtn = panel.querySelector(`[data-send="${theme.key}"]`);
  const loader = panel.querySelector(`[data-loader="${theme.key}"]`);
  const responseEl = panel.querySelector(`[data-response="${theme.key}"]`);
  const sourcesEl = panel.querySelector(`[data-sources="${theme.key}"]`);

  const question = input.value.trim();
  if (!question) { input.focus(); return; }

  sendBtn.disabled = true;
  loader.classList.add('visible');
  responseEl.classList.remove('visible');
  sourcesEl.classList.remove('visible');
  responseEl.textContent = '';
  sourcesEl.querySelectorAll('.source-chip').forEach(c => c.remove());

  let result;
  try {
    result = await askMarcel(theme, question);
  } catch (err) {
    console.warn('[IKCP] Marcel indisponible, fallback mock', err);
    result = theme.mock;
  }

  loader.classList.remove('visible');
  sendBtn.disabled = false;

  await streamText(responseEl, result.text);
  renderSources(sourcesEl, result.sources || []);

  // CTA mailto enrichi avec contexte
  const cta = panel.querySelector(`[data-next="${theme.key}"]`);
  if (cta) {
    const subject = `IKCP — ${theme.title} : ${question.slice(0, 60)}`;
    const body =
      `Bonjour Maxime,\n\nQuestion posée à Marcel : ${question}\n\n` +
      `Retour Marcel :\n${stripMd(result.text).slice(0, 400)}…\n\n` +
      `Suite proposée : ${result.next_action || 'discuter en RDV'}.\n\n` +
      `— envoyé depuis ikcp.eu/family-office`;
    cta.href = `mailto:maxime@ikcp.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}

/**
 * Appel direct au Worker Marcel. On préfixe le message avec un préambule
 * thématique pour focaliser la réponse. Marcel renvoie {reply, follow_ups,
 * web_search_used, season} — on extrait `reply` et on devine les sources
 * à partir des mentions CGI / API dans le texte (heuristique simple, à
 * remplacer par des `sources[]` natives une fois le Worker mis à jour).
 */
async function askMarcel(theme, question) {
  const message = `${theme.preamble}\n\nQuestion : ${question}`;
  const history = (conversations[theme.key] || []).slice(-6); // 3 derniers tours

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  let res;
  try {
    res = await fetch(MARCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, theme: theme.key }),
      signal: ctrl.signal
    });
  } finally { clearTimeout(t); }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.reply) throw new Error('reply vide');

  // Mémorise la conversation par thème
  conversations[theme.key] = [
    ...history,
    { role: 'user', content: message },
    { role: 'assistant', content: json.reply }
  ];

  return {
    text: json.reply,
    sources: extractSources(json.reply, theme),
    next_action: 'Soumettre cette analyse à Maxime'
  };
}

/**
 * Extraction heuristique de sources depuis la réponse Marcel.
 * Cherche les mentions "CGI ###", "art. ###", "BOFIP-...", "api.gouv.fr".
 * Si rien trouvé, fallback sur les `apis` du thème.
 */
function extractSources(text, theme) {
  const found = new Set();
  const patterns = [
    /\b(CGI\s*[\d\-\s]*[A-Z]?(?:\s*(?:bis|ter|quater|quinquies|sexies))?)\b/gi,
    /\b(art\.\s*\d+(?:\s*[A-Z])?(?:\s*(?:bis|ter|quater))?\s*(?:CGI|Code\s+civil|CMF))\b/gi,
    /\b(BOFIP-[A-Z\-\d]+)\b/gi,
    /\b(api\.gouv\.fr\/[a-z\-]+)\b/gi,
    /\b(Bigdata\.com|Artprice|Pappers|DVF|Légifrance|PriceHubble)\b/g,
  ];
  patterns.forEach(p => {
    let m;
    while ((m = p.exec(text)) !== null) {
      const s = m[1].replace(/\s+/g, ' ').trim();
      if (s.length < 80) found.add(s);
    }
  });
  if (found.size === 0) {
    return theme.apis.slice(0, 4).map(name => ({ name }));
  }
  return Array.from(found).slice(0, 6).map(name => ({ name }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu : streaming texte + chips sources

async function streamText(el, text) {
  el.classList.add('visible');
  el.innerHTML = '';
  const html = mdLite(text);
  const plain = stripMd(text);
  let i = 0;
  await new Promise(resolve => {
    const tick = () => {
      i += Math.max(1, Math.floor(plain.length / 200));
      el.textContent = plain.slice(0, i);
      if (i >= plain.length) {
        el.innerHTML = html;
        resolve();
        return;
      }
      setTimeout(tick, STREAM_DELAY_MS);
    };
    tick();
  });
}

function renderSources(el, sources) {
  if (!sources.length) return;
  el.classList.add('visible');
  sources.forEach(s => {
    const chip = document.createElement('span');
    chip.className = 'source-chip';
    if (s.url) {
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.color = 'inherit';
      a.style.textDecoration = 'none';
      a.textContent = s.name;
      chip.appendChild(a);
    } else {
      chip.textContent = s.name;
    }
    el.appendChild(chip);
  });
}

function mdLite(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function stripMd(text) {
  return String(text).replace(/\*\*/g, '').replace(/\*/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', renderThemes);
