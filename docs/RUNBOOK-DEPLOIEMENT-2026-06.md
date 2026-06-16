# Runbook de déploiement actualisé — 16 juin 2026

> Étape par étape pour passer du code committé sur la branche au lancement
> commercial. Adapté à la stack RÉELLE après le merge du 13 juin
> (commit `3b47798`). Les actions sont triées par ordre d'exécution avec
> dépendances explicites.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## État au 16 juin 2026

### Ce qui est en prod et fonctionne déjà 🟢
- `workers/ikcp-marcel` — Marcel chat sync (sonnet-4-6 + orchestrateur tier-aware opus-4-7 pour `fo`)
- `workers/ikcp-codex` — Sub-agent fiscal Opus 4.7
- `workers/ikcp-pappers` — Cartographie SIREN
- `workers/ikcp-temoin` — Audit log MIF II
- `workers/ikcp-client` — Magic-link + Stripe checkout + portal + webhook + RGPD export/delete
- 93 pages SEO Ardèche en prod
- CMS Sveltia (admin.ikcp.eu) avec OAuth GitHub
- App principale `ikcp.eu` sur Cloudflare Pages

### Ce qui est codé mais pas encore déployé 🟡
- `workers/ikcp-agents` — Orchestrateur 13 agents Managed Anthropic + cron newsletter
- `workers/ikcp-admin` — Cockpit Maxime
- `workers/ikcp-voice` — TTS/STT (code en prod mais `VOXCPM_API_URL` à provisionner)
- `workers/ikcp-batisseur, ikcp-hermes, ikcp-lifestyle, ikcp-veille, ikcp-feedback, ikcp-collector, ikcp-watchdog` — codés, attendent `wrangler deploy` + secrets
- `workers/documents-mcp-server, reporting-mcp-server, suivi-mcp-server` — sub-agents HMAC
- `workers/ikcp-cms-auth` — déployé
- Pages : `dashboard-perfection.html`, `demo-agents-voix.html`, `admin/cockpit.html`, `onboarding-paiement.html`, `cgv-abonnement.html`
- 13 agents YAML Anthropic Managed

---

## Critical Path — ordre d'exécution

### 🔴 Phase A — Bloqueurs commerciaux (semaine 25-29 juin)

Ces 5 actions BLOQUENT la facturation. Sans elles, on ne peut pas
encaisser légalement.

| # | Action | Qui | Délai estimé | Statut |
|---|---|---|---|---|
| A1 | Email à `sales@anthropic.com` : demande DPA Enterprise + Zero Data Retention | Maxime | 5-10j réponse | ⏳ |
| A2 | Activation compte Stripe France + complétion KYC | Maxime | 1-3j | ⏳ |
| A3 | Création des 3 prix Stripe : `STRIPE_PRICE_DECOUVERTE` (1 800€ one-shot), `STRIPE_PRICE_AUGMENTE_YEARLY` (6 800€/an), `STRIPE_PRICE_BESPOKE_YEARLY` (15 000€/an) | Maxime | 30 min | ⏳ |
| A4 | Souscription Yousign OU Universign (réactivation worker en pause) | Maxime | 1j | ⏳ |
| A5 | Avenant RC pro mentionnant "outils IA d'aide à la décision" | Maxime (appel assureur) | 5-10j | ⏳ |

### 🟡 Phase B — Provisionning technique (parallèle à A)

