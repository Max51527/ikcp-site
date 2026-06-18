# IKCP — Registre IA · Conformité AI Act UE

> **Objet** : registre des systèmes IA déployés par IKCP, en conformité
> avec le règlement (UE) 2024/1689 (AI Act). Tenu à jour, opposable,
> pour les autorités compétentes (DGCCRF, ACPR, AMF, CNIL).
>
> **Statut** : v1 · 09/05/2026
> **Tenue du registre** : Maxime Juveneton (DPO de fait pour IKCP)
> **Révision** : trimestrielle ou à chaque évolution majeure d'un agent

---

## 0. Cadre légal applicable

- **Règlement (UE) 2024/1689** du 13 juin 2024 (AI Act) — entrée en vigueur progressive 2025-2027
- Article 6 et Annexe III §5(b) : *systèmes d'IA destinés à évaluer la solvabilité ou le scoring de crédit des personnes physiques* — **classification haut risque**
- Article 13-15 : transparence, supervision humaine, qualité des données
- Article 9 : système de gestion des risques
- Article 17 : système de management de la qualité

**Position IKCP** : le système Marcel **prépare** des analyses patrimoniales mais **ne décide jamais** d'octroi de produit ou de souscription. La décision finale revient à Maxime Juveneton (CGP CIF + COA, ORIAS 23001568) qui valide chaque recommandation. Cette architecture *human-in-the-loop* ramène le risque opérationnel sous le seuil "haut risque" tout en restant transparent.

---

## 1. Système Marcel — fiche d'identification

| Item | Valeur |
|---|---|
| Nom du système | Marcel · orchestrateur IA patrimonial IKCP |
| Version | v2 (mai 2026) |
| Modèle sous-jacent | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| Hébergement | Cloudflare Workers — région EU (DORA) |
| Code source | `workers/ikcp-marcel/worker.js` — auditable, versionné Git |
| Mise en production | mai 2026 (suite à v1 ikcp-chat 2024) |
| Dernier audit interne | 09/05/2026 (cette fiche) |

### 1.1 Finalité

Assistance pédagogique au visiteur du site ikcp.eu et aux clients membres Family Office IKCP, sur les questions patrimoniales, fiscales, juridiques et lifestyle. **Non-conseiller** au sens MIF II — **préparation** d'analyses pour le CGP humain qui arbitre.

### 1.2 Données traitées

| Catégorie | Données | Base légale RGPD | Durée |
|---|---|---|---|
| Identification | Email, prénom, nom (si fournis) | Art. 6.1.b consentement / contrat | Durée de la relation + 5 ans |
| Conversation | Messages texte échangés avec Marcel | Art. 6.1.b | 90 jours (KV) ou durée relation (D1 si client) |
| Patrimoine | Montants, structures, échéances (si client) | Art. 6.1.b | Durée relation + 10 ans (NF Z42-013) |
| Analytique | Logs anonymisés (timestamp, season, web_search_used) | Art. 6.1.f intérêt légitime | 90 jours |

**Aucune donnée sensible** au sens art. 9 RGPD (santé, opinions, etc.) n'est traitée par Marcel.

### 1.3 Source des données

- **Saisie volontaire** par l'utilisateur (chat, formulaire, upload doc)
- **APIs publiques** : Légifrance (CGI, articles), INSEE (démo, mortalité), DVF (transactions immo) — données ouvertes etalab
- **APIs partenaires** : Anthropic (LLM), Resend (email), Notion (CRM) — contractualisé
- **Aucune** collecte automatique non consentie

### 1.4 Outputs

