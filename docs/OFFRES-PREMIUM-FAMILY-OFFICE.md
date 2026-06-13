# Offres IKCP Family Office — Premium & Sur-mesure

> **Objet** : document de travail pour préciser ce que chaque tier apporte concrètement.
> Pour chaque agent IA Claude, on liste : capacités, cas d'usage réels, limites MIF II, modèle utilisé.
> Le but : qu'on puisse vendre **honnêtement** ce qu'on facture, et que l'écart Premium / Sur-mesure soit **visible et défendable**.
>
> **Statut** : v1 · 2026-05-11 · à itérer avec Maxime

---

## 1. La philosophie des 3 tiers

| | Freemium | Premium | Family Office Sur-mesure |
|---|---|---|---|
| **Promesse** | *"Goûter."* | *"Outiller."* | *"Accompagner."* |
| **Cible** | Curieux, prospect | Dirigeant TNS, profession libérale, famille en construction | Famille à patrimoine constitué · multi-business · transmission active |
| **Prix** | 0 € | **290 €/mois** sans engagement | **Sur devis** (forfait 6 800 €/an + variable) |
| **ADN** | IA pédagogique générique | IA personnalisée + 11 agents | IA + **validation humaine systématique Maxime** + **exécution** |
| **Promesse claire** | Voir si ça parle | Comprendre + simuler son patrimoine | Décider + exécuter avec un cabinet derrière |

La différenciation clé : **Premium = vous comprenez. Sur-mesure = on agit pour vous, avec vous.**

---

## 2. Tier 1 — Freemium

### Ce qu'on offre

- **Marcel basique** : 30 messages/mois, réponses pédagogiques génériques, pas de mémoire de profil
- **1 lookup Pappers/mois** : essayer la cartographie
- **Accès aux simulateurs publics ikcp.eu** (IR, succession, donation, IFI)
- **Newsletter UPPERCUT PATRIMOINE**

### Limites volontaires

- Pas de mémoire cross-session (chaque conversation repart de zéro)
- Pas d'export PDF
- Pas d'accès aux 10 autres agents
- Pas de chiffres sur son propre patrimoine (Pappers seulement, pas le recueil)

### Stratégie

Le Freemium est **un funnel d'acquisition**, pas un produit. Objectif : convertir 5 % vers Premium dans les 90 jours après signup.

---

## 3. Tier 2 — Premium · 290 €/mois

### Ce que vous obtenez **en plus** du Freemium

- **Mémoire de profil 90 jours** (Marcel se souvient de votre situation cross-conversation)
- **10 lookups Pappers/mois** (Théodore peut cartographier votre groupe entier)
- **Recueil patrimonial complet** (10 étapes, vos vrais chiffres importés)
- **Les 11 agents activés** (mais en mode *recommandation*, pas exécution)
- **Export PDF** de vos diagnostics
- **Mail prioritaire à Maxime** (réponse sous 48 h ouvrées)

### Les 11 agents — ce qu'ils font CONCRÈTEMENT

---

#### 🎼 Marcel — Maestro · chef d'orchestre

**Capacités**
- Écoute, qualifie, route vers les bons agents (parallèle si besoin)
- Mémoire 90 j : âge, situation familiale, enfants, statut pro, TMI, préférences
- Web search Anthropic natif (vérif actualités fiscales)
- Tool calling (calculs déterministes + APIs partenaires)
- Multilingue FR / EN / DE

**Modèle** : Claude Sonnet 4.6

**3 cas d'usage Premium**

| Question | Ce que Marcel fait |
|---|---|
| *"Quels droits de succession pour mes 3 enfants si je décède ?"* | Convoque Auguste (calc_droits_succession) + Iris (alternatives donation) → synthèse 1-page |
| *"Combien je peux donner à ma fille sans payer ?"* | Réponse FAQ offline instantanée + suggestion d'optimisation Auguste |
| *"Je voudrais migrer en Belgique, impact patrimoine ?"* | Auguste (fiscalité internationale) + Théodore (restructuration entités) + Hermès (suggère notaire belge) |

