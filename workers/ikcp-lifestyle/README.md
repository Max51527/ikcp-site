# ikcp-lifestyle — 8 sous-agents Sonnet 4.6 mutualisés

Worker Cloudflare regroupant les 8 sous-agents Family Office "lifestyle / passions / immobilier" sur un seul endpoint pour économiser la maintenance.

## Agents disponibles

| ID | Nom | Spécialité | Modèle |
|---|---|---|---|
| `iris` | Iris | Voyage & Conciergerie | Sonnet 4.6 |
| `emile` | Émile | Art & Collections | Sonnet 4.6 |
| `leon` | Léon | Voitures, Yachts & Aviation | Sonnet 4.6 |
| `josephine` | Joséphine | Montres & Joaillerie | Sonnet 4.6 |
| `helene` | Hélène | Mode, Beauté & Bien-être | Sonnet 4.6 |
| `olympe` | Olympe | Philanthropie & NextGen | Sonnet 4.6 |
| `auguste` | Auguste | Vins & Gastronomie | Sonnet 4.6 |
| `augustin` | Augustin | Immobilier & Foncier | Sonnet 4.6 |

> **Workers dédiés** (pas dans ce worker mutualisé) : Théodore (`ikcp-batisseur`, Opus 4.7 — patrimoine), Hermès (`ikcp-hermes`, Opus 4.7 — transmission), Codex (`ikcp-codex`, Opus 4.7 — fiscalité), Capital (`ikcp-capital`, Opus 4.7 — Marchés & PE), Marcel (`ikcp-chat`, Sonnet 4.6 — orchestration).

## Endpoints

### `GET /health`

```json
{
  "status": "ok",
  "service": "ikcp-lifestyle",
  "agents": [
    { "id": "iris", "name": "Iris", "role": "Voyage & Conciergerie", "model": "claude-sonnet-4-6" },
    ...
  ],
  "configured": { "api_key": true }
}
```

### `POST /`

**Request**
```json
{
  "agent": "iris",
  "question": "Recommandez-moi 3 chalets a Megeve fin decembre",
  "context": "(optionnel) Contexte fourni par Marcel"
}
```

**Response**
```json
{
  "reply": "...",
  "agent": "Iris",
  "agent_id": "iris",
  "role": "Voyage & Conciergerie",
  "model": "claude-sonnet-4-6",
  "usage": { "input_tokens": ..., "output_tokens": ... },
  "delegated_by": "Marcel"
}
```

## Déploiement

```bash
cd workers/ikcp-lifestyle
npx wrangler login                                # 1ère fois
npx wrangler secret put ANTHROPICAPIKEY           # coller la clé sk-ant-...
npx wrangler deploy
```

URL post-déploiement : `https://ikcp-lifestyle.maxime-ead.workers.dev`

## Économie prompt caching

Le system prompt long de chaque agent (~1500 tokens) est marqué `cache_control: { type: "ephemeral" }`. Bénéfice attendu : **-80 % coût** dès le 2e appel sous 5 minutes (TTL cache Anthropic).

## Conformité MIF II

Chaque agent termine par une question, jamais par une recommandation produit personnalisée. Disclaimer obligatoire automatique : *"Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier."*

## Test rapide

```bash
# Test Iris (voyage)
curl -X POST https://ikcp-lifestyle.maxime-ead.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"agent":"iris","question":"Conciergerie pour vacances de fevrier 2027 a Megeve, famille de 5"}'

# Test Joséphine (montres)
curl -X POST https://ikcp-lifestyle.maxime-ead.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"agent":"josephine","question":"Patek Nautilus 5711A : faut-il attendre que le marche secondaire baisse encore avant d acheter ?"}'

# Test Olympe (philanthropie)
curl -X POST https://ikcp-lifestyle.maxime-ead.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"agent":"olympe","question":"Mes parents veulent creer une fondation famille pour la recherche medicale. Quelle structure choisir entre fonds de dotation et FRUP ?"}'
```

## Architecture d'orchestration

```
Frontend (family-office-v4.html)
    │
    ▼
ikcp-chat (Marcel · Sonnet 4.6)
    │
    │ tool_use: delegate_to_specialist
    │ { agent: "iris", question, context }
    │
    ▼
ikcp-lifestyle (CE WORKER)
    │
    │ system: PROMPTS["iris"].system  (cached)
    │ model: claude-sonnet-4-6
    │
    ▼
api.anthropic.com /v1/messages
    │
    ▼
reply → Marcel → frontend
```

© 2026 IKCP · Sub-agents Sonnet 4.6 mutualisés
