# 🚀 Sprint 2 — Espace client Cassius + Freemium + Perplexity

> Date démarrage : 2026-05-16
> Objectif : passer de la démo Marcel V4 à un produit Cassius commercialisable bêta
> Durée estimée : 6 jours travail

---

## 🛡 J0 — Verrous bloquants à fermer EN PREMIER (30 min Max + 30 min code)

### 1. Plafond Anthropic (Max — 5 min)

1. Ouvrir https://console.anthropic.com/settings/limits
2. **Workspace IKCP** → **Spend limits**
3. Soft limit : **150 €/mois** (notification email)
4. Hard limit : **300 €/mois** (suspension auto)
5. Vérifier : email d'alerte configuré sur `maxime@ikcp.fr`

### 2. Rotation clé API (Max — 5 min)

1. Console Anthropic → **API Keys** → **Create key** (nouvelle, nom `ikcp-prod-2026-05`)
2. Sur chaque worker : `npx wrangler secret put ANTHROPICAPIKEY` (workers : ikcp-chat, ikcp-codex, ikcp-hermes, ikcp-lifestyle)
3. **Révoquer** l'ancienne clé une fois les workers re-vérifiés via /health

### 3. Plafond Perplexity (à activer dès souscription Pro)

- Compte Pro Perplexity activé : 5 $/1000 quick searches, 30 $/Deep Research
- Soft cap mensuel **200 $** (à fixer dans dashboard Perplexity dès qu'on souscrit l'API tier)

---

## 📦 J1 — Worker `ikcp-veille` (Perplexity Pro proxy)

**Code** : `workers/ikcp-veille/worker.js` (scaffolded · à compléter)

**Actions Max** :
```bash
cd workers/ikcp-veille
# 1. Créer KV namespace
npx wrangler kv namespace create VEILLE_CACHE
# → copier l'ID dans wrangler.toml

# 2. Set secret
npx wrangler secret put PERPLEXITY_API_KEY
# → coller la clé Perplexity Pro

# 3. Deploy
npx wrangler deploy
```

**Test live** :
```bash
curl https://ikcp-veille.maxime-ead.workers.dev/health
curl -X POST https://ikcp-veille.maxime-ead.workers.dev/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Jurisprudence Cass. com. 2026 Pacte Dutreil","mode":"quick","user_id":"test","tier":"premium_fo"}'
```

**Branchement dans Marcel** :
- Ajouter tool `search_perplexity` dans `ikcp-marcel/worker.js`
- Marcel invoque ce tool quand : question demande source temps réel, jurisprudence récente, cote actif

---

## 🔐 J2 — Espace client : auth magic link

**Worker** : `ikcp-client` (existant, à enrichir)

**Endpoints à créer/finaliser** :
- `POST /auth/request` — `{email}` → envoie email magic link via Brevo
- `GET /auth/verify?token=xxx` → valide, crée user si premier login, set cookie session, redirige `/app/dashboard`
- `GET /me` — Bearer token → user profile + tier + sirens + recent conversations
- `POST /me/sirens` — ajouter une société (auto-cartographie Pappers)
- `DELETE /me` — droit à l'oubli RGPD cascade

**Schema D1** : voir `workers/ikcp-client/schema-v2.sql` (10 tables)

**Apply schema** :
```bash
cd workers/ikcp-client
npx wrangler d1 execute ikcp-client-db --remote --file=schema-v2.sql
```

**Secret Brevo** : `wrangler secret put BREVO_API_KEY`

---

## 💬 J3 — Persistance conversations + reprise

**Modif worker ikcp-chat** :
- Lire header `Authorization: Bearer <token>` → résoudre user_id
- Avant chaque message : charger history depuis `conversations.messages_json` D1
- Après chaque message : append + update `last_message_at`
- Compteur `usage_daily` incrémenté (rate-limit tier discovery)

**Modif page family-office** :
- Si auth → bouton "Reprendre la dernière conversation" sous Marcel
- Si auth → afficher prénom dans `Bonjour Maxime`
- Si pas auth → fonctionne en mode anonyme (cookie session 7 j, tier `discovery`)

---

## 🎨 J4 — Dashboard `/app/dashboard`

**Page** : `proposals/app-dashboard.html` (à créer, basé sur charte D épuré)

**Composants** :
1. Header avec nom + tier badge + déconnexion
2. Bloc Marcel (champ persistant + dernière conversation)
3. Sociétés rattachées (carte par SIREN)
4. Alertes du jour (collector + Perplexity veille)
5. Sphères actives (les 11, hover = lien vers conversation)
6. Carnet contacts (top 5 favoris + bouton ajouter)
7. Documents (DER, LM, rapports)
8. RDV Maxime (Calendly embed)

---

## 📄 J5 — Mentions légales / CGU / DER / Politique confidentialité

**Pages à créer** :
- `cgu.html` — Conditions générales d'utilisation Cassius (modèle CIF)
- `mentions-legales.html` — éditeur IKCP, ORIAS, hébergeur Cloudflare
- `politique-confidentialite.html` — RGPD : finalités, durées, droits, sous-traitants
- `der.html` — Document d'Entrée en Relation bêta (statut CIF, conflits, rémunération, ACPR)

**Source** : skill `conformite-ikcp` génère DER/LM personnalisés. Utiliser pour produire les templates.

---

## 🔁 J6 — Feedback + streaming SSE + eval suite

### Feedback 👍👎
- UI : sous chaque réponse Marcel/Codex, 2 boutons + textarea raison
- POST `/messages/:id/feedback` → écriture `messages.feedback_value`
- Dashboard admin : voir taux 👍 par sphère / agent

### Streaming SSE
- Modif ikcp-chat : utiliser `stream: true` dans appel Anthropic
- Worker proxy → ReadableStream → client `EventSource`
- UI : Marcel répond en streaming visible (typing fluide)

### Eval suite
- `workers/evals/` : 30 questions canon (10 fiscalité / 10 transmission / 10 lifestyle)
- Job cron quotidien : pose les questions, vérifie présence mots-clés attendus (art. CGI, jurisprudence, disclaimer)
- Slack/email alerte si dégradation > 10 %

---

## 💳 J7+ — Paywall Stripe (post-bêta)

- Worker `ikcp-stripe` (à créer)
- Checkout Stripe pour Premium Essentiel 49 € / Family Office 149 €
- Webhook → met à jour `users.tier`, `users.subscription_status`, `users.subscription_until`
- Trial : 6 mois offerts famille fondatrice (token invite_token déjà dans schema)

---

## 📊 Backlog Sprint 3+ (post-bêta)

- Worker `ikcp-strategie` (Marchés & PE — combler trou)
- Eval suite enrichie
- Mobile PWA installable + push notifications alertes
- SaaS B2B white-label (option D backlog mémoire)
- App native iOS/Android wrapper Capacitor
- Espace administration Maxime (vue 50 familles fondatrices)

---

## 🎯 KPI Sprint 2

- 1 famille fondatrice signée DER + LM = SUCCESS
- 50 inscriptions Découverte (cookie session 7 j) avec ≥ 3 questions Marcel
- 10 conversions Découverte → Premium Family Office (offre fondateur 6 mois)
- 0 incident Anthropic spend > 300 €/mois
- Audit Témoin 100 % des actions sensibles tracées

---

© 2026 IKCP · Cassius · Sprint 2 roadmap
