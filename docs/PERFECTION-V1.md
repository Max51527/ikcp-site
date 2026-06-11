# IKCP — Perfection V1 · 2026-06

> Le moment où la stack passe du "POC ambitieux" au "Family Office digital
> jamais vu en France". Ce document consolide les 5 chantiers livrés en
> juin 2026 et le mode d'emploi end-to-end.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## 1. Ce qui n'existait nulle part avant ce moment

Aucun cabinet de gestion de patrimoine FR n'offrait jusqu'ici cette
combinaison sur **un seul produit** :

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  🧠 Marcel chat sync (Sonnet 4.6) + 9 calculateurs déterministes JS   │
│  🎙️  Marcel parle (TTS VoxCPM2) + écoute (Voxtral STT)                │
│  👁️  Marcel voit (vision Anthropic — drag-drop PDF/image)             │
│  🧠 Marcel se souvient (Memory Stores par famille, persistance multi-séances) │
│                                                                       │
│  🤖 7 agents Managed Anthropic asynchrones :                          │
│     reporting · patrimoine · fortune · gouvernance (visuels obligatoires)│
│     documents · suivi · editorial                                     │
│                                                                       │
│  📰 Newsletter perso hebdo (cron vendredi 10h Paris)                  │
│      → marcel-editorial lit la memory store, écrit un article         │
│         adapté à la situation réelle de la famille                    │
│                                                                       │
│  📱 App native iOS + Android (Capacitor)                              │
│      → push notifications, biométrie Face ID/Touch ID                 │
│                                                                       │
│  🌍 100% souverain EU (Cloudflare + Mistral + Modal.run + Pappers)    │
│      seul Claude reste US — couvert par DPA Anthropic Enterprise ZDR  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

C'est ce que les concurrents — agrégateurs banque, CGP traditionnels,
robo-advisors, multi-family offices — n'ont pas. La somme fait la
différence.

---

## 2. Les 5 chantiers de cette release

### Chantier 1 — Memory Stores par famille (mémoire persistante)

Chaque famille a son **memory store Anthropic** workspace-scoped, qui
persiste à travers TOUTES ses sessions Marcel. Lors d'une nouvelle
tâche, l'agent monte la memory store en `resources[]` et lit les
préférences, l'allocation cible, le contexte familial. Il y écrit aussi
ce qu'il apprend de nouveau.

**Impact UX** : Marcel **n'oublie plus rien**. Il sait que vous êtes
le dirigeant d'une SARL Logiciel à Lyon, que votre fille fait son
internat NextGen, que votre allocation cible est 50% AV / 30% PEA /
20% SCPI. Vous ne le lui répétez pas tous les mois.

**Implémentation** :
- `migrations/007_memory_stores.sql` — colonne `users.memory_store_id`
- `workers/ikcp-agents/worker.js` — `GET /api/me/memory`, `POST /api/me/memory/init`
  + seed avec 3 fichiers Markdown initiaux
- Memory store attaché en `resources` à chaque session via `access: read_write`
- Instructions injectées dans le system prompt agent : *"Lis le contexte
  avant de répondre. Écris ce que tu apprends."*

### Chantier 2 — Newsletter perso hebdomadaire (cron auto)

Chaque vendredi à 10h Paris, le cron trigger Cloudflare Workers lance
une session `marcel-editorial` **pour chaque famille active** :

1. L'agent Fable 5 monte la memory store de la famille
2. Lit `/contexte/famille.md` + `/preferences/format.md` + `/allocation/cible.md`
3. Compose une newsletter de 250-400 mots **adaptée à la situation réelle**
4. Génère 1 visuel hero matplotlib (palette IKCP)
5. Email via Resend → boîte mail du client
6. Log en D1 `newsletter_log` pour audit

**Impact business** : 1 point de contact hebdo non-intrusif, ultra-perso,
qui justifie à lui seul l'abonnement annuel 6 800€. Coût marginal :
~$0.40/famille/mois.

**Implémentation** :
- `[triggers] crons = ["0 8 * * 5"]` dans `wrangler.toml`
- `scheduled()` handler → `runWeeklyNewsletters()` → `queueNewsletterFor(user, week)`
- Outcome avec rubric stricte : ton UPPERCUT, sources CGI, visuel hero,
  disclaimer MIF II
- Anti-doublon via `newsletter_log` (clé composite `user_id × week_iso`)

### Chantier 3 — Vision Marcel drag-drop (`<marcel-vision>`)

Composant web vanille qui transforme n'importe quelle page IKCP en
**zone de drop intelligente** :

