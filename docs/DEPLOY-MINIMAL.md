# Guide déploiement minimal — ikcp-client (sans Stripe, sans Resend)

> Objectif : avoir le magic link auth fonctionnel en **15 minutes**, sans carte bancaire, sans email configuré.
> L'outil est entièrement opérationnel. Resend et Stripe s'ajoutent plus tard.

---

## Pré-requis

```bash
# Vérifier que wrangler est connecté au bon compte
npx wrangler whoami
# → doit afficher : maxime@ikcp.fr
```

Si pas connecté :
```bash
npx wrangler login
```

---

## Étape 1 — Exécuter le schéma SQL (1 fois)

```bash
cd workers/ikcp-client
npx wrangler d1 execute ikcp-client-db --file=schema.sql --remote
```

✅ La base de données Paris est initialisée.

---

## Étape 2 — Vérifier les bindings (optionnel)

```bash
npx wrangler d1 list
# → doit lister ikcp-client-db avec son UUID
npx wrangler kv namespace list
# → doit lister CLIENT_KV
```

Les IDs sont déjà dans `wrangler.toml` — rien à changer.

---

## Étape 3 — Déployer le worker

```bash
cd workers/ikcp-client
npx wrangler deploy
```

→ URL live : `https://ikcp-client.maxime-ead.workers.dev`

---

## Étape 4 — Tester l'auth en mode dev (sans Resend)

1. Ouvrir : https://ikcp.eu/app/index.html
2. Saisir votre email (maxime@ikcp.fr)
3. Cliquer "Recevoir mon lien sécurisé"
4. **En mode dev**, le lien apparaît directement sur la page — cliquez-le
5. → Redirection vers `/app/dashboard.html` ✅

---

## Étape 5 — Activer l'envoi email (recommandé, gratuit)

### Option A — Resend (recommandé, 3000 emails/mois gratuit)

1. Créer un compte sur [resend.com](https://resend.com)
2. Dans Resend → API Keys → Create → copier la clé `re_xxx`
3. Ajouter le secret :
```bash
cd workers/ikcp-client
npx wrangler secret put RESEND_API_KEY
# Coller la clé → Entrée
```

4. **Si domaine `ikcp.eu` non vérifié dans Resend** (plus rapide) :
   - Décommenter dans `wrangler.toml` : `RESEND_FROM = "IKCP <onboarding@resend.dev>"`
   - Re-déployer : `npx wrangler deploy`

5. **Si domaine `ikcp.eu` vérifié** (recommandé) :
   - Resend → Domains → Add → `ikcp.eu` → suivre les instructions DNS
   - Les emails partent depuis `noreply@ikcp.eu`

### Option B — Tester sans email (suffisant pour bêta interne)

Le magic link apparaît dans les logs Cloudflare :
```bash
npx wrangler tail ikcp-client
# Dans un autre terminal, déclencher un envoi depuis la page login
# → le lien s'affiche dans les logs
```

Ou via Cloudflare Dashboard → Workers → ikcp-client → Logs.

---

## Sprint 2 — Déployer les agents IA spécialisés

> Une fois ikcp-client OK, déployer les agents qui attendent un secret.

### batisseur + hermes + lifestyle (Anthropic)

```bash
# La clé est LA MÊME pour les 3 — votre clé API Anthropic
cd workers/ikcp-batisseur
npx wrangler secret put ANTHROPICAPIKEY

cd workers/ikcp-hermes
npx wrangler secret put ANTHROPICAPIKEY

cd workers/ikcp-lifestyle
npx wrangler secret put ANTHROPICAPIKEY
```

Puis déployer :
```bash
cd workers/ikcp-batisseur && npx wrangler deploy
cd workers/ikcp-hermes && npx wrangler deploy
cd workers/ikcp-lifestyle && npx wrangler deploy
```

Vérifier :
```bash
curl https://ikcp-batisseur.maxime-ead.workers.dev/health
# → {"status":"ok","configured":{"api_key":true}}
```

### veille (Perplexity)

```bash
cd workers/ikcp-veille
npx wrangler secret put PERPLEXITY_API_KEY
# + créer le KV si pas encore fait :
npx wrangler kv namespace create VEILLE_CACHE
# → copier l'ID dans wrangler.toml [[kv_namespaces]] id=...
npx wrangler deploy
```

### Activer dans Marcel (après deploy)

Dans `workers/ikcp-marcel/worker.js`, chercher `SPECIALISTS_REGISTRY` et passer :
```javascript
{ key: 'batisseur', live: true, ... }
{ key: 'hermes',    live: true, ... }
{ key: 'lifestyle', live: true, ... }
```

Puis : `cd workers/ikcp-marcel && npx wrangler deploy`

---

## Sprint 3 — Stripe (optionnel, plus tard)

```bash
cd workers/ikcp-client
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# + décommenter les vars dans wrangler.toml
npx wrangler deploy
```

---

## Vérifications finales

| URL | Attendu |
|---|---|
| `https://ikcp-client.maxime-ead.workers.dev/health` | `{"status":"ok","bindings":{"db":true,"kv":true,...}}` |
| `https://ikcp.eu/app/index.html` | Page login Marcel |
| `https://ikcp.eu/app/dashboard.html` | Redirect → login (si pas de session) |
| `https://ikcp-chat.maxime-ead.workers.dev/health` | `{"status":"ok","model":"claude-sonnet-4-5"}` |
| `https://ikcp-pappers.maxime-ead.workers.dev/entreprise/947972436/short` | JSON société IKCP |

---

## En cas de problème

**Worker ne démarre pas** :
```bash
npx wrangler tail ikcp-client
# Regarder les logs en temps réel
```

**D1 introuvable** :
```bash
npx wrangler d1 list
# Vérifier que ikcp-client-db existe bien avec l'UUID dans wrangler.toml
```

**Session cookie non transmis** :
- Le cookie `ikcp_session` est `SameSite=None; Secure` en prod
- En local (`localhost`), les `credentials: 'include'` fonctionnent sans HTTPS
- Sur `ikcp.eu`, le cookie traverse les domaines `*.maxime-ead.workers.dev` → OK

---

*IKCP · ORIAS 23001568 · Cloudflare WEUR Paris · Dernière MÀJ : 21 mai 2026*
