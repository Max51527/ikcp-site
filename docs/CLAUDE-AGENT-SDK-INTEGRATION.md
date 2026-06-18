# IKCP — Intégration Claude Agent SDK

> **Objet** : évaluer 3 options d'intégration du Claude Agent SDK dans
> l'architecture IKCP (actuellement Cloudflare Workers + API Anthropic
> directe), recommander l'option pragmatique, planifier la migration en
> phases progressives.
>
> **Statut** : v1 · 09/05/2026
> **Tenue** : Maxime + Claude
> **Documents associés** : `FAMILY-OFFICE-AGENTS-AUDIT.md`,
> `FAMILY-OFFICE-FAISABILITE-AUDIT.md`, `IP-SECURITY-PROTECTION.md`

---

## 0. Pourquoi se poser la question

L'architecture actuelle Marcel utilise l'API Anthropic Messages directement
dans un Worker Cloudflare, avec une boucle `tool_use` manuelle. Cela fonctionne
très bien pour le chat temps réel — latence minimale, coût maîtrisé.

Mais à mesure que le périmètre grandit (Documents-agent OCR, Suivi-agent
cron, Reporting-agent PDF, Juridique-agent RAG, sub-agents par univers…),
on touche les limites de l'API directe :

| Capacité | API directe | Claude Agent SDK |
|---|:---:|:---:|
| Chat simple avec tools | ✅ idéal | ⚠️ overhead inutile |
| Sub-agents avec contexte isolé | ❌ à coder | ✅ natif |
| MCP servers (tools externes) | ❌ à coder | ✅ natif |
| Mémoire long terme + compaction | ❌ à coder | ✅ natif |
| Permissions par agent | ❌ à coder | ✅ natif |
| Workflow multi-étapes | ⚠️ verbeux | ✅ natif |
| Latence chat | ✅ ~200 ms | ⚠️ +10-50 ms overhead |
| Hébergement Cloudflare Workers | ✅ natif | ❌ Node.js requis |

D'où la nécessité d'une **architecture hybride** : garder Marcel sur
l'API directe pour la latence chat, et utiliser le Claude Agent SDK
pour les workflows asynchrones lourds.

---

## 1. État actuel de l'architecture IKCP

```
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND ikcp.eu (Hostinger LiteSpeed)             │
│   Pages publiques · PWA installable · Marcel chat embed         │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS + CORS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                CLOUDFLARE WORKERS (existant)                     │
│                                                                  │
│  ikcp-marcel (chat) ──── API Anthropic directe                  │
│   · 9 tools déterministes (calc_*)                              │
│   · 25 contextes thématiques (THEME_CONTEXTS)                   │
│   · Web search natif Anthropic                                  │
│   · Loop tool_use max 4 iter                                    │
│   · Prompt caching (cache_control: ephemeral)                   │
│   · KV MARCEL_LOGS (90 j)                                       │
│   · Rate limit 30 q/h IP+UA (cette PR)                          │
│                                                                  │
│  ikcp-api (gateway) · ikcp-client (espace) · ikcp-prospect      │
│  D1 · R2 · KV · Cron triggers · Service binding                 │
└──────────────────────────────────────────────────────────────────┘
```

**Tools actuels Marcel** : tous *côté Worker*, JS pur, déterministes (pas
de LLM dans la boucle de calcul). Aucun MCP server. Aucun sub-agent natif.

---

## 2. Trois options évaluées

### Option A — Tout migrer vers Claude Agent SDK

**Description** : Marcel et tous les futurs sub-agents tournent sur un
service Node.js dédié (Vercel / Fly / Railway) avec `@anthropic-ai/claude-agent-sdk`.

**Avantages**
- Sub-agents natifs (Agent tool)
- MCP servers prêts à brancher
- Mémoire persistante automatique
- Compaction contexte (long-running)
- Permissions par agent

**Inconvénients**
- ❌ Sortie de l'écosystème Cloudflare-first (DORA souverain)
- ❌ Latence chat dégradée (+10-50 ms overhead SDK + cold starts éventuels)
- ❌ Coût hébergement supplémentaire (Vercel ~20 €/mois minimum, Fly idem)
- ❌ Migration lourde (700+ lignes de Marcel à refactor)
- ❌ Perte du prompt caching custom optimisé