**Limites MIF II**
- Jamais "je vous conseille de…" — toujours "voici les options chiffrées"
- Jamais de nom de produit (assurance-vie X, fonds Y)
- Citation systématique des articles CGI pour chaque chiffre
- Disclaimer final sur les réponses à enjeu

---

#### 📐 Théodore — Bâtisseur · structuration patrimoniale

**Capacités**
- Cartographie 360° des entités (sociétés, holdings, SCI, comptes, biens, collections)
- Identification des angles morts (entités manquantes, parts indéterminées)
- Propositions de regroupement / création de holding / fusion SCI / démembrement
- Allocation cible vs allocation réelle

**Modèle** : Claude Opus 4.7 (raisonnement structurel complexe)

**Tools** : `pappers_lookup`, `recueil_load`, `entities_graph`, `simulate_structure`

**3 cas d'usage Premium**

| Situation | Ce que Théodore livre |
|---|---|
| Vous saisissez le SIREN de votre holding | Carto complète : filiales, % de détention, dirigeants, capital · graphique exportable PDF |
| Vous voulez racheter votre société à une holding | Simulation 3 schémas : apport-cession 150-0 B ter, holding pure, leveraged buy-out — comparaison chiffrée |
| Vous avez 4 SCI éclatées | Théodore détecte la complexité (4 baux, 4 comptables, 4 AG/an) → propose une SCI faîtière |

**Ce qu'il NE fait PAS en Premium** : pas de rédaction d'actes, pas de contact notaire, pas d'exécution. **Propose, ne déclenche pas**.

---

#### 🏛 Auguste — Codex · juridique & fiscal

**Capacités**
- Calculs fiscaux déterministes 2025-2026 (IR, IFI, PV immo, succession, Dutreil, 150-0 B ter, PER) via serveur propriétaire `ikcp-mcp` hébergé à Paris
- Veille Légifrance + BOFIP temps réel
- Citation systématique : *"art. 779 I CGI · barème LF 2026"*
- Prépare des **brouillons** de note juridique (à valider par Maxime)

**Modèle** : Claude Opus 4.7 (raisonnement juridique nuancé)

**3 cas d'usage Premium**

| Question | Ce qu'Auguste retourne |
|---|---|
| *"IR avec 120 k€ de revenus, marié 2 enfants ?"* | calc_ir_2026 → 14 320 € · TMI 30 % · barème complet · art. 197 CGI |
| *"Stratégie succession 2 M€ patrimoine, 3 enfants ?"* | 3 schémas comparés : sans anticipation (380 k€ droits) · donation 100 k€/enfant tous 15 ans (-300 k€) · démembrement résidence principale (-180 k€) |
| *"Pacte Dutreil sur ma holding, ça marche ?"* | Vérifie engagement collectif, exonération 75 %, économie chiffrée + sources art. 787 B CGI |

**Limites MIF II**
- Calcule mais ne **recommande pas** : "voici 3 options chiffrées, à choisir avec votre conseil"
- Tout document à signature requiert validation Maxime
- Aucun nom de produit financier

---

#### 📈 Léon — Stratège · marchés financiers

**Capacités**
- Lit votre allocation actuelle (anonymisée — pas de noms de fonds)
- Alertes drawdown automatiques (>5 % sur une poche)
- News macro filtrées par vos positions
- Propose des arbitrages — **mais ne les exécute pas**

**Modèle** : Claude Sonnet 4.6

**Tools** : `portfolio_state`, `quote_isin`, `market_news`, `drawdown_calc`, `rebalancing_plan`

**3 cas d'usage Premium**

| Question / événement | Ce que Léon livre |
|---|---|
| *"Mon PEA est à -8 %, je vends ?"* | Analyse drift vs cible + recommandation rebalancing (pas vendre, mais ajuster) |
| BCE annonce remontée des taux | Push alerte : "Impact estimé sur votre poche oblig : -2 % à 6 mois. 3 actions possibles." |
| Trimestre fini | Léon livre une note d'opportunité 1-page : poches sur-pondérées · poches sous-pondérées · arbitrage cible |

