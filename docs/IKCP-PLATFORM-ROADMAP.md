# IKCP Platform — Roadmap stratégique

> **Vision** : devenir la première plateforme française de gestion de patrimoine automatisée, alliant conseil IA pluridisciplinaire et exécution online avec validation humaine du CGP.
>
> **Statut** : document stratégique vivant · dernière révision 23/04/2026
>
> **Auteur** : rédigé en binôme Maxime Juveneton + Claude (Agent SDK)

---

## 1. Positionnement et opportunité de marché

### 1.1 Le constat

Le marché français du conseil en gestion de patrimoine digital est segmenté en trois groupes incomplets :

| Acteur | Force | Limite |
|---|---|---|
| **Robo-advisors** (Nalo, Yomoni, Ramify, Goodvest) | Souscription online, onboarding fluide | Allocations standardisées, pas de conseil pluridisciplinaire (succession, protection, fiscal pro) |
| **Agrégateurs** (Finary, Cashbee) | Data consolidée | Ne font pas de conseil ni d'exécution structurée |
| **CGP traditionnels** (99% du marché) | Expertise, relation humaine | Peu digitalisés, scaling limité par le temps humain |

**La case vide** : un acteur qui combine
- Agent IA patrimonial **pluridisciplinaire** (fiscal + succession + protection + placement)
- **Exécution online** (signature, souscription via API partenaires)
- **Human-in-the-loop CGP** pour la conformité MIF II / DDA
- Positionnement "**Protection**" plutôt que pur "rendement"

### 1.2 L'avantage IKCP

- **CIF + COA** (ORIAS 23001568) — le double statut permet conseil en investissement ET courtage d'assurance
- **10 ans d'expertise terrain** — légitimité métier que les fintechs pure-players mettent 5 ans à construire
- **Marcel déjà en production** — chatbot IA mature (v2.1) avec tool calling, web search, logs KV, prompt caching
- **Site SEO établi** — 70+ pages indexées, trafic organique qualifié, PWA opérationnelle
- **Différenciateur "Protection"** — ADN unique (la question *"que se passe-t-il si..."*) là où tous les concurrents parlent rendement

---

## 2. Audit des partenaires (synthèse exécutive)

### 2.1 Assureurs — stratégie : **passer par un grossiste**, pas en direct

Aucun assureur français n'offre d'API publique self-service aux CGP. Les intégrations directes (Apicil, Spirica, Generali, Suravenir, Swiss Life) nécessitent volumes + négociation bilatérale longue.

**Solution : courtiers grossistes avec API multi-assureurs unifiée**

| Grossiste | Couverture typique | API | Priorité |
|---|---|---|---|
| **Nortia** | Apicil, Spirica, Generali, Swiss Life, Vie Plus… | Documentée pour partenaires CGP | ⭐ Priorité 1 |
| **Alpheys** | Assureurs premium, UC large | API REST | ⭐ Priorité 1 |
| **Intencial** | Multi-assureurs | À confirmer | Priorité 2 |
| **Finaveo** | Multi-assureurs | À confirmer | Priorité 2 |

**Action** : contacter Nortia et Alpheys pour obtenir leurs docs API et conditions 2026. Objectif Phase 2.

### 2.2 Signature électronique — **Yousign + Universign**

| Besoin | Fournisseur | Niveau eIDAS |
|---|---|---|
| Souscription AV standard, arbitrages, bulletins | **Yousign** (français) | AdES |
| Contrats capi, dossiers > 150k€, actes sensibles | **Universign** (français, PSCo qualifié) | QES |

Yousign API REST bien documentée (developers.yousign.com), tarif ~0,50-2€/signature en volume.

### 2.3 KYC digital — **Ubble en premier choix**

| Fournisseur | PVID ANSSI | Choix |
|---|---|---|
| **Ubble** | ✅ Certifié | ⭐ Premier choix (français, adopté par Ramify, Shine, Qonto) |
| **IDnow** | ✅ Certifié | Fallback volumétrique |
| **Onfido** | À vérifier | Non recommandé comme solution unique pour AV |

