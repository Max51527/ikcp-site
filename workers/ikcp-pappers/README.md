# IKCP Pappers Worker

Wrappe l'API [Pappers.fr](https://www.pappers.fr/api) pour le Family Office IKCP — entry point de Théodore (Architecte 360°) pour récupérer la structure d'une entreprise / holding à partir d'un simple SIREN.

## Endpoints

| Méthode | Path | Description |
|---|---|---|
| `GET` | `/` ou `/health` | Status + bindings configurés |
| `GET` | `/search?q=<query>` | Recherche entreprise par nom (10 résultats max) |
| `GET` | `/entreprise/:siren` | Fiche complète (dirigeants, bénéficiaires, finances, actes) |
| `GET` | `/entreprise/:siren/short` | Fiche résumée (rapide pour Marcel chat) |

## Setup en 4 étapes (5 min)

### 1. Obtenir une clé Pappers

→ <https://www.pappers.fr/api/inscription> (free tier 100 requêtes/mois, suffit pour tester)

### 2. Créer le KV cache

```powershell
cd "$env:USERPROFILE\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-pappers"
npx wrangler login
npx wrangler kv namespace create PAPPERS_CACHE
```

Copie l'ID retourné dans `wrangler.toml` (champ `id`, remplace `REPLACE_WITH_YOUR_KV_ID`).

### 3. Pousser le secret

```powershell
npx wrangler secret put PAPPERS_API_KEY
# Colle ta clé Pappers quand demandé
```

### 4. Déployer

```powershell
npx wrangler deploy
```

URL retournée : `https://ikcp-pappers.<ton-sous-domaine>.workers.dev`

## Tests

### Health check (sans clé)
```powershell
curl https://ikcp-pappers.<sous-domaine>.workers.dev/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "service": "ikcp-pappers",
  "version": "1.0",
  "configured": { "api_key": true, "cache_kv": true }
}
```

### Recherche entreprise

```powershell
curl "https://ikcp-pappers.<sous-domaine>.workers.dev/search?q=IKIGAI"
```

### Fiche complète (SIREN IKCP exemple)

```powershell
curl "https://ikcp-pappers.<sous-domaine>.workers.dev/entreprise/947972436"
```

### Fiche résumée

```powershell
curl "https://ikcp-pappers.<sous-domaine>.workers.dev/entreprise/947972436/short"
```

## Test sans déployer (dev local)

```powershell
npx wrangler dev
```

Ouvre `http://localhost:8787/health` dans le navigateur.

## Logs

```powershell
npx wrangler tail ikcp-pappers
```

## Cache

Les réponses sont mises en cache **1 heure** dans KV (`PAPPERS_CACHE`). Header `X-IKCP-Cache: HIT` ou `MISS` indique l'état. Économise drastiquement le quota Pappers free tier (100 req/mois → potentiellement plusieurs centaines d'utilisateurs).

## Sécurité

- Clé Pappers **jamais** exposée au front (toujours côté Worker)
- CORS strict : `ikcp.eu` + `localhost` + `file://` (dev only)
- Pas de logs avec PII : seuls SIREN et `q` sont loggés (qui sont publics par nature)

## Prochaine étape

Brancher ce Worker en tool-call à Marcel (worker `ikcp-chat`) — voir [PAPPERS-INTEGRATION.md](../../docs/PAPPERS-INTEGRATION.md).