**Verdict** : ❌ **Non recommandé**. Casse l'architecture existante pour un
gain marginal sur le chat. Réservé à un greenfield ou à un service Node
dédié à un cas d'usage spécifique.

### Option B — API directe + sub-agents manuels sur Workers

**Description** : on garde l'architecture actuelle. Chaque sub-agent
(Documents, Suivi, Reporting…) devient un Worker Cloudflare distinct qui
s'appelle l'API Anthropic directement. Marcel orchestre via service binding
ou fetch.

**Avantages**
- ✅ Reste 100% Cloudflare (latence + souveraineté)
- ✅ Pas de migration
- ✅ Chaque sub-agent peut être déployé indépendamment

**Inconvénients**
- ⚠️ Code orchestration sub-agents écrit à la main (mais ~100 lignes par
  sub-agent — gérable)
- ⚠️ Pas de contexte isolation natif (à implémenter)
- ⚠️ Pas de standard MCP — chaque sub-agent a sa propre interface

**Verdict** : 🟡 **Possible court terme** mais on réinvente les abstractions
que MCP fournit gratuitement. À éviter si la roadmap inclut > 5 sub-agents.

### Option C — Hybride : MCP servers Cloudflare + Marcel orchestrateur (✅ RECOMMANDÉ)

**Description** : on garde Marcel sur l'API directe pour le chat temps
réel. Chaque sub-agent devient un **MCP server hébergé sur Cloudflare
Workers** exposant un endpoint HTTPS conforme au protocole MCP. Marcel
appelle ces MCP servers via des `tool_use` standardisés. À terme, on peut
basculer vers le Claude Agent SDK pour les workflows asynchrones lourds
(Reporting batch, RAG juridique) sans toucher Marcel.

```
Marcel (chat temps réel) ────── API Anthropic directe
   │
   │ tool_use → fetch HTTPS
   ▼
┌──────────────────────────────────────────────────────────────┐
│   MCP SERVERS (Cloudflare Workers — un par sub-agent)        │
│                                                               │
│   documents-mcp-server                                        │
│    · tools : classify_document, extract_structured, ocr_pdf   │
│    · endpoint : https://documents.api.ikcp.eu/mcp             │
│                                                               │
│   suivi-mcp-server (cron Worker)                              │
│    · tools : check_deadlines, propose_arbitrage               │
│                                                               │
│   reporting-mcp-server                                        │
│    · tools : generate_der, render_pdf, sign_yousign           │
│                                                               │
│   juridique-mcp-server  (Phase 3)                             │
│    · tools : analyze_pacte, lookup_jurisprudence              │
│    · backend : Vectorize RAG sur Légifrance                   │
└──────────────────────────────────────────────────────────────┘
```

**Avantages**
- ✅ Reste 100% Cloudflare-first
- ✅ Latence chat préservée (Marcel ne change pas)
- ✅ MCP servers réutilisables (Claude Code, Claude.ai, autres clients)
- ✅ Standard ouvert (MCP protocol)
- ✅ Migration incrémentale (1 sub-agent à la fois)
- ✅ Chaque MCP server testable en isolation
- ✅ **Anthropic supporte officiellement MCP server HTTP** depuis 2024

**Inconvénients**
- ⚠️ Faut écrire le protocole MCP côté serveur (mais boilerplate ~50 lignes)
- ⚠️ Authentification entre Marcel et MCP servers (HMAC + service binding)

**Verdict** : ✅ **Recommandé**. Combine le meilleur des deux mondes.

---

## 3. Architecture cible recommandée

### 3.1 Vue d'ensemble

