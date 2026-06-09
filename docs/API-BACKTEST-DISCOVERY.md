# Backtest API + découverte — IKCP SaaS 3.0 / Family Office Digital

> Audit complet de l'écosystème API IKCP au **3 juin 2026**.
> Backtest des intégrations existantes, scoring risque/coût/santé,
> découverte des APIs manquantes pour la vision SaaS 3.0 + Family
> Office 100% digital + application mobile.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## 1. Vision adressée

> *"Cabinet de gestion de patrimoine SaaS 3.0 avec family office 100% digital + application"*

Décomposition en **4 axes** :

| Axe | Promesse client | APIs critiques |
|---|---|---|
| **A — Vue 360° patrimoine en temps réel** | « Je vois tout mon patrimoine, partout, en 1 vue » | Open Banking, marchés, immo, sociétés |
| **B — Marcel + agents IA augmentés** | « Je pose une question, j'ai une réponse référencée en 5s » | Anthropic, Mistral, Perplexity, OCR |
| **C — Compliance et signature 100% dématérialisée** | « Aucun papier, aucune perte de temps » | eIDAS, KYC, archivage probant |
| **D — Cabinet en autopilot (back office)** | « Le CGP passe 80% de son temps en relation client » | Comptabilité, facturation, calendrier, CRM |

Le backtest et la découverte ci-dessous sont organisés par axe.

---

## 2. Backtest — APIs déjà intégrées (16 endpoints externes + 5 inter-workers)

### Scoring : santé · coût marginal/client/mois · risque RGPD · alternative

| API | Worker | Axe | Santé | Coût/client/mois | Risque RGPD | Note backtest |
|---|---|---|---|---|---|---|
| **api.anthropic.com** (Claude Messages + Managed Agents) | ikcp-marcel, ikcp-codex, ikcp-hermes, ikcp-batisseur, ikcp-lifestyle, ikcp-agents | B | 🟢 LIVE | $0.40-$1.20 | 🟡 US infra (DPA Enterprise + ZDR à signer) | Modèle déprécié sur Marcel chat (`claude-sonnet-4-20250514` → migrer vers `claude-sonnet-4-6` avant juin 2026). Agents Opus 4.7 OK |
| **api.mistral.ai** (chat + audio transcriptions Voxtral) | ikcp-voice, ikcp-veille (?) | B | 🟢 LIVE | $0.05-$0.20 | 🟢 EU sovereign (Mistral La Plateforme FR) | Excellent pour cohérence pitch "IA souveraine". Ajouter chat Mistral en fallback Marcel ? |
| **api.perplexity.ai** (Sonar + Sonar Deep Research) | ikcp-veille | B | 🟢 LIVE | $0.20-$0.50 | 🟡 US-based mais ZDR option | Bon ratio coût/fraîcheur. Modèle `sonar-deep-research` = équivalent à un analyste 30 min |
| **api.pappers.fr** (v2 — SIREN cartographie + dirigeants) | ikcp-pappers | A | 🟢 LIVE | ~€0.10-€0.30 | 🟢 EU FR | Bien intégré + cache KV. Alternative INPI Data Open Source à terme (gratuit) |
| **api.insee.fr** (données locales V0.1) | ikcp-client | A | 🟢 LIVE | gratuit | 🟢 EU FR (institution publique) | Token gratuit. Élargir aux SIRENE, BdF Webstat (taux, inflation) |
| **api-adresse.data.gouv.fr** (BAN) | divers | A | 🟢 LIVE | gratuit | 🟢 EU FR | Stable. Bon pour autocomplete adresse |
| **api.piste.gouv.fr** (Légifrance) | ikcp-codex (?) | C | 🟡 LIVE BETA | gratuit | 🟢 EU FR | API endpoint `legifrance-beta` — surveiller la sortie de beta. Fiabilité moyenne mais sources officielles inégalables |
| **files.data.gouv.fr** | divers | A | 🟢 LIVE | gratuit | 🟢 EU FR | Pour DVF (immobilier), Bodacc, etc. |
| **api.brevo.com** (ex-Sendinblue) | ? | D | 🟢 LIVE | ~€10 fixe + €0.001/email | 🟢 EU FR | Newsletter UPPERCUT (Beehiiv) + transactionnel ? Vérifier doublon avec Resend |
| **api.resend.com** (email transactionnel) | ikcp-client, ikcp-agents | D | 🟢 LIVE | $0.0004/email | 🟡 US-based, EU residency disponible (option) | Bien pour magic-link. Activer EU residency option |
| **api.stripe.com** (Checkout + Portal) | ikcp-client | D | 🟡 CODE PRÊT, non actif | €0.25 + 1.4% | 🟡 US/IE base | À activer dès compte créé. Stripe Atlas pas nécessaire (cabinet déjà FR) |
| **api.notion.com** | legacy | D | 🔴 LEGACY | $8/seat/mois | 🟡 US-based, infra | À déprécier — migrer contenus vers GitHub/Sveltia ou Pennylane |
| **VoxCPM2 (Modal.run)** | ikcp-voice | B | 🟡 LIVE (TTS) | $0.001/min audio | 🟢 self-hosted, Apache 2.0 | Bon choix open-source. Vérifier latence vs ElevenLabs |
| **github.com** (commits depuis CMS) | ikcp-cms-auth | D | 🟢 LIVE | gratuit | 🟡 US (Microsoft) | Acceptable car repo de **code+contenu pédagogique**, pas de PII client |
| **rebrickable.com** | ? | - | ❓ | ? | - | À investiguer : Lego API ?? Probable test, à nettoyer si pas utile |
| **api.piste.gouv.fr/dila** | ikcp-codex | C | 🟡 BETA | gratuit | 🟢 EU FR | Idem note Piste |

