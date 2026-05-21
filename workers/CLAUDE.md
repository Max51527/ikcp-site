# CLAUDE.md — Workers IKCP (Marcel + sub-agents IA)

> Architecture des **agents IA souverains** d'IKCP Family Office.
> Hérite de `~/.claude/CLAUDE.md` + `ikcp-site/CLAUDE.md`.
> État opérationnel : voir `../docs/INFRA-PRODUCTION.md`.

---

## 🎼 Architecture — Marcel chef d'orchestre + sub-agents spécialisés

```
                  ┌────────────────────┐
                  │  Front IKCP        │
                  │  marcel-funnel     │
                  │  family-office     │
                  └──────────┬─────────┘
                             │ POST question
                             ▼
                  ┌────────────────────┐
                  │   🎼 MARCEL         │
                  │ ikcp-chat          │  ← chef d'orchestre
                  │ Sonnet 4.6         │     point d'entrée UNIQUE
                  └─────────┬──────────┘
                            │
   ┌────────────────────────┼────────────────────────┐
   │                        │                        │
   ▼                        ▼                        ▼
┌──────────┐         ┌──────────┐            ┌──────────┐
│ TOOLS    │         │ SUB-     │            │ SERVICES │
│ FISCAUX  │         │ AGENTS   │            │ EXTERNES │
│ LOCAUX   │         │ EXPERTS  │            │          │
├──────────┤         ├──────────┤            ├──────────┤
│ calc_ir  │         │ Codex    │            │ Pappers  │
│ calc_dut │         │ (Opus    │            │ Témoin   │
│ calc_don │         │  4.7)    │            │ Universign│
│ calc_ifi │         │ Bâtisseur│            │ DVF      │
│ calc_succ│         │ Architect│            │ ...      │
└──────────┘         └──────────┘            └──────────┘
   intégrés          workers séparés         workers/APIs
   à Marcel          (Opus si besoin)        publics
```

**Principe Option A** (validée dans `docs/AGENTS-STRATEGY.md`) :
- **Marcel = unique point d'entrée** côté client
- **Marcel = unique cerveau** la plupart du temps (Sonnet 4.6)
- **Marcel délègue** UNIQUEMENT quand la question dépasse ses tools (Codex sur fiscalité pointue, Bâtisseur sur cartographie multi-entités, etc.)
- **Pas de bavardage entre sub-agents** (anti-Option B) : on évite la complexité inutile

## 📦 Workers déployés

> Dernière MÀJ : **21 mai 2026** · Sprint 2 en cours.

### ✅ Sprint 1 — Production (validés)

| Worker | Rôle | Modèle | URL | Statut |
|---|---|---|---|---|
| **ikcp-pappers** | Cartographie SIREN (RNE) | — | `ikcp-pappers.maxime-ead.workers.dev` | 🟢 LIVE |
| **ikcp-chat** | Marcel chef d'orchestre | Sonnet 4.6 | `ikcp-chat.maxime-ead.workers.dev` | 🟢 LIVE |
| **ikcp-codex** | Sub-agent fiscal expert | Opus 4.7 | `ikcp-codex.maxime-ead.workers.dev` | 🟢 LIVE |
| **ikcp-temoin** | Audit log MIF II D1 Paris | — | `ikcp-temoin.maxime-ead.workers.dev` | 🟢 LIVE |
| **ikcp-universign** | Signature eIDAS | — | (code présent, Universign pausé) | ⏸ PAUSE |
| **ikcp-client** | Magic link auth + Stripe | — | `ikcp-client.maxime-ead.workers.dev` | 🟡 À auditer |
| **ikcp-prospect** | Capture prospects | — | `ikcp-prospect.maxime-ead.workers.dev` | 🟡 À auditer |

### ⏳ Sprint 2 — Codés, en attente secrets + deploy

| Worker | Rôle | Modèle | Secret requis | Statut |
|---|---|---|---|---|
| **ikcp-batisseur** | Patrimoine 360° multi-entités | Opus 4.7 | `ANTHROPICAPIKEY` | ⏳ Déployer + secret |
| **ikcp-hermes** | Transmission patrimoniale | Opus 4.7 | `ANTHROPICAPIKEY` | ⏳ Déployer + secret |
| **ikcp-lifestyle** | 12 agents mutualisés (Architecte, Stratège…) | Sonnet 4.6 | `ANTHROPICAPIKEY` | ⏳ Déployer + secret |
| **ikcp-veille** | Veille Perplexity Pro | — | `PERPLEXITY_API_KEY` + `CLIENT_AUTH_PUBKEY` | ⏳ Déployer + secrets |