```html
<marcel-vision agents-url="https://agents.ikcp.eu"
               marcel-url="https://chat.ikcp.eu"></marcel-vision>
```

L'utilisateur dépose un avis IR, un Kbis, un acte de donation → l'image
ou le PDF est encodé en base64 → POST vers Marcel chat avec content
block multimodal → Marcel **lit en direct** (vision Anthropic) → renvoie
classification + extraction JSON + points d'attention.

**Événement déclenché à la fin** : `vision-done` → Marcel commente
vocalement le résultat (intégration native avec `<marcel-voice>`).

### Chantier 4 — Dashboard "perfection" (`/proposals/dashboard-perfection.html`)

La page d'accueil membre qui tisse tout :

| Section | Composant | Comportement |
|---|---|---|
| Salutation perso | `<marcel-voice>` | "Bonjour [Prénom]" auto-play à l'ouverture |
| Drop document | `<marcel-vision>` | Dépose → lit → commente vocalement |
| 7 agents tuile | tier-gated | Locked si tier insuffisant, débloque sur upgrade |
| Mémoire famille | `/api/me/memory` | Liste les fichiers de la memory store |
| Newsletters reçues | `/api/me/newsletters` | Toutes les newsletters hebdo |

C'est ce que Maxime verra quand il se connectera la première fois.

### Chantier 5 — Migration technique

- ✅ Marcel chat : `claude-sonnet-4-20250514` → `claude-sonnet-4-6` (2 occurrences)
- ⏳ Restant à faire côté Maxime : flip `ikcp-batisseur` (poser `ANTHROPICAPIKEY`)

---

## 3. Architecture mise à jour

```
                                ┌─────────────────────┐
                                │ 👤 CLIENT app native│
                                │ iOS / Android       │
                                │ (Capacitor)         │
                                └──────────┬──────────┘
                                           │ WebView + push
                                           ▼
                            ┌──────────────────────────────────┐
                            │ client.ikcp.eu (Cloudflare Pages)│
                            │ • dashboard-perfection.html      │
                            │ • <marcel-voice> <marcel-vision> │
                            │ • magic-link auth                │
                            └──────────┬───────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
   ┌──────────────────┐    ┌────────────────────┐    ┌────────────────────┐
   │ ikcp-marcel      │    │ ikcp-agents        │    │ ikcp-voice         │
   │ chat sync        │    │ async + cron       │    │ TTS/STT            │
   │ Sonnet 4.6       │    │ 7 agents Managed   │    │ VoxCPM2 + Voxtral  │
   │ + 9 tools JS     │    │ + memory stores    │    │                    │
   │ + web_search     │    │ + newsletter cron  │    │                    │
   └────────┬─────────┘    └─────────┬──────────┘    └─────────┬──────────┘
            │                        │                          │
            └────────┬───────────────┴──────────┬───────────────┘
                     ▼                          ▼
              ┌──────────────────────────────────────┐
              │ 🇺🇸 Anthropic                         │
              │ Messages API + Managed Agents +      │
              │ Memory Stores + Vision               │
              └──────────────────────────────────────┘
              ┌──────────────────────────────────────┐
              │ 🇫🇷 Mistral La Plateforme (Voxtral)   │
              │ 🇪🇺 Modal.run (VoxCPM2 self-host)      │
              └──────────────────────────────────────┘

  Storage (EU)
  ┌─────────────────────────────────────┐
  │ D1 ikcp-prod                        │
  │  + users.memory_store_id (007)      │
  │  + newsletter_log (007)             │
  │  + push_log (007)                   │
  │ R2 ikcp-docs-private / templates    │
  │ KV AGENT_KV / VOICE_CACHE / VOICE_RATE │
  └─────────────────────────────────────┘
```

---

## 4. Smoke tests — ce que tu peux tester

### Tests immédiats (preview Pages, sans wrangler deploy)

| Page | Test | Attendu |
|---|---|---|
| `proposals/dashboard-perfection.html` | Ouvre dans browser | Salutation + grille agents + drop zone + voix bar |
| `proposals/demo-agents-voix.html` | Tap "🎤" puis parler 3s | Transcription FR affichée |
| `proposals/demo-agents-voix.html` | Tap "▶ Lancer démo reporting" | Console stream live (si workers en prod) |

### Tests après déploiement workers + secrets