```
┌───────────────────────────────────────────────────────────────────┐
│                     FRONTEND ikcp.eu                              │
│              (PWA · pages publiques · Marcel chat)                │
└────────────────────────┬──────────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────────┐
│       MARCEL (Cloudflare Worker · API Anthropic directe)          │
│                                                                   │
│       ┌──────────────────────────────────────────────┐           │
│       │ Tools déterministes locaux (déjà en place)   │           │
│       │ · calc_impot_revenu, calc_donation, etc.     │           │
│       └──────────────────────────────────────────────┘           │
│       ┌──────────────────────────────────────────────┐           │
│       │ Tools MCP-distants (à ajouter)              │           │
│       │ · documents.classify_document                │           │
│       │ · suivi.next_deadline                        │           │
│       │ · reporting.generate_bilan                   │           │
│       │ · juridique.analyze_pacte (Phase 3)          │           │
│       └──────────────────────────────────────────────┘           │
│                                                                   │
└──────────────────────────┬────────────────────────────────────────┘
                           │ tool_use → fetch HTTPS
            ┌──────────────┼──────────────┬──────────────┐
            ▼              ▼              ▼              ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ documents-   │ │ suivi-       │ │ reporting-   │ │ juridique-   │
   │ mcp-server   │ │ mcp-server   │ │ mcp-server   │ │ mcp-server   │
   │ (Worker)     │ │ (Worker+Cron)│ │ (Worker+R2)  │ │ (Wrk+Vector) │
   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
   Anthropic vision  D1 events       Templates R2     RAG Légifrance
   R2 docs           Resend          Yousign API      MCP-only
```

### 3.2 Convention MCP server sur Cloudflare Worker

Chaque sub-agent expose 3 endpoints HTTP :

```
POST /mcp/list_tools          → liste des tools disponibles
POST /mcp/call_tool           → exécution d'un tool
GET  /mcp/health              → status + version
```

Format standardisé MCP. Auth via header `X-IKCP-Signature` HMAC-SHA256
(secret partagé Marcel ↔ sub-agent).

### 3.3 Flux concret — exemple Documents-agent

1. Utilisateur upload une photo de courrier RAR DGFiP via le dashboard
2. Frontend POST → `client.ikcp.eu/api/docs/upload` → R2 + insert D1
3. Worker `ikcp-client` notifie Marcel : *« nouveau doc à classifier »*
4. Marcel appelle `documents.classify_document(r2_key="docs/.../xyz.jpg")`
5. `documents-mcp-server` fait l'OCR via Anthropic vision + classifie
6. Retourne `{ type: "avis_cfe_2026", year: 2026, amount: 2380 }`
7. Marcel met à jour D1 + déclenche `suivi.schedule_reminder()` pour J−8

Aucune logique métier dans le frontend. Aucune dépendance Node. 100%
Cloudflare-first.

---

## 4. Plan de migration en 3 phases

### Phase 1 — Bootstrap MCP convention (1-2 semaines)

| # | Action | Effort |
|---|---|---|
| 1.1 | Créer `workers/ikcp-subagent-template/` (template MCP server) | 2 j |
| 1.2 | Implémenter Documents-agent comme premier MCP server | 3-4 sem (détaillé `BETA-IMPROVEMENT-PHASES.md` Phase 2) |
| 1.3 | Ajouter à Marcel un tool générique `call_subagent` qui fetch un MCP server | 1 j |
| 1.4 | Service binding Marcel ↔ documents-mcp-server | 0,5 j |
| 1.5 | Auth HMAC entre Marcel et MCP servers | 1 j |

**Livrable Phase 1** : 1 MCP server fonctionnel + convention documentée.

### Phase 2 — Migration progressive (3-6 mois)

À chaque sub-agent ajouté à la roadmap, on suit le pattern MCP :

| # | Sub-agent | Effort | Phase audit faisabilité |
|---|---|---|:---:|
| 2.1 | suivi-mcp-server (cron rappels échéances) | 2 sem · 6 k€ | Phase 2 P1 |
| 2.2 | reporting-mcp-server (DER/RA/bilan PDF) | 3-4 sem · 14 k€ | Phase 2 P2 |
| 2.3 | sub-agents univers (art-mcp, vins-mcp, montres-mcp) | 2-3 sem chacun · 8-18 k€ | Phase 2-3 |

Chaque sub-agent est :
- Déployable indépendamment
- Testable en isolation
- Versionnable séparément
- Réutilisable par d'autres clients MCP (Claude Code, Claude.ai)

### Phase 3 — Workflows lourds avec Claude Agent SDK natif (12+ mois)

Pour les workflows qui dépassent la simple boucle `tool_use` (Reporting auto
multi-étapes, RAG juridique avec compaction, génération de plan 10 ans) :