**Ce qu'il NE fait PAS en Premium** : pas d'exécution. Vous gardez la main sur votre courtier / banque privée.

---

#### 💎 Joséphine — Concierge · voyages & événements

**Capacités**
- Préférences mémorisées dans un vault chiffré (vue mer/montagne, allergies, langues, dress code)
- Recherche hôtels premium (Five Star Alliance, Mr & Mrs Smith, Relais & Châteaux)
- Jets privés (NetJets, VistaJet à la demande)
- Restaurants étoilés (Resy Concierge)
- Événements privés (opéra, festivals, places exceptionnelles)

**Modèle** : Claude Haiku 4.5 (recherche + scoring rapide, coût faible)

**3 cas d'usage Premium**

| Demande | Ce que Joséphine livre |
|---|---|
| *"3 nuits Megève en février, famille 4, suite spa"* | 2 options scorées : Fermes de Marie (0,94) vs Four Seasons (0,91) avec justification |
| *"Bayreuth Festival août 2027 ?"* | Waitlist + calendrier · prix · process · stratégie d'obtention |
| *"Chef privé à la maison pour 12 le 24 décembre"* | 3 chefs proposés avec menus + tarifs |

**Ce qu'elle NE fait PAS en Premium** : pas de réservation directe ni paiement. Vous recevez les options, vous bookez vous-même. **Sur-mesure = elle réserve, Camille débite la CB stockée.**

---

#### 🎨 Émile — Curateur · art & collections

**Capacités**
- Cotes Artprice + Artnet
- Suivi auctions Sotheby's / Christie's / Drouot / Phillips / Bonhams (alertes lots)
- Valorisation pour déclaration IFI
- Vérification provenance (chaîne de propriété)
- Recommandations d'experts indépendants

**Modèle** : Claude Sonnet 4.6

**3 cas d'usage Premium**

| Question | Ce qu'Émile retourne |
|---|---|
| *"Combien vaut mon Picasso de 1955 ?"* | Estimation 380-450 k€ · 12 ventes comparables · source Artprice |
| *"Je veux vendre ma collection : Sotheby's ou Christie's ?"* | Comparatif frais (acheteur/vendeur), expertises gratuites, calendrier ventes |
| Déclaration IFI annuelle | Liste de votre collection avec valorisation à jour · prête pour Auguste (déclaration art. 977 CGI) |

**Ce qu'il NE fait PAS en Premium** : pas de représentation aux ventes (Sur-mesure via Hermès).

---

#### 🗝 Hélène — Foncier · immobilier

**Capacités**
- Estimation par DVF (data.gouv) + MeilleursAgents
- Recherche d'acquisitions (selon vos critères : ville, type, ticket)
- Yield locatif (brut, net, après IFI)
- Gestion locative (suivi loyers, vacance, travaux)
- Vue cadastrale (IGN)

**Modèle** : Claude Sonnet 4.6

**3 cas d'usage Premium**

| Situation | Ce qu'Hélène livre |
|---|---|
| *"Combien vaut ma villa à Cap-Ferret ?"* | Estimation 5,7-6,1 M€ · 9 transactions DVF comparables 12 derniers mois |
| *"Acheter un T3 à Lyon comme placement"* | 4 biens shortlistés · yield 3,2-4,1 % net · financement Lombard envisageable |
| Locataire impayé | Plan d'action 30 j : mise en demeure, recours conciliateur, assignation — coord avocat (Hermès) |

**Ce qu'elle NE fait PAS en Premium** : pas de mandat de recherche, pas de gestion locative en propre. Recommandations + coordination uniquement.

---

#### 🪴 Augustin — Capital · private equity

