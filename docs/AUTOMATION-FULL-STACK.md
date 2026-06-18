# Architecture pleinement automatisée — IKCP

> Plan technique de la chaîne **Claude → GitHub → Sveltia → Cloudflare**
> pour ikcp.eu et l'espace family office. Tout est lié, tout est
> automatisé. Aucune intervention manuelle entre l'édition d'un
> contenu et sa publication.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## 1. Schéma global

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│   👤 MAXIME                                  🤖 CLAUDE (Anthropic via Claude Code) │
│   ┌──────────────────┐                       ┌──────────────────────────────┐     │
│   │ contenu (texte,  │                       │ code (Workers, pages HTML,   │     │
│   │ prix, cas, FAQ)  │                       │ schemas D1, agents, docs)    │     │
│   └────────┬─────────┘                       └──────────────┬───────────────┘     │
│            │                                                │                     │
│            │ login GitHub OAuth                             │ via Claude Code CLI │
│            │ via auth.ikcp.eu                               │                     │
│            ▼                                                ▼                     │
│   ┌─────────────────────┐                       ┌──────────────────────────┐      │
│   │  📝 SVELTIA CMS     │                       │  💻 Branche claude/*     │      │
│   │  admin.ikcp.eu      │                       │  + PR review             │      │
│   │  UI no-code         │                       │  + tests + lint          │      │
│   └──────────┬──────────┘                       └─────────────┬────────────┘      │
│              │ commit .md/.json                                │ merge → main     │
│              │ directement sur main                            │                  │
│              ▼                                                 ▼                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │  📦 GITHUB · max51527/ikcp-site                                          │    │
│   │  ────────────────────────────────                                        │    │
│   │  Source of truth UNIQUE — code + contenu + agents + docs                 │    │
│   │  • branches : main (prod) · claude/* (chantiers)                         │    │
│   │  • CI automatique : validate-content (PR) + deploy-workers (push main)   │    │
│   │  • Webhooks : push main → Cloudflare Pages + Workers                     │    │
│   └────────────┬──────────────────────┬──────────────────────────────────────┘    │
│                │                       │                                          │
│                │ webhook 1             │ webhook 2                                │
│                ▼                       ▼                                          │
│   ┌─────────────────────────┐  ┌────────────────────────────────────────────┐     │
│   │ ☁️ CLOUDFLARE PAGES      │  │ ☁️ GITHUB ACTIONS                          │     │
│   │ ────────────────────    │  │ ─────────────────                          │     │
│   │ Auto-build sur push     │  │ 1. detect-changes : diff workers/*         │     │
│   │ • static files          │  │ 2. parallel deploy : wrangler deploy par   │     │
│   │ • assets, content/*.json│  │    Worker modifié                          │     │
│   │ • admin/ (Sveltia UI)   │  │ 3. validate-content sur les PR             │     │
│   │ → ikcp.eu en ~30s       │  │                                            │     │
│   └────────┬────────────────┘  └────────────┬───────────────────────────────┘     │
│            │                                 │                                    │
│            │ live                            │ deploy                             │
│            ▼                                 ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────────────┐     │
│   │  🌐 ikcp.eu — Cloudflare Pages (front statique + admin/ Sveltia)        │     │
│   │  ───────────────────────────────────────────────────────────────────    │     │
│   │  Pages servent les .html + content/*.json fraîchement déployés          │     │
│   │  Le JS loader.js hydrate les pages avec le contenu Sveltia              │     │
│   └────────────┬────────────────────────────────────────────────────────────┘     │
│                │ fetch /api/* + Marcel                                            │
│                ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐     │
│   │  🔧 CLOUDFLARE WORKERS — backend dynamique                              │     │
│   │  ───────────────────────────────────────                                │     │
│   │   • ikcp-marcel       (chat sync, claude-sonnet-4-6)                    │     │
│   │   • ikcp-client       (espace FO, magic-link, dashboard)                │     │
│   │   • ikcp-agents       (tâches async via Managed Agents)                 │     │
│   │   • ikcp-cms-auth     (OAuth GitHub pour Sveltia)                       │     │
│   │   • documents/suivi/reporting-mcp-server  (sub-agents HMAC)             │     │
│   │                                                                          │    │
│   │   Storage EU : D1 + R2 + KV                                              │    │
│   └────────────┬─────────────────────────────────────────────────────────────┘    │
│                │ API calls                                                        │
│                ▼                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │  🧠 ANTHROPIC — IA derrière Marcel                                       │    │
│   │  • Messages API (chat sync, claude-sonnet-4-6 + outils déterministes)    │    │
│   │  • Managed Agents (claude-opus-4-8, reporting/documents/suivi async)     │    │
│   │  • Files API + webhooks session events                                   │    │
│   └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Les 4 chaînes d'automatisation

### Chaîne A — Édition de contenu (Maxime, no-code)

```
Maxime → admin.ikcp.eu (Sveltia UI) → commit content/X.json sur main
       → GitHub webhook → Cloudflare Pages rebuild (~30s, no build step)
       → ikcp.eu fetch content/X.json → loader.js hydrate les pages → LIVE
```

**Temps total : ~30 secondes. Aucune intervention dev.**

### Chaîne B — Évolution code (Claude, via Maxime)

```
Maxime → "Claude, ajoute X" (Claude Code CLI)
       → moi : code + commit branche claude/* + push
       → PR ouverte → Action validate-content (si content/) ou autres CI
       → Maxime review → merge sur main
       → Action deploy-workers détecte le diff → wrangler deploy en parallèle
       → Workers updated en ~1 min
```

**Temps total : 10-30 min selon la complexité + ton review.**

### Chaîne C — Client beta utilise Marcel chat (live, sync)

```
Client tape une question → POST chat.ikcp.eu (ikcp-marcel Worker)
       → Worker fetch Anthropic Messages API (sonnet-4-6)
       → si calcul fiscal → 9 tools JS local (calc_impot_revenu, etc.)
       → si actualité → web_search natif Anthropic
       → réponse streaming au client en <2s TTFT
```

### Chaîne D — Client génère son DER trimestriel (async, batch)

```
Client clic "Générer mon DER Q3" → POST /api/agents/task (ikcp-client Worker)
       → ikcp-agents Worker : sessions.create() vers Anthropic Managed Agents
       → Anthropic provisionne container, exécute marcel-reporting agent
       → Custom tools (Pattern 9) → HMAC vers reporting-mcp-server pour data
       → Agent produit .docx dans /mnt/session/outputs/
       → Webhook session.status_idled → ikcp-agents stocke en D1 + R2
       → Resend email magic-link → "Votre DER est prêt"
       → Client clique → dashboard → R2 signed URL → download
```

**Temps total : 1-3 min. Aucune intervention dev ni Maxime.**

---

## 3. Inventaire des composants livrés (cette PR)

### 3.1 Sveltia CMS (édition no-code)

| Fichier | Rôle |
|---|---|
| `admin/index.html` | Entry point Sveltia (`/admin/` sur ikcp.eu) |
| `admin/config.yml` | 6 collections éditables : tarifs · cas · citations · FAQ · roadmap · articles conviction |
| `workers/ikcp-cms-auth/worker.js` | OAuth proxy GitHub (auth.ikcp.eu) |
| `workers/ikcp-cms-auth/wrangler.toml` | Déploiement Worker auth |

### 3.2 Contenu structuré (extrait des pages)

| Fichier | Contenu |
|---|---|
| `content/tariffs.json` | 3 espaces (Freemium / Augmenté 6 800€ / Bespoke) |
| `content/quotes.json` | 4 citations clés clients beta |
| `content/cases/*.md` | 4 cas concrets en Markdown (Emma, Thomas, Léa, Hugo & Antoine) |
| `content/faq.json` | 4 FAQ initiales (beta, compliance, marcel, tarifs) |
| `content/loader.js` | Hydrater client-side qui fetch /content/*.json et remplit les `[data-ikcp-*]` |

### 3.3 CI / Automation GitHub

| Fichier | Déclencheur | Action |
|---|---|---|
| `.github/workflows/deploy-workers.yml` | push main + workers/** | Deploy parallèle des Workers modifiés |
| `.github/workflows/validate-content.yml` | PR content/** | Valide JSON + frontmatter Markdown |

---

## 4. Runbook de setup — actions humaines J0

À faire une seule fois, dans cet ordre.

### Étape 1 — GitHub OAuth App (5 min)

1. Aller sur https://github.com/settings/developers → "New OAuth App"
2. Remplir :
   - **Application name** : `IKCP CMS`
   - **Homepage URL** : `https://ikcp.eu`
   - **Authorization callback URL** : `https://auth.ikcp.eu/callback`
3. Cliquer "Register application"
4. Copier le **Client ID** affiché
5. Cliquer "Generate a new client secret" → copier la valeur

### Étape 2 — Provisionner les secrets Cloudflare (5 min)

```sh
# Pour ikcp-cms-auth (OAuth Sveltia)
cd workers/ikcp-cms-auth
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# Pour ikcp-agents (déjà documenté dans docs/MANAGED-AGENTS-INTEGRATION.md)
cd ../ikcp-agents
wrangler secret put ANTHROPICAPIKEY
wrangler secret put ANTHROPIC_WEBHOOK_SIGNING_KEY
wrangler secret put HMAC_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put IKCP_CLIENT_BASE_URL <<< "https://client.ikcp.eu"
# (+ MARCEL_ENV_ID, MARCEL_*_AGENT_ID après création via ant CLI)
```

### Étape 3 — Provisionner les secrets GitHub Actions (3 min)

Sur https://github.com/max51527/ikcp-site/settings/secrets/actions → "New repository secret" :

| Nom | Valeur |
|---|---|
| `CF_API_TOKEN` | Token Cloudflare avec scope "Edit Workers Scripts" (dash.cloudflare.com/profile/api-tokens) |
| `CF_ACCOUNT_ID` | Account ID (visible en haut à droite du dashboard Cloudflare) |

### Étape 4 — Configurer les DNS et Worker routes (10 min)

Sur dash.cloudflare.com → DNS :

| Type | Nom | Cible | Routé par |
|---|---|---|---|
| CNAME | `ikcp.eu` (apex) | `ikcp-site.pages.dev` | Cloudflare Pages |
| CNAME | `www` | `ikcp.eu` | Pages (redirect) |
| CNAME | `admin` | `ikcp.eu` | Pages (sert `/admin/`) |
| CNAME | `chat` | dummy | Worker `ikcp-marcel` via routes |
| CNAME | `client` | dummy | Worker `ikcp-client` via routes |
| CNAME | `agents` | dummy | Worker `ikcp-agents` via routes |
| CNAME | `auth` | dummy | Worker `ikcp-cms-auth` via routes |

Pour les sous-domaines des Workers, les `[[routes]]` dans chaque `wrangler.toml` font le mapping — pas besoin de DNS CNAME spécifique, le pattern matching de Cloudflare prend le relais (à condition que la zone soit gérée par CF).

### Étape 5 — Cloudflare Pages (5 min)

1. dash.cloudflare.com → Workers & Pages → "Create" → "Pages" → "Connect to Git"
2. Sélectionner `max51527/ikcp-site`
3. Branch : `main`
4. Build command : *(laisser vide — site statique)*
5. Build output directory : `/`
6. Variables d'environnement : aucune nécessaire
7. "Save and Deploy"

À chaque push sur `main`, Cloudflare Pages rebuild en ~30s.

### Étape 6 — Premier login Sveltia (1 min)

1. Ouvrir https://admin.ikcp.eu/admin/
2. "Login with GitHub" → autoriser l'app `IKCP CMS`
3. UI Sveltia apparaît → modifier `content/tariffs.json` (test : changer le `price_label` de Freemium)
4. "Publish" → commit visible sur GitHub en <5s
5. Vérifier sur ikcp.eu/proposals/espaces-fo.html que la modif est live (~30s)

✅ **Si ça fonctionne, la chaîne complète Maxime → Sveltia → GitHub → Cloudflare → ikcp.eu est branchée.**

### Étape 7 — Setup Managed Agents (optionnel, voir doc dédiée)

Suivre `docs/MANAGED-AGENTS-INTEGRATION.md` section §4.5 (création environnement + 3 agents via `ant` CLI).

---

## 5. Wiring d'une page existante avec le contenu Sveltia (exemple)

Pour qu'une page HTML utilise le contenu édité dans Sveltia, ajouter en bas de la page :

```html
<script type="module" src="/content/loader.js"></script>
```

Puis dans le HTML, marquer les zones à hydrater :

```html
<!-- Texte simple -->
<h2 data-ikcp-text="quotes/items/0/quote"></h2>
<p data-ikcp-text="quotes/items/0/author"></p>

<!-- Liste rendue via template -->
<ul data-ikcp-list="cases" data-template="case-tpl"></ul>
<template id="case-tpl">
  <li>
    <strong>{{title}}</strong> — {{age}} ans · {{context}}
    <blockquote>{{quote}}</blockquote>
  </li>
</template>

<!-- Tarif d'un tier précis -->
<div data-ikcp-tariff="augmente" data-field="price_label"></div>
<ul data-ikcp-tariff="augmente" data-field="features"></ul>
```

À l'ouverture de la page, `loader.js` :
1. Fetch les JSON depuis `/content/`
2. Remplit chaque `[data-ikcp-*]` avec les valeurs correspondantes
3. Émet l'event `ikcp:content-ready` pour les scripts qui en dépendent

---

## 6. Garanties

| Promesse | Implémentation |
|---|---|
| Maxime peut modifier le contenu sans dev | Sveltia CMS avec UI no-code |
| Tout est versionné, revertable | GitHub source of truth, history complet |
| Aucune erreur ne casse la prod | Validate-content sur PR + Pages preview deploys par branche |
| Déploiement automatique | GitHub Actions deploy-workers + Pages auto-build |
| Souveraineté EU | Cloudflare Workers + D1 + R2 en EU |
| Sécurité OAuth | Secret jamais en client, échange côté Worker uniquement |
| Pas de single-point-of-failure | Pages + Workers indépendants ; ant CLI = backup pour les agents |

---

## 7. Évolutions Phase 2 (non incluses)

- **Editorial workflow** : passer le `backend` Sveltia en `editorial_workflow: true` pour que les edits Maxime créent des PR (au lieu de commits directs sur main), avec preview Pages avant publication.
- **Image upload via R2** : configurer Sveltia `media_library` pour uploader directement vers R2 (au lieu du dossier `assets/uploads/` dans le repo).
- **Index Markdown auto** : GitHub Action qui regénère `content/cases/index.json` à chaque commit (le loader peut alors lister les .md sans hardcoder un index).
- **Multilingue** : Sveltia supporte `i18n` natif — ajouter en/fr pour expansion internationale.
- **Sentry / observability** : Workers Analytics Engine pour métriques chaîne A→D.

---

*Plan d'automatisation v1.0 · 2026-06 · © IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