**Action Maxime** : GitHub Actions → "Deploy Cloudflare Workers" → `workflow_dispatch` → target `all`  
Puis `wrangler secret put ANTHROPICAPIKEY` dans chaque répertoire worker.

### 🔴 Sprint 3+ — À coder

| Worker prévu | Rôle | Sprint |
|---|---|---|
| **ikcp-feedback** | Feedback bêta + D1 | 3 |
| **ikcp-feedback** | Feedback bêta + D1 | 3 |
| **ikcp-collector** | Cotations collectionneur | 3 |
| **ikcp-voice** | TTS/STT ElevenLabs | 3 |

## 🔑 Convention secrets (NON NÉGOCIABLE)

### Workflow standard pour ajouter une clé API

```bash
cd workers/<worker-name>
npx wrangler secret put <SECRET_NAME>
# wrangler te demande la valeur → coller → Entrée
# La clé part chiffrée chez Cloudflare. JAMAIS sur ton disque.
```

### Conventions de nommage des secrets

- `ANTHROPICAPIKEY` — clé API Anthropic (Marcel, Codex, futurs sub-agents)
- `PAPPERS_API_KEY` — clé Pappers (worker pappers)
- `IKCP_ADMIN_TOKEN` — token admin Maxime (Témoin, futurs admin endpoints)
- `STRIPE_SECRET_KEY` — clé Stripe live (futur ikcp-stripe)
- `STRIPE_WEBHOOK_SECRET` — webhook Stripe signing
- `BREVO_API_KEY` — emails transactionnels (futur ikcp-mail)
- `UNIVERSIGN_API_KEY` + `UNIVERSIGN_PROFILE_ID` — signature eIDAS

### Vérifier les secrets sur un worker

```bash
cd workers/<worker-name>
npx wrangler secret list
```

### Si un secret fuit (chat, git, email)

1. **Révoquer immédiatement** sur le dashboard du provider (Anthropic, Pappers, etc.)
2. **Regénérer** une nouvelle clé
3. **Re-uploader** : `npx wrangler secret put <SECRET>` avec la nouvelle valeur
4. **PAS BESOIN de redéployer** le worker (les secrets sont disponibles immédiatement)

## 🛠 Convention code workers

### Template d'un nouveau sub-agent

```javascript
const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev', // Marcel peut appeler
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'null', '',
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || (origin?.endsWith('.ikcp.eu')) || (origin?.endsWith('.workers.dev'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const SYSTEM_PROMPT = `Tu es <NOM>, sub-agent <DOMAINE> d'IKCP IKIGAÏ Conseil Patrimonial.
Marcel te délègue les questions sur <DOMAINE>.

# CADRE STRICT
- MIF II : termine toujours par une question, jamais une recommandation produit
- Disclaimer obligatoire : "Cette analyse ne constitue pas un conseil personnalisé (art. L.541-1 CoMoFi)"
- Cite tes sources : article CGI, BOFIP, jurisprudence

# STYLE
- Markdown structuré, tableaux, précis chiffré
- Pédagogique mais expert (dirigeant cultivé)