**Architecture** : un service Node.js dédié (Fly.io région EU pour DORA)
qui utilise `@anthropic-ai/claude-agent-sdk` natif. Ce service expose lui
aussi un endpoint MCP que Marcel peut appeler.

| # | Action | Effort |
|---|---|---|
| 3.1 | Setup Fly.io région EU (Paris) | 1 j |
| 3.2 | Service Node `ikcp-agent-runtime` avec Claude Agent SDK | 1-2 sem |
| 3.3 | Migration juridique-agent vers SDK natif (RAG + sub-agents internes) | 6-8 sem |
| 3.4 | Évaluation perf + bascule reporting-agent si pertinent | variable |

---

## 5. Exemples de code

### 5.1 MCP server template (Cloudflare Worker)

```js
// workers/ikcp-subagent-template/worker.js
//
// Template minimal pour exposer un sub-agent comme MCP server HTTPS.
// Copier-coller, adapter les tools, déployer.

const TOOLS = [
  {
    name: 'classify_document',
    description: 'Classifie un document patrimonial uploadé en R2',
    input_schema: {
      type: 'object',
      properties: { r2_key: { type: 'string' } },
      required: ['r2_key'],
    },
  },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Auth HMAC (header X-IKCP-Signature)
    const sig = request.headers.get('X-IKCP-Signature');
    if (!await verifyHmac(request, sig, env.MCP_SHARED_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (url.pathname === '/mcp/list_tools') {
      return Response.json({ tools: TOOLS });
    }

    if (url.pathname === '/mcp/call_tool' && request.method === 'POST') {
      const { name, arguments: args } = await request.json();
      const result = await callTool(name, args, env);
      return Response.json({ result });
    }

    if (url.pathname === '/mcp/health') {
      return Response.json({ status: 'ok', tools: TOOLS.length });
    }

    return new Response('Not found', { status: 404 });
  },
};

async function callTool(name, args, env) {
  if (name === 'classify_document') {
    return await classifyDocument(args.r2_key, env);
  }
  return { error: 'unknown_tool' };
}

async function classifyDocument(r2Key, env) {
  // Récupère le doc R2 → OCR via Anthropic vision → classification
  const obj = await env.DOCS_R2.get(r2Key);
  if (!obj) return { error: 'doc_not_found' };
  // ... appel Anthropic vision avec base64 du doc
  // ... parse réponse, retourne { type, year, amount, summary }
  return { type: 'avis_ir', year: 2024, summary: '...' };
}
```

### 5.2 Marcel — tool générique `call_subagent`

```js
// Dans workers/ikcp-marcel/worker.js — ajout au TOOLS_FISCAL
{
  name: 'call_subagent',
  description: "Délègue à un sub-agent spécialisé via MCP. Sub-agents disponibles : documents (OCR + classification), suivi (échéances), reporting (PDF), juridique (analyse actes).",
  input_schema: {
    type: 'object',
    properties: {
      subagent: { type: 'string', enum: ['documents', 'suivi', 'reporting', 'juridique'] },
      tool: { type: 'string' },
      arguments: { type: 'object' },
    },
    required: ['subagent', 'tool'],
  },
},

// Implémentation :
async function callSubagent(subagent, tool, args, env) {
  const url = SUBAGENT_URLS[subagent] + '/mcp/call_tool';
  const sig = await hmac(JSON.stringify({ name: tool, arguments: args }), env.MCP_SHARED_SECRET);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-IKCP-Signature': sig },
    body: JSON.stringify({ name: tool, arguments: args }),
  });
  if (!res.ok) return { error: 'subagent_failed', status: res.status };
  const json = await res.json();
  return json.result;
}
```

### 5.3 Déploiement parallèle

```bash
# Chaque sub-agent dans son propre repo / dossier
cd workers/documents-mcp-server
wrangler deploy
# → https://documents-mcp-server.maxime-ead.workers.dev
# Custom domain : documents.api.ikcp.eu

# Service binding dans Marcel pour latence 0
# wrangler.toml ikcp-marcel :
# [[services]]
# binding = "DOCUMENTS_MCP"
# service = "documents-mcp-server"
```

---

## 6. Coûts et bénéfices

### 6.1 Coût additionnel par sub-agent MCP

