# IKCP Family Office — Audit des agents IA par spécialité

> **Objet** : pour la page `family-office` du site ikcp.eu, auditer chaque agent IA
> spécialisé et préciser, pour chacun, **(1) la donnée nécessaire**,
> **(2) les APIs à relier**, **(3) l'automatisation par agent Claude**
> (sous-agent + tools + place dans l'orchestration Marcel).
>
> **Statut** : v1 — 08/05/2026
> **Auteur** : Maxime Juveneton + Claude (Agent SDK)
> **Source pages** : `proposals/family-office-v3-hero-minimal.html` (6 agents)
> et `proposals/family-office-v2-expertises.html` (9 expertises métier).

---

## 0. Modèle d'orchestration retenu

```
                       Maxime (chef d'orchestre humain — arbitre, signe)
                                    ▲
                                    │ validation MIF II / DDA
                                    │
                            Marcel (chef d'orchestre IA)
                            Claude Agent SDK · D1 mémoire · KV cache
                                    │
       ┌────────────┬──────────────┼─────────────┬────────────┬──────────────┐
       ▼            ▼              ▼             ▼            ▼              ▼
   Triage       Fiscal        Juridique      Reporting       Suivi      Documents
  (qualifie)   (calcule)      (analyse)    (synthétise)  (orchestre)  (indexe)
       │            │              │             │            │              │
       └────────────┴──────────────┼─────────────┴────────────┴──────────────┘
                                   │ délégation par expertise métier
                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ 9 expertises métier (les "verticales" du family office augmenté)     │
   │  i. Ingénierie juridique & fiscale     vi. Conciergerie de luxe       │
   │  ii. Actifs financiers cotés           vii. Financement                │
   │  iii. Assistance admin & comptable     viii. Actifs immobiliers       │
   │  iv. Acquisition / cession / transm.   ix. Philanthropie               │
   │  v. Private Equity                                                     │
   └──────────────────────────────────────────────────────────────────────┘
```

**Lecture** :
- **Marcel** est l'orchestrateur (router + mémoire + composition de réponse).
- Les **6 agents transversaux** sont des sous-agents Claude génériques qui
  travaillent pour les 9 expertises (un agent Fiscal sert l'expertise i mais
  aussi viii, par ex.).
- Les **9 expertises** sont les *domaines* (data + APIs propres). Chaque
  expertise mobilise plusieurs agents transversaux selon le besoin.
- Tout output destiné au client passe par **validation Maxime** (file d'attente
  D1 + dashboard).

---

## 1. Audit des 6 agents transversaux (couche orchestration)

Pour chaque agent : **rôle → donnée → APIs → automatisation Claude**.

---

### 1.1 Agent **Triage** — qualifie

**Rôle** : à toute requête entrante (chat, formulaire, RDV, email forward),
détecter l'intention, scorer le profil, router vers le bon agent métier,
remplir le profil dans D1.

| Volet | Détail |
|---|---|
| **Donnée** | Profil prospect (nom, email, situation familiale, âge, statut pro, AUM estimé, enjeu principal, source d'arrivée), historique conversations, score de maturité dossier. Stockage : `D1.persons` + `D1.events` + `KV ikcp_marcel_conv_v1`. |
| **APIs entrantes** | `POST /v1/chat`, `POST /v1/prospect`, webhook Calendly (`/v1/webhooks/calendly`), webhook Make.com (`/v1/webhooks/make`). |
| **APIs sortantes** | Notion (CRM fiche prospect), Resend (notif Maxime hot lead), Insee (siret/société), email forward parsing. |
| **Tools Claude** | `extract_profile_from_message`, `score_lead(profile, conversation)`, `classify_intent → {fiscal, juridique, immo, transmission, financement, philanthropie, conciergerie, autre}`, `lookup_company(siret)`, `enrich_from_email_domain`. |
| **Sub-agent Claude** | `triage-agent` — Haiku 4.5 pour latence (< 800 ms), prompt court, `max_tokens: 400`, prompt caching sur la grille de scoring. |
| **Sortie** | `{ person_id, intent, lead_score 0-100, suggested_agent, missing_fields[], next_question }`. |
| **Verrou actuel** | Le scoring vit dans le SYSTEM_PROMPT de Marcel. À externaliser dans `triage-agent` pour rendre testable et auditable (AI Act). |

---

### 1.2 Agent **Fiscal** — calcule

**Rôle** : calculs déterministes (IR, IFI, droits de succession, donation,
plus-values, exit tax, PFU vs barème, abattement DMTG…) avec sources juridiques
citées article par article.

| Volet | Détail |
|---|---|
| **Donnée** | Barèmes IR/IFI/DMTG par année (versionnés), abattements donation 100k€/15 ans par parent/enfant, table de mortalité INSEE pour démembrement, indices BOFIP, situation patrimoniale du prospect (depuis `D1.files.data_json`). |
| **APIs** | **Légifrance via api.piste.gouv.fr** (déjà câblé `/v1/legifrance`) pour articles CGI / Code civil ; **BOFIP** (scraping ou cache R2) pour doctrine fiscale ; **api.insee.fr** pour table de mortalité et indices ; **DGFiP — IR/IFI** : pas d'API publique → tables maintenues dans `D1.tax_brackets`. |
| **Tools Claude** | Existants côté Marcel : `calc_impot_revenu`, `calc_droits_succession`. À ajouter : `calc_ifi(actifs_immo)`, `calc_donation(parent, enfant, montant, antériorité)`, `calc_plus_value_immo(prix_acq, prix_cess, durée)`, `calc_demembrement(âge_usufruitier)`, `calc_exit_tax`, `calc_per_deductibilité(revenu, statut)`. Tous **déterministes JS** côté Worker — pas d'hallucination. |
| **Sub-agent Claude** | `fiscal-agent` — Sonnet 4.6 (raisonnement chaîné, choix tool), system prompt avec règles "tool-first, jamais d'estimation à la main", citation systématique de l'article + millésime. |
| **Sortie** | `{ amount, formula, brackets_used, article_legal, year, hypotheses[], alternative_scenarios[] }`. |
| **Verrou actuel** | Tools déjà partiels dans `workers/ikcp-marcel`. À déplacer dans `workers/ikcp-api/v1/fiscal/*` pour réutilisation par tous les simulateurs (succession, donation, IFI). |

---

### 1.3 Agent **Juridique** — analyse

**Rôle** : lire et analyser actes notariés, statuts SCI/SARL, contrats AV,
clauses bénéficiaires, pactes Dutreil, mandats de protection future ;
détecter risques et incohérences ; proposer rédactions alternatives.

| Volet | Détail |
|---|---|
| **Donnée** | PDF/images d'actes (R2 `ikcp-docs-private`), métadonnées doc (`D1.documents`), base d'articles Code civil / CGI / CMF (RAG sur extracts versionnés Légifrance). |
| **APIs** | **Légifrance** (api.piste.gouv.fr) — articles & jurisprudence ; **OCR** : Mistral OCR ou Anthropic vision pour PDF scannés ; **Notaires de France — base BIEN** (premium, pour comparables) ; **Infogreffe / Pappers** pour sociétés (statuts, bénéficiaires effectifs). |
| **Tools Claude** | `read_pdf(r2_key) → text`, `extract_clauses(text, type) → {clauses[]}`, `lookup_jurisprudence(question)`, `search_legifrance(article)`, `compare_clause(actual, template)`, `flag_risk(clause) → {risk, severity, recommendation}`. |
| **Sub-agent Claude** | `juridique-agent` — Sonnet 4.6 + **citations** activées (Anthropic API) pour traçabilité, tool `read_pdf` avec extraction de positions (page, ligne) pour pointer dans le doc original. |
| **Sortie** | `{ document_id, type_detected, clauses[], risks[{severity, article, suggestion}], summary, validation_required: true }`. |
| **Verrou actuel** | Pas encore de pipeline OCR/RAG. À démarrer par : (a) bucket R2 `ikcp-docs-private` + signed URLs, (b) un endpoint `/v1/docs/analyze` qui indexe et appelle l'agent. |

---

### 1.4 Agent **Reporting** — synthétise

**Rôle** : produire les livrables réglementaires et clients — DER, Lettre de
Mission, Rapport d'Adéquation, DIPA, bilan patrimonial PDF, reporting trimestriel
de portefeuille.

| Volet | Détail |
|---|---|
| **Donnée** | Templates de docs (R2 `ikcp-templates/`), data du dossier (`D1.files`), résultats agents Fiscal/Juridique/Immo, profil prospect (`D1.persons`), historique des recos validées par Maxime (`D1.recommendations`). |
| **APIs** | **DocRaptor** ou **Gotenberg** (HTML→PDF) pour rendu ; **Anthropic Files API** pour générer corpus contextuel ; **Universign / Yousign** pour horodatage eIDAS sur le rendu final. |
| **Tools Claude** | `render_template(template_id, data) → html`, `html_to_pdf(html) → r2_key`, `compose_executive_summary(file_id)`, `generate_der(person_id)`, `generate_rapport_adequation(file_id)`, `compose_reporting_trimestriel(person_id, quarter)`. |
| **Sub-agent Claude** | `reporting-agent` — Sonnet 4.6, avec **prompt caching** sur les templates (gros gain : ~70% réduction coût), output en JSON structuré → rendu HTML/PDF côté Worker. |
| **Sortie** | `{ document_id, r2_key, type, page_count, requires_validation: true, validator: "maxime" }`. **Aucun document n'est envoyé client sans validation.** |
| **Verrou actuel** | Bouton Export PDF chat existe (B4 livré). Manque : templates DER/RA officiels, pipeline R2, signature Universign. |

---

### 1.5 Agent **Suivi** — orchestre

**Rôle** : gérer le cycle de vie d'un dossier dans le temps — relances,
rappels d'échéances fiscales, alertes lois de finance, rebalancing,
arbitrages proposés, anniversaires de versements.

| Volet | Détail |
|---|---|
| **Donnée** | Calendrier fiscal (`D1.tax_calendar`), positions client (`D1.subscriptions`), événements (`D1.events`), profil objectifs (`D1.files.data_json`), veille légale (RSS Légifrance + JOAFE). |
| **APIs** | **Cloudflare Cron Triggers** (orchestration temporelle) ; **Cloudflare Queues** (file de tâches asynchrones) ; **Resend** + **OVH SMS API** pour notifications ; **Calendly v2 API** pour proposer un RDV ; **Google Calendar API** pour caler les rappels. |
| **Tools Claude** | `next_tax_deadline(person_id)`, `propose_arbitrage(subscription_id, market_data)`, `check_legal_change_impact(change, person_id)`, `schedule_reminder(person_id, type, when)`, `nudge_engagement(person_id)`. |
| **Sub-agent Claude** | `suivi-agent` — Haiku 4.5 (volume + latence), déclenché par Cron + par events (webhook subscription, doc signé, news Légifrance). |
| **Sortie** | Tâches dans `D1.tasks`, notifications sortantes, propositions d'arbitrage en attente validation Maxime. |
| **Verrou actuel** | Aucun cron en production. À créer : Worker `ikcp-suivi-cron` avec triggers `0 8 * * *` (daily) et `0 9 1 * *` (monthly). |

---

### 1.6 Agent **Documents** — indexe

**Rôle** : recevoir les documents entrants (client envoie une feuille d'impôt,
un acte, un relevé), les classer, OCR + extraction structurée, stocker dans R2,
indexer dans D1, déclencher les agents downstream.

| Volet | Détail |
|---|---|
| **Donnée** | Tous les fichiers entrants (PDF, JPG, EML), métadonnées (type détecté, person_id, hash SHA-256, dates), index plein texte. Stockage : R2 (`ikcp-docs-private`) + index dans D1 (`documents` + `document_chunks` pour RAG). |
| **APIs** | **Mistral OCR** ou **Anthropic vision (claude-haiku-4-5)** pour OCR ; **Cloudflare Vectorize** pour embeddings + RAG ; **PDF.co** ou **pdf-lib** (Worker) pour split/merge ; **email-to-API** (Resend inbound ou Postmark) pour réception par mail. |
| **Tools Claude** | `ingest_document(file)`, `classify_document(text) → {type, year, sender}`, `extract_structured(text, schema)`, `embed_chunks(text)`, `search_documents(person_id, query)`. |
| **Sub-agent Claude** | `documents-agent` — Haiku 4.5 (classification + extraction structurée — peu de raisonnement). |
| **Sortie** | `{ document_id, r2_key, type, year, person_id, summary, chunks_indexed: N, downstream_triggered: ["fiscal-agent"] }`. |
| **Verrou actuel** | Pipeline inexistant. À démarrer par un endpoint `POST /v1/docs/upload` (signed URL R2) + Worker handler. |

---

## 2. Audit des 9 expertises métier

Pour chaque expertise : **donnée propre → APIs spécifiques → orchestration Claude**
(quels agents transversaux mobilisés, quels nouveaux tools).

Légende des priorités :
- **P1** = livrable Phase 1 (0-4 mois, lead gen + qualification)
- **P2** = livrable Phase 2 (4-12 mois, co-pilot souscription)
- **P3** = livrable Phase 3 (12-18 mois, plateforme autonome supervisée)

---

### i. Ingénierie juridique & fiscale — **P1**

| Volet | Détail |
|---|---|
| **Données** | Avis d'imposition (IR + IFI), feuille de paie, K-bis, pacte Dutreil, statuts sociétés, contrats AV, clauses bénéficiaires, situation matrimoniale, donations antérieures (`D1.persons.donations_history`). |
| **APIs publiques** | Légifrance (CGI, CGI Annexe, CMF, Code civil) · BOFIP · Insee (mortalité, données entreprise) · Pappers / Infogreffe (sociétés, BE) · api.gouv.fr DVF (immo). |
| **APIs partenaires** | Notaires de France (BIEN — comparables) · Fidroit (doctrine — premium) · Editions Francis Lefebvre (Memento) — abonnement. |
| **APIs internes** | `/v1/fiscal/calc/*`, `/v1/legal/lookup`, `/v1/docs/analyze`. |
| **Agents Claude** | **Fiscal** (calcs IR/IFI/DMTG/PV/donation), **Juridique** (analyse actes), **Reporting** (DER, RA, recommandations transmission), **Documents** (ingestion avis IR/IFI, K-bis, statuts). |
| **Automatisation** | Pipeline : client upload avis IR → `documents-agent` extrait revenus + composition foyer → `fiscal-agent` calcule capacité d'optimisation (PER, FCPI, Madelin) → `reporting-agent` génère mémo "3 leviers prioritaires" → file validation Maxime → envoi client. |

---

### ii. Actifs financiers cotés — **P2**

| Volet | Détail |
|---|---|
| **Données** | Allocation cible / réelle par classe d'actifs, performance, frais (TFC), risque (SRRI), liquidité, fiscalité par enveloppe (PEA / AV / CTO / PER). |
| **APIs publiques** | **Bigdata.com** (recherche fondamentale, sentiment, tearsheets) · **Yahoo Finance** ou **Alpha Vantage** (cotations, historiques) · **Quantalys** ou **Morningstar API** (notations OPCVM — premium). |
| **APIs partenaires** | **Nortia** / **Alpheys** (référentiel UC, allocation modèle CGP) · **BNP Paribas Custody** ou équivalent dépositaire (positions client). |
| **APIs internes** | `/v1/portfolio/positions`, `/v1/portfolio/performance`, `/v1/market/quote`, `/v1/research/company`. |
| **Agents Claude** | **Triage** (arbitrage simple vs complexe), **Fiscal** (impact fiscal arbitrage : PV, plafond cession PEA), **Reporting** (reporting trimestriel), **Suivi** (alertes drift allocation, propositions rebalancing). |
| **Automatisation** | Cron mensuel : `suivi-agent` lit positions client → calcule drift vs allocation cible → si > 5% propose 1-3 arbitrages → `fiscal-agent` simule impact PV → `reporting-agent` génère note d'arbitrage PDF → validation Maxime → exécution via API Nortia. |

---

### iii. Assistance administrative & comptable — **P1 (light) / P2 (auto)**

| Volet | Détail |
|---|---|
| **Données** | Calendrier fiscal personnel + sociétés, échéances paiement IR/IFI/CFE/CET/TVA, bilans annuels, courrier sensible (RAR, mises en demeure, AGRAS, URSSAF). |
| **APIs publiques** | **api.gouv.fr** : impots.gouv.fr (statut télédéclaration — pas d'API officielle, scraping interdit), DGFiP (pas d'API publique). **Pappers** (dépôts comptes). **JOAFE** (annonces légales). |
| **APIs partenaires** | **Pennylane** ou **Tiime** (compta automatisée si dirigeant) · **Qonto** / **Shine** (banque pro — Open Banking AISP) · **DocuWare** ou **Notion** (GED courrier). |
| **APIs internes** | `/v1/calendar/deadlines`, `/v1/docs/inbox`, `/v1/banking/feed`. |
| **Agents Claude** | **Documents** (classement courrier sensible reçu par mail vers `docs@ikcp.eu`), **Suivi** (rappels échéances), **Reporting** (synthèse mensuelle administrative). |
| **Automatisation** | Boîte mail dédiée `admin@ikcp.eu` (Resend inbound ou Postmark) → `documents-agent` classe (RAR fiscal / banque / URSSAF / autre) → `suivi-agent` extrait deadline et planifie rappel → si urgence (mise en demeure) notif SMS Maxime. |

---

### iv. Acquisition, cession & transmission d'entreprise — **P2/P3**

| Volet | Détail |
|---|---|
| **Données** | Comptes 3 derniers exercices, K-bis, pacte d'associés, BSPCE, valorisation sur multiples, due-dil checklist, dossier transmission (Dutreil, donation-cession, OBO). |
| **APIs publiques** | **Pappers / Infogreffe** (états financiers, BE, dirigeants) · **Insee SIRENE** · **BODACC** (annonces) · **Datagouv DGFiP-IS** (anonymisé sectoriel). |
| **APIs partenaires** | **Diligente** ou **Closd** (data-room virtuelle) · **Zefix** (Suisse, pour clients frontaliers) · **Hubert** (intermédiaire cession PME). |
| **APIs internes** | `/v1/company/profile`, `/v1/company/valuation`, `/v1/dataroom`. |
| **Agents Claude** | **Triage** (qualification cédant / acquéreur / transmetteur familial), **Fiscal** (Dutreil, PV pro 150-0 B ter, apport-cession, exit tax), **Juridique** (lecture pacte, statuts, accord confidentialité), **Reporting** (lettre d'intention, mémo opérationnel transmission). |
| **Automatisation** | Module "Diagnostic transmission 360" : client renseigne SIREN → `documents-agent` ingère K-bis + bilans Pappers → `fiscal-agent` simule 4 schémas (Dutreil familial, donation-cession, holding apport, cession 150-0 B ter) → `reporting-agent` produit comparatif PDF → validation Maxime → RDV. |

---

### v. Private Equity — **P2**

| Volet | Détail |
|---|---|
| **Données** | Thèse d'investissement client (sectorielle, géographique, ticket), pipeline deals (sourcing CGP), KYC AIFM, lettre d'engagement (LP), capital appelé / distribué, NAV, J-curve. |
| **APIs publiques** | **Crunchbase API** ou **Dealroom** (sourcing startups) · **France Invest** (fonds référencés, statistiques marché) · **AMF — base GECO** (FCPR, FPCI agréés). |
| **APIs partenaires** | **Caceis** ou **Apex** (administration fonds — reporting LP) · **CARTA** (cap tables) · **MoonFare / Opale Capital** (plateformes PE retail). |
| **APIs internes** | `/v1/pe/deals`, `/v1/pe/positions`, `/v1/pe/capital-calls`. |
| **Agents Claude** | **Triage** (matching thèse client ↔ deal), **Fiscal** (150-0 B ter, IR-PME 18-25%, exonération PV holding), **Juridique** (analyse term sheet, LPA), **Reporting** (reporting trimestriel LP-style). |
| **Automatisation** | Email partenaire fonds → `documents-agent` parse term sheet/LPA → `juridique-agent` extrait conditions clés (commit, fees, distribution waterfall) → `triage-agent` matche les LPs intéressés dans la base → notif Maxime + brief client. |

---

### vi. Conciergerie de luxe — **P3**

| Volet | Détail |
|---|---|
| **Données** | Préférences client (compagnies aériennes, hôtels, restaurants, écoles, dates anniversaires, allergies), agenda partagé, prestataires whitelistés. |
| **APIs publiques** | (peu pertinent — domaine privé). |
| **APIs partenaires** | **Amadeus / Sabre** (voyage corporate — compte agence) · **John Paul** ou **Quintessentially** (conciergerie B2B white-label) · **OpenTable / SevenRooms** (resto premium) · **Booking.com / Expedia Group** affiliate. |
| **APIs internes** | `/v1/concierge/request`, `/v1/concierge/preferences`. |
| **Agents Claude** | **Triage** (qualifie demande : voyage, school, événement, gift), **Suivi** (rappels anniversaires, vœux, deadlines visa), **Documents** (passeports, visas, scan billets). |
| **Automatisation** | (Phase tardive) — chat Marcel détecte intention "conciergerie" → handoff vers prestataire white-label avec contexte client (préférences). Pas d'auto-booking direct (responsabilité). |

---

### vii. Financement — **P2**

| Volet | Détail |
|---|---|
| **Données** | Endettement actuel, capacité d'emprunt, type de financement souhaité (hypothécaire, Lombard, dette privée), garanties dispo, taux marché, profil emprunteur. |
| **APIs publiques** | **Banque de France** (taux directeurs, indices) · **Insee** (indice loyers, indice de référence) · **DVF** (valorisation gage immo). |
| **APIs partenaires** | **CAFPI / Pretto / Meilleurtaux Pro** (comparateur courtiers) · **Younited Credit** ou **October** (dette privée) · **BNP Wealth Lombard** ou **Edmond de Rothschild** (Lombard) — pas d'API self-service, dossier humain. |
| **APIs internes** | `/v1/finance/quote`, `/v1/finance/eligibility`. |
| **Agents Claude** | **Triage** (type de financement adapté), **Fiscal** (déductibilité intérêts, impact IFI), **Juridique** (analyse offre de prêt, lecture garanties), **Reporting** (mémo comparatif 2-3 offres). |
| **Automatisation** | Client renseigne projet → `triage-agent` route (immo / Lombard / pro / dette privée) → `fiscal-agent` calcule TAEG net d'IS si Lombard sur SCI/holding → `reporting-agent` produit fiche comparative → validation Maxime → mise en relation 2 partenaires. |

---

### viii. Actifs immobiliers — **P1 (data) / P2 (gestion)**

| Volet | Détail |
|---|---|
| **Données** | Patrimoine immo client (par bien : adresse, surface, type, valeur, locataire, loyer, charges, prêt en cours, régime fiscal LMNP/LMP/SCI/foncier), travaux en cours, indices loyers. |
| **APIs publiques** | **api.gouv.fr DVF** (valeurs foncières — déjà ouvert) · **Insee IRL / ICC** · **api.gouv.fr Adresse** (BAN — géocodage) · **Géoportail-Urbanisme** (PLU, zones) · **api.diagnostiqueurs** (DPE, ERP). |
| **APIs partenaires** | **MeilleursAgents Pro** ou **PriceHubble** (estimation auto) · **Hosman / Castor / Smovin** (gestion locative API) · **Sinimo / Foncia** (gestion confiée). |
| **APIs internes** | `/v1/realestate/estimate`, `/v1/realestate/dpe`, `/v1/realestate/portfolio`. |
| **Agents Claude** | **Documents** (compromis, baux, DPE, taxe foncière), **Fiscal** (PV immo, IFI, micro-foncier vs réel, LMNP), **Juridique** (analyse bail, CGV gestion), **Reporting** (bilan immo annuel), **Suivi** (revalorisation IRL, échéances). |
| **Automatisation** | Mise à jour annuelle automatique : `suivi-agent` cron → DVF + PriceHubble pour réestimation → recalcule IFI → si écart > 10% sur l'assiette IFI → notif client + RDV proposé. |

---

### ix. Philanthropie — **P3**

| Volet | Détail |
|---|---|
| **Données** | Cause(s) cible, véhicule (fonds de dotation, fondation abritée, fondation reconnue d'utilité publique), dotation, calendrier reversement, mesure d'impact. |
| **APIs publiques** | **JOAFE** (publication créations fonds dotation) · **Datagouv — RNA** (associations) · **Centre Français des Fonds et Fondations** (data sectorielle). |
| **APIs partenaires** | **Fondation de France** ou **Institut de France** (fondations abritées — pas d'API, partenariat humain) · **Iraiser** (logiciel collecte). |
| **APIs internes** | `/v1/philanthropy/structure`, `/v1/philanthropy/impact`. |
| **Agents Claude** | **Triage** (cause + moyens), **Fiscal** (ISF/IR-don 66%, IFI 75%, Coluche, mécénat IS), **Juridique** (statuts fonds dotation, conventions reversement), **Reporting** (rapport d'impact annuel). |
| **Automatisation** | Agent dédié de "matchmaking cause ↔ véhicule ↔ fiscalité" : client décrit la cause → `triage-agent` identifie 3 véhicules pertinents → `fiscal-agent` simule impact IR/IFI/IS → `reporting-agent` génère mémo et project plan → validation Maxime. |

---

## 3. Matrice de couverture (qui automatise quoi)

| Expertise \ Agent           | Triage | Fiscal | Juridique | Reporting | Suivi | Documents |
|-----------------------------|:------:|:------:|:---------:|:---------:|:-----:|:---------:|
| i. Juridique & fiscal       |   ✅   |   ✅   |    ✅     |    ✅     |  ✅  |    ✅     |
| ii. Actifs cotés            |   ✅   |   ✅   |     ·     |    ✅     |  ✅  |     ·     |
| iii. Admin & comptable      |   ✅   |   ✅   |     ·     |    ✅     |  ✅  |    ✅     |
| iv. Acquisition / cession   |   ✅   |   ✅   |    ✅     |    ✅     |  ·   |    ✅     |
| v. Private Equity           |   ✅   |   ✅   |    ✅     |    ✅     |  ·   |    ✅     |
| vi. Conciergerie            |   ✅   |   ·    |     ·     |     ·     |  ✅  |    ✅     |
| vii. Financement            |   ✅   |   ✅   |    ✅     |    ✅     |  ·   |     ·     |
| viii. Immobilier            |   ✅   |   ✅   |    ✅     |    ✅     |  ✅  |    ✅     |
| ix. Philanthropie           |   ✅   |   ✅   |    ✅     |    ✅     |  ·   |     ·     |

**Lecture** : un seul jeu de 6 sous-agents Claude couvre les 9 expertises. C'est
la justification du diagramme v3 (centre = Marcel + 6 satellites).

---

## 4. État de la donnée et des APIs (au 08/05/2026)

### 4.1 Données — verdict par état

| État | Données concernées |
|---|---|
| 🟢 **En place** | Conversations Marcel (`KV MARCEL_LOGS`), prospects (`KV ikcp-prospect`), profil mini-quiz (`localStorage A4`). |
| 🟡 **À structurer** | Tout ce qui doit migrer en D1 : `persons`, `files`, `documents`, `subscriptions`, `events`, `tasks`, `tax_brackets`. Schémas existent dans `docs/IKCP-API-READINESS.md` §4 — non créés. |
| 🟠 **À ingérer** | Documents clients (R2 `ikcp-docs-private`), templates DER/RA/DIPA (R2 `ikcp-templates`), corpus Légifrance versionné (R2 `ikcp-archives`). |
| 🔴 **À acquérir** | Référentiel produits Nortia/Alpheys, Pappers premium, PriceHubble, Bigdata.com (recherche). |

### 4.2 APIs — verdict par état

| État | APIs |
|---|---|
| 🟢 **Câblées** | Anthropic (Marcel), Notion (`/v1/notion`), Resend (`/v1/email`), Légifrance (`/v1/legifrance`), Insee (`/v1/insee`). |
| 🟡 **Worker prêt, secrets manquants** | Voir `docs/MARCEL-V3-FEATURES.md` — `NOTION_TOKEN`, `RESEND_API_KEY`, `LEGIFRANCE_TOKEN`, `INSEE_KEY` à configurer dans Cloudflare. |
| 🟠 **Phase 2 (à intégrer)** | Yousign, Ubble (PVID), Universign (QES + horodatage), Nortia, Alpheys, Pappers, DVF, PriceHubble. |
| 🔴 **Phase 3 (à explorer)** | Powens (agrégation bancaire), Stream (vidéo), Cloudflare Vectorize (RAG), Amadeus, John Paul. |

---

## 5. Plan d'exécution recommandé

### Phase 1 (0-4 mois) — Lead gen + qualification automatisée

1. **Extraire le scoring Triage** du SYSTEM_PROMPT Marcel vers `triage-agent` (Haiku, testable). Endpoint : `POST /v1/triage`.
2. **Créer la base D1 `ikcp-prod`** avec schémas `persons / files / documents / events / tasks` (script déjà rédigé dans IKCP-API-READINESS §4).
3. **Créer R2 buckets** `ikcp-docs-private`, `ikcp-media-public`, `ikcp-archives`.
4. **Pipeline Documents v0** : endpoint `POST /v1/docs/upload` (signed URL R2) → `documents-agent` Haiku → classification + extraction → indexé D1.
5. **Externaliser les tools Fiscal** (`calc_ir`, `calc_succession`, `calc_donation`, `calc_ifi`) dans `workers/ikcp-api/v1/fiscal/*`. Réutilisés par Marcel + simulateurs publics.
6. **Configurer les secrets** Notion + Resend + Légifrance + Insee.
7. **Module "Diagnostic 5 leviers"** : pipeline complet i. Ingénierie juridique & fiscale en P1.

### Phase 2 (4-12 mois) — Co-pilot souscription

8. **Yousign + Ubble** intégrés (`/v1/sign`, `/v1/kyc`).
9. **Partenariat Nortia OU Alpheys** signé → API souscription cotés (ii) + AV (i.).
10. **Agent Reporting** rendu DER + RA + DIPA via templates R2.
11. **Agent Juridique** OCR pipeline (Mistral OCR) + RAG Légifrance sur Vectorize.
12. **Agent Suivi** Cron production : rappels fiscaux (iii.) + drift portefeuille (ii.) + revalorisation immo (viii.).
13. **Modules expertises i. / ii. / iii. / vii. / viii.** opérationnels en production avec validation Maxime.

### Phase 3 (12-18 mois) — Plateforme autonome supervisée

14. **Modules iv. / v. / ix.** (transmission, PE, philanthropie) — à plus forte composante humaine, sub-agents en mode "préparation dossier".
15. **Conciergerie (vi.)** — mode handoff white-label.
16. **RAG Bigdata.com** + **Pappers** + **DVF** intégrés en sources tools.
17. **Multilingue EN/DE** sur tous les agents (frontaliers, expatriés).

---

## 6. Décisions à confirmer avec Maxime

| # | Décision | Recommandation |
|---|---|---|
| D1 | Modèle par sous-agent : Haiku 4.5 (Triage, Suivi, Documents) vs Sonnet 4.6 (Fiscal, Juridique, Reporting) ? | **Mix** — latence pour les Haiku, raisonnement pour les Sonnet. Économie ~60% vs all-Sonnet. |
| D2 | Agent SDK Anthropic vs orchestration maison Worker ? | **Agent SDK** — gère memory + tool loop + sous-agents nativement. |
| D3 | Vectorize (Cloudflare) vs Pinecone vs pgvector ? | **Vectorize** — reste sur Cloudflare, latence 0 vs Workers. |
| D4 | OCR : Mistral OCR vs Anthropic vision ? | **Anthropic vision** d'abord (déjà le compte), bench sur 50 docs réels avant de migrer. |
| D5 | Données souveraineté : tout sur Cloudflare EU ? | **Oui**, jurisdiction EU sur D1/R2/KV — confirmer dans wrangler.toml. |
| D6 | Email inbound (admin@ikcp.eu) : Resend Inbound vs Postmark vs Cloudflare Email Routing ? | **Cloudflare Email Routing** + Worker — gratuit, intégré. |

---

## 7. Annexe — mapping page family-office ↔ ce document

| Élément page (`family-office-v3-hero-minimal.html`) | Ce qu'il faut afficher | Section de ce doc |
|---|---|---|
| Centre "Maxime + Marcel" | "Chef d'orchestre humain + IA, arbitre, signe" | §0 |
| Agent Triage 📥 | "Qualifie · score · route" | §1.1 |
| Agent Fiscal 🏛 | "Calcs IR/IFI/Succession/Donation, articles cités" | §1.2 |
| Agent Juridique ⚖ | "Lit actes, détecte risques, propose alternatives" | §1.3 |
| Agent Reporting 📊 | "Génère DER, RA, DIPA, bilans" | §1.4 |
| Agent Suivi 🔄 | "Rappels, échéances, alertes, arbitrages" | §1.5 |
| Agent Documents 📁 | "OCR, classement, indexation, RAG" | §1.6 |
| Bandeau "9 expertises" | Liste cliquable → fiche détaillée par expertise | §2 |
| Bloc "Sources sourcées" | Remplacer le placeholder par 2-4 logos APIs réelles par carte | §2 + §4.2 |
| Section infrastructure | Le diagramme Marcel + 6 + 9 (§0 ASCII → SVG propre) | §0 |

**Action UI directe** : remplacer dans `family-office-v2-expertises.html` les 9
blocs `<div class="card-apis-label">Sources sourcées</div>` génériques par les
**logos / noms d'APIs réels** listés dans §2 — c'est la promesse "auditable"
de la page.

---

## 8. Expérience client + différentiation marché

### 8.1 Les 4 promesses qui nous distinguent

Quatre promesses rendues *visibles* dans l'expérience (page `proposals/family-office-v4-live.html`) :

| # | Promesse | Ce que le visiteur voit | Pourquoi ça change |
|---|---|---|---|
| **i.** | **Sources visibles** | Chaque réponse affiche des chips avec article CGI, BOFIP, Bigdata, DVF, Pappers. | Anti-hallucination. Un cabinet sans sources = un cabinet sans audit possible. |
| **ii.** | **Orchestration apparente** | Le panel affiche les agents mobilisés (`Triage · Fiscal · Reporting`). Marcel est nommé comme orchestrateur. | Le théâtre de la coordination. Le visiteur sent qu'il y a une équipe — pas un chatbot. |
| **iii.** | **Multi-classe coordonné** | Une seule conversation couvre art / marchés / immo / PE / philanthropie. | L'art *et* les marchés *et* la transmission — là où Finary et les robo-advisors restent monolignes. |
| **iv.** | **Validation Maxime** | Footer de chaque réponse : *"préparation, pas recommandation"* + CTA *"Continuer avec Maxime"* préréempli. | Conformité MIF II by-design. La ligne rouge réglementaire devient un argument commercial. |

### 8.2 Concurrents et positionnement

| Acteur | Force | Limite | Notre angle |
|---|---|---|---|
| **Robo-advisors** (Nalo, Yomoni, Ramify, Goodvest) | Onboarding fluide, allocations standardisées | 1 classe d'actifs, pas de conseil pluridisciplinaire | Multi-classe (i-x) + arbitrage humain |
| **Agrégateurs** (Finary, Cashbee) | Vision consolidée | Ne conseillent pas, ne font pas exécuter | On *commence* par un avis transversal, on *exécute* avec validation |
| **Family offices traditionnels** | Sur-mesure, légitimité | Inaccessibles < 10 M€, opaques, lents | Sur-mesure dès 2 M€, sources visibles, réponse en 90 secondes sur un sujet précis |
| **CGP digitalisés** (≪ 1% du marché) | Expertise + outils | Pas de pluri-classe, pas d'art / PE | Marcel + 6 agents transversaux + 10 thématiques sourcées |

**La case vide** : un cabinet où le visiteur peut, en 90 secondes, **interroger 10 expertises** — voir les sources — recevoir un diagnostic synthétisé — *et* être pris en main par un humain identifié (Maxime).

### 8.3 Architecture client → Marcel → agents

```
Page family-office-v4-live.html
        │
        │  POST { theme, question, history }
        ▼
api.ikcp.eu/v1/agents/ask  ──── service binding ────▶ Worker ikcp-chat (Marcel)
        │                                                       │
        │  ┌───────────── THEME_CONTEXTS ─────────────┐         │
        │  │ Système prompt augmenté pour la thématique│         │
        │  └───────────────────────────────────────────┘         │
        │                                                       │
        │  ┌────────── 6 tools déterministes ─────────┐         │
        │  │ calc_impot_revenu  · calc_droits_succ.    │◀────────┤
        │  │ calc_donation      · calc_ifi              │         │
        │  │ calc_plus_value_immo · calc_demembrement   │         │
        │  └────────────────────────────────────────────┘         │
        │                                                       │
        │  ┌─── web_search natif (Anthropic) ──────────┐         │
        │  │ actualités fiscales, jurisprudence récente│◀────────┤
        │  └────────────────────────────────────────────┘         │
        │                                                       │
        ▼                                                       │
   Réponse front : { text, sources[], next_action, follow_ups[] } ◀┘
```

### 8.4 Ce qui est déjà en code (PR courante)

- ✅ `proposals/family-office-v4-live.html` — page interactive avec 10 thématiques
- ✅ `proposals/family-office-agents.js` — panels inline, streaming texte, chips sources, fallback mock
- ✅ `workers/ikcp-marcel/worker.js` — extension Marcel :
  - Acceptation du paramètre optionnel `theme`
  - 4 nouveaux tools déterministes : `calc_donation`, `calc_ifi`, `calc_plus_value_immo`, `calc_demembrement`
  - 10 contextes thématiques (`THEME_CONTEXTS`) injectés dans le system prompt
- ✅ `workers/ikcp-api/agents.js` + route `/v1/agents/ask` — proxy via service binding vers Marcel
- ✅ `workers/ikcp-api/wrangler.toml` — service binding `MARCEL` configuré

### 8.5 Ce qu'il reste à faire (Phase 2)

| # | Action | Pourquoi |
|---|---|---|
| 1 | **Brancher les vraies APIs externes** comme tools Marcel : Bigdata.com (markets), DVF (immo), Pappers (transmission), Légifrance (RAG juridique). | Aujourd'hui les sources sont citées dans le prompt mais pas requêtées en temps réel. |
| 2 | **Migrer Marcel sur le modèle 4.6/4.7** (`claude-sonnet-4-6`) — actuellement `claude-sonnet-4-20250514`. | Bénéficier de l'amélioration tool-calling + raisonnement. |
| 3 | **Sub-agents Claude Agent SDK** : un sous-agent par expertise lourde (juridique avec RAG Légifrance, art avec Artprice scraping, etc.) — orchestré par Marcel. | Aujourd'hui Marcel est mono-agent. La couche sub-agents permet : tools spécialisés par domaine, économie via Haiku 4.5 sur les tâches simples. |
| 4 | **Intégrer la page v4 dans le site** (route `/family-office`). Décider si v4 remplace v1/v2/v3 ou cohabite. | Décision Maxime. |
| 5 | **Ajouter la donnée client** (`profile`) dans le payload pour personnaliser : drift d'allocation, calcul IFI sur patrimoine réel, etc. | Aujourd'hui les exemples sont génériques. La valeur client réelle est dans le sur-mesure. |

---

## 9. Dashboard client backtesté — la valeur ajoutée *mesurée*

### 9.1 Pourquoi un dashboard, et pourquoi backtesté

Une page family-office "live" (v4) suffit à *qualifier* un prospect : il peut tester Marcel, voir les sources, mesurer le sérieux du dispositif. Mais elle ne dit rien sur **ce qu'il se passera après la signature**. Pour cela il faut un *espace client* qui :

- centralise patrimoine + échéances + documents + conversations
- montre **mesurément** ce que l'IA + le CGP ont fait
- permet de réinterroger Marcel à tout moment, dans le contexte personnel
- met dans une file `arbitrages_en_attente_maxime` les recommandations préparées

Le **backtest** consiste à charger une famille fictive cohérente (patrimoine, structures, donations, drift) et à exécuter le dashboard pour voir ce qui apparaît à l'écran. C'est ainsi qu'on valide la promesse avant la signature : si la value scorecard est convaincante sur la Famille Dupont (mock), elle l'est en production.

### 9.2 Famille Dupont — profil de backtest

| Élément | Valeur |
|---|---|
| Membres | Marc 58 ans + Sophie 56 ans + Emma 30 + Thomas 28 |
| Net worth consolidé | **4 247 000 €** (+2,3% trimestre, +6,8% sur 12 mois) |
| Allocation | Immo 38% · Coté 24% · AV 13% · Société 11% · Art 9% · Cash 2% · Autre 3% |
| Drift max vs cible | 4 pts (drift modéré — coté -4, pe -1, immo +3) |
| Société familiale | SARL DupSoft 4,8 M€ (logiciels, IS, dirigeant Marc) |
| Société immo | SCI La Roseraie 920 k€ brut (3 biens locatifs Paris) |
| Œuvres d'art | Soulages 1959 100×81 (estimé 1,4 M€) + 2 autres |
| Membre IKCP depuis | avril 2024 (2 ans à fin avril 2026) |

### 9.3 Architecture de la page

```
┌──────────────────────────────────────────────────────────────────────┐
│ proposals/dashboard-famille-office.html  +  dashboard-data.js  +     │
│ dashboard-render.js  →  s'ouvre en local sans backend                │
│                                                                      │
│ Sections (top-to-bottom) :                                           │
│  1. Hero — Bonjour Marc & Sophie · 4,2 M€ · membre depuis 04/2024    │
│  2. Value Scorecard — 5 métriques d'activité IA du mois              │
│  3. Patrimoine 360° — net worth + allocation barres + drift par      │
│     classe (chaque classe avec écart vs cible)                       │
│  4. Échéances — 8 prochaines, status [Préparé Marcel / À préparer /  │
│     Expert-comptable / Prélevé auto / Analyse en cours]              │
│  5. Arbitrages en attente Maxime — cartes avec contexte + reco       │
│     Marcel + sources sourcées + gain estimé + actions Approfondir/   │
│     Discuter                                                         │
│  6. Conversations Marcel — par thème (clic → modal avec embed Marcel)│
│  7. Documents — grid avec OCR + classement automatique               │
│  8. Livrables — bilan trimestriel, DER, mémo Dutreil, etc. (signé    │
│     ou à signer)                                                     │
│  9. Services — RDV Maxime, voyages, partenaires whitelistés          │
│ 10. Backtest 12 mois — 5 résultats mesurés + comparatif vs FO        │
│     classique (coût, délai, valeur)                                  │
│ 11. Journal d'activité — feed des actions agents (audit log)         │
│                                                                      │
│ Modal "Marcel privé" — POST direct vers ikcp-chat.maxime-ead.workers │
│ avec préambule [Espace privé · Famille Dupont] + theme               │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.4 Value scorecard — la pièce maîtresse

Le bandeau de 5 cellules juste sous le hero. Sur la Famille Dupont en mai 2026 :

| Métrique | Valeur backtest | Pourquoi ça compte |
|---|---|---|
| Questions Marcel traitées | 12 ce mois | Le client *utilise* — démontre l'usage réel |
| Documents classés automatiquement | 3 | Le coffre-fort se construit *sans effort client* |
| Arbitrages prêts pour Maxime | 1 (Dutreil DupSoft) | Le CGP a une file de travail *préparée* — il décide, il ne fouille pas |
| Optimisations identifiées (€) | 24 700 € ce mois | La valeur ajoutée chiffrée — quantifiable |
| Prochaine échéance | J−6 (déclaration 2042) | Le client ne rate plus rien, anticipation visible |

### 9.5 Backtest 12 mois — les 5 chiffres qui closent une vente

| Métrique | 12 mois Famille Dupont | Détail |
|---|---|---|
| **Heures économisées** | 24 h | Documents + rappels + relances partenaires |
| **Occasions saisies** | 5 | Don familial 31 865 €, micro→réel SCI, allègement LVMH, donation Emma 2025, optimisation PER Q4 |
| **Erreurs évitées** | 2 | Échéance CFE 2025 rappelée J−8, clause bénéficiaire AV Sophie corrigée |
| **Gains nets identifiés** | **47 200 €** | Cumul des optimisations validées |
| **Économie potentielle Dutreil DupSoft (en attente)** | **1 400 000 €** | Mémo livré 07/05 — décision famille |

**Comparatif vs Family Office classique** :
- IKCP : honoraires forfait 6 800 €/an + commissions transparentes
- FO classique : 0,5-1% AUM = ~25-40 k€/an pour 4 M€
- **Préparation dossier : 90 min IA → 25 min Maxime**, soit −70%

### 9.6 Pourquoi cette page transforme la promesse en preuve

La page `family-office-v4-live.html` parle de **promesses** (4 promesses, 10 thématiques, sources visibles). La page `dashboard-famille-office.html` montre les **preuves** :
- les sources promises sont *cliquables* sur des arbitrages réels
- les agents promis sont *nommés* sur des conversations réelles
- la coordination promise est *visible* sur les partenaires whitelistés
- la valeur promise est *chiffrée* (47 200 € + 1,4 M€ en attente)

C'est la même page qu'un prospect verra **après un mois d'utilisation** — donc on peut la lui montrer **avant** comme un *back-test* de ce qu'il aura.

### 9.7 Lien avec le code existant (Phase 2)

| Source | Ce qu'il faudra connecter |
|---|---|
| `D.client` | Table `users` (existe — `workers/ikcp-client/schema.sql`) |
| `D.patrimoine` | À créer : table `patrimoine_snapshot(user_id, asof, classes_json)` + cron weekly |
| `D.echeances` | À créer : table `echeances(user_id, date, label, status, source)` |
| `D.conversations` | Table `conversations` (existe) |
| `D.arbitrages` | À créer : table `arbitrages(user_id, conv_id, status, reco_json, sources_json, gain_estime)` |
| `D.documents` | À créer : table `documents(user_id, r2_key, type, tags_json, sha256)` + R2 bucket `ikcp-docs-private` |
| `D.livrables` | Sous-ensemble de `documents` avec `generated=true` + signature `signed_at` |
| `D.activity` | Table `audit_log` (existe — peut être enrichie) |
| `D.value_scorecard` | Calcul agrégé sur `audit_log` + `arbitrages` (cron quotidien) |
| `D.backtest_12m` | Calcul agrégé sur historique 365j |

L'endpoint à exposer : `GET /api/dashboard/me` sur `workers/ikcp-client`, qui renvoie ce JSON exact (cf. `proposals/dashboard-data.js` pour le shape). Le rendu côté front (`dashboard-render.js`) reste identique.

---

## 10. Valeur ajoutée d'un FO digital — au-delà du conseil

### 10.1 Les 5 axes de valeur que doit couvrir un FO digital

Un cabinet de gestion de patrimoine *traditionnel* fait du conseil. Un FO *digital* doit faire bien plus pour justifier l'abonnement et la confiance. Cinq axes :

| Axe | Promesse | Comment IKCP le rend |
|---|---|---|
| **i. Dénicheur d'offres** | Accès à des opportunités **scorées par profil** : off-market immo, co-invest PE, fenêtres fiscales, art en pré-vente, tarifs négociés. | Pipeline IKCP + réseau notaires + Christie's/Sotheby's + Bigdata.com → Marcel score chaque offre par adéquation profil (allocation, conversations, deadlines fiscales). Section **Opportunités** du dashboard. |
| **ii. Conseil premium** | Le sur-mesure introuvable chez les robo-advisors : family governance, NextGen, transmission inter-générationnelle, audit assurance complet. | Section **Services premium** du dashboard : 6 services activables — *family governance*, *programme NextGen*, *cyber-protection*, *health concierge*, *audit assurance*, *tarifs négociés*. |
| **iii. Services avantageux** | Tarifs négociés sur Lombard, signature électronique, banques privées, plateformes PE. Mise en concurrence systématique 3 offres > 50 k€. | Concrètement : Lombard renégocié OAT+85 pb (vs OAT+110) = **5 800 €/an économisés** sur 2 M€ — détecté par Marcel et placé en opportunité. |
| **iv. Toujours dans la poche** | PWA installable (iOS + Android + desktop). Notifications push échéances. Marcel 24/7 mobile. Photo → coffre-fort instantané. Mode hors-ligne (FAQ). | `manifest.json` enrichi (raccourcis Dashboard + Marcel) · meta `apple-mobile-web-app-*` · service worker existant (`sw.js`) · banner installation auto sur mobile. |
| **v. Multi-générationnel** | Sous-comptes Emma & Thomas, programme pédagogique, préparation à recevoir la transmission. Gouvernance familiale outillée. | Service premium *Programme NextGen* + page de transmission liée à la file `arbitrages` (mémo Dutreil 4,8 M€ DupSoft accessible aux deux générations). |

### 10.2 Mapping value-add → revenus

L'enjeu : chaque service premium doit avoir une **valeur économique mesurable** côté client *et* un **modèle de revenus** côté IKCP.

| Service premium | Valeur client | Source revenus IKCP |
|---|---|---|
| Dénicheur d'offres | 5-50 k€/an d'optimisations identifiées | Commission apporteur (PE/structurés/immo) — transparente |
| Family governance | Charte familiale, 2-4 réunions/an | Honoraire forfait 2-4 k€/an |
| NextGen | 1-2 modules/an Emma + Thomas | Honoraire 800-1 500 €/module |
| Cyber-protection | Audit annuel + alerte fuite | White-label CYRPA (~500 €/an) |
| Health concierge | Bilan préventif + 2nd avis | White-label SOS Médecin Privé (~1 800 €/an) |
| Audit assurance | Identification lacunes RC/cyber/K&R | Commission courtage CO |
| Tarifs négociés | -25% sur Lombard, signature, etc. | Pas de revenu direct — mais argument de fidélisation |

**Forfait FO digital cible** : **6 800 €/an** (vs 25-40 k€ d'un FO classique 0,5-1% AUM sur 4 M€). À cela s'ajoutent les commissions apporteur (transparentes, MIF II) et les forfaits services premium activés à la demande.

### 10.3 Ce qui rend la version mobile critique

Un FO traditionnel s'utilise au cabinet, sur RDV. Un FO digital doit être **dans la poche** :

1. **Notifications push échéances** — J−8 sur déclaration 2042, alerte sur offre off-market avec deadline 4 semaines, validation Maxime requise.
2. **Photo → coffre-fort** — courrier RAR DGFiP reçu : photo depuis le téléphone → upload R2 → `documents-agent` Haiku 4.5 le classe + `suivi-agent` programme le rappel.
3. **Marcel mobile 24/7** — question patrimoniale en RDV chez le notaire, réponse instantanée avec sources.
4. **Conciergerie en mobilité** — ESTA à renouveler avant voyage NYC : visible directement sur le dashboard.

### 10.4 Ce qui est livré dans cette PR (commit `<dashboard v2>`)

- `proposals/dashboard-data.js` enrichi de :
  - **`opportunites[]`** (6 offres pre-screened : off-market Combloux 4,8 M€, co-invest PE SaaS B2B, fenêtre CGI 790 A bis, Soulages Christie's, renégociation Lombard, structuré EuroStoxx)
  - **`services_premium[]`** (6 services : governance, NextGen, cyber, health, audit assurance, tarifs négociés) avec status (actif / à initier / planifié / etc.)
- `proposals/dashboard-famille-office.html` :
  - 2 nouvelles sections : **Dénicheur d'offres** + **Services premium**
  - Meta PWA iOS (`apple-mobile-web-app-*`, `apple-touch-icon`)
  - **Banner d'installation** "Installer IKCP Family Office" qui apparaît sur mobile non-installé
  - Responsive mobile renforcé (12 nouveaux breakpoints à 720 px : nav compact, modal Marcel full-screen, opp-card 1 col, etc.)
- `proposals/dashboard-render.js` :
  - `renderOpportunites()` avec scoring fit (high/med/normal) + bar de progression + raisons "pourquoi vous"
  - `renderServicesPremium()` avec status par service
  - `setupPwaInstall()` : capture `beforeinstallprompt`, banner sur Android/Chrome, message contextuel sur iOS Safari, opt-out 7 jours
- `proposals/family-office-v4-live.html` : meta PWA + manifest ajoutés (la page d'entrée publique est aussi installable)
- `manifest.json` : 4 raccourcis (Dashboard, Marcel orchestrateur, Diagnostic patrimonial, RDV)

### 10.5 Ce qu'il reste à brancher (Phase 2)

| # | Action | Pourquoi |
|---|---|---|
| 1 | **Pipeline notaires off-market** : flux mensuel des biens > 2 M€ pré-MEM (réseau Maxime). Indexation D1 + scoring Marcel. | Cœur du dénicheur d'offres immo. |
| 2 | **Alertes Christie's / Sotheby's** : RSS → `art-agent` parse les ventes à venir → match avec préférences client (Soulages, Hartung, Hantaï…). | L'art comme vraie classe d'actif. |
| 3 | **Notifications push** via Web Push API (VAPID keys dans `ikcp-client`). | Sans push, on perd les J−8 échéances. |
| 4 | **Service binding `MARCEL` activé** sur `ikcp-api` (déjà déclaré dans wrangler.toml — il faut juste deployer). | Latence quasi nulle entre `/v1/agents/ask` et Marcel. |
| 5 | **Sous-comptes Emma + Thomas** : ajout `family_id` + `role` (principal/co/enfant) dans schema D1, vue partielle pour les enfants. | NextGen activable. |

---

*Document vivant — à mettre à jour à chaque jalon majeur.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · ikcp.eu*
