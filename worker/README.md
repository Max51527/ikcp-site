# IKCP Prospect Worker

Pipeline : Diagnostic ikcp.eu → Notion DB → Notification email

## Déploiement

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler deploy
```

## Variables d'environnement (à configurer dans Cloudflare Dashboard)

| Variable | Description |
|---|---|
| `NOTION_TOKEN` | Token secret de l'intégration Notion (`secret_xxx`) |
| `NOTION_DB_ID` | ID de la base Notion : `47283ea3419f4d1b80cade61d7b65791` |
| `NOTIFY_EMAIL` | Email de notification (défaut : maxime@ikcp.eu) |

## Configuration Notion requise

1. Créer une intégration sur notion.so/profile/integrations
2. Connecter l'intégration à la base prospects (... → Connections)
3. Colonnes attendues dans la DB :
   - Nom (title), Email, Prénom, Score (number), Niveau (select)
   - Statut (select), Patrimoine net (number), IR estimé (number)
   - TMI, Droits succession (number), Âge (number)
   - Situation (select), Statut pro, Enfants (number)
   - Alertes, Leviers, Source (select), Date (date)

## Test

```bash
curl -X POST https://ikcp-prospect.maxime-ead.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"prenom":"Test","email":"test@test.com","score":72,"patrimoineNet":350000}'
```

## Health check

```bash
curl https://ikcp-prospect.maxime-ead.workers.dev
# → {"status":"ok","service":"ikcp-prospect-worker"}
```