| # | Action | Commande | Statut |
|---|---|---|---|
| B1 | Migration D1 : `wrangler d1 execute ikcp-client-db --file=workers/ikcp-client/schema.sql --remote` | (déjà appliqué probablement) | ⏳ vérifier |
| B2 | Migration D1 : `wrangler d1 execute ikcp-client-db --file=migrations/006_agent_sessions.sql --remote` | ⏳ |
| B3 | Migration D1 : `wrangler d1 execute ikcp-client-db --file=migrations/007_memory_stores.sql --remote` | ⏳ |
| B4 | Créer 3 KV namespaces : `AGENT_KV`, `VOICE_CACHE`, `VOICE_RATE` | `wrangler kv namespace create <NAME>` × 3 | ⏳ |
| B5 | Push secrets ikcp-client : `STRIPE_PRICE_DECOUVERTE`, `STRIPE_PRICE_AUGMENTE_YEARLY`, `STRIPE_PRICE_BESPOKE_YEARLY` | `wrangler secret put` × 3 | ⏳ |
| B6 | `ant auth login` puis créer environnement + 13 agents Managed Anthropic | `ant beta:agents create < agents/marcel-*.yaml` × 13 | ⏳ |
| B7 | Push secrets ikcp-agents : `MARCEL_ENV_ID` + 13 × `MARCEL_*_AGENT_ID` + `ANTHROPICAPIKEY` + `ANTHROPIC_WEBHOOK_SIGNING_KEY` + `RESEND_API_KEY` | `wrangler secret put` × 16 | ⏳ |
| B8 | Push secrets ikcp-admin : `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_SIGNING_SECRET`, `ANTHROPICAPIKEY`, `MARCEL_*` | `wrangler secret put` × 13 | ⏳ |
| B9 | Provision Modal.run pour VoxCPM2 TTS, push `VOXCPM_API_URL` dans ikcp-voice | `python workers/ikcp-voice/deploy-voxcpm-modal.py` | ⏳ |
| B10 | Provision Mistral La Plateforme + push `MISTRAL_API_KEY` dans ikcp-voice | `wrangler secret put` | ⏳ |
| B11 | Webhook Anthropic : Console → URL `https://ikcp-agents.maxime-ead.workers.dev/webhooks/anthropic`, events `session.status_idled`, `session.status_terminated`, `session.outcome_evaluation_ended` | UI Anthropic Console | ⏳ |
| B12 | Webhook Stripe : Dashboard Stripe → endpoint `https://ikcp-client.maxime-ead.workers.dev/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.deleted` | UI Stripe Dashboard | ⏳ |
| B13 | GitHub OAuth App "IKCP Cockpit Admin" : settings/developers, callback `https://ikcp-admin.maxime-ead.workers.dev/auth/callback` | UI GitHub | ⏳ |
| B14 | DNS Cloudflare : routes `admin.ikcp.eu` → `ikcp-cms-auth` + `ikcp-admin`, `client.ikcp.eu` → `ikcp-client`, `agents.ikcp.eu` → `ikcp-agents`, `voice.ikcp.eu` → `ikcp-voice` | Dashboard CF DNS | ⏳ |
| B15 | Déployer tous les workers : GitHub Actions `Deploy Cloudflare Workers` → `workflow_dispatch` → target `all` | UI GitHub Actions | ⏳ |

### 🟢 Phase C — Smoke tests avant commercialisation (semaine 30 juin)

Tester EN ORDRE — si un fail, ne pas passer au suivant.

| # | Test | Commande / URL | Critère succès |
|---|---|---|---|
| C1 | Marcel chat répond | `curl https://ikcp-chat.maxime-ead.workers.dev/ -X POST -d '{"message":"Bonjour"}'` | Réponse 200 + texte FR |
| C2 | Marcel cite Codex sur question fiscale | `curl ... -d '{"message":"Pacte Dutreil 2026 conditions ?"}'` | Réponse mentionne CGI 787 B |
| C3 | Stripe Checkout decouverte | Onboarding `/proposals/onboarding-paiement.html?plan=decouverte` | Redirection Stripe avec ligne 1 800€ |
| C4 | Webhook Stripe bumps tier | Paiement test mode → vérifier `users.tier='premium'` | Stripe event reçu + tier=premium en D1 |
| C5 | Lettre de mission Yousign envoyée | Onboarding étape 3 cochée → email Yousign | Email reçu avec lien signature |
| C6 | Premier Managed Agent (marcel-reporting) | Cockpit `/admin/cockpit.html` → Run-agent | Session créée + Fable 5 répond |
| C7 | Memory Store créé pour user payant | POST `/api/me/memory/init` après paiement | `users.memory_store_id` rempli en D1 |
| C8 | Voix Marcel TTS | `curl https://ikcp-voice.maxime-ead.workers.dev/tts -d '{"text":"Bonjour"}'` | Audio WAV retourné |
| C9 | Vision drag-drop document | Upload PDF dans `/proposals/dashboard-perfection.html` | Marcel commente + JSON extrait |
| C10 | Demo publique end-to-end | `/proposals/demo-agents-voix.html` → tap "Lancer démo reporting" | DER docx généré + audio résumé |

### 🚀 Phase D — Lancement commercial (semaine 6-13 juillet)

| # | Action | Effet |
|---|---|---|
| D1 | Sélection 5 prospects dans ton réseau actuel | Familles cibles pour cohort Découverte |
| D2 | Envoyer chacun le lien `/proposals/onboarding-paiement.html?plan=decouverte` après leur RDV | 5 × 1 800€ = 9 000€ encaissés |
| D3 | Activer cron newsletter `wrangler triggers --schedule "0 8 * * 5"` | Premier envoi vendredi 10 juillet |
| D4 | Sortir première newsletter UPPERCUT publique (séparée de la perso) | Build trafic |
| D5 | Article LinkedIn "Pourquoi j'ai construit Marcel" | Lead gen |

