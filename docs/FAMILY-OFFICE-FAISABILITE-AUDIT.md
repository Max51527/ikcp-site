# IKCP Family Office Digital — Audit de faisabilité

> **Objet** : pour chaque capacité produit, intégration ou service envisagé
> dans la vision Family Office Digital IKCP, évaluer la **faisabilité réelle**
> selon 4 dimensions (technique, contractuel, réglementaire, économique) et
> rendre une **décision d'engagement** (go / wait / no-go).
>
> **Statut** : v1 · 09/05/2026 · vivant
> **Auteur** : Maxime Juveneton + Claude (Agent SDK)
> **Documents associés** : `FAMILY-OFFICE-AGENTS-AUDIT.md` (vision agents),
> `IKCP-PLATFORM-ROADMAP.md` (stratégie), `IKCP-API-READINESS.md` (infra)

---

## 0. Méthode

### Échelle de faisabilité

| Code | Lecture | Action |
|---|---|---|
| 🟢 | **Possible immédiatement** — code/contrat/cadre déjà en place | Activer · déployer |
| 🟡 | **Possible avec pré-requis** — manque secrets, schéma, intégration | Lever le pré-requis |
| 🟠 | **Possible Phase 2/3** — délai 3-12 mois, dépendance externe | Inscrire roadmap |
| 🔴 | **Hors portée actuelle** — bloqueur fort (réglementation, volume, coût) | Ne pas s'engager |

### 4 dimensions d'évaluation

- **Technique** : la stack actuelle peut-elle le porter ?
- **Contractuel** : faut-il signer un partenariat externe ?
- **Réglementaire** : MIF II / DDA / AI Act / DORA / RGPD acceptent-ils ?
- **Économique** : le ROI couvre-t-il les coûts (setup + récurrent) ?

### Périmètre couvert

Sept dimensions produit :
1. Front-end / UX
2. Agents IA
3. Données & sources
4. APIs partenaires
5. Conformité réglementaire
6. Hébergement & souveraineté
7. Modèle économique & pricing

---

## 1. Front-end / UX