# CONTEXTE FRANÇAIS 2026
[barèmes, dispositifs, jurisprudence pertinente du domaine]
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });

    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'ikcp-<nom>',
        agent: '<NOM>',
        model: 'claude-<modele>',
        configured: { api_key: !!env.ANTHROPICAPIKEY },
      }, { headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: corsHeaders(origin) });
    if (!env.ANTHROPICAPIKEY) return Response.json({ error: 'api_key_missing' }, { status: 500, headers: corsHeaders(origin) });

    const { question, context } = await request.json();
    const userContent = context ? `CONTEXTE FOURNI PAR MARCEL :\n${context}\n\nQUESTION CLIENT :\n${question}` : question;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPICAPIKEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-<modele>', // sonnet-4-6 / opus-4-7 / haiku-4-5
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!r.ok) return Response.json({ error: 'anthropic_upstream', status: r.status }, { status: 502, headers: corsHeaders(origin) });
    const data = await r.json();
    return Response.json({
      reply: data.content?.[0]?.text || '',
      agent: '<NOM>',
      model: data.model,
      usage: data.usage,
      delegated_by: context ? 'Marcel' : 'direct',
    }, { headers: corsHeaders(origin) });
  },
};
```

### Choix du modèle Claude par sub-agent

| Modèle | Quand l'utiliser | Coût (par M tokens) |
|---|---|---|
| **Haiku 4.5** | Tâches simples, rapides, volumineuses (audit log, lookups, formatage) | 0,80 $ in / 4 $ out |
| **Sonnet 4.6** | Marcel + sub-agents standard (Concierge, Stratège, Architecte) | 3 $ in / 15 $ out |
| **Opus 4.7** | Expertise complexe (Codex fiscal, Bâtisseur multi-entités, Hermès) | 15 $ in / 75 $ out |

**Règle d'or coût** : ne pas mettre Opus 4.7 partout — réserver aux questions qui le justifient. Sinon coût × 5.

## 🤖 Logique de délégation Marcel → sub-agents

Marcel décide de déléguer quand :
- La question demande **citation jurisprudence précise** (Cass. com., CE)
- La question implique **arbitrage multi-dispositifs** (apport-cession + Dutreil + démembrement)
- La question nécessite **détection de pièges** réglementaires fins
- La question demande **comparaison chiffrée** sur > 3 schémas

Marcel **ne délègue PAS** quand :
- Calcul simple couvert par ses tools locaux (IR, IFI, donation simple)
- Question définitionnelle ("c'est quoi le PER ?")
- Question de routing ("où faut-il que je clique ?")

### Pattern d'appel (à intégrer dans Marcel)

```javascript
// Dans Marcel — tool consult_codex (à brancher Sprint 1.5)
{
  name: 'consult_codex',
  description: 'Délègue à Codex pour analyse fiscale complexe (multi-articles CGI, jurisprudence, arbitrages chiffrés)',
  input_schema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Question fiscale précise pour Codex' },
      context: { type: 'string', description: 'Contexte client (Pappers, situation perso)' },
    },
    required: ['question'],
  },
}

// Quand Claude (Marcel) appelle ce tool, le worker fetch :
const codexResponse = await fetch('https://ikcp-codex.maxime-ead.workers.dev/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://ikcp-chat.maxime-ead.workers.dev' },
  body: JSON.stringify({ question, context }),
});
```

## 📊 Coûts mesurés (au 14 mai 2026)

| Worker | Coût test | Tokens consommés |
|---|---|---|
| Marcel (Sonnet 4.6) | ~0,03 € / question | 800 in + 1500 out |
| Codex (Opus 4.7) | ~0,15 € / question complexe | 1600 in + 2000 out |
| Pappers (Cloudflare KV) | 0 € | — (cache 1h) |
| Témoin (D1 Paris) | 0 € | — (free tier) |

**Crédit Anthropic restant** : ~24 € (sur 25 € initial · estimation après tests).

## 🆘 Si tu démarres une session sur les workers

1. Lis ce fichier
2. Lis `../docs/INFRA-PRODUCTION.md` pour les URLs et IDs Cloudflare
3. Lis `../docs/AGENTS-STRATEGY.md` pour la stratégie globale
4. Vérifie l'authentification : `npx wrangler whoami` (doit afficher `maxime@ikcp.fr`)
5. Liste les workers existants : `npx wrangler deployments list` ou consulter dashboard

## ⚡ Commandes wrangler de référence

```bash
# Auth
npx wrangler login
npx wrangler whoami

# Déploiement
cd workers/<nom>
npx wrangler deploy

# Secrets
npx wrangler secret put <SECRET_NAME>     # créer/modifier
npx wrangler secret list                  # lister (sans valeurs)
npx wrangler secret delete <SECRET_NAME>  # supprimer

# D1
npx wrangler d1 list
npx wrangler d1 create <name> --location weur
npx wrangler d1 execute <name> --remote --file=schema.sql
npx wrangler d1 execute <name> --remote --command "SELECT * FROM table LIMIT 10"

# KV
npx wrangler kv namespace list
npx wrangler kv namespace create <NAME>
npx wrangler kv key list --namespace-id=<id>

# Logs en temps réel
npx wrangler tail <worker-name>
```

---

© 2026 IKCP · Architecture agents IA souverains