| Poste | Phase 1 | Phase 2 (3 sub-agents) | Phase 3 (8 sub-agents) |
|---|---|---|---|
| Cloudflare Workers (req) | 0 € | 0 € | ~5 €/mois |
| Anthropic API (vision OCR si applicable) | ~30 €/mois | ~150 €/mois | ~500 €/mois |
| Vectorize (Phase 3 RAG) | 0 € | 0 € | ~50 €/mois |
| Service Node Fly.io (Phase 3) | 0 € | 0 € | ~25 €/mois |
| **Total mensuel marginal** | **~30 €** | **~150 €** | **~580 €** |

À mettre en regard du gain :
- Documents-agent économise ~5 h/mois de Maxime (~250 €)
- Suivi-agent évite 1 erreur d'échéance/an (~5 000 € de pénalité fiscale)
- Reporting-agent économise ~10 h/mois (~500 €)

**ROI** : positif dès le 1er sub-agent.

### 6.2 Bénéfices techniques

- **Modularité** : chaque sub-agent est testable et déployable indépendamment
- **Réutilisation** : les MCP servers sont consommables par Claude Code, Claude.ai, ou tout autre client compatible MCP
- **Évolutivité** : ajouter un sub-agent ne dégrade pas Marcel
- **Standardisation** : protocole MCP open-source, large adoption Anthropic + écosystème
- **Observabilité** : chaque MCP server a son propre log, monitoring, rate limit

### 6.3 Bénéfices stratégiques

- **Alignement avec l'écosystème Anthropic** : MCP est le standard que Claude Code, Claude.ai et l'écosystème adoptent. IKCP devient interopérable.
- **Open-sourçabilité partielle** : un MCP server `documents-classifier-fr` pourrait être open-sourcé en marketing technique (sans toucher au cœur Marcel propriétaire).
- **Embauche / sous-traitance** : développeurs externes peuvent contribuer à un MCP server sans toucher au cœur — réduction du risque de fuite de propriété intellectuelle.

---

## 7. Risques et mitigations

| Risque | Probabilité | Mitigation |
|---|:---:|---|
| Latence cumulée Marcel + sub-agent | Moyenne | Service binding intra-Cloudflare = ~0 ms |
| Spec MCP qui change | Faible | Anthropic + spec stable depuis 2024 |
| Sub-agent down | Moyenne | Fallback Marcel répond sans le sub-agent + alerte |
| Auth HMAC compromise | Faible | Rotation trimestrielle des secrets partagés |
| Coût Anthropic OCR explose | Moyenne | Cap budgétaire mensuel + alerting |

---

## 8. Synthèse — décision recommandée

| Choix | Verdict |
|---|---|
| Tout migrer Claude Agent SDK Node | ❌ overkill, casse Cloudflare-first |
| Sub-agents manuels sans MCP | 🟡 court terme OK, ne scale pas > 5 |
| **MCP servers Cloudflare + Marcel inchangé** | ✅ **GO** |

**Plan d'action immédiat** :
1. Cette PR : template `workers/ikcp-subagent-template/` + doc convention MCP
2. Phase 2 beta (S+5) : Documents-agent comme premier MCP server (validation pattern)
3. Phase 2 beta (S+8) : Suivi-agent + Reporting-agent (3 MCP servers en prod)
4. Phase 3 (post-beta, S+24) : évaluation Claude Agent SDK Node sur Fly.io pour workflows lourds

**Investissement total à 6 mois** : ~36 k€ + 9 sem dev cumulés (Documents +
Suivi + Reporting). Couvert par le revenu attendu Phase 2-3 beta (cf.
audit faisabilité §7.3 — break-even 8-10 familles Augmenté).

---

## 9. Liens utiles

- [Claude Agent SDK — sub-agents](https://code.claude.com/docs/en/agent-sdk/subagents)
- [Claude Agent SDK — MCP](https://code.claude.com/docs/en/agent-sdk/mcp)
- [MCP protocol spec](https://modelcontextprotocol.io)
- [Cloudflare Workers + Claude Code](https://developers.cloudflare.com/agent-setup/claude-code/)
- [Cloudflare Agents](https://developers.cloudflare.com/agents/)

---

*Document opérationnel — révision trimestrielle.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
