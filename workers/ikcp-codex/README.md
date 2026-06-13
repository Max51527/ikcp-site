# ikcp-codex · sub-agent fiscal Opus 4.7

> Premier sub-agent spécialisé de l'équipe IKCP.
> Marcel délègue les questions fiscales pointues (CGI, BOFIP, jurisprudence).

## Endpoints

| Méthode | URL | Description |
|---|---|---|
| GET | `/health` | Statut + clé API |
| POST | `/` | `{ question, context? }` → `{ reply, agent, model, usage }` |

## Déploiement (3 min)

```bash
cd workers/ikcp-codex
npx wrangler secret put ANTHROPICAPIKEY  # même clé que Marcel
npx wrangler deploy
```

## Test rapide

```bash
curl -X POST https://ikcp-codex.maxime-ead.workers.dev/ \
  -H "Content-Type: application/json" \
  -H "Origin: https://ikcp.eu" \
  -d '{"question":"Pacte Dutreil sur EURL holding patrimoniale, quelles conditions ?"}'
```

## Coût indicatif

- Opus 4.7 : 15 $/M input + 75 $/M output
- Réponse moyenne ~1500 tokens out + 800 in = ~0,12 $ par appel
- Avec cache : ~0,025 $

→ **Marcel délègue à Codex 5-10% des questions** (les plus complexes). Pour 50 clients × 15 q/mois × 7% = ~50 délégations/mois × 0,025 $ = **1,25 €/mois pour Codex sur 50 clients**.