```sh
# 1) Health checks
curl https://agents.ikcp.eu/health
curl https://voice.ikcp.eu/health
curl https://chat.ikcp.eu/

# 2) Vision Marcel (envoyer un PDF base64)
curl -X POST https://chat.ikcp.eu/ \
  -H "Origin: https://client.ikcp.eu" \
  -H "Content-Type: application/json" \
  -d '{"message":"Lis ce document.","attachments":[{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"<BASE64>"}}],"theme":"admin"}'

# 3) Memory store init (avec session cookie magic-link)
curl -X POST https://agents.ikcp.eu/api/me/memory/init \
  -H "Cookie: ikcp_session=<TOKEN>"

# 4) Cron trigger manuel pour newsletter (test sans attendre vendredi)
# Via Cloudflare dashboard → Worker → Triggers → "Trigger now"
# OU :
curl -X POST https://api.cloudflare.com/client/v4/accounts/<ACCOUNT>/workers/scripts/ikcp-agents/schedules \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

### Tests app mobile (sans Xcode)

```sh
# Vérifier la syntaxe Capacitor config
cd mobile
npx tsc --noEmit capacitor.config.ts   # check types

# Vérifier les CORS Workers acceptent capacitor://
curl -X OPTIONS https://agents.ikcp.eu/api/agents/task \
  -H "Origin: capacitor://localhost" \
  -H "Access-Control-Request-Method: POST" \
  -v | grep -i "access-control"
```

### Tests app mobile complets (avec Xcode / Android Studio)

```sh
cd mobile
npm install
npx cap add ios
npx cap add android
npx cap sync

# Simulateur iOS
npx cap run ios --target="iPhone 15 Pro"

# Émulateur Android
npx cap run android
```

Dans le simulateur :
- [ ] Splash IKCP 1.5s
- [ ] WebView charge client.ikcp.eu
- [ ] Magic-link reçu → login → dashboard
- [ ] Tap micro → STT fonctionne (autoriser permission audio simulateur)
- [ ] Drag-drop document (depuis Finder vers simulateur)
- [ ] Push notification de test (Settings → Notifications → IKCP → Test)

---

## 5. Inventaire complet — 18 fichiers livrés dans cette release

| Fichier | Rôle |
|---|---|
| `agents/marcel-editorial.agent.yaml` | Newsletter UPPERCUT Fable 5 |
| `agents/marcel-fortune.agent.yaml` | HNW Opus 4.8 effort max |
| `agents/marcel-gouvernance.agent.yaml` | Charte familiale Fable 5 |
| `agents/marcel-patrimoine.agent.yaml` | 360° Opus 4.8 |
| `agents/marcel-reporting.agent.yaml` | DER trimestriel Fable 5 (swap) |
| `agents/marcel-documents.agent.yaml` | OCR existant |
| `agents/marcel-suivi.agent.yaml` | Planning existant |
| `workers/ikcp-agents/worker.js` | + Memory + Cron + Démo + Stream |
| `workers/ikcp-agents/wrangler.toml` | + Cron + Tous les secrets |
| `workers/ikcp-voice/worker.js` | TTS VoxCPM2 + STT Voxtral |
| `workers/ikcp-voice/wrangler.toml` | Route voice.ikcp.eu |
| `workers/ikcp-marcel/worker.js` | Migration sonnet-4-6 |
| `assets/marcel-voice.js` | Web component voix |
| `assets/marcel-vision.js` | Web component drag-drop vision |
| `proposals/dashboard-perfection.html` | Dashboard membre |
| `proposals/demo-agents-voix.html` | Démo live publique |
| `migrations/007_memory_stores.sql` | Memory + newsletter + push log |
| `mobile/capacitor.config.ts` | App mobile native |

Plus 6 docs : MANAGED-AGENTS-INTEGRATION, AUTOMATION-FULL-STACK,
API-BACKTEST-DISCOVERY, AGENTS-VISUAL-FIRST, OFFER-AGENTS-MAPPING,
PERFECTION-V1.

---

## 6. Setup humain — actions J0 dans l'ordre

### Bloc 1 — Anthropic (1h)

```sh
# Compte Anthropic + DPA Enterprise + Zero Data Retention signé
# → contact sales@anthropic.com avec mention "IKCP — IKIGAÏ Conseil Patrimonial"

# Anthropic CLI
ant auth login