### 📈 Phase E — Scale (juillet-août)

| # | Action | Cible fin août |
|---|---|---|
| E1 | Webinar live #1 "Démo Marcel en 30 min" | 50 inscrits, 25 présents, 5 leads |
| E2 | LinkedIn outreach 5 dirigeants/jour | 100 contacts touchés |
| E3 | Closing 10 ventes Augmenté 6 800€ | 68 000€ encaissés cumulé |
| E4 | Cockpit admin tour de contrôle quotidien | Pilotage MRR/churn/coût |

---

## Commandes prêtes à copier-coller

### Migrations D1
```bash
cd ~/ikcp-site
wrangler d1 execute ikcp-client-db --remote --file=migrations/006_agent_sessions.sql
wrangler d1 execute ikcp-client-db --remote --file=migrations/007_memory_stores.sql
```

### KV namespaces
```bash
wrangler kv namespace create AGENT_KV
wrangler kv namespace create VOICE_CACHE
wrangler kv namespace create VOICE_RATE
# → Copier les 3 IDs dans wrangler.toml correspondants
```

### Création des 13 agents Anthropic Managed
```bash
ant auth login
ENV_ID=$(ant beta:environments create < agents/marcel-environment.yaml --transform id -r)
echo "MARCEL_ENV_ID=$ENV_ID"
for agent in documents suivi patrimoine fortune reporting editorial gouvernance \
             transmission remuneration strategie fiscalite-impots immobilier defiscalisation; do
  ID=$(ant beta:agents create < agents/marcel-$agent.agent.yaml --transform id -r)
  echo "MARCEL_${agent^^/_/-}_AGENT_ID=$ID"
done
```

### Push secrets en masse (utiliser .env temporaire NON commité)
```bash
cd workers/ikcp-agents
for var in MARCEL_ENV_ID MARCEL_DOCUMENTS_AGENT_ID MARCEL_SUIVI_AGENT_ID \
           MARCEL_PATRIMOINE_AGENT_ID MARCEL_FORTUNE_AGENT_ID \
           MARCEL_REPORTING_AGENT_ID MARCEL_EDITORIAL_AGENT_ID \
           MARCEL_GOUVERNANCE_AGENT_ID MARCEL_TRANSMISSION_AGENT_ID \
           MARCEL_REMUNERATION_AGENT_ID MARCEL_STRATEGIE_AGENT_ID \
           MARCEL_FISCALITE_IMPOTS_AGENT_ID MARCEL_IMMOBILIER_AGENT_ID \
           MARCEL_DEFISCALISATION_AGENT_ID; do
  echo "→ wrangler secret put $var"
  wrangler secret put $var
done
```

---

## Décisions prises (pour info)

1. **5 tiers commerciaux → 3 IDs techniques** dans `users.tier` :
   `free` (Freemium) / `premium` (Découverte 3 mois OU Augmenté 12 mois)
   / `fo` (Bespoke OU Partner CGP). Différenciation via `subscription_data[metadata][plan]`.

2. **Découverte 1 800€/3 mois = subscription Stripe avec `cancel_at` à T+90j**. Pas un one-shot.
   Si client veut renouveler avant T+90j, conversion en Augmenté via Portal.

3. **Newsletter cron `0 8 * * 5`** (vendredi 8h UTC = 10h Paris été) avec circuit breaker
   3 échecs consécutifs = abandon cohorte + alerte ops dans `push_log`.

4. **App mobile Capacitor reportée** au Q1 2027. PWA "Add to Home Screen" suffit pour cohort 1
   (cf. warning Apple 4.2 dans `mobile/README.md`).

5. **Cohorte cible août 2026** ramenée de 50 → **10-15 familles** (cf. critique honnête).

---

## Pour Maxime — checklist cette semaine (16-21 juin)

- [ ] Envoyer email DPA Anthropic Enterprise + ZDR
- [ ] Activer compte Stripe France
- [ ] Créer 3 prix Stripe (Découverte, Augmenté, Bespoke)
- [ ] Souscription Yousign
- [ ] Appel assureur pour avenant RC pro IA
- [ ] Ouvrir Apple Developer + Google Play Console (option PWA = report)
- [ ] Désigner DPO externalisé
- [ ] Créer 2 GitHub OAuth Apps (Sveltia déjà fait + Cockpit Admin)

Quand ces 8 actions sont en cours/terminées, on lance Phase B → C → D.

---

*Runbook v2.0 · 2026-06-16 · prend en compte le merge `3b47798`*
*© IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