**Capacités**
- Sourcing deals (Pitchbook, Crunchbase, Dealroom) — selon votre thèse
- Due diligence simplifiée (fondateurs, marché, traction, term sheet)
- Dette privée, club deals
- Suivi performance portefeuille (TRI, IRR, NAV)

**Modèle** : Claude Sonnet 4.6

**3 cas d'usage Premium**

| Situation | Ce qu'Augustin livre |
|---|---|
| *"On me propose un Series A à 50 k€, je signe ?"* | Due dil 2 pages : team, marché, term sheet, alignement intérêts, risques |
| *"Mon fonds VC fait un capital call de 25 k€"* | Analyse impact cash flow + rappel échéance Camille |
| *"Sortie d'un investissement à 300 k€ : optimiser la PV ?"* | Coord Auguste pour 150-0 B ter (réinvestissement obligatoire) |

**Ce qu'il NE fait PAS en Premium** : pas de placement direct, pas de négociation term sheet. Aide à la décision uniquement.

---

#### 📋 Camille — Intendance · family secretary

**Capacités**
- Calendrier des échéances (fiscales, financières, contractuelles)
- Rappels automatiques (J-30, J-7, J-1)
- Brouillons de courriers sensibles (notaire, banque, administration)
- Archivage des documents importants

**Modèle** : Claude Haiku 4.5

**3 cas d'usage Premium**

| Tâche | Ce que Camille fait |
|---|---|
| Acompte IFI dans 14 j | Rappel push J-7 et J-1 + lien pré-rempli déclaration |
| *"Écrire à ma banque pour clôturer un compte"* | Brouillon courrier à valider · accusé de réception · suivi |
| Conserver un acte notarié signé | Stockage chiffré · indexation · rappel renouvellement si applicable |

**Ce qu'elle NE fait PAS en Premium** : pas d'archivage qualifié eIDAS (Sur-mesure). Pas de paiement automatique de factures (Sur-mesure).

---

#### 🕊 Iris — Mécène · philanthropie & impact

**Capacités**
- Cartographie des structures philanthropiques (FRUP, abritée, fonds de dotation)
- Sélection de causes alignées avec vos valeurs
- Simulation défiscalisation (66 % IR, 75 % IFI)
- Mesure d'impact (KPI, reporting trimestriel)

**Modèle** : Claude Sonnet 4.6

**3 cas d'usage Premium**

| Question | Ce qu'Iris livre |
|---|---|
| *"Donner 50 k€ aux Restos du Cœur"* | Calcul défiscal : 33 k€ d'IR récupérés + suggestion structure si récurrent |
| *"Créer une fondation famille"* | Comparatif 3 structures · coût de mise en place · délais · gouvernance |
| Reporting annuel | Bilan d'impact des dons : N bénéficiaires, KPI ciblés · prêt à montrer en CA familial |

---

#### 📓 Olympe — Vigie · reporting & synthèse

**Capacités**
- Consolidation multi-actifs (toutes vos entités + perso + AV + PE + immo)
- Synthèse trimestrielle automatique (4 pages PDF)
- Alertes seuils (allocation drift, drawdown, échéance)
- Dashboard live temps réel

**Modèle** : Claude Sonnet 4.6

**3 cas d'usage Premium**