| Capacité | État | Délai | Coût | Risque | Décision |
|---|:---:|:---:|:---:|:---:|---|
| Site vitrine multi-page (existant) | 🟢 | — | — | faible | acquis |
| Page Family Office dédiée | 🟢 | — | — | faible | **5 versions livrées** (v3 minimaliste, v4 live, v5 univers, conviction-overview, sur-mesure-tarif) |
| Espace client privé magic-link | 🟢 | 0 | 0 | faible | **`workers/ikcp-client` opérationnel** — auth Resend + cookie JWT |
| Dashboard family office consolidé | 🟡 | 3 sem | 8 k€ | faible | mockup livré, brancher D1 réel |
| PWA installable (iOS + Android + desktop) | 🟢 | — | — | faible | manifest + sw.js + meta iOS livrés |
| App mobile native | 🟠 | 6-8 sem | 35 k€ | moyen | **wait** — PWA suffit Phase 1, native si demande client |
| Multilingue UI (FR/EN/DE) | 🟡 | 3-4 sem | 18 k€ | faible | Marcel le gère déjà ; UI à internationaliser |
| Responsive mobile complet | 🟢 | — | — | faible | 12 breakpoints @720 px sur dashboard + univers |
| Notifications push Web (VAPID) | 🟡 | 2 sem | 6 k€ | faible | clé VAPID à générer dans `ikcp-client` |
| Mode hors-ligne complet | 🟡 | 1 sem | 3 k€ | faible | étendre `sw.js` au cache des routes /dashboard/* |

**Synthèse** : tout le front est **possible immédiatement ou à 1 mois**. La seule capacité hors portée court terme est l'app native — non bloquante car la PWA est installable, capte 80% de l'usage mobile.

---

## 2. Agents IA

| Agent | État | Tech | Délai | Coût | Décision |
|---|:---:|---|:---:|:---:|---|
| Marcel orchestrateur | 🟢 | Sonnet 4 + web search + cache | — | 0 | en production |
| 6 tools fiscaux déterministes | 🟢 | JS Worker | — | 0 | en production (IR · succession · donation · IFI · PV immo · démembrement) |
| 18 contextes thématiques | 🟢 | THEME_CONTEXTS injectés | — | 0 | en production (10 expertises + 8 univers) |
| Triage routing | 🟢 | implicite Marcel | — | 0 | en production |
| Gateway `/v1/agents/ask` | 🟡 | service binding ikcp-api → Marcel | 0 | 0 | **prêt** — il suffit de `wrangler deploy` |
| Documents-agent (OCR + classement) | 🟡 | Haiku 4.5 + Anthropic vision + R2 | 3-4 sem | 12 k€ | **go** — débloquerait le pipeline doc |
| Suivi-agent (cron rappels) | 🟡 | Cloudflare Cron + D1 + Resend | 2 sem | 6 k€ | **go** — différenciant fort |
| Reporting-agent (DER/RA/bilan PDF) | 🟡 | Sonnet + templates R2 + html→pdf | 3-4 sem | 14 k€ | **go** — Phase 2 souscription |
| Juridique-agent (RAG Légifrance) | 🟠 | Cloudflare Vectorize + OCR | 8-10 sem | 28 k€ | wait — POC Q3 2026 |
| Sub-agents univers (art, voitures, vins…) | 🟠 | Haiku par univers + APIs | 2-3 sem/agent | 8-18 k€/agent | progressif selon demande |
| Recommendation-agent (catalogue Nortia) | 🔴 | RAG catalogue produits | 8-12 sem | 35 k€ | **bloqué** — nécessite partenariat grossiste signé |
| Exécution-agent (Yousign + Ubble + souscription) | 🟠 | orchestration multi-API | 10-12 sem | 45 k€ | wait — Phase 3 |

**Synthèse** : **3 agents (Documents, Suivi, Reporting) sont les quick-wins** — ~32 k€ et 9 semaines pour rendre le dashboard opérationnel en production. Les agents lourds (Juridique RAG, Exécution) attendent l'infrastructure (Vectorize, partenariats).

---

## 3. Données & sources

| Source / Donnée | État | Type | Décision |
|---|:---:|---|---|
| Conversations Marcel | 🟢 | KV `MARCEL_LOGS` (90 j) | en production |
| Profils prospects | 🟢 | KV `ikcp-prospect` | en production |
| Patrimoine consolidé client | 🟡 | D1 table `patrimoine_snapshot` à créer | go — 1 sem |
| Échéances fiscales | 🟡 | D1 table `echeances` à créer | go — 3 j |
| Documents indexés (R2 + meta D1) | 🟡 | bucket `ikcp-docs-private` à créer | go — 1 sem |
| Audit log événements | 🟢 | partiel (Marcel KV) | étendre vers D1 `events` |
| Référentiel barèmes fiscaux | 🟢 | en dur dans Marcel | versionner par millésime D1 |
| Templates DER / RA / DIPA | 🟠 | R2 `ikcp-templates` à monter | go Phase 2 |
| Corpus Légifrance versionné (RAG) | 🟠 | R2 `ikcp-archives` + Vectorize | Phase 2-3 |
| Catalogue produits CGP partenaires | 🔴 | dépend partenariat Nortia/Alpheys | wait |

**Synthèse** : **5 tables D1 + 3 buckets R2** à créer cette semaine pour passer le dashboard du mock au réel. Effort total : ~1 semaine de dev.

---

## 4. APIs partenaires

### 4.1 APIs publiques gratuites

| API | État | Coût | Décision |
|---|:---:|---|---|
| Légifrance (api.piste.gouv.fr) | 🟢 | gratuit | worker câblé `/v1/legifrance` |
| INSEE (api.insee.fr) | 🟢 | gratuit (clé) | worker câblé `/v1/insee` |
| DVF (api.gouv.fr/dvf) | 🟡 | gratuit | **go** — endpoint à ajouter (~2 j) |
| BAN adresses (api.gouv.fr/adresse) | 🟡 | gratuit | go — 1 j |
| Géoportail-Urbanisme | 🟡 | gratuit | wait Phase 2 |
| BODACC (annonces légales) | 🟡 | gratuit | wait Phase 2 |
| BOFIP (doctrine fiscale) | 🟠 | scraping ou cache R2 | wait — pas d'API officielle |
| RNA (associations Datagouv) | 🟡 | gratuit | wait Phase 3 (philanthropie) |
| France Galop / Goffs (chevaux) | 🟠 | scraping public | Phase 3 |

### 4.2 APIs partenaires payantes (commerciales)

| API | État | Coût indicatif | Délai contrat | Décision |
|---|:---:|---|---|---|
| Anthropic Claude | 🟢 | ~50-3000 €/mois selon volume | déjà actif | en production |
| Resend (email) | 🟢 | gratuit jusqu'à 3000/mois | déjà actif | activer secret |
| Notion (CRM) | 🟢 | gratuit free tier | déjà actif | activer secret |
| Pappers (sociétés) | 🟡 | freemium 1 req/j · 99 €/mois premium | instantané | **go** — 99 €/mois utile |
| Yousign (signature AdES) | 🟠 | ~0,50-2 €/signature | POC 30 j gratuit | go Phase 2 |
| Universign (QES + horodatage) | 🟠 | sur devis | 4-6 sem négo | go Phase 2 (transmission, contrats > 150 k€) |
| Ubble (KYC PVID ANSSI) | 🟠 | ~1,50-3 €/KYC | POC 30 j | go Phase 2 |
| Bigdata.com (recherche fondamentale) | 🟠 | abonnement | contact MCP existant | go progressif (markets, sentiment) |
| PriceHubble (estimation immo) | 🟠 | sur devis | 4 sem | go Phase 2 (immo) |
| Hagerty Valuation Tool (USA) | 🟠 | $ subscription | 6-8 sem | wait — sub-agent voitures Phase 2 |
| Liv-ex (vins) | 🟠 | £ year subscription | 4 sem | wait — sub-agent vins Phase 2 |
| Chrono24 (montres) | 🟠 | pas d'API publique | scraping accepté | scraping limité, light agent |
| Artprice (art) | 🔴 | premium contrat lourd | 3-6 mois | wait — alternative Artnet |
| Nortia / Alpheys (grossistes AV) | 🔴 | nécessite volume + agrément | 6-12 mois | wait — partenariat lourd |
| Stripe (paiement honoraires) | 🟡 | 1,4% + 0,25 € | instantané | go — 2 j |
| Cloudflare Email Routing (inbound) | 🟢 | gratuit | déjà dispo | activer pour `admin@ikcp.eu` |

**Synthèse** : **5 APIs activables sous 2 semaines** (Pappers premium + DVF + BAN + Stripe + Email Routing) pour ~150 €/mois. Les APIs lourdes (Hagerty, Liv-ex, Artprice, Nortia) attendent un volume justifiant l'abonnement annuel ou le contrat.

---

## 5. Conformité réglementaire

| Cadre | État | Risque | Action |
|---|:---:|:---:|---|
| **MIF II** (conseil en investissement) | 🟢 | faible | prompt by-design, validation Maxime systématique, audit log |
| **DDA** (distribution assurance) | 🟢 | faible | même approche que MIF II |
| **AI Act UE** (système haut risque) | 🟡 | moyen | doc à produire : registre IA, documentation algo, plan de tests, supervision humaine documentée |
| **DORA** (résilience opérationnelle) | 🟢 | faible | Cloudflare EU ISO 27001 / SOC 2 |
| **RGPD** | 🟢 | faible | Cloudflare EU + DPO externe à formaliser (~2 k€/an) |
| **LCB-FT** (lutte blanchiment) | 🟡 | moyen | KYC Ubble + audit log + politique vigilance |
| **Archivage 10 ans NF Z42-013** | 🟡 | moyen | R2 + horodatage Universign à câbler (Phase 2) |
| **eIDAS** (signature qualifiée) | 🟠 | faible | Universign QES pour actes > 150 k€ |
| **CIF / COA** (statut IKCP) | 🟢 | — | ORIAS 23001568 actif |
| **RC Pro** | 🟡 | moyen | **action** : prévenir l'assureur RC du projet IA, avenant probable |

**Synthèse** : aucun bloqueur réglementaire. **3 actions à mener** :
1. Document AI Act (registre IA, supervision humaine)
2. RC Pro avenant
3. DPO externe formalisé

Coût total : ~6 k€ + 2 k€/an. Délai : 2-3 mois.

---

## 6. Hébergement & souveraineté

| Brique | État | Coût | Décision |
|---|:---:|---|---|
| Cloudflare Workers (compute) | 🟢 | gratuit jusqu'à 100k req/j | en production |
| Cloudflare D1 (SQL) | 🟢 | gratuit jusqu'à 5M req/j | tables à créer |
| Cloudflare R2 (object storage) | 🟢 | gratuit 10 GB · pas d'egress | buckets à créer |
| Cloudflare KV | 🟢 | gratuit | en production |
| Cloudflare Cron triggers | 🟢 | gratuit | à configurer (Suivi-agent) |
| Cloudflare Queues (file asynchrone) | 🟢 | gratuit jusqu'à 1M ops | à configurer |
| Cloudflare Email Routing (inbound) | 🟢 | gratuit | activer `admin@ikcp.eu` |
| Cloudflare Vectorize (embeddings RAG) | 🟡 | $ par 100k vectors | go Phase 2 (Juridique) |
| Service binding Worker→Worker | 🟢 | gratuit | déjà déclaré dans wrangler.toml |
| Custom domain `api.ikcp.eu` | 🟡 | gratuit | DNS CNAME à créer |
| Backup / disaster recovery | 🟡 | $ | Phase 2 (D1 export quotidien R2) |
| Souveraineté EU (DORA) | 🟢 | inclus | jurisdictions EU sur tous les bindings |

**Synthèse** : tout le hosting nécessaire est **dans le free tier Cloudflare** jusqu'à plusieurs centaines de clients. Premier coût significatif au-delà de ~1 000 clients (~500 €/mois). C'est l'**avantage de coût structurel le plus fort** d'IKCP vs plateformes US.

---

## 7. Modèle économique & pricing

### 7.1 Sources de revenus

| Source | Possible | Délai | Volume cible Phase 2 (12 mois) |
|---|:---:|---|---|
| Forfait FO Augmenté 6 800 €/an | 🟢 | immédiat | 30 familles = 204 k€ |
| Setup sur-mesure 28-120 k€ | 🟢 | immédiat | 4 contrats = 200 k€ |
| Modules à la carte (8-35 k€) | 🟢 | immédiat | 6 modules = 60 k€ |
| Honoraires service premium (governance, NextGen) | 🟢 | immédiat | 12 prestations = 30 k€ |
| Commission apporteur transparente (PE, structurés, immo) | 🟢 | progressif | variable |
| Honoraires conseil ponctuel | 🟢 | immédiat | variable |
| Licensing B2B (white-label autres CGP) | 🟠 | Phase 3 | wait |

**CA Phase 2 cible 12 mois** : ~500 k€ atteignables avec 30 familles + 4 contrats sur-mesure + activité courante.

### 7.2 Structure de coûts mensuelle (estimée)

| Poste | Phase 1 (10 familles) | Phase 2 (30 familles) | Phase 3 (100 familles) |
|---|---|---|---|
| Anthropic API (cache actif) | 80 € | 300 € | 1 200 € |
| Cloudflare (Workers + D1 + R2 + KV) | 0 € | 30 € | 200 € |
| Resend (3000 mails/mois free) | 0 € | 15 € | 80 € |
| Yousign (POC → ~1 €/signature) | 0 € | 60 € | 300 € |
| Ubble (KYC ~2 €) | 0 € | 50 € | 200 € |
| Pappers premium | 0 € | 99 € | 99 € |
| PriceHubble (estimation immo) | 0 € | 200 € | 600 € |
| Bigdata.com (recherche) | 0 € | sur devis | sur devis |
| Domaine + monitoring | 10 € | 30 € | 80 € |
| Compliance (DPO + audit) | — | 200 € | 500 € |
| **Total infra mensuel** | **~90 €** | **~1 000 €** | **~3 200 €** |

### 7.3 Marges projetées

| Phase | CA mensuel | Coûts | Marge brute | % |
|---|---|---|---|---|
| Phase 1 (10 familles) | 5 700 € | 90 € | 5 610 € | 98 % |
| Phase 2 (30 familles + sur-mesure) | 42 000 € | 1 000 € | 41 000 € | 97 % |
| Phase 3 (100 familles) | 80 000 € | 3 200 € | 76 800 € | 96 % |

**Marge structurelle 95-98 %** sur l'IT/infra. Le coût réel est le **temps Maxime** — la techno divise par 3-5 le temps par dossier (cf. backtest §9.5 audit agents).

---

## 8. Synthèse — Top 10 chantiers prioritaires

Classés par **impact / effort** — recommandation d'engagement immédiat :

| # | Chantier | Effort | Impact | Décision |
|---|---|---|---|---|
| 1 | **Brancher D1 réel** dans le dashboard (5 tables + 3 buckets R2) | 1 sem · 6 k€ | très fort | **GO immédiat** |
| 2 | **Déployer le gateway `/v1/agents/ask`** (service binding actif) | 1 j · 0 € | fort | **GO immédiat** |
| 3 | **Documents-agent OCR** (pipeline upload → classement → indexation) | 3-4 sem · 12 k€ | très fort | **GO** |
| 4 | **Suivi-agent cron** (rappels échéances + drift portfolio + alertes) | 2 sem · 6 k€ | très fort | **GO** |
| 5 | **Sources Marcel cliquables** (CGI / BOFIP en URL Légifrance) | 2 j · 1 k€ | fort différenciant | **GO immédiat** |
| 6 | **Calculateur économies vs banque privée** sur la page FO | 1 j · 0 € | fort conversion | **GO immédiat** |
| 7 | **Endpoint export client** (ZIP D1 + R2) — argument anti-friction | 3 j · 2 k€ | moyen-fort | **GO** |
| 8 | **Reporting-agent PDF** (bilan trimestriel auto) | 3-4 sem · 14 k€ | fort | go après #3 |
| 9 | **Pappers premium + DVF + Stripe** (3 APIs activables) | 3 j · 1 k€ | moyen | **GO** |
| 10 | **Doc AI Act + DPO + RC Pro avenant** | 2 mois · 6 k€ | obligatoire à terme | go en parallèle |

**Investissement total Top 10** : **~48 k€ + 2 mois de dev** pour passer de la maquette à la production complète Phase 1+2.

**ROI estimé** : break-even atteint à 8-10 familles Augmenté (54-68 k€/an), soit la fin du semestre.

---

## 9. Ce qui est **hors portée actuelle** — décisions de ne pas faire

| Capacité | Pourquoi pas maintenant |
|---|---|
| App mobile native | PWA suffit Phase 1+2, capte 80% usage. Reconsidérer si demande client forte. |
| Recommendation-agent (catalogue Nortia/Alpheys) | Nécessite partenariat grossiste signé (6-12 mois), volume initial à atteindre. Marcel reste sur **préparation**, Maxime fait la sélection produit. |
| Exécution-agent end-to-end (KYC + signature + souscription auto) | Phase 3 — nécessite le précédent + maturité Yousign + Ubble en production. |
| Artprice premium | Contrat lourd (3-6 mois). Alternative Artnet free tier suffisante en Phase 2. |
| Plateforme PE retail intégrée (MoonFare, Opale Capital) | Wait — concentrer sur clients existants Phase 1+2. |
| Conciergerie ad-hoc (réservation directe) | Responsabilité — handoff John Paul / Ten Lifestyle suffisant. |
| Multi-juridiction complète (CH/USA/UK fiscal) | Phase 3 — formule Bespoke uniquement. |

---

## 10. Décision recommandée

### Sur 3 mois (Phase 1+ activable)

1. **Engager le Top 10 chantiers prioritaires** (~48 k€ + 2 mois)
2. **Déployer Marcel sur les nouveaux contextes** (déjà commités, juste `wrangler deploy`)
3. **Lancer le freemium public** sur la page v5 univers
4. **Ouvrir 5 contrats sur-mesure pilotes** à tarif promotionnel (-30 % les 3 premiers)

### Sur 6-12 mois (Phase 2)

5. **Yousign + Ubble POC 30 jours** (à déclencher dès qu'un client de souscription se présente)
6. **Pappers premium + DVF + PriceHubble** câblés
7. **Documents-agent + Suivi-agent + Reporting-agent** en production
8. **Documentation AI Act + DPO formalisé + RC Pro avenant**
9. **Création D1 multi-utilisateur famille** (sous-comptes NextGen)
10. **Lancement programme NextGen** (4-6 modules pédagogiques)

### Sur 12-18 mois (Phase 3)

11. **Partenariat grossiste** (Nortia ou Alpheys) ouvert
12. **Juridique-agent + RAG Légifrance** déployé
13. **Sub-agents univers progressifs** (1 par trimestre selon demande)
14. **Licensing B2B** ouvert (white-label autres CGP)
15. **Multi-juridiction Bespoke** disponible sur devis

---

## 11. Conclusion

**Aucun bloqueur structurel** sur la vision Family Office Digital IKCP :
- 80 % des capacités produit sont 🟢 ou 🟡 (possibles immédiatement ou avec pré-requis < 1 mois)
- Les 20 % en 🟠/🔴 sont soit Phase 2-3, soit hors-scope volontaire
- **Marge structurelle 95-98 %** sur l'IT — le levier économique est exceptionnel
- **Conformité MIF II / DDA / DORA / RGPD** by-design ; AI Act et RC Pro à compléter (2-3 mois)

Le verdict est **GO** sur le Top 10 chantiers (48 k€, 2 mois) — break-even atteint à 8-10 familles, marge structurelle dégagée pour autofinancer Phase 2.

---

*Document vivant — révision trimestrielle.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · ikcp.eu*