### Inter-workers (HMAC / service binding)

| De → vers | Rôle | Santé |
|---|---|---|
| ikcp-marcel → ikcp-codex | Sous-traitance fiscal Opus 4.7 | 🟢 |
| ikcp-marcel → ikcp-hermes | Sous-traitance transmission Opus 4.7 | 🟢 |
| ikcp-marcel → ikcp-batisseur | Sous-traitance patrimoine 360° | 🔴 `ANTHROPICAPIKEY` manquant |
| ikcp-marcel → ikcp-veille | Sous-traitance veille marchés | 🟢 |
| ikcp-marcel → ikcp-lifestyle | 8 agents Sonnet (univers) | 🟢 |
| ikcp-marcel → ikcp-temoin | Audit log MIF II D1 Paris | 🟢 |
| ikcp-client → ikcp-pappers | Cartographie SIREN front | 🟢 |

### Top 3 alertes du backtest

1. 🔴 **ikcp-batisseur down** — `ANTHROPICAPIKEY` manquant côté Worker → flip `live:false` dans Marcel orchestrateur. **Action : 30 sec, dashboard CF.**
2. 🟡 **Modèle Marcel chat déprécié** — `claude-sonnet-4-20250514` retire 2026-06-15. Migrer vers `claude-sonnet-4-6` (2 lignes dans `workers/ikcp-marcel/worker.js`).
3. 🟡 **rebrickable.com** — appel inconnu dans le code, à nettoyer si pas justifié.

### Coût total mensuel estimé (cohorte beta 50 familles)

| Provider | Volume | Coût |
|---|---|---|
| Anthropic (Claude, Marcel + agents) | ~15k chat + 200 sessions | ~$80 |
| Mistral (voice STT + fallback) | ~50h audio | ~$15 |
| Perplexity (veille quotidienne) | 30 deep research/mois | ~$30 |
| Pappers v2 | ~500 SIREN/mois | ~€50 |
| Brevo + Resend | ~2000 emails | ~€15 |
| Cloudflare (Workers + D1 + R2 + KV) | usage actuel | ~$5 |
| **Total runtime APIs** | — | **~$195/mois** |

À 50 familles beta gratuites → coût net IKCP. À 50 familles payantes 6 800€/an → revenu 28 333€/mois, marge nette infra > 99% sur ces APIs.

---

## 3. Découverte — APIs manquantes pour SaaS 3.0 / Family Office 100% digital

### Axe A — Vue 360° patrimoine