- Réponses textuelles structurées (markdown léger)
- Schemas dessinés (SVG, dashboard)
- Liens vers sources réglementaires (Légifrance, BOFIP)
- Chiffres calculés par tools déterministes (JS Worker — pas d'hallucination)
- Suggestions de suivi (follow-ups)

**Aucun output** n'est une décision automatisée au sens art. 22 RGPD.

---

## 2. Supervision humaine — l'architecture *human-in-the-loop*

### 2.1 Principe

> *"L'IA prépare. L'humain arbitre."* — Maxime Juveneton, fondateur IKCP

Toute recommandation patrimoniale qui sortirait du cadre pédagogique général (recommandation produit personnalisée, choix d'arbitrage, signature) **passe systématiquement par la file `arbitrages` validée par Maxime**. Cette file est tracée, horodatée, archivée 10 ans (NF Z42-013).

### 2.2 Matrice délégation IA ↔ validation CGP

| Étape | IA autonome | Validation CGP obligatoire |
|---|:---:|:---:|
| Réponse pédagogique générale | ✅ | — |
| Calcul fiscal/successoral via tool | ✅ | — (chiffre déterministe, pas IA) |
| Lecture / classement de document | ✅ | exception : doc engagement client |
| Alerte échéance fiscale | ✅ | — |
| **Recommandation produit personnalisée** | ❌ | ✅ MIF II / DDA |
| **Préparation arbitrage portefeuille** | ✅ préparation | ✅ exécution |
| Génération document réglementaire (DER/RA/DIPA) | ✅ rédaction | ✅ signature |
| Souscription (KYC fort, signature, ordre passé) | ❌ | ✅ contrôle systématique |
| Réponse à réclamation client | ❌ | ✅ |

### 2.3 Mécanismes de supervision dans le code

- `THEME_CONTEXTS` injecte la règle MIF II dans le system prompt à chaque requête (10 règles absolues, vouvoiement, pas de "vous devriez")
- Disclaimer obligatoire en fin de chaque réponse à enjeu : *"Ces informations sont pédagogiques et ne constituent pas un conseil en investissement au sens de la réglementation MIF II"*
- Aucune réponse ne nomme un produit spécifique (assureur, contrat, fonds)
- File D1 `arbitrages.status = 'en_attente'` retient toute proposition d'action — Maxime décide
- Audit log D1 `events` enregistre chaque action agent

---

## 3. Système de gestion des risques (art. 9 AI Act)

### 3.1 Risques identifiés

| Risque | Sévérité | Probabilité | Mitigation actuelle |
|---|:---:|:---:|---|
| Hallucination chiffrée (IR/IFI faux) | élevée | faible | tools déterministes JS — calcul jamais par LLM |
| Conseil produit interdit (MIF II) | élevée | faible | system prompt strict + disclaimer + revue Maxime |
| Source juridique périmée | moyenne | moyenne | barèmes versionnés D1, web search natif sur questions actualité |
| Fuite donnée client | critique | très faible | hébergement EU, chiffrement R2, audit log, accès auth |
| Biais discriminatoire | moyenne | faible | pas de scoring décisionnel, pas de variables sensibles RGPD |
| Contournement freemium | faible | moyenne | quota localStorage (Phase 1) → KV server-side (Phase 2) |
| Indisponibilité API tierce | moyenne | moyenne | fallback mock front, retry exponentiel, monitoring |

### 3.2 Plan de tests

- **Tests unitaires** : tous les tools (calc_*) ont des tests sur cas connus (ex: IR célibataire 80 k€ revenus, donation 200k€ avec antériorité)
- **Tests d'intégration** : suite de prompts patrimoniaux types vérifiés trimestriellement (au moins 50 cas couvrant succession, donation, IFI, transmission, immo)
- **Tests adverse** : 10 prompts cherchant à faire dévier Marcel (recommandation produit, conseil illégal, données sensibles) — Marcel doit refuser proprement
- **Audit annuel externe** : revue par juriste spécialisé CGP (à formaliser Q3 2026)

---

## 4. Transparence (art. 13 AI Act)

### 4.1 Information utilisateur

- Page `family-office-v3-hero-minimal.html` présente Marcel comme un agent IA orchestrateur
- Disclaimer présent dans toute réponse à enjeu
- Sources cliquables (CGI / BOFIP / API) sur chaque chiffre — l'utilisateur peut vérifier
- Page **Conviction** (`proposals/conviction-overview.html`) explicite le workflow : Question → Agent → Données → Schéma sourcé

### 4.2 Identification IA

L'utilisateur sait qu'il interagit avec une IA :
- Bandeau "Marcel · IA orchestrateur" sur les pages publiques
- Disclaimer en pied de chat
- Page family-office précise *"orchestré par Marcel"* sous chaque thématique

---

## 5. Qualité des données (art. 10 AI Act)

- **Données d'entraînement** : aucune — Marcel utilise un modèle fondation Anthropic, pas de fine-tuning sur données IKCP
- **Prompt engineering** : system prompt versionné Git, revue à chaque modification
- **Sources factuelles** : Légifrance (officiel), BOFIP (officiel), INSEE (officiel), DVF (etalab), Anthropic web search → URLs gov.fr / .europa.eu privilégiées
- **Mise à jour barèmes** : LF annuelle intégrée chaque janvier (IR, IFI, DMTG)

---

## 6. Documentation technique (art. 11 + Annexe IV AI Act)

| Document | Localisation | Statut |
|---|---|---|
| Description générale du système | ce document §1 | ✅ |
| Description architecture | `docs/IKCP-PLATFORM-ROADMAP.md` §4 | ✅ |
| Specs des données entrées/sorties | `docs/FAMILY-OFFICE-AGENTS-AUDIT.md` §1 | ✅ |
| Modèle utilisé + version | ce document §1 | ✅ |
| Prompts système | `workers/ikcp-marcel/worker.js` (versionné Git) | ✅ |
| Tools déterministes (code) | `workers/ikcp-marcel/worker.js` lignes ~70-260 | ✅ |
| Procédure de supervision humaine | ce document §2 | ✅ |
| Plan de gestion des risques | ce document §3 | ✅ |
| Indicateurs de performance | à formaliser Q3 2026 (KPI : taux de validation Maxime, taux de réclamation, satisfaction client) | 🟡 |
| Procédure incident | à formaliser Q3 2026 | 🟡 |
| Logs et conservation | KV `MARCEL_LOGS` 90 j + D1 `events` durée relation | ✅ |

---

## 7. Tenue du registre — engagement IKCP

- **Mise à jour à chaque évolution majeure** de Marcel (nouveau modèle, nouveau tool, changement de prompt système)
- **Révision trimestrielle** systématique (mars, juin, septembre, décembre)
- **Communication aux autorités** sur demande (DGCCRF, ACPR, AMF, CNIL)
- **Information clients** : ce document est mis à disposition des membres Family Office sur simple demande
- **Audit externe** : objectif Q3 2026 (juriste spécialisé CGP + cabinet AI Act)

---

## 8. Plan d'action de mise en conformité — 12 mois

| # | Action | Échéance | Responsable | Statut |
|---|---|---|---|---|
| 1 | Documenter ce registre (cette fiche) | mai 2026 | Maxime + Claude | ✅ fait |
| 2 | Avenant RC Pro pour activité IA | juin 2026 | Maxime + assureur | 🟡 à initier |
| 3 | Formaliser DPO externe | juin 2026 | Maxime + DPO | 🟡 à initier |
| 4 | Procédure de gestion des incidents | sept 2026 | Maxime + Claude | 🟡 à rédiger |
| 5 | KPI performance Marcel (dashboard interne) | sept 2026 | Claude | 🟡 à coder |
| 6 | Suite de tests automatisée (50 prompts) | sept 2026 | Claude | 🟡 à coder |
| 7 | Audit externe juriste CGP + cabinet AI Act | déc 2026 | Maxime | 🟡 à planifier |
| 8 | Communication clients (charte usage IA) | déc 2026 | Maxime | 🟡 à rédiger |

---

## 9. Glossaire

- **AI Act** : Règlement UE 2024/1689 sur l'intelligence artificielle
- **CGP** : Conseiller en gestion de patrimoine (CIF + COA dans le cas IKCP)
- **CIF** : Conseiller en Investissements Financiers (statut AMF)
- **COA** : Courtier en Opérations d'Assurance (statut ORIAS)
- **DDA** : Directive sur la distribution d'assurances
- **DGFiP** : Direction Générale des Finances Publiques
- **DORA** : Règlement UE résilience opérationnelle numérique
- **MIF II** : Directive marchés d'instruments financiers révisée
- **NF Z42-013** : Norme française archivage électronique probant
- **ORIAS** : Organisme pour le Registre des Intermédiaires en Assurance

---

*Document opposable · révision trimestrielle · ORIAS 23001568*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · maxime@ikcp.fr*
