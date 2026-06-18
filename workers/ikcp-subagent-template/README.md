# IKCP Sub-agent MCP server template

Template Cloudflare Worker pour exposer un sub-agent IKCP via le **protocole
MCP** (Model Context Protocol) en HTTP. Conforme à la convention IKCP
documentée dans [`docs/CLAUDE-AGENT-SDK-INTEGRATION.md`](../../docs/CLAUDE-AGENT-SDK-INTEGRATION.md).

## Usage

### Créer un nouveau sub-agent depuis ce template

```bash
cp -r workers/ikcp-subagent-template workers/<nom>-mcp-server
cd workers/<nom>-mcp-server
# Adapter worker.js : SUBAGENT_NAME, TOOLS, callTool()
# Adapter wrangler.toml : name, bindings selon besoin
```

### Configurer le secret partagé (auth HMAC avec Marcel)

```bash
# Générer un secret 64 chars
openssl rand -hex 32
# → ex : 7f8a9b3c2d1e0f4...

# Le mettre dans le sub-agent ET dans Marcel
wrangler secret put MCP_SHARED_SECRET   # dans workers/<nom>-mcp-server
cd ../ikcp-marcel
wrangler secret put MCP_SHARED_SECRET   # même valeur
```

### Déployer

```bash
cd workers/<nom>-mcp-server
wrangler deploy
# → https://<nom>-mcp-server.maxime-ead.workers.dev/mcp/health
```

### Brancher dans Marcel

Dans `workers/ikcp-marcel/wrangler.toml` :

```toml
[[services]]
binding = "DOCUMENTS_MCP"      # nom de l'env binding
service = "documents-mcp-server"  # nom du Worker cible
```

Puis dans `worker.js` Marcel, appel via :

```js
const sig = await hmac(body, env.MCP_SHARED_SECRET);
const res = await env.DOCUMENTS_MCP.fetch('https://internal/mcp/call_tool', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-IKCP-Signature': sig },
  body,
});
```

## Endpoints exposés par chaque sub-agent

| Méthode | Path | Description |
|---|---|---|
| `GET`  | `/mcp/health` | Status, version, nombre de tools |
| `POST` | `/mcp/list_tools` | Liste des tools (schémas inclus) |
| `POST` | `/mcp/call_tool` | Exécution d'un tool : `{ name, arguments }` |

## Format MCP

### `list_tools` response

```json
{
  "tools": [
    {
      "name": "classify_document",
      "description": "Classifie un document patrimonial uploadé en R2",
      "input_schema": {
        "type": "object",
        "properties": { "r2_key": { "type": "string" } },
        "required": ["r2_key"]
      }
    }
  ]
}
```

### `call_tool` request

```json
{
  "name": "classify_document",
  "arguments": { "r2_key": "docs/cli_001/avis_ir_2024.pdf" }
}
```

### `call_tool` response

```json
{
  "result": {
    "type": "avis_ir",
    "year": 2024,
    "summary": "Avis d'impôt sur le revenu 2024 pour foyer à 2 parts."
  }
}
```

## Sécurité

- **Auth HMAC obligatoire** sur `/mcp/list_tools` et `/mcp/call_tool`
- Header `X-IKCP-Signature` = `HMAC-SHA256(body, MCP_SHARED_SECRET)`
- Constant-time comparison côté serveur (anti-timing)
- Secret rotation **trimestrielle** recommandée
- Aucun tool n'est exécuté s'il n'est pas déclaré dans `TOOLS`
- Whitelist d'origines / IPs côté Cloudflare (via Firewall) en production

## Sub-agents IKCP planifiés (cf. roadmap)

| Sub-agent | Tools clés | Phase |
|---|---|---|
| `documents-mcp-server` | `classify_document`, `extract_structured`, `ocr_pdf` | Phase 2 P1 |
| `suivi-mcp-server` | `next_deadline`, `propose_arbitrage`, `schedule_reminder` | Phase 2 P1 |
| `reporting-mcp-server` | `generate_der`, `render_pdf`, `sign_yousign` | Phase 2 P2 |
| `juridique-mcp-server` | `analyze_pacte`, `lookup_jurisprudence`, `extract_clauses` | Phase 3 |
| `art-mcp-server` | `estimate_artwork`, `find_comparables`, `alert_pre_sale` | Phase 3 |
| `markets-mcp-server` | `quote`, `sentiment`, `peer_comp` | Phase 3 |

## Convention de versioning

- Major : breaking change sur l'API d'un tool (ex : changement schéma)
- Minor : ajout d'un tool ou champ
- Patch : fix bug, optimisation

Marcel doit gérer la rétro-compatibilité au moins 1 minor en arrière.