Certification **PVID ANSSI** = standard de fait pour souscription AV 100% en ligne sans virement initial.

---

## 3. Cadre réglementaire — ce qui est négociable vs non-négociable

### 3.1 Les règles d'or

**Règle fondamentale** : l'IA **prépare et propose**, le CGP **valide et signe**.

Toute recommandation envoyée à un client doit avoir une **trace de validation humaine** (log horodaté avec identité du CGP). C'est la ligne rouge AMF/ACPR — **non négociable**.

### 3.2 Matrice délégation IA ↔ validation CGP

| Étape | IA autonome | Validation CGP obligatoire |
|---|---|---|
| Collecte KYC | ✅ | Exceptions |
| Questionnaire d'adéquation | ✅ | ✅ Avant toute reco |
| Analyse patrimoniale (fiscal/succession/immo) | ✅ | Signature rapport |
| **Recommandation produit** | Préparation | **✅ Obligatoire** (MIF II / DDA) |
| Rédaction rapport d'adéquation | ✅ | ✅ Relecture |
| Souscription (signature, KYC-forte) | ✅ | Contrôle post |
| Alertes, suivi, arbitrages | ✅ | Arbitrages significatifs |
| Réclamations | ❌ | ✅ |

### 3.3 Cadres complémentaires à intégrer *by design*

- **AI Act UE** (entrée progressive 2025-2027) : système évaluant l'adéquation produit = **"à haut risque"**. Obligations : documentation, qualité données, supervision humaine, registre, transparence.
- **DORA** (depuis janvier 2025) : résilience opérationnelle numérique — gestion risques IT, incidents, tests, sous-traitants critiques.
- **RGPD** : DPO, consentement, droit à l'effacement (attention avec l'archivage 10 ans).
- **LCB-FT** : vigilance renforcée pour l'entrée en relation à distance.

### 3.4 Archivage à valeur probante