| Périodicité | Ce qu'Olympe livre |
|---|---|
| Trimestriel | Synthèse Q : performance globale, allocations, échéances, alertes, opportunités (4 p PDF) |
| Temps réel | Dashboard `/salon` avec KPI vivants : patrimoine consolidé, liquidités, dossiers ouverts |
| Sur déclencheur | Alerte instantanée si seuil franchi (ex : poche actions US >32 % de l'allocation totale) |

---

#### 🤝 Hermès — Émissaire · vers les métiers extérieurs (PROPOSE en Premium)

**Capacités**
- Annuaire qualifié de partenaires (notaires, avocats, experts-comptables, banquiers privés)
- Templates emails par métier (vocabulaire adapté)
- Coordination dossiers multi-partie
- Tracage des échanges (audit log)

**Modèle** : Claude Haiku 4.5

**3 cas d'usage Premium**

| Situation | Ce qu'Hermès **propose** |
|---|---|
| Vous devez briefer votre notaire sur une cession | Email préparé avec PJ Auguste · vous l'envoyez vous-même |
| Cession société : coord notaire + avocat + expert-compta | Suggestion d'agenda commun · vous bookez le Calendly |
| Contacter Sotheby's pour vente | Template d'introduction + dossier provenance Émile |

**🔑 Différence clé Premium vs Sur-mesure** : en Premium, Hermès **rédige et propose**. Vous envoyez vous-même. En Sur-mesure, **Hermès envoie en votre nom**, avec Maxime en CCi.

---

### Synthèse Premium 290 €/mois

| Brique | Inclus |
|---|---|
| **Marcel** illimité (chat) + mémoire 90 j | ✓ |
| **11 agents** activés en mode recommandation | ✓ |
| **10 lookups Pappers**/mois | ✓ |
| **Recueil patrimonial complet** importé | ✓ |
| **Synthèse trimestrielle** Olympe (PDF) | ✓ |
| **Export PDF** de diagnostic | ✓ |
| **Mail prioritaire** Maxime · réponse 48 h ouvrées | ✓ |
| **Pas** de validation humaine systématique | ⛔ Sur-mesure |
| **Pas** d'exécution (Joséphine ne réserve pas, Hermès n'envoie pas) | ⛔ Sur-mesure |
| **Pas** d'archivage eIDAS qualifié | ⛔ Sur-mesure |
| **Pas** de RDV mensuel Maxime garanti | ⛔ Sur-mesure |

→ Premium = *"vous comprenez votre patrimoine, vous décidez, vous agissez."*

---

## 4. Tier 3 — Family Office Sur-mesure (Bespoke)

### Les 5 vraies différences vs Premium

#### Différence #1 — Validation humaine systématique de Maxime

