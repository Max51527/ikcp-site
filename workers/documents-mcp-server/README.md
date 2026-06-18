# IKCP Documents MCP server — Premier prototype sub-agent

Sub-agent qui **classifie** et **extrait les données structurées** des
documents patrimoniaux uploadés par les clients (avis IR, K-bis, actes,
AV, relevés, etc.) via Anthropic Claude vision.

Premier prototype IKCP du pattern **Claude Agent / MCP server** documenté
dans [`docs/CLAUDE-AGENT-SDK-INTEGRATION.md`](../../docs/CLAUDE-AGENT-SDK-INTEGRATION.md).

## Tools exposés

| Tool | Description |
|---|---|
| `classify_document(r2_key, hint?)` | Détecte le type (parmi 14 catégories), extrait les champs clés, retourne un summary 2-3 phrases + score de confiance |
| `extract_structured(r2_key, doc_type)` | Extraction profonde des champs typés selon le type connu |
| `ocr_pdf(r2_key)` | OCR brut page par page (fallback) |

## Types de documents reconnus

`avis_ir` · `avis_ifi` · `kbis` · `statuts` · `acte_donation` ·
`acte_notarie` · `av_contrat` · `releve_pea` · `taxe_fonciere` ·
`cfe` · `bilan_compta` · `compromis` · `bail` · `attestation` · `autre`

## Architecture

```
   Client uploade un PDF/image
        │ POST /api/docs/upload (workers/ikcp-client)
        ▼
   ikcp-client : upload R2 + insert D1 documents (status=pending)
        │ service binding (latence ~0)
        ▼
   documents-mcp-server : /mcp/call_tool name=classify_document
        │ récupère depuis R2 (binding DOCS_R2)
        │ encode base64
        │ appelle Anthropic Claude vision
        │ parse JSON structuré
        ▼
   Retour { type, year, summary, key_fields, confidence }
        │
        ▼
   ikcp-client : update D1 documents (type, label, tags_json)
                 + audit_log
```

## Flux RGPD

| Étape | Donnée | Conservation |
|---|---|---|
| Upload R2 | Doc chiffré at-rest (Cloudflare default) | Durée relation + 10 ans (NF Z42-013) |
| Hash SHA-256 | Audit log D1 | Idem |
| Anthropic vision | Doc envoyé via TLS (pas stocké) | 30 j max chez Anthropic (DPA) · pas de retraining |
| Classification | Type + champs en D1 (anonymisable) | Idem |
| `DELETE /api/docs/:id` | Suppression R2 + anonymisation D1 | Audit log conservé (CNIL admis) |

**Pré-requis RGPD avant beta** :
- ✅ DPA (Data Processing Addendum) Anthropic signé
- ✅ Mention dans la charte beta-tester : *« Les documents uploadés
  sont OCRisés via Anthropic Claude (US, conservation 30 j max,
  pas de retraining sur vos données). »*
- ✅ Bouton « Supprimer ce document » dans le dashboard client

## Configuration

### 1. Créer le bucket R2

```bash
wrangler r2 bucket create ikcp-docs-private
```

### 2. Configurer les secrets

```bash
cd workers/documents-mcp-server

# Clé Anthropic (vision)
wrangler secret put ANTHROPIC_API_KEY
# → coller sk-ant-...

# Secret partagé pour auth HMAC avec ikcp-client (et future Marcel)
openssl rand -hex 32
# → ex: 7f8a9b...
wrangler secret put MCP_SHARED_SECRET
# → coller la valeur générée

# Reproduire le même secret côté ikcp-client
cd ../ikcp-client
wrangler secret put MCP_SHARED_SECRET
# → coller la même valeur
```

### 3. Déployer

```bash
cd workers/documents-mcp-server
wrangler deploy
# → https://ikcp-documents-mcp-server.maxime-ead.workers.dev/mcp/health

# Puis ikcp-client (déjà configuré pour utiliser le service binding) :
cd ../ikcp-client
wrangler deploy
```

## Smoke tests

```bash
# Health (sans auth)
curl https://ikcp-documents-mcp-server.maxime-ead.workers.dev/mcp/health
# → { status: "ok", tools_count: 3, configured: { r2: true, anthropic: true, ... } }

# List tools (avec auth HMAC) — exécuté depuis un script qui calcule le HMAC :
node -e "
const crypto = require('crypto');
const secret = process.env.MCP_SHARED_SECRET;
const sig = crypto.createHmac('sha256', secret).update('list_tools').digest('hex');
console.log('Header X-IKCP-Signature:', sig);
"

curl -X POST https://ikcp-documents-mcp-server.maxime-ead.workers.dev/mcp/list_tools \
  -H 'Content-Type: application/json' \
  -H 'X-IKCP-Signature: <sig>' \
  -d ''
# → { tools: [...] }
```

## Test end-to-end

Depuis le dashboard client (après login magic-link) :

```bash
# 1. Upload un avis IR scanné (PDF base64)
curl -X POST https://client.ikcp.eu/api/docs/upload \
  -H 'Cookie: ikcp_session=<jwt>' \
  -H 'Content-Type: application/json' \
  -d "{
    \"filename\": \"avis_ir_2024.pdf\",
    \"mime_type\": \"application/pdf\",
    \"base64\": \"$(base64 -w0 /tmp/avis_ir.pdf)\"
  }"

# Réponse attendue :
# {
#   "success": true,
#   "document": {
#     "id": "doc_abc123",
#     "r2_key": "docs/<user>/<sha>.pdf",
#     "sha256": "...",
#     "classification": {
#       "type": "avis_ir",
#       "confidence": 0.95,
#       "summary": "Avis IR 2024 pour foyer 2 parts...",
#       "key_fields": { "annee_revenus": 2024, "revenu_imposable": 95000, ... }
#     }
#   }
# }
```

## Coûts

| Poste | Volume mensuel attendu (50 familles beta) | Coût |
|---|---|---|
| Anthropic Claude vision (~$0.003 / image · ~$0.003 / page PDF) | 200-500 docs/mois | ~$0.60 - $1.50 |
| Cloudflare R2 storage | 50 GB | ~$0.75 |
| Cloudflare R2 lectures (Class A) | 1k ops | ~$0.005 |
| Cloudflare Workers requêtes | 5 k req | $0 (free tier) |
| **Total mensuel marginal** | | **~ 2 - 3 €** |

ROI : économise ~5 h/mois de Maxime (classement manuel des courriers
DGFiP, K-bis, AV, etc.) → **~ 250 €/mois économisés** vs ~3 €/mois de
coût marginal Anthropic.

## Évolutions Phase 2

- [ ] Webhook async vers `suivi-mcp-server` quand `type=avis_cfe` ou `taxe_fonciere`
      (déclenchement automatique du rappel J-8 sur l'échéance détectée)
- [ ] Cache D1 des classifications (rejet anti-doublon par SHA-256)
- [ ] Support des emails `.eml` (parsing + extraction PDFs joints)
- [ ] OCR multi-langues (EN, IT, ES) pour clients internationaux
- [ ] Watermark IKCP sur les documents générés (versions signées)

---

*Premier prototype · IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
