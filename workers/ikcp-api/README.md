# ikcp-api — Worker gateway

Point d'entrée canonique `api.ikcp.eu` qui expose les endpoints publics
de l'écosystème IKCP. Proxy vers les sous-Workers (Marcel, etc.) et les
APIs externes (Légifrance, INSEE, DVF, Notion, Resend).

## Endpoints

| Méthode | Path | Description |
|---|---|---|
| GET | `/v1/health` | Status + endpoints + secrets configurés |
| POST | `/v1/agents/ask` | Orchestration multi-thématique → service binding Marcel |
| POST | `/v1/notion` | Crée une fiche prospect dans Notion |
| POST | `/v1/email` | Envoi email via Resend |
| GET | `/v1/legifrance?q=...` | Recherche article CGI (api.piste.gouv.fr) |
| GET | `/v1/insee?commune=...` | Données démographiques INSEE |
| GET | `/v1/dvf?code_postal=...` | Comparables transactions immobilières (api.cquest.org) |

## Bindings et secrets

### Service binding (wrangler.toml)

```toml
[[services]]
binding = "MARCEL"
service = "ikcp-chat"
```

Le binding `MARCEL` permet à `/v1/agents/ask` de déléguer vers le Worker
`ikcp-chat` (qui contient Marcel v2) **sans coût d'invocation et avec une
latence quasi-nulle** (intra-Cloudflare).

Pré-requis : le Worker `ikcp-chat` doit être déployé dans le même
compte Cloudflare. Pour le vérifier :

```bash
npx wrangler deployments list --name ikcp-chat
```

Si `ikcp-chat` n'existe pas encore, déployer d'abord :

```bash
cd ../ikcp-marcel
npx wrangler deploy
```

### Secrets (Cloudflare Dashboard → Worker `ikcp-api` → Settings → Secrets)

| Secret | Source | Optionnel ? |
|---|---|---|
| `NOTION_TOKEN` | https://www.notion.so/my-integrations | oui (sans → endpoint /v1/notion désactivé) |
| `RESEND_API_KEY` | https://resend.com/api-keys | oui |
| `LEGIFRANCE_TOKEN` | https://piste.gouv.fr | oui (sans → mock) |
| `INSEE_KEY` | https://api.insee.fr | oui |

### Variables d'environnement (texte clair)

| Variable | Exemple |
|---|---|
| `NOTION_DB_ID` | `abc123...` (ID database Notion Prospects) |
| `RESEND_FROM` | `Marcel <marcel@ikcp.eu>` |
| `RESEND_TO` | `maxime@ikcp.fr` |

## Déploiement

```bash
# 1. Login (une seule fois)
npx wrangler login

# 2. Vérifier la config
npx wrangler whoami
cat wrangler.toml

# 3. Configurer les secrets (interactif, encrypté)
npx wrangler secret put NOTION_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put INSEE_KEY
# (LEGIFRANCE_TOKEN optionnel)

# 4. Configurer les variables (clair)
# Via Dashboard → Settings → Variables and Secrets

# 5. Déployer
npx wrangler deploy

# 6. Vérifier
curl https://ikcp-api.maxime-ead.workers.dev/v1/health
```

Réponse attendue (avec service binding actif) :

```json
{
  "success": true,
  "data": {
    "service": "ikcp-api",
    "version": "1.0.0",
    "endpoints": [
      "/v1/agents/ask",
      "/v1/notion",
      "/v1/email",
      "/v1/legifrance?q=",
      "/v1/insee?commune=",
      "/v1/dvf?code_postal="
    ],
    "configured": {
      "marcel_binding": true,
      "notion": true,
      "resend": true,
      "legifrance": false,
      "insee": true
    }
  }
}
```

## Domaine custom `api.ikcp.eu`

1. Cloudflare Dashboard → DNS → Add record
   - Type : `CNAME`
   - Name : `api`
   - Target : `ikcp-api.maxime-ead.workers.dev`
   - Proxy : ON
2. Worker → Domains and Routes → Add → `api.ikcp.eu`

## Test post-déploiement

```bash
# Health
curl https://api.ikcp.eu/v1/health

# Agents (avec Origin → CORS check)
curl -X POST https://api.ikcp.eu/v1/agents/ask \
  -H "Origin: https://ikcp.eu" \
  -H "Content-Type: application/json" \
  -d '{"theme":"fiscal","question":"Donation 200k€ à mon fils — antériorité ?"}'

# DVF
curl "https://api.ikcp.eu/v1/dvf?code_postal=75116&type=Appartement&surface_min=70&surface_max=90"
```

## Architecture

```
                     ikcp.eu (PWA / pages family-office)
                              │
                              ▼ HTTPS + CORS
                     api.ikcp.eu/v1/*
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
              Worker ikcp-api    APIs externes
              (ce Worker)        (Légifrance, INSEE,
                     │           DVF, Notion, Resend)
                     │ service binding (intra-CF, latence ~0)
                     ▼
              Worker ikcp-chat
              (Marcel orchestrateur)
                     │
                     ├─ tools déterministes (calc_*)
                     ├─ web search Anthropic
                     ├─ prompt caching MIF II
                     └─ KV MARCEL_LOGS (90 j)
```