# Créer environnement + 7 agents
ENV_ID=$(ant beta:environments create < agents/marcel-environment.yaml --transform id -r)
REPORTING_ID=$(ant beta:agents create < agents/marcel-reporting.agent.yaml --transform id -r)
DOCUMENTS_ID=$(ant beta:agents create < agents/marcel-documents.agent.yaml --transform id -r)
SUIVI_ID=$(ant beta:agents create < agents/marcel-suivi.agent.yaml --transform id -r)
PATRIMOINE_ID=$(ant beta:agents create < agents/marcel-patrimoine.agent.yaml --transform id -r)
FORTUNE_ID=$(ant beta:agents create < agents/marcel-fortune.agent.yaml --transform id -r)
GOUVERNANCE_ID=$(ant beta:agents create < agents/marcel-gouvernance.agent.yaml --transform id -r)
EDITORIAL_ID=$(ant beta:agents create < agents/marcel-editorial.agent.yaml --transform id -r)
echo "Env: $ENV_ID"
echo "Reporting: $REPORTING_ID"
echo "Editorial: $EDITORIAL_ID"
# ... copier tous les IDs
```

### Bloc 2 — Cloudflare Workers (30 min)

```sh
# Migration D1
wrangler d1 execute ikcp-prod --file migrations/006_agent_sessions.sql
wrangler d1 execute ikcp-prod --file migrations/007_memory_stores.sql

# KV namespaces
wrangler kv:namespace create AGENT_KV
wrangler kv:namespace create VOICE_CACHE
wrangler kv:namespace create VOICE_RATE
# → coller les IDs dans wrangler.toml correspondants

# Secrets ikcp-agents
cd workers/ikcp-agents
wrangler secret put ANTHROPICAPIKEY
wrangler secret put ANTHROPIC_WEBHOOK_SIGNING_KEY
wrangler secret put HMAC_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put MARCEL_ENV_ID         # ENV_ID ci-dessus
wrangler secret put MARCEL_REPORTING_AGENT_ID
wrangler secret put MARCEL_DOCUMENTS_AGENT_ID
wrangler secret put MARCEL_SUIVI_AGENT_ID
wrangler secret put MARCEL_PATRIMOINE_AGENT_ID
wrangler secret put MARCEL_FORTUNE_AGENT_ID
wrangler secret put MARCEL_GOUVERNANCE_AGENT_ID
wrangler secret put MARCEL_EDITORIAL_AGENT_ID
wrangler secret put DEMO_BYPASS_TOKEN
wrangler deploy

# Secrets ikcp-voice
cd ../ikcp-voice
wrangler secret put MISTRAL_API_KEY
# Lancer Modal.run pour VoxCPM2 → copier URL → editer wrangler.toml VOXCPM_API_URL
wrangler deploy

# Webhook Anthropic
# Console.anthropic.com → Webhooks → Add :
#   URL: https://agents.ikcp.eu/webhooks/anthropic
#   Events: session.status_idled, session.status_terminated,
#           session.outcome_evaluation_ended, vault_credential.refresh_failed
# → copier whsec_ → wrangler secret put ANTHROPIC_WEBHOOK_SIGNING_KEY
```

### Bloc 3 — App mobile (1 jour avec Xcode/Android Studio)

```sh
cd mobile
npm install
npx cap add ios
npx cap add android
npx cap sync

# iOS — Apple Developer account requis ($99/an)
npx cap open ios
# Xcode : signing team IKCP, capabilities Push + Sign In With Apple
# Archive → Distribute App

# Android — Google Play Console ($25 one-time)
npx cap open android
# Android Studio : Build → Generate Signed Bundle
# Upload sur Play Console
```

### Bloc 4 — Domaines DNS Cloudflare (15 min)

| Sous-domaine | Cible | Worker |
|---|---|---|
| ikcp.eu | Pages | — |
| admin.ikcp.eu | Pages (sert /admin/) | — |
| client.ikcp.eu | Pages | — |
| app.ikcp.eu | Pages (PWA pour Capacitor) | — |
| chat.ikcp.eu | route Worker | ikcp-marcel |
| agents.ikcp.eu | route Worker | ikcp-agents |
| voice.ikcp.eu | route Worker | ikcp-voice |
| auth.ikcp.eu | route Worker | ikcp-cms-auth |

---

## 7. Indicateurs de succès — première cohorte beta

| Métrique | Cible J+30 | Cible J+90 |
|---|---|---|
| Familles beta actives | 25/50 | 50/50 |
| Newsletters perso envoyées/semaine | 25 | 50 |
| Sessions agents async / famille / mois | 2 | 4 |
| Marcel chat questions / famille / mois | 8 | 15 |
| Vision drag-drop usage | 5/famille | 10/famille |
| Mémoire — fichiers / famille | 4 (seed) | 12+ (enrichie) |
| Conversion démo → demande beta code | 5 % | 8 % |
| Coût marginal / famille / mois | $5 | $8 |
| Marge nette à 6 800€/an / famille / mois | $560 | $556 |

---

*Perfection V1 · 2026-06 · « jamais vu, parce qu'on a tout cousu d'un coup »*
*© IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
