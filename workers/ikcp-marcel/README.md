# Marcel Worker v2

Worker Cloudflare qui sert le chatbot Marcel sur ikcp.eu.

## Nouveautés v2

- **Web search natif** (Anthropic `web_search_20250305`) : Marcel peut vérifier les actualités fiscales en temps réel (2 recherches max par message)
- **Contexte saisonnier** : le prompt s'adapte selon le mois (période de déclaration, rentrée fiscale, fin d'année…)
- **Few-shot examples** : 3 exemples de réponses idéales injectés dans le prompt pour améliorer la cohérence
- **Règles MIF II renforcées** : citation systématique des sources, pas de prescription, disclaimer systématique
- **Logging KV anonyme** : questions stockées 90 jours dans `MARCEL_LOGS` pour analyser les sujets récurrents
- **Format I/O conservé** : `{message, history}` → `{reply}` pour compat frontend sans modification

## Déploiement

### Prérequis

- Node.js (déjà installé)
- Compte Cloudflare (déjà configuré sur ce poste)

### Première fois

```bash
cd workers/ikcp-marcel
npx wrangler login
# → ouvre le navigateur pour OAuth Cloudflare
```

### Deploy

```bash
cd workers/ikcp-marcel
npx wrangler deploy
```

Cela pousse `worker.js` sur le Worker nommé `ikcp-chat` (URL : `https://ikcp-chat.maxime-ead.workers.dev`) en conservant le secret `ANTHROPICAPIKEY` et en ajoutant le binding KV `MARCEL_LOGS`.

### Test post-déploiement

```bash
curl https://ikcp-chat.maxime-ead.workers.dev
# → doit retourner { "status": "ok", "version": "2.0", "features": [...] }
```

## Variables d'environnement

| Nom | Type | Rôle |
|---|---|---|
| `ANTHROPICAPIKEY` | Secret | Clé API Anthropic (déjà configurée) |
| `MARCEL_LOGS` | KV binding | Logs anonymisés (auto-configuré via wrangler.toml) |

Pour vérifier les secrets existants :
```bash
npx wrangler secret list --name ikcp-chat
```

## Consulter les logs

Logs en direct :
```bash
npx wrangler tail ikcp-chat
```

Lire les questions stockées dans KV :
```bash
npx wrangler kv key list --namespace-id 64d10977135f400783a7e66f119c7b4f
```

## Rollback

Wrangler conserve les versions précédentes. Pour revenir à la version d'avant :
```bash
npx wrangler rollback --name ikcp-chat
```
