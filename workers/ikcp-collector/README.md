# ikcp-collector — Agent veille marchés collectionneur

Worker Cloudflare automatisé qui scrute en continu les marchés "profil collectionneur" et alerte sur opportunités matchant le profil utilisateur.

## Marchés couverts

### 🟢 Modules LIVE (gratuits)
| Module | Source | Catégorie | Coût | Note |
|---|---|---|---|---|
| `bricklink` | Rebrickable API | Lego | gratuit (1 req/sec) | Clé gratuite `REBRICKABLE_API_KEY` |
| `histovec` | Histovec gouv.fr | Voitures FR | gratuit | Vérification individuelle |

### 🟡 Modules STUB (à brancher Sprint 3+)
- `chrono24` / `watchcharts` / `phillips` — Montres
- `classic` / `hagerty` — Voitures
- `stockx` / `goat` — Sneakers
- `idealwine` / `wine_searcher` — Vins
- `artprice` / `drouot` — Art
- `yachtworld` / `marinetraffic` — Yachts

Les stubs renvoient l'URL publique du marché et un statut `manual` ou `freemium-pending-key`. Marcel peut t'orienter vers ces URLs en attendant.

## Architecture

```
                          ┌──────────────────────────┐
                          │  Cloudflare Cron Trigger │
                          │  (chaque jour 7h Paris)   │
                          └────────────┬─────────────┘
                                       │
                                       ▼
                       ┌──────────────────────────────┐
                       │  ikcp-collector (worker)      │
                       │  scheduled() → dailyScan()    │
                       └─────┬──────────────────────┬─┘
                             │                      │
                             ▼                      ▼
                  ┌────────────────────┐   ┌────────────────────┐
                  │  D1 Paris (WEUR)    │   │ APIs externes      │
                  │  user_profile       │   │  - Rebrickable     │
                  │  market_watches     │   │  - (futurs)        │
                  │  alerts             │   └────────────────────┘
                  └────────────────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │  Frontend admin     │
                  │  ikcp.eu/collector  │
                  │  (Bearer admin tk)  │
                  └────────────────────┘
```

## Endpoints

### `GET /health` — public
Statut + modules live + modules stub + configuration.

### `GET /lookup?market=bricklink&q=10497-1` — public
Lookup direct sans toucher la D1. Utile pour Marcel / tests rapides.

### Endpoints admin (Bearer `ADMIN_TOKEN`)

| Endpoint | Méthode | Description |
|---|---|---|
| `/profile?user_id=max` | GET | Lire profil + passions |
| `/profile` | POST | `{ user_id, passions_json }` upsert profil |
| `/watches?user_id=max` | GET | Liste watches actifs |
| `/watches` | POST | `{ user_id, market, category, query, target_price? }` ajout watch |
| `/watches/:id` | DELETE | Désactive watch (soft) |
| `/alerts?user_id=max&unread=1` | GET | Liste alertes (filtre non-lues) |
| `/scan` | POST | Déclenche scan manuel (sinon cron daily) |

## Déploiement

```bash
cd workers/ikcp-collector

# 1. Créer la D1 Paris
npx wrangler d1 create ikcp_collector_db --location weur
# → copier l'UUID retourné dans wrangler.toml database_id

# 2. Initialiser schema
npx wrangler d1 execute ikcp_collector_db --remote --file=schema.sql

# 3. Secrets
npx wrangler secret put ADMIN_TOKEN          # token long, Bitwarden
npx wrangler secret put REBRICKABLE_API_KEY  # https://rebrickable.com/api/ (gratuit)

# 4. Deploy
npx wrangler deploy
```

## Tester

```bash
# Sante
curl https://ikcp-collector.maxime-ead.workers.dev/health

# Ajouter un watch Lego (UCS Galaxy Explorer)
curl -X POST https://ikcp-collector.maxime-ead.workers.dev/watches \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"max","market":"bricklink","category":"lego","query":"10497-1","target_price":600}'

# Lookup direct
curl "https://ikcp-collector.maxime-ead.workers.dev/lookup?market=bricklink&q=10497-1"

# Lister watches
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://ikcp-collector.maxime-ead.workers.dev/watches?user_id=max"

# Forcer un scan (le cron tournera chaque jour 7h Paris)
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://ikcp-collector.maxime-ead.workers.dev/scan
```

## Profil utilisateur (passions_json)

Structure JSON libre, par catégorie. Marcel peut le lire pour personnaliser ses réponses.

```json
{
  "montres": {
    "detenues": [],
    "wishlist": ["Patek 5711A", "AP Royal Oak 15202"],
    "marches_suivis": ["chrono24", "watchcharts", "phillips"]
  },
  "voitures": {
    "detenues": [],
    "wishlist": ["Porsche 964 RS", "Ferrari 250 GTL"],
    "periode_preferee": "air-cooled"
  },
  "lego": {
    "detenues_set_ids": [],
    "wishlist_set_ids": ["10497-1", "75313-1"],
    "themes_preferes": ["UCS Star Wars", "Technic", "Creator Expert"]
  },
  "vins": { "domaines": [], "wishlist": [] },
  "art": { "artistes_suivis": [], "wishlist": [] },
  "voyage": { "destinations_recurrentes": ["Megeve"], "wishlist": [] },
  "sport": { "pratique": [], "spectateur": [] }
}
```

## Conformité

- **RGPD** : profil + watches stockés en D1 Paris uniquement. Aucune sortie UE.
- **Sources publiques uniquement** : on n'achète pas de données privées, on indexe les marchés publics.
- **Pas de scraping abusif** : User-Agent identifiable, rate limit respecté, robots.txt suivi.
- **MIF II** : le collector n'émet PAS de recommandation d'achat/vente. Il informe et alerte. Marcel synthétise sans préconiser.

© 2026 IKCP · Agent veille marchés collectionneur
