# ikcp-temoin · audit log immutable

> Worker Cloudflare souverain UE — trace chaque interaction client.
> Conformité MIF II + RGPD + opposabilité juridique 10 ans.

## Endpoints

| Méthode | URL | Description |
|---|---|---|
| GET | `/health` | Ping + statut bindings |
| POST | `/log` | Enregistre une interaction |
| GET | `/retrieve/:hash` | Lit une entrée par hash SHA-256 |
| GET | `/audit?family_id=...` | Audit trail famille (token admin requis) |

## Déploiement (10 minutes)

```bash
cd workers/ikcp-temoin

# 1. Login Cloudflare (une fois)
npx wrangler login

# 2. Créer la base D1 à Paris (région weur)
npx wrangler d1 create ikcp_temoin_db --location weur
# Copie l'ID retourné dans wrangler.toml → database_id

# 3. Créer le bucket R2 EU
npx wrangler r2 bucket create ikcp-temoin --location eu

# 4. Créer la table audit_log
npx wrangler d1 execute ikcp_temoin_db --remote --file=schema.sql

# 5. Token admin (génère puis stocke)
openssl rand -hex 32  # → copie le résultat
npx wrangler secret put IKCP_ADMIN_TOKEN  # colle le token

# 6. Déploie
npx wrangler deploy
```

Worker disponible à : `https://ikcp-temoin.<ton-subdomain>.workers.dev`

## Test rapide

```bash
# Health check
curl https://ikcp-temoin.maxime-ead.workers.dev/health

# Log une interaction
curl -X POST https://ikcp-temoin.maxime-ead.workers.dev/log \
  -H "Content-Type: application/json" \
  -d '{
    "family_id": "famille-test-001",
    "user_id": "maxime",
    "universe": "fiscalite",
    "question": "Test conformité MIF II",
    "answer_summary": "Réponse de test",
    "agent": "marcel",
    "model": "claude-sonnet-4-6",
    "tokens_input": 120,
    "tokens_output": 80,
    "sources": ["art. 197 CGI"],
    "mif2_compliant": true
  }'
# → { "ok": true, "hash": "...", "timestamp": "...", "r2_key": "audit/..." }

# Retrieve par hash
curl https://ikcp-temoin.maxime-ead.workers.dev/retrieve/<hash>

# Audit trail famille (admin)
curl https://ikcp-temoin.maxime-ead.workers.dev/audit?family_id=famille-test-001 \
  -H "X-IKCP-Token: <ton-token-admin>"
```

## Architecture data

```
Client interaction
       ↓
   POST /log
       ↓
   ┌───────────────────┬───────────────────┐
   ↓                   ↓                   ↓
SHA-256 hash      D1 (Paris)         R2 (EU Frankfurt)
                  metadata           payload immutable
                  index              rétention 10 ans
```

## Compliance

- **MIF II** : champ `mif2_compliant` = 1 (par défaut). Mettre à 0 force review.
- **RGPD** : pas de PII non hashée. Hash SHA-256 = intégrité, pas réversible.
- **eIDAS** : timestamp UTC ISO 8601 + hash SHA-256 = horodatage qualifié (NF Z42-026 ready).
- **Rétention** : 10 ans (R2 versioning + lifecycle rules).

## Coût estimé

- D1 : free 5 GB inclus · au-delà 0,75 $/GB
- R2 : 0,015 $/GB/mois · zero egress (sortie gratuite)
- Workers : free 100k requests/jour, payant 0,30 $/M req au-delà

**Pour 50 clients × 30 interactions/jour = 1500 logs/jour = ~5 €/mois.**