Tout livrable réglementaire (DER, Lettre de Mission, Rapport d'Adéquation, note Dutreil, etc.) est **lu, validé et signé** par Maxime avant transmission. Trace eIDAS conservée 10 ans. C'est ce qui rend le service **MIF II / DDA-compliant** côté distribution de produits patrimoniaux.

→ **Conformité MIF II garantie par un humain qualifié.** Pas par l'IA.

#### Différence #2 — Exécution, pas seulement recommandation

| En Premium | En Sur-mesure |
|---|---|
| Joséphine propose 2 options Megève | Joséphine réserve · Camille débite · Hermès confirme |
| Hermès rédige l'email au notaire | Hermès envoie en votre nom (Maxime CCi) · suit la réponse |
| Hélène suggère vendre Cap-Ferret | Hélène signe mandat avec agence · Hermès coord notaire · Camille suit acte |
| Émile estime ma collection | Émile représente aux ventes Sotheby's · Hermès négocie commission |

→ **Vous arrivez le matin, l'équipage a déjà avancé pendant la nuit.**

#### Différence #3 — Espace dossiers chiffré multi-comptes liés

- 1 dossier = 1 famille avec **N comptes liés** (vous + conjoint + enfants ayant-droit)
- Permissions granulaires par membre (vous voyez tout, vos enfants voient leur périmètre)
- Archivage **eIDAS qualifié** 10 ans (Universign, Scaleway fr-par)
- Stockage R2 chiffré at-rest + transit TLS 1.3
- Audit log complet (qui, quand, quoi, ancienne valeur)

→ **Une coffre-fort patrimonial familial qui survit à votre éventuelle indisponibilité.**

#### Différence #4 — RDV mensuel Maxime garanti

- 1 RDV de 45-60 min par mois, Calendly prioritaire, présence Maxime garantie
- Préparation par Marcel + Olympe : ordre du jour, dossiers chauds, décisions à prendre
- Comptes rendus archivés eIDAS
- Suivi des actions entre 2 RDV par Camille

→ **Vous avez un CGP qui vous connaît. Pas juste une plateforme.**

#### Différence #5 — Lettre de mission CGP signée + couverture RC Pro

- Lettre de mission classique CGP / CIF / COA signée Maxime
- Mission étendue au numérique notifiée à l'assureur RC Pro
- Conformité ACPR / AMF / ORIAS sur la distribution
- Vous bénéficiez du **statut juridique de client conseillé**, pas d'utilisateur SaaS

→ **Vous êtes client d'un cabinet régulé, pas abonné à un outil.**

### Prix Sur-mesure

- **Forfait annuel** : 6 800 €/an (566 €/mois facturés annuellement)
- **+ honoraires variables** sur opérations spécifiques (cessions, structurations, due-dil PE) facturés au temps passé Maxime
- **Pas de rétro-commissions** (différenciateur IKCP : 100 % indépendant)

À comparer à :
- Family office multi-family classique : 25 000 - 80 000 €/an de frais fixes + % AUM
- Cyrus Herez, ODDO BHF FO, Lazard Frères Gestion : non publié, mais > 50 k€/an
- AFFO × EDHEC NextGen : 6 500-7 500 €/an (mais formation seule, sans accompagnement)

→ **Positionnement IKCP : prix accessibles + accompagnement complet + IA. Le ticket d'entrée FO le plus bas du marché premium FR.**

---

## 5. Comparatif visuel synthétique

### Marcel + les 11 agents — capacités par tier

| Agent | Freemium | Premium 290 €/mois | Family Office Sur-mesure |
|---|---|---|---|
| 🎼 **Marcel** | Pédago générique · 30 msg | Personnalisé · mémoire 90 j · illimité | Personnalisé · mémoire permanente · illimité |
| 📐 **Théodore** | — | Cartographie · 10 Pappers/mois | Cartographie illimitée · plans de restructuration validés Maxime |
| 🏛 **Auguste** | Simulateurs publics | 7 calculateurs fiscaux 2025/2026 + veille | + brouillons d'actes validés Maxime · DER/LM/RA générés |
| 📈 **Léon** | — | Allocation + alertes + recommandations | + propositions arbitrages soumises Maxime · arbitrages exécutés |
| 💎 **Joséphine** | — | Recommandations 2 options scorées | **Réserve + paye + confirme** |
| 🎨 **Émile** | — | Estimation + cotes + IFI | + **représentation aux ventes** via Hermès |
| 🗝 **Hélène** | — | Estimation DVF + recherche | + **mandats signés** + coord notaire/avocat |
| 🪴 **Augustin** | — | Sourcing + due dil + suivi NAV | + **club deals coordonnés** Maxime |
| 📋 **Camille** | — | Rappels + brouillons courriers | + **paiements auto** + archivage eIDAS qualifié |
| 🕊 **Iris** | — | Structuration + défiscal + impact | + **mise en place fondation** coord notaire |
| 📓 **Olympe** | — | Synthèse Q (PDF) + dashboard | + reporting annuel + AG familiale + tableau de bord live multi-membres |
| 🤝 **Hermès** | — | **Propose** templates emails | **Envoie en votre nom** + suit + archive |

### Engagement humain Maxime

| | Freemium | Premium | Sur-mesure |
|---|---|---|---|
| Réponse mail | — | < 48 h ouvrées | < 24 h |
| Validation livrable réglementaire | — | À la demande | **Systématique** |
| RDV mensuel | — | À la demande, payant | **Garanti, inclus** |
| Lettre de mission CIF/COA | — | — | **Signée** |
| Conseil produit (= rémunéré) | — | — | **Oui** (commissions rétrocédées 100 %) |

---

## 6. Questions ouvertes à trancher

| # | Question | Mon opinion |
|---|---|---|
| 1 | **Premium à 290 €/mois ou 199 €/mois ?** | 290 € pour positionnement clair. 199 € attire plus mais dévalue la perception. Test sur 50 bêta-testeurs. |
| 2 | **Sur-mesure : forfait 6 800 €/an ou % AUM ?** | **Forfait** pour démarrer (lisible). % AUM optionnel pour > 10 M€ (alignement intérêts). |
| 3 | **Hermès en Premium : propose ou n'apparaît pas ?** | **Apparaît mais ne déclenche rien**. Le simple fait que Hermès rédige montre la valeur du Sur-mesure. |
| 4 | **Camille Premium : rappels + brouillons. Sur-mesure : paiements auto ?** | Oui. Le différenciateur "ne plus s'occuper de rien" est central. |
| 5 | **Recueil patrimonial : Premium ou Sur-mesure ?** | **Premium**. Sans recueil, l'IA n'est pas personnalisée — donc Premium n'a pas de valeur. |
| 6 | **Mémoire Marcel : 90 j Premium · permanente Sur-mesure ?** | Oui — c'est un différenciateur subtil mais réel. |
| 7 | **Mois offert en bêta puis bascule auto Premium ?** | Non. **Bêta gratuite 6 mois explicite** puis choix manuel (Premium ou Sur-mesure ou rien). Pas de piège. |
| 8 | **Tarif Founder -50 % à vie pour les 50 bêta-testeurs ?** | Oui. Contractualisé. C'est le coût d'acquisition. |

---

## 7. Recommandations stratégiques

### Pour Premium 290 €/mois — ce qui fait basculer

1. **La synthèse trimestrielle Olympe** (4 pages PDF que personne ne produit ailleurs)
2. **La cartographie Théodore** via Pappers (effet "waouh" de la première démo)
3. **Marcel personnalisé** avec mémoire 90 j (le visiteur sent qu'on le connaît)
4. **Le mail prioritaire à Maxime** (réassurance humaine derrière l'IA)

→ Ces 4 bénéfices sont **suffisamment concrets pour justifier 290 €/mois face à un comptable à 80 €/mois ou un avocat fiscal à 300 €/h**.

### Pour Sur-mesure — ce qui fait basculer

1. **Exécution complète** (Joséphine réserve, Hermès envoie, Camille paye)
2. **Validation humaine Maxime systématique** (le seul moyen d'être MIF II compliant à 100 %)
3. **Espace dossiers chiffré multi-comptes liés** (famille étendue, transmission)
4. **RDV mensuel garanti** (relation humaine)
5. **Lettre de mission CGP** (cadre juridique solide)

→ À ~6 800 €/an, c'est **8 × moins cher** que tout autre family office équivalent. C'est l'argument massif.

### Roadmap de construction d'offre

1. **Cette semaine** : valider les 8 questions ouvertes (§6) avec Maxime
2. **Semaine prochaine** : rédiger la page `proposals/espaces-fo-detaillee.html` avec toutes ces capacités visibles
3. **Avant lancement bêta** : produire 1 cas d'étude E2E par tier (Joséphine D. en Premium + Famille D. en Sur-mesure) — vidéo + écrit
4. **Bêta** : tester sur 50 familles, mesurer ce qui justifie réellement le passage Premium → Sur-mesure
5. **Post-bêta** : ajuster les frontières entre les 3 tiers

---

## 8. Synthèse

| | Freemium | Premium | Sur-mesure |
|---|---|---|---|
| Promesse | *Goûter* | *Outiller* | *Accompagner* |
| Marcel + agents | Basique | Personnalisé · 11 agents recommandent | + Exécution + validation humaine |
| Engagement humain | — | Mail prio 48 h | RDV mensuel + LM + RC Pro |
| Prix | 0 € | 290 €/mois | 6 800 €/an + variable |
| Valeur perçue | Test pédagogique | "Mon CGP digital" | "Mon Family Office" |
| Concurrent direct | MOOC / chatbot fiscal | Comptable + simulateurs en ligne | MFO 25-80 k€/an |

L'offre tient. La technique aussi. Ce qui manque, c'est **l'exécution de l'offre** sur les 50 premières familles bêta. Le reste se résout.

---

*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial*
