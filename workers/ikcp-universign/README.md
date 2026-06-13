# ikcp-universign · signature électronique souveraine FR

> Wrapper Cloudflare Worker pour l'API Universign (Dhimyotis).
> eIDAS qualifié · hébergement Annecy + Paris · 0,80 €/signature.

## Pourquoi Universign vs YouSign

| Critère | Universign ✅ | YouSign |
|---|---|---|
| Hébergement | Annecy + Paris | Paris |
| Prix /signature | **0,80 €** | 0,99 € |
| Tier gratuit | 5 sign/mois | 1 sign/jour |
| eIDAS qualifié | ✓ | ✓ |
| Partenaire CSN (notaires) | ✓ | partiel |
| Archivage NF Z42-026 | ✓ | ✓ |
| API REST claire | ✓ excellente | bonne |

## Prérequis

1. Compte Universign Pro : https://www.universign.eu/professionnel/
2. Souscription pack "Qualified" pour eIDAS qualifié (signature opposable en justice)
3. Profil API créé : récupérer la **clé API** + **profile_id**

## Déploiement

```bash
cd workers/ikcp-universign

# 1. Login Cloudflare
npx wrangler login

# 2. Créer D1 (Paris)
npx wrangler d1 create ikcp_universign_db --location weur
# copie l'ID dans wrangler.toml

# 3. Schema
npx wrangler d1 execute ikcp_universign_db --remote --file=schema.sql

# 4. Secrets
npx wrangler secret put UNIVERSIGN_API_KEY  # colle ta clé
npx wrangler secret put UNIVERSIGN_PROFILE_ID  # colle ton profile_id qualified

# 5. Deploy
npx wrangler deploy
```

## Test

```bash
# Health
curl https://ikcp-universign.maxime-ead.workers.dev/health

# Créer une transaction de signature (avec un PDF base64)
curl -X POST https://ikcp-universign.maxime-ead.workers.dev/transactions/create \
  -H "Content-Type: application/json" \
  -d '{
    "customId": "lettre-mission-dupont-2026",
    "family_id": "famille-dupont-001",
    "description": "Lettre de mission Family Office Augmenté",
    "return_base_url": "https://famille.ikcp.eu",
    "documents": [
      {
        "name": "Lettre de mission IKCP.pdf",
        "base64": "JVBERi0xLjQK..."
      }
    ],
    "signers": [
      {
        "firstName": "Jean-Marc",
        "lastName": "Dupont",
        "email": "jean-marc.dupont@example.com",
        "phone": "+33612345678",
        "birthDate": "1968-04-12"
      }
    ]
  }'
# → { "ok": true, "transaction_id": "tx_...", "signers_urls": ["https://..."] }
```

Le signataire reçoit un email/SMS avec un lien sécurisé. Signature OTP par SMS pour eIDAS qualifié.

## Cas d'usage IKCP

| Document | Type signature | Coût |
|---|---|---|
| Lettre de mission Premium | qualifiée | 0,80 € |
| Lettre de mission Sur-mesure | qualifiée | 0,80 € |
| Mandat ad-hoc conciergerie | simple | 0,30 € |
| Convention de portage NextGen | qualifiée | 0,80 € |
| DER MIF II (accusé prise de connaissance) | simple | 0,30 € |

**Coût mensuel estimé pour 50 clients Premium : ~5 lettres de mission × 0,80 € = 4 €/mois.**

## Workflow type

```
1. Maxime valide la lettre de mission générée par Cassius
2. Worker ikcp-universign crée la transaction
3. Client reçoit email + SMS Universign
4. Client signe via OTP SMS (eIDAS qualifié)
5. Webhook /webhook reçoit notification "signed"
6. ikcp-temoin archive la transaction (audit log)
7. PDF signé envoyé à Maxime + client
```