| API | Quoi | Coût/mois | Souverain ? | Priorité |
|---|---|---|---|---|
| **Powens** (ex-Budget Insight) | Agrégation comptes bancaires FR (DSP2), 300+ banques | €150-300 fixe + €0.50/connexion | 🟢 EU FR (Paris) | 🔥 P0 — bloqueur Family Office sans ça |
| **Bridge API** (ex-Bankin') | Concurrent Powens, DSP2 agrégation | €99-249/mois | 🟢 EU FR | 🔥 P0 (alternative) |
| **Tink** (Visa) | Agrégation, paiements | €€€ premium | 🟡 EU mais Visa US | P1 (option enterprise) |
| **DVF (data.gouv.fr)** | Demandes Valeurs Foncières — prix immobilier réels | gratuit | 🟢 EU FR | 🔥 P0 — pour évaluation immo |
| **INPI Data** (RNE Open Source) | Sociétés, Kbis, bénéficiaires effectifs | gratuit | 🟢 EU FR | P1 — complément Pappers gratuit |
| **Bodacc** (data.gouv.fr) | Annonces sociétés (création, modif, cession) | gratuit | 🟢 EU FR | P1 — alertes événements sociétés clients |
| **Bigdata.com MCP** (déjà connecté en MCP server) | Tearsheets entreprises, sentiment marchés | €€ enterprise | 🟡 US | P2 — pour conviction-overview |
| **Banque de France Webstat** | Taux d'intérêt, inflation, indices | gratuit | 🟢 EU FR | P2 — pour scénarios macro |
| **AlphaVantage / Finnhub** | Cotations actions/ETF | gratuit/freemium | 🟡 US | P2 — pour PEA tracking |

### Axe B — IA augmentée

| API | Quoi | Coût/mois | Souverain ? | Priorité |
|---|---|---|---|---|
| **Mistral chat** (déjà voice) | Modèle FR pour Marcel-fallback ou agent souverain dédié | $0.05-0.20/client | 🟢 EU FR | 🔥 P0 — cohérence pitch souveraineté |
| **Voyage AI / Cohere embed** | Embeddings pour RAG (recherche docs client) | $0.10/1M tokens | 🟡 US | P1 — pour Marcel mémoire docs |
| **Pinecone / Qdrant Cloud / Cloudflare Vectorize** | Vector DB pour RAG | $25-100 fixe | Vectorize 🟢 EU | P1 (préférer Vectorize) |
| **OpenAI Whisper API** | STT haute qualité fallback | $0.006/min | 🟡 US | P3 — Voxtral suffit |

### Axe C — Compliance et signature 100% dématérialisée

| API | Quoi | Coût/mois | Souverain ? | Priorité |
|---|---|---|---|---|
| **Universign** (déjà pause) | Signature eIDAS qualifié FR | €1-2/sig | 🟢 EU FR | 🔥 P0 — réactiver pour lettre de mission |
| **Yousign** | Concurrent eIDAS qualifié FR, UX moderne | €1-1.5/sig | 🟢 EU FR | 🔥 P0 (alternative Universign) |
| **Onfido** (Entrust) | KYC vidéo, vérification ID + face match | €2-5/KYC | 🟡 UK | P1 — pour onboarding beta |
| **France Connect+** | Auth citoyen via Impots/AMELI/etc. | gratuit | 🟢 EU FR | P1 — UX onboarding premium |
| **api.impots.gouv.fr** (DGFiP) | Vérification fiscale officielle | gratuit (sur agrément) | 🟢 EU FR | P2 — Phase 3 |
| **OVH SignBox / Docaposte** | Archivage probant NF Z42-013 | €€ | 🟢 EU FR | P2 — pour signature à valeur probante long terme |

### Axe D — Cabinet en autopilot (back office)

| API | Quoi | Coût/mois | Souverain ? | Priorité |
|---|---|---|---|---|
| **Pennylane** | Comptabilité moderne FR (export FEC, facturation, banque) | €35-99 fixe | 🟢 EU FR | 🔥 P0 — remplace Notion + Excel |
| **Indy** | Comptabilité profession libérale (CGP) | €15-39 fixe | 🟢 EU FR | P0 (alternative Pennylane) |
| **Cal.com** | Booking RDV partenaires (notaire, avocat, EC) — open source | gratuit (self-host) ou €15/seat | 🟢 EU possible | 🔥 P0 — UX "tout en un" |
| **Brevo** (déjà) | Marketing email + SMS + chat | €25-65 fixe | 🟢 EU FR | P1 — étendre au SMS |
| **Twilio** | SMS transactionnel (2FA, alertes) | $0.05/SMS FR | 🟡 US | P2 — Brevo SMS suffit |
| **Plausible / Matomo** | Analytics privacy-friendly | €9-19 fixe | 🟢 EU FR | P1 — remplace Google Analytics (banni RGPD) |
| **Sentry** | Error tracking Workers + front | $26 fixe | 🟡 US, EU residency option | P1 — observability prod |
| **Posthog** (alternative) | Product analytics + sessions replay | self-hostable EU | 🟢 EU possible | P2 |

### Application mobile

| Stack | Quoi | Effort | Priorité |
|---|---|---|---|
| **PWA actuelle** | Déjà en place (manifest.json + sw.js + iOS meta) | déjà fait ✅ | maintenir |
| **Capacitor** (Ionic) | Wrapper PWA → iOS/Android natif app stores | 2-3 semaines pour publication initiale | P1 — quand 100 familles |
| **Expo / React Native** | Refonte app native, push notifications, biométrie | 3-6 mois pour parité | P3 — pour scale > 1000 |

**Reco app mobile :** PWA suffit jusqu'à 200 familles. Capacitor pour les stores (UX premium + push notifications natives) en Phase 2.

---

## 4. GitHub partagé — comment ouvrir le repo sans casser la sécurité

### Le repo aujourd'hui

`max51527/ikcp-site` est **privé**, propriété de Maxime seul. Tout y vit (code, contenu, agents YAML, docs, migrations). Si Maxime veut collaborer (dev externe, CGP partenaire, audit), il faut une stratégie.

### Options de partage

| Option | Pour qui | Sécurité | Reco |
|---|---|---|---|
| **Outside collaborator** (free, max 100 par repo privé) | Dev externe ponctuel | Accès lecture+écriture sur toutes les branches | ⚠️ Trop large |
| **GitHub Teams + Branch protection** | Cabinet ≥ 2 personnes | Granulaire : seul main protégé, dev en PR | 🟢 Recommandé |
| **Fine-grained Personal Access Token** (PAT) | Bot / outil externe | Scoped à 1 repo, lecture seule ou repo:contents | 🟢 Pour bots (ant CLI, Sveltia) |
| **GitHub App** | Intégration tierce (Cloudflare Pages, Sentry) | Permissions précises, OAuth | 🟢 Pour automation |
| **Submodule / monorepo split** | Code public / code privé | Sépare ce qui peut être Open Source | P2 |

### Setup recommandé J0

1. **Activer Branch Protection sur `main`** :
   - dash GitHub → Settings → Branches → "Add rule"
   - Branch name pattern : `main`
   - ✅ Require a pull request before merging
   - ✅ Require approvals : 1 (toi)
   - ✅ Require status checks to pass : `Validate Content`, `Deploy Cloudflare Workers`
   - ✅ Restrict who can push : seulement Maxime + GitHub App Sveltia

2. **Inviter des collaborateurs externes via Outside Collaborator** (1 par 1, scope: write) :
   - Settings → Collaborators → "Add people"
   - Dev externe → branche `dev/<name>/*` (politique nommage)
   - Pas de droit merge sur main, doit passer par PR

3. **Créer fine-grained PAT pour Sveltia OAuth** (déjà fait via ikcp-cms-auth, OAuth App = best)

4. **Activer Dependabot + secret scanning** :
   - Settings → Security → "Enable all" (Dependabot alerts, Code scanning, Secret scanning)
   - Gratuit sur repos privés depuis 2023

5. **CODEOWNERS** pour reviews auto :

```text
# .github/CODEOWNERS
*                  @max51527
workers/**         @max51527
agents/**          @max51527
content/**         @max51527 @cmf-junior  # ex: junior partner sur le contenu
docs/**            @max51527 @cmf-junior
```

### Cas concrets

| Scénario | Solution |
|---|---|
| **Maxime engage un dev junior** | Outside collaborator, branche `dev/<name>/*`, PR avec review obligatoire |
| **Audit sécurité externe** | Outside collaborator en read-only (rôle "Triage") |
| **Cabinet ouvre à un CGP associé** | GitHub Teams (passe le repo en Organization `ikcp-org`), Team `cabinet` avec write |
| **Ajout d'un MCP partenaire (notaire, banque)** | GitHub App dédiée, scope `repo:contents:read` uniquement |
| **Sveltia bot commits** | OAuth via ikcp-cms-auth, commits attribués au compte GitHub de l'éditeur (Maxime) |

---

## 5. Plan d'intégration phasé

### Phase 1 — Quick wins compliance + UX (4 semaines)

- [ ] **Migrer Marcel chat** vers `claude-sonnet-4-6` (15 min) + adaptive thinking (`shared/model-migration.md`)
- [ ] **Activer ikcp-batisseur** : poser `ANTHROPICAPIKEY` (5 min, flip `live:true` dans Marcel)
- [ ] **Nettoyer rebrickable.com** si non justifié (audit + grep)
- [ ] **Activer Stripe** (compte + secrets) — déblocage monétisation
- [ ] **Réactiver Universign OU intégrer Yousign** — lettre de mission digitale = bloqueur Premium
- [ ] **Brancher Pennylane** ou Indy — remplacer Notion legacy
- [ ] **Brancher Plausible** — analytics RGPD-safe
- [ ] **DPA Anthropic Enterprise + ZDR signé** — bloqueur compliance Managed Agents
- [ ] **Branch protection main** + Dependabot — sécurité repo
- [ ] **Audit secrets fuite** : `grep -r "sk-" workers/` (rapide)

### Phase 2 — Family Office 360° (8 semaines)

- [ ] **Powens OU Bridge** — agrégation bancaire DSP2 (1 worker `ikcp-banking`)
- [ ] **DVF intégration** — évaluation immobilière dans Marcel + dashboard
- [ ] **INPI Data** — complément Pappers gratuit
- [ ] **Bodacc** — alertes événements sociétés clients
- [ ] **Mistral chat** — fallback Marcel souverain (cohérence pitch)
- [ ] **Cloudflare Vectorize** — RAG sur docs clients (mémoire Marcel par famille)
- [ ] **Cal.com self-hosted** — booking RDV partenaires
- [ ] **Sentry** — observability prod
- [ ] **Capacitor wrap PWA** → publication iOS + Android stores

### Phase 3 — Premium institutionnel (16 semaines)

- [ ] **France Connect+** — onboarding premium
- [ ] **api.impots.gouv.fr** (sur agrément) — vérification fiscale officielle
- [ ] **OVH SignBox / Docaposte** — archivage probant NF Z42-013
- [ ] **GitHub Organization `ikcp-org`** — passage Teams si cabinet grandit
- [ ] **Bigdata.com** ou Refinitiv lite — pour conviction-overview pro
- [ ] **Onfido KYC vidéo** — onboarding bespoke > 5M€

---

## 6. Synthèse — santé écosystème API

```
        ┌──────────────────────────────────────────────────────────┐
        │  16 APIs externes + 7 workers IA = stack MATURE          │
        │                                                          │
        │  🟢 12 LIVE et fonctionnelles                            │
        │  🟡 3 LIVE avec dette technique (modèle, beta)           │
        │  🔴 1 DOWN (batisseur sans clé)                          │
        │  ❓ 1 INVESTIGATE (rebrickable)                          │
        │  ⏸  1 PAUSE intentionnelle (universign)                  │
        │                                                          │
        │  Couverture vision SaaS 3.0 / FO Digital :               │
        │    Axe A — Patrimoine 360°    : 40 % (manque Open Banking) │
        │    Axe B — IA augmentée       : 90 % (très solide)       │
        │    Axe C — Compliance         : 60 % (manque sig + KYC)  │
        │    Axe D — Back office        : 50 % (manque compta)     │
        │                                                          │
        │  Quick wins Phase 1   : ~4 semaines, coût marginal nul   │
        │  Family Office 360°   : Phase 2 = bloqueur valeur réelle │
        └──────────────────────────────────────────────────────────┘
```

**Verdict** : la stack IA est **excellente** (90%). La stack Family Office data
est **incomplète** (40%) — l'agrégation bancaire DSP2 est le prochain bloqueur
pour tenir la promesse "vue 360° temps réel". À prioriser **avant** d'ouvrir
la beta payante.

---

*Backtest API v1.0 · 2026-06-03 · © IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