- **Contrats d'assurance** : durée du contrat + prescription (10 ans AV, 30 ans non-réclamés)
- **Conseil en investissement** : 5 ans minimum (7 ans si demandé par l'autorité)
- **LCB-FT** : 5 ans après fin de relation
- **Format** : NF Z42-013 / horodatage qualifié eIDAS

---

## 4. Architecture technique cible — multi-agents Claude

### 4.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (PWA)                            │
│              ikcp.eu + app mobile installable               │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│   │   Marcel    │  │  Simulateurs│  │   Espace    │         │
│   │  (Agent IA) │  │  (IR, Succ) │  │   Client    │         │
│   └─────────────┘  └─────────────┘  └─────────────┘         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          ORCHESTRATION (Cloudflare Workers)                  │
│                                                              │
│   ┌────────────────────────────────────────────────┐        │
│   │  Agent Orchestrator (Claude Agent SDK)         │        │
│   │  Router & Memory Manager (D1 + KV)             │        │
│   └──────────────┬─────────────────────────────────┘        │
│                  │                                           │
│     ┌────────────┼────────────┬────────────┬───────────┐    │
│     ▼            ▼            ▼            ▼           ▼    │
│  ┌──────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐ ┌─────┐ │
│  │Disco-│  │ Analyse  │  │  Reco   │  │Compliance│ │Exéc-│ │
│  │very  │  │patrimon. │  │ produit │  │          │ │ution│ │
│  └──────┘  └──────────┘  └─────────┘  └──────────┘ └─────┘ │
│  KYC-light  calculs       sélection     DER/RA/DIPA  API    │
│  Profil     déterministes solutions     génération   partner│
└───────────┬─────────────────────────────────────────┬───────┘
            │                                         │
            ▼                                         ▼
    ┌──────────────┐                         ┌───────────────┐
    │  Dashboard   │                         │   Partenaires │
    │   Maxime     │◄──── validation ────────┤   externes    │
    │  (Human-in-  │      humaine            │  Yousign      │
    │   the-loop)  │                         │  Ubble        │
    └──────────────┘                         │  Nortia/Alph. │
                                             └───────────────┘
```

### 4.2 Les 5 agents Claude + orchestrateur

#### **Agent Orchestrator** (Claude Agent SDK)
- Reçoit toute requête client
- Maintient la mémoire de session (D1 : conversations, profils, docs)
- Route vers les sous-agents selon l'intention détectée
- Agrège les résultats et compose la réponse finale
- Gère le human-in-the-loop (file d'attente de validation)

#### **Agent 1 — Discovery** (collecte & KYC-light)
- **Rôle** : qualifier le visiteur, construire le profil
- **Tools** : questionnaire dynamique, extraction localStorage, appel Ubble pour vérif ID avancée
- **Sortie** : `{profil_complet, score_maturité_dossier}`

#### **Agent 2 — Analyse patrimoniale** (déterministe + LLM)
- **Rôle** : calculer tous les indicateurs patrimoniaux
- **Tools** : `calc_ir_2026`, `calc_droits_succession`, `calc_ifi`, `calc_capacité_épargne`, `calc_pension_retraite`
- **Sortie** : rapport structuré avec chiffres exacts et sources juridiques

#### **Agent 3 — Recommendation** (sélection produits)
- **Rôle** : proposer 1-3 solutions adaptées au profil et objectifs
- **Tools** : base de connaissances produits (RAG sur catalogue grossistes), matcher profil ↔ produit
- **Sortie** : `{propositions:[{produit, assureur, arguments, risques, alternatives}]}`
- **⚠️ Output marqué "PROPOSITION" — pas de transmission client sans validation Maxime**

#### **Agent 4 — Compliance** (génération documents réglementaires)
- **Rôle** : générer automatiquement les livrables MIF II / DDA
- **Tools** : templates DER, Lettre de Mission, Rapport d'Adéquation, DIPA
- **Sortie** : docs PDF pré-remplis prêts à signature après validation Maxime
- **Conformité** : chaque doc inclut mentions légales, sources, exhaustivité de l'analyse

#### **Agent 5 — Exécution** (souscription & signature)
- **Rôle** : orchestrer l'onboarding et la souscription après go de Maxime
- **Tools** : API Ubble (KYC fort), API Yousign/Universign (signature), API Nortia/Alpheys (souscription)
- **Sortie** : contrat signé, n° de police, accusé d'exécution

### 4.3 Stack technique

| Couche | Technologie | Rationale |
|---|---|---|
| Frontend | PWA existante (HTML/JS/CSS) → évolution Next.js | Réutilise ce qui marche |
| Agents IA | **Claude Agent SDK** (Anthropic) | Natif multi-agents, tool calling, prompt caching |
| Orchestration | **Cloudflare Workers** | Déjà en place, pas de cold start, edge |
| Base de données | **Cloudflare D1** (SQLite) | Profils, conversations, dossiers |
| Cache | **Cloudflare KV** | Session, logs (existant MARCEL_LOGS) |
| Documents | **Cloudflare R2** (S3-compatible) | PDFs signés, justificatifs, archives |
| Queue validation | **Cloudflare Queues** | File d'attente "dossiers à valider par Maxime" |
| Analytics | **Cloudflare Analytics Engine** | Métriques temps réel |
| CI/CD | GitHub Actions → Cloudflare | Déploiement automatique |

**Avantages de rester sur Cloudflare** : tout est déjà là, un seul compte, un seul facturé, edge mondial, sécurité ISO 27001/SOC 2, conforme DORA.

---

## 5. Modèle économique

### 5.1 Sources de revenus

| Source | Description | Ordre de grandeur |
|---|---|---|
| **Commissions d'apporteur** | Rétrocessions assureurs sur souscription (existant) | 0-4,5% frais entrée |
| **Rétrocession encours** | % annuel sur AUM (Assets Under Management) | 0,30-0,80%/an |
| **Honoraires de conseil** | Forfait pour dossier complexe (succession, transmission) | 500-3000€/dossier |
| **Abonnement Marcel Premium** | Accès illimité à l'agent IA (vs gratuit limité) | 19-49€/mois ? |
| **Licensing B2B** | Vendre la techno à d'autres CGP (futur) | Plus tard |

### 5.2 Structure de coûts (estimation mensuelle)

| Poste | Phase 1 (test) | Phase 2 (100 clients) | Phase 3 (1000 clients) |
|---|---|---|---|
| Anthropic API (avec prompt caching) | ~50€ | ~500€ | ~3000€ |
| Cloudflare (Workers + D1 + R2 + KV) | ~20€ | ~100€ | ~500€ |
| Yousign (signatures) | ~50€ | ~300€ | ~2000€ |
| Ubble (KYC) | ~100€ | ~500€ | ~3000€ |
| Hostinger + domaines | ~10€ | ~10€ | ~30€ |
| Monitoring, sécurité | ~0€ | ~50€ | ~200€ |
| RC Pro, compliance | variable | variable | variable |
| **Total infra** | **~230€/mois** | **~1460€/mois** | **~8730€/mois** |

### 5.3 Point de bascule

- **Client moyen** : 50 000 € d'AUM (hypothèse prudente)
- **Rétrocession moyenne** : 0,5%/an = 250 €/an/client = ~21 €/mois
- **Break-even Phase 2** : ~70 clients actifs
- **Break-even Phase 3** : ~420 clients actifs

À comparer au coût d'un CGP salarié qu'il faudrait embaucher pour scaler de la même façon : ~80 000 €/an chargé. La techno remplace ~2-3 embauches dès la Phase 3.

---

## 6. Roadmap 18 mois

### Phase 1 — Lead gen & qualification (0-4 mois)
**Objectif** : aucun verrou réglementaire, maximum de valeur.

**Livrables** :
- ✅ Marcel v2.1 (fait)
- ⏳ Dashboard Maxime v1 : voir les prospects qualifiés, leur score, leurs questions
- ⏳ Agent Discovery : questionnaire dynamique qui remplit le profil client en 5 min
- ⏳ Agent Analyse (amélioré) : mini-rapport structuré généré automatiquement
- ⏳ Module RDV automatisé : transmission dossier pré-qualifié au bon créneau Maxime
- ⏳ Module Notion intégration : synchronisation prospects en automatique

**KPI** : x3 de taux de RDV qualifiés / temps passé en prospection.

**Coût infra mensuel** : ~230 €.

### Phase 2 — Co-pilot souscription (4-12 mois)
**Objectif** : premier client qui souscrit 100% en ligne avec validation Maxime.

**Livrables** :
- Intégration **Yousign API** : signature électronique embarquée dans le chat
- Intégration **Ubble API** : KYC fort embarqué (PVID ANSSI)
- Partenariat **Nortia ou Alpheys** (1 grossiste au départ) : accès API souscription
- **Agent Compliance** : génération auto DER + Lettre de Mission + Rapport d'Adéquation
- **Agent Recommendation** : catalogue produits initial (assurance-vie + PER simples)
- **Dashboard Maxime v2** : file d'attente de validation, 1 clic pour approuver
- **Espace client** : suivi contrats, documents, historique
- **Module R2 archivage** : horodatage eIDAS, WORM 10 ans
- **Conformité AI Act** : registre IA, documentation, plan de tests

**KPI** : premier client onboardé online de A à Z, temps moyen dossier < 30 min client + 10 min Maxime.

**Coût infra mensuel** : ~1460 € à 100 clients.

### Phase 3 — Plateforme autonome supervisée (12-18 mois)
**Objectif** : scale et différenciation.

**Livrables** :
- Marcel **autonome sur cas simples** (< 50k€, profil défensif, AV standard)
- **Rebalancing automatique** sur mandats
- **Alertes proactives** : "M. Dupont, la LF 2027 change X, voici 3 actions"
- **Ouverture produits** : pierre-papier, PEA, capital investissement (via grossistes)
- **Module Gestion Sous Mandat** (MSM) avec allocation dynamique IA
- **RAG sur base de connaissances IKCP** : vos articles, vos cas, votre ton
- **Multilingue** : EN (expatriés), DE (frontaliers Suisse-Megève)
- **Licensing B2B** : autres CGP peuvent utiliser la plateforme

**KPI** : 500+ clients actifs, 50M€+ d'AUM, marge opérationnelle > 30%.

**Coût infra mensuel** : ~8700 € à 1000 clients.

---

## 7. Risques et mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Refus partenariat grossiste** | Moyen | Fort | Plan B : intégration directe avec 1-2 assureurs à volume initial modeste, ou white-label avec MonFinancier/Linxea pour démarrer |
| **Évolution défavorable AMF/ACPR** | Faible | Fort | Veille réglementaire continue, archivage complet, juridique MIF II dès le début |
| **Incident sécurité / RGPD** | Faible | Critique | Cloudflare + chiffrement, DPO externe, pentests, cyber-assurance |
| **Concurrent fintech émerge** | Moyen | Moyen | Time-to-market agressif, différenciation "Protection" + "Pluridisciplinaire + Human-in-loop" |
| **AI Act impose contraintes lourdes** | Moyen | Moyen | Architecture by-design avec registre IA, documentation algorithmes, revue humaine documentée |
| **RC Pro refuse de couvrir** | Moyen | Fort | Discussion préalable avec assureur RC, probable avenant + surcoût à anticiper |
| **Adoption client lente** | Moyen | Moyen | Campagne pédagogique, démarrer sur clients existants qui connaissent Maxime |

---

## 8. Prochaines étapes concrètes (semaine du 23/04/2026)

### Immédiat
- [ ] **Valider la vision** avec Maxime (ce document comme base)
- [ ] **Prise de contact Nortia et Alpheys** : obtenir docs API, conditions CGP, volumes minimaux 2026
- [ ] **Prise de contact Yousign + Ubble** : demander POC gratuit 30 jours
- [ ] **Audit RC Pro** : vérifier couverture actuelle, prévenir l'assureur du projet
- [ ] **Contact juriste spécialisé CGP** : validation préalable du design conforme MIF II / AI Act

### Court terme (2-4 semaines)
- [ ] **Prototype Phase 1** : Agent Discovery + Dashboard Maxime v1 (pas de souscription, juste qualification)
- [ ] **Migration D1** : schema des tables profils, conversations, dossiers
- [ ] **Tests utilisateurs** sur 5 prospects existants

### Moyen terme (2-3 mois)
- [ ] **Lancement Phase 1** en production
- [ ] **Partenariat grossiste signé** (objectif Nortia ou Alpheys)
- [ ] **Recrutement ponctuel** : juriste compliance en consulting 1-2j/mois

---

## 9. Annexes

### 9.1 Glossaire
- **CIF** : Conseiller en Investissements Financiers (statut AMF)
- **COA** : Courtier en Opérations d'Assurance (statut ORIAS)
- **MIF II** : directive européenne sur les marchés d'instruments financiers
- **DDA** : directive européenne sur la distribution d'assurances
- **PVID** : Prestataire de Vérification d'Identité à Distance (certification ANSSI)
- **eIDAS** : règlement UE sur identification et signature électroniques
- **AI Act** : règlement européen sur l'intelligence artificielle
- **DORA** : règlement européen sur la résilience opérationnelle numérique
- **DER** : Document d'Entrée en Relation (obligation MIF II)
- **RA** : Rapport d'Adéquation (obligation MIF II / DDA)
- **DIPA** : Document d'Information Précontractuel Assurance (DDA)
- **AUM** : Assets Under Management (encours sous gestion)
- **MSM** : Mandat de Gestion (Gestion Sous Mandat)
- **RAG** : Retrieval-Augmented Generation (LLM + base de connaissances)

### 9.2 Liens utiles
- AMF documentation conseil automatisé : `amf-france.org/fr/professionnels/prestataires-financiers/mon-metier/conseil-automatise`
- ACPR recommandation souscription distance 2022-R-01 : `acpr.banque-france.fr`
- ANSSI PVID : `cyber.gouv.fr/PVID`
- Claude Agent SDK : `docs.anthropic.com/en/docs/agents-and-tools/claude-agent-sdk`
- AI Act texte officiel : `eur-lex.europa.eu/eli/reg/2024/1689`

---

**Ce document est vivant. Il sera mis à jour à chaque jalon majeur.**

*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial*
*ORIAS 23001568 · SIREN 947 972 436 · ikcp.eu*
