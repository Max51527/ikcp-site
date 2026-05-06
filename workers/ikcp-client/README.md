# IKCP Client Portal — Worker

Espace client privé family office avec auth magic link.

## Fichiers

- `worker.js` — code du worker (700+ lignes : auth + SSR pages + API)
- `wrangler.toml` — config bindings (D1 + KV + vars)
- `schema.sql` — schéma D1 (users, sessions, audit, conversations, dossiers)
- `deploy.bat` — script déploiement guidé Windows
- `.gitignore` — exclut node_modules, .wrangler, secrets locaux

## Setup en 5 étapes

### 1. Créer la D1

```bash
cd workers/ikcp-client
npx wrangler d1 create ikcp-client-db
```

Copier l'ID retourné dans `wrangler.toml` (champ `database_id`).

### 2. Créer le KV namespace pour magic tokens

```bash
npx wrangler kv namespace create CLIENT_TOKENS
```

Copier l'ID dans `wrangler.toml` (champ `kv_namespaces.id`).

### 3. Migrer le schéma D1

```bash
npx wrangler d1 execute ikcp-client-db --file=schema.sql --remote
```

### 4. Pousser les secrets

```bash
# JWT secret (64 chars random)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put JWT_SECRET

# Resend API key (depuis https://resend.com/api-keys)
npx wrangler secret put RESEND_API_KEY
```

### 5. Déployer

```bash
npx wrangler deploy
```

URL par défaut : `https://ikcp-client.maxime-ead.workers.dev`

### 6. (Optionnel) Domaine custom `client.ikcp.eu`

- Cloudflare DNS → CNAME `client` → `ikcp-client.maxime-ead.workers.dev` (proxy ON)
- Worker → Domains and Routes → Add Custom Domain → `client.ikcp.eu`
- Mettre à jour `APP_URL` dans `wrangler.toml` puis re-déployer

## Test

```bash
# Healthcheck
curl https://ikcp-client.maxime-ead.workers.dev/health

# Devrait retourner :
# {"status":"ok","service":"ikcp-client","version":"0.1","bindings":{"db":true,"tokens":true,"jwt":true,"resend":true}}
```

Si tous les bindings sont `true`, ça marche. Ouvre l'URL dans un browser
et teste le flow login : email → reçois lien → clic → dashboard.

## Routes

| Route | Méthode | Auth | Description |
|---|---|---|---|
| `/` | GET | non | Page login |
| `/auth/send` | POST | non | Envoie magic link à l'email saisi |
| `/auth/verify?token=X` | GET | non | Vérifie token, crée session, redirect dashboard |
| `/auth/logout` | GET | oui | Détruit session + cookie |
| `/dashboard` | GET | oui | Vue d'ensemble client |
| `/marcel` | GET | oui | Marcel privé persistant (placeholder phase 2) |
| `/dossiers` | GET | oui | Liste dossiers (placeholder phase 2) |
| `/health` | GET | non | Status worker + bindings |

## Sécurité

- Cookie `HttpOnly` + `Secure` + `SameSite=Strict`
- JWT signé HS256 (secret 64 chars)
- Magic link TTL 15 min, single-use (burn après vérification)
- Rate limit 3 envois / email / heure
- Audit log de toutes les connexions (D1 `audit_log`)
- Sessions stockées D1 + invalidables individuellement
- Pas de password jamais stocké

## Phase 2 (à venir)

- [ ] Marcel persistant cross-session (mémoire D1)
- [ ] Dossiers patrimoine avec R2 chiffré
- [ ] Reports trimestriels PDF (Cron Worker)
- [ ] Calendrier échéances fiscales
- [ ] Membres famille rattachés (gouvernance)
- [ ] 2FA TOTP optionnel
