# IKCP Reporting MCP server — 3e sub-agent

Sub-agent qui génère les **livrables réglementaires** et **clients** :
DER, Lettre de Mission, RA, DIPA, bilan patrimonial trimestriel.

**Statut** : prototype Phase 1 — la structure est en place, l'implémentation
finale (templates R2, DocRaptor, signature Yousign) est planifiée Phase 2 P2.

## Tools exposés

| Tool | Description |
|---|---|
| `generate_der(user_id, require_signature?)` | Génère le DER (MIF II art. 24) pré-rempli avec les données client |
| `generate_rapport_adequation(user_id, dossier_id, recommendation)` | Génère le RA (MIF II art. 25 + DDA art. 30) |
| `generate_bilan_trimestriel(user_id, quarter)` | Génère le bilan patrimonial trimestriel (~18 pages) |
| `render_template(template_id, data, output_filename, user_id)` | Tool low-level : HTML → PDF DocRaptor → R2 |

## Architecture

```
Marcel ou Maxime déclenche generate_*()
   │ via service binding + auth HMAC
   ▼
reporting-mcp-server :
  · récupère données depuis D1 (user, dossier, patrimoine, échéances, etc.)
  · récupère template HTML depuis R2 ikcp-templates
  · render Mustache-light → HTML
  · DocRaptor API : HTML → PDF
  · stocke PDF dans R2 ikcp-docs-private avec metadata
  · UPDATE D1 documents SET generated=1
  · option signature : POST file Yousign
   │
   ▼
Retour : { r2_key, sha256, size_bytes, signature_id? }
```

## Templates R2 à créer

| Template | Pages | Contenu |
|---|---|---|
| `templates/der.html` | 4 | DER MIF II : identité IKCP + statuts + tarification + RC Pro + obligations |
| `templates/lettre-mission.html` | 2 | Lettre de mission contractuelle |
| `templates/ra.html` | 8-12 | Rapport d'Adéquation : situation + objectifs + reco + sources |
| `templates/dipa.html` | 6 | DIPA (DDA · contrats AV/IARD) |
| `templates/bilan-trim.html` | 18 | Bilan trimestriel : couverture + 13 sections (cf. liste worker.js) |

Chaque template utilise une syntaxe Mustache simple `{{variable}}` (rendu côté worker).

## Phase 2 P2 — implémentation finale

| # | Action | Effort |
|---|---|---|
| 1 | Rédiger les 5 templates HTML (avec juriste pour DER/RA/DIPA) | 5 j juriste + 3 j tech |
| 2 | Uploader templates dans R2 `ikcp-templates` | 1 h |
| 3 | Compte DocRaptor + clé API (50 PDFs/mois gratuit, 9$/mois 50-200) | 1 h |
| 4 | Activer le code DocRaptor dans `renderTemplate()` (commenté actuellement) | 2 h |
| 5 | Tests end-to-end avec un user de test | 1 j |
| 6 | Compte Yousign + DPA + clé API (POC 30 j gratuit) | 1 sem négo |
| 7 | Activer la signature Yousign pour DER/RA | 2 j |
| 8 | Cron monthly : auto-génération bilan trimestriel pour membres actifs | 1 j |

**Effort total** : 3-4 sem · 14 k€ (dont juriste 5 k€).

## RGPD

| Mesure | Statut |
|---|:---:|
| Stockage R2 chiffré at-rest | ✅ |
| Hash SHA-256 du PDF dans audit | ✅ Phase 2 |
| Conservation 10 ans (NF Z42-013) | 🟡 R2 Object Lock à activer |
| Horodatage Universign eIDAS | 🟡 Phase 2 (livrables > 150 k€ engagement) |
| Signature électronique Yousign AdES | 🟡 Phase 2 (POC 30 j) |
| Suppression cascade si user supprimé | 🟡 ON DELETE CASCADE schema |

## Configuration (Phase 2 prête)

```bash
# R2 buckets (déjà créé pour documents-mcp-server)
wrangler r2 bucket create ikcp-templates  # nouveau

# Uploader les templates HTML
wrangler r2 object put ikcp-templates/templates/der.html --file=./templates/der.html
wrangler r2 object put ikcp-templates/templates/ra.html --file=./templates/ra.html
# ... etc

# Secrets
wrangler secret put MCP_SHARED_SECRET     # même que les autres workers
wrangler secret put DOCRAPTOR_API_KEY     # docraptor.com
wrangler secret put YOUSIGN_API_KEY       # yousign.com (Phase 2)

# Deploy
wrangler deploy
```

## Smoke tests

```bash
curl https://ikcp-reporting-mcp-server.maxime-ead.workers.dev/mcp/health
# → { status: "ok", tools_count: 4, configured: { ... } }

# Avec auth HMAC :
curl -X POST https://ikcp-reporting-mcp-server.maxime-ead.workers.dev/mcp/list_tools \
  -H 'X-IKCP-Signature: <sig>'
```

## Coûts mensuels

| Volume | DocRaptor | R2 | Yousign |
|---|---|---|---|
| 5 familles · ~10 PDFs/mois | gratuit (< 50) | < 1 € | POC gratuit |
| 50 familles · ~150 PDFs/mois | ~9 € | ~3 € | ~75 € (1,50 €/sig) |
| 200 familles · ~600 PDFs/mois | ~30 € | ~10 € | ~300 € |

## ROI

- Bilan trimestriel généré en 30 sec vs 2-3 h en manuel = ~10 h/mois Maxime gagnées
- DER pré-rempli vs 30 min manuel = 5-10 min par nouvelle relation
- RA conforme MIF II = sécurité juridique (réduction risque litige)

---

*Prototype 3e sub-agent · IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
