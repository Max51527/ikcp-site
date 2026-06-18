# Managed Agents — Intégration IKCP Family Office

> Plan d'intégration des **Anthropic Managed Agents** dans l'architecture
> Marcel · IKCP Family Office Digital v1 · 2026-06.
>
> Auteur : Maxime Juveneton · ORIAS 23001568 · IKIGAÏ Conseil Patrimonial
> Modèle cible : `claude-opus-4-8` (agents) · `claude-sonnet-4-6` (chat Marcel)

---

## 1. Diagnostic stratégique — pas de migration totale

### 1.1 Ce que sont (vraiment) les Managed Agents

Les **Anthropic Managed Agents** ne sont pas un remplacement drop-in
de l'API Messages + tool use. C'est une **3ᵉ surface** :

| Surface                       | Quand l'utiliser                                          |
|-------------------------------|-----------------------------------------------------------|
| `messages.create` + tools     | Chat sync, classification, Q&A — **Marcel actuel**        |
| `messages.create` + agent SDK | Workflow code-orchestré (boucle agentique côté client)    |
| **`/v1/agents` + `/v1/sessions`** | **Tâche stateful, longue durée, dans un container** (rapport, OCR pipeline, planning multi-étapes) |

Anthropic gère :
- la boucle agentique (model → tool → result → model)
- le container sandboxé (bash + read/write/edit + glob/grep + web_search/fetch)
- la mémoire de session (compaction auto, prompt caching, extended thinking)
- l'orchestration MCP (auth via vault, refresh OAuth)
- le streaming SSE des events + webhooks

### 1.2 Ce qu'il ne faut PAS migrer

**Marcel chat (`workers/ikcp-marcel/worker.js`) doit rester sur l'API
Messages directe**. Raisons :

1. **Latence** : chat conversationnel = TTFT < 1s. Une session managed
   agent provisionne un container (overhead ~500ms-2s même pour une
   réponse simple).
2. **Coût** : container par session vs appel API stateless. Un chat à
   30 messages = 30 containers ≠ 1 container long-lived.
3. **Souveraineté EU** : Marcel.eu = Cloudflare Workers EU isolés.
   Managed Agents tourne sur l'infra Anthropic (US par défaut). Pour
   du PII patrimonial brut (avis IR, RIB, statuts), c'est un downgrade
   compliance vs notre engagement clients.
4. **Determinisme fiscal** : nos 9 tools JS (calc_impot_revenu,
   calc_droits_succession, etc.) s'exécutent en `workerd` à <5ms.
   Les déporter en tool MCP = +HTTP roundtrip + perte de la
   garantie "pas de hallucination LLM sur les calculs".

### 1.3 Ce qu'il FAUT migrer — 3 use cases parfaits

Les Managed Agents sont la bonne réponse pour les **tâches asynchrones
longues à livrable structuré** :

| Use case                                    | Outcome                                          | Skills | Container utile pour                                                |
|---------------------------------------------|--------------------------------------------------|--------|---------------------------------------------------------------------|
| **DER trimestriel famille** (rapport PDF)   | `.docx` ou `.pdf` 8-12 pages + cover            | `docx`, `pdf`, `xlsx` | Génération template, charts matplotlib, validation rubric          |
| **OCR + extraction structurée d'un dossier** (avis IR / acte donation / Kbis) | JSON normalisé + flag confiance | `pdf`     | OCR pdfplumber, extraction Claude vision, sortie JSON validée par rubric |
| **Planning trimestriel + arbitrages**       | Memo .md + .ics calendrier + alertes            | `pdf`, `docx` | Itération multi-tools, croisement échéances/drift/jurisprudence    |

Ces 3 use cases :
- tournent en **batch async** (l'utilisateur attend pas en live ; on
  notifie par email magic-link quand c'est prêt)
- ont un **livrable structuré** que la rubric grader peut évaluer
- bénéficient de la **mémoire de session** pour itérer (3-5 cycles
  rubric → revision)
- justifient le **container** (lib Python, génération .docx/.xlsx)

---

## 2. Architecture cible — hybride

```
                          ┌────────────────────────────────────────┐
                          │  utilisateur (ikcp.eu / dashboard)     │
                          └───────────┬────────────────────────────┘
                                      │
                ┌─────────────────────┼────────────────────────────┐
                │                                                  │
                ▼                                                  ▼
   ┌──────────────────────┐                       ┌─────────────────────────────┐
   │  ikcp-marcel         │  CHAT SYNC (<2s)      │  ikcp-agents (NEW)         │
   │  Cloudflare Worker   │                       │  Cloudflare Worker          │
   │                      │                       │                             │
   │  • messages.create   │                       │  • sessions.create()        │
   │  • 9 tools JS local  │                       │  • events.send()            │
   │  • 25 contextes      │                       │  • webhook handler          │
   │  • prompt caching    │                       │  • custom tool dispatcher   │
   │  • web search natif  │                       │                             │
   └──────────┬───────────┘                       └────────────┬────────────────┘
              │                                                │
              │ direct API                                     │ + webhook
              ▼                                                ▼
   ┌──────────────────────┐                       ┌──────────────────────────────┐
   │  Anthropic Messages  │                       │  Anthropic Managed Agents    │
   │  API (EU routing OK) │                       │  + 3 agents persistants :    │
   │                      │                       │   • marcel-reporting         │
   └──────────────────────┘                       │   • marcel-documents         │
                                                  │   • marcel-suivi             │
                                                  └────────────┬─────────────────┘
                                                               │ custom tool calls
                                                               │ (agent.custom_tool_use)
                                                               ▼
                                ┌──────────────────────────────────────────────────┐
                                │  MCP sub-agents existants (HMAC HTTP, inchangés) │
                                │  • documents-mcp-server (OCR, classify, extract) │
                                │  • suivi-mcp-server     (deadlines, drift, …)    │
                                │  • reporting-mcp-server (DER, rapport adéquation)│
                                └──────────────────────────────────────────────────┘
```

### Pourquoi cette architecture

- **Marcel chat reste sync** : pas de régression UX.
- **Nouveau worker `ikcp-agents`** dédié aux tâches async. Une seule
  responsabilité : créer des sessions, écouter les webhooks, dispatcher
  les custom tool calls vers nos MCP sub-agents existants.
- **Les MCP sub-agents ne sont PAS réécrits en protocole MCP officiel**.
  On les expose comme **custom tools** côté agent Managed
  ([Pattern 9 du skill](claude-api)) : quand l'agent invoque
  `documents.classify`, le worker `ikcp-agents` reçoit l'event
  `agent.custom_tool_use`, appelle le sub-agent en HMAC, poste
  `user.custom_tool_result`. **Aucune credential ne traverse le
  container Anthropic**.

### Bénéfice compliance

1. **PII brut reste dans nos workers EU + R2 EU**. Le container
   Anthropic ne voit que :
   - les inputs strictement nécessaires (path de file_id côté Files API)
   - les **outputs filtrés par nos sub-agents** (JSON normalisé,
     pas le PDF brut)
2. **Logs d'audit** : chaque session = `agent_session_id` + webhook
   `session.status_idle` capturé en D1 avec horodatage et usage tokens.
3. **AI Act** : agents persistants versionnés = on peut épingler une
   `version` pour reproductibilité (exigence article 13 transparence).

---

## 3. Caveats compliance — à régler avant prod

| Risque                                          | Mitigation                                                                       |
|-------------------------------------------------|----------------------------------------------------------------------------------|
| **Anthropic Managed Agents = US infra**         | Limiter aux tâches batch async. Filtrer le PII dans workers EU avant l'envoi.   |
| **Container Anthropic voit le `system` prompt** | Pas de secret dans le system prompt. Credentials = vault Anthropic OAuth-managed |
| **DPA Anthropic Enterprise requis**             | Cocher Zero Data Retention. Signer avant J0 beta.                                |
| **Sub-processor Anthropic à déclarer RGPD**     | Ajouter au registre des traitements ART. 30. Mention obligatoire CGU.            |
| **Webhook public**                              | HMAC signature (la SDK le fait), endpoint behind Cloudflare access ou IP allow.  |

---

## 4. Stack de déploiement

### 4.1 Définition des agents (YAML versioned)

3 fichiers YAML check-in dans le repo, déployés via `ant` CLI :

- `agents/marcel-environment.yaml` — environnement cloud EU-friendly
- `agents/marcel-reporting.agent.yaml` — génération DER
- `agents/marcel-documents.agent.yaml` — OCR + extraction
- `agents/marcel-suivi.agent.yaml` — planning trimestriel

Voir fichiers committés dans `agents/`.

### 4.2 Nouveau worker — `workers/ikcp-agents/worker.js`

Voir fichier committé. Endpoints :

| Méthode | Path                            | Rôle                                                |
|---------|---------------------------------|-----------------------------------------------------|
| POST    | `/api/agents/task`              | Démarre une session pour un user/agent donné        |
| GET     | `/api/agents/task/:id`          | Statut d'une session                                |
| POST    | `/webhooks/anthropic`           | Réceptionne events (HMAC-signed)                    |
| GET     | `/api/agents/task/:id/outputs`  | Liste les fichiers produits par l'agent             |
| GET     | `/api/agents/task/:id/file/:fid`| Download un fichier output                          |

### 4.3 Migration D1

`migrations/006_agent_sessions.sql` — 1 nouvelle table :

```sql
CREATE TABLE agent_sessions (
  id              TEXT PRIMARY KEY,           -- sesn_xxx
  user_id         TEXT NOT NULL,
  agent_kind      TEXT NOT NULL,              -- reporting | documents | suivi
  agent_id        TEXT NOT NULL,              -- agent_xxx
  agent_version   INTEGER NOT NULL,
  status          TEXT NOT NULL,              -- running | idle | terminated
  stop_reason     TEXT,
  outcome_result  TEXT,                       -- satisfied | needs_revision | …
  created_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  cache_read      INTEGER DEFAULT 0,
  metadata_json   TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_agent_sessions_user ON agent_sessions(user_id, created_at DESC);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status) WHERE status != 'terminated';
```

### 4.4 Secrets à provisionner

```sh
# Pour le nouveau worker ikcp-agents
wrangler secret put ANTHROPICAPIKEY --name ikcp-agents
wrangler secret put ANTHROPIC_WEBHOOK_SIGNING_KEY --name ikcp-agents   # whsec_… depuis Console
wrangler secret put HMAC_SECRET --name ikcp-agents                     # partagé avec les sub-agents
```

### 4.5 Setup initial — création des agents (ONE-TIME)

```sh
# 1) Login Anthropic CLI (OAuth, profil local)
ant auth login

# 2) Créer l'environnement (une fois pour les 3 agents)
ENV_ID=$(ant beta:environments create < agents/marcel-environment.yaml \
  --transform id -r)
echo "ENV_ID=$ENV_ID"

# 3) Créer les 3 agents et capturer les IDs
REPORTING_ID=$(ant beta:agents create < agents/marcel-reporting.agent.yaml \
  --transform id -r)
DOCUMENTS_ID=$(ant beta:agents create < agents/marcel-documents.agent.yaml \
  --transform id -r)
SUIVI_ID=$(ant beta:agents create < agents/marcel-suivi.agent.yaml \
  --transform id -r)

# 4) Injecter les IDs comme env vars dans wrangler
wrangler secret put MARCEL_ENV_ID --name ikcp-agents <<< "$ENV_ID"
wrangler secret put MARCEL_REPORTING_AGENT_ID --name ikcp-agents <<< "$REPORTING_ID"
wrangler secret put MARCEL_DOCUMENTS_AGENT_ID --name ikcp-agents <<< "$DOCUMENTS_ID"
wrangler secret put MARCEL_SUIVI_AGENT_ID --name ikcp-agents <<< "$SUIVI_ID"

# 5) Updates en CI (quand un .yaml change)
ant beta:agents update --agent-id "$REPORTING_ID" --version <N> \
  < agents/marcel-reporting.agent.yaml
```

### 4.6 Webhook public

1. Console Anthropic → Manage → Webhooks → "Add endpoint"
2. URL : `https://agents.ikcp.eu/webhooks/anthropic`
3. Subscribe : `session.status_idled`, `session.status_terminated`,
   `session.outcome_evaluation_ended`, `vault_credential.refresh_failed`
4. Copier le `whsec_…` → `wrangler secret put ANTHROPIC_WEBHOOK_SIGNING_KEY`

---

## 5. Migration de Marcel chat — petite re-tune (pas urgent)

Pendant qu'on y est, le chat Marcel actuel a 2 dettes techniques :

### 5.1 Modèle déprécié

```diff
- model: 'claude-sonnet-4-20250514'   // retire 2026-06-15
+ model: 'claude-sonnet-4-6'
```

À faire dans `workers/ikcp-marcel/worker.js` lignes 1131 et 1255.

### 5.2 `budget_tokens` à supprimer (si présent)

Si Marcel utilise extended thinking avec `budget_tokens: N`, switcher vers :

```diff
- thinking: { type: 'enabled', budget_tokens: 8000 }
+ thinking: { type: 'adaptive' }
+ output_config: { effort: 'medium' }
```

### 5.3 Prompt caching breakpoint

Déjà fait probablement, mais vérifier que le `cache_control: {type: 'ephemeral'}`
est posé sur le **dernier bloc system** (avant les 25 contextes thématiques),
pas avant — sinon les contextes invalident le cache à chaque appel.

---

## 6. Code complet — worker orchestrateur

Voir `workers/ikcp-agents/worker.js`. Architecture :

```js
// Endpoint POST /api/agents/task
// Body: { user_id, kind: "reporting"|"documents"|"suivi", task, rubric?, files? }
async function startTask(req, env) {
  const { user_id, kind, task, rubric, file_ids = [] } = await req.json();

  const agentId = AGENT_IDS[kind];          // depuis env
  const envId   = env.MARCEL_ENV_ID;

  // 1) Créer la session — référence l'agent persistant (PAS de model/system/tools ici)
  const session = await anthropicFetch(env, 'POST', '/v1/sessions', {
    agent: agentId,
    environment_id: envId,
    title: `${kind} · user:${user_id}`,
    resources: file_ids.map(fid => ({
      type: 'file', file_id: fid,
      mount_path: `/workspace/inputs/${fid}.bin`,
    })),
    metadata: { user_id, kind, source: 'ikcp-agents-worker' },
  });

  // 2) Persister en D1
  await env.DB.prepare(`
    INSERT INTO agent_sessions
      (id, user_id, agent_kind, agent_id, agent_version, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'running', ?)
  `).bind(session.id, user_id, kind, agentId, 0, Date.now()).run();

  // 3) Envoyer le kickoff — outcome si rubric, message sinon
  const event = rubric
    ? { type: 'user.define_outcome', description: task, rubric: { type: 'text', content: rubric } }
    : { type: 'user.message', content: [{ type: 'text', text: task }] };

  await anthropicFetch(env, 'POST', `/v1/sessions/${session.id}/events`,
    { events: [event] });

  return Response.json({ session_id: session.id, status: 'running' });
}

// Endpoint POST /webhooks/anthropic
async function handleWebhook(req, env) {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify HMAC signature avec ANTHROPIC_WEBHOOK_SIGNING_KEY
  // (utiliser client.beta.webhooks.unwrap depuis le SDK ou impl manuelle)
  const event = await verifyWebhook(body, headers, env.ANTHROPIC_WEBHOOK_SIGNING_KEY);
  if (!event) return new Response('invalid signature', { status: 400 });

  switch (event.data.type) {
    case 'session.status_idled': {
      // Fetch outputs + notifier user
      const session = await anthropicFetch(env, 'GET', `/v1/sessions/${event.data.id}`);
      await env.DB.prepare(`
        UPDATE agent_sessions
        SET status='idle', ended_at=?, input_tokens=?, output_tokens=?, cache_read=?
        WHERE id=?
      `).bind(
        Date.now(),
        session.usage?.input_tokens ?? 0,
        session.usage?.output_tokens ?? 0,
        session.usage?.cache_read_input_tokens ?? 0,
        event.data.id,
      ).run();

      // TODO: envoyer email magic-link "votre rapport est prêt"
      return new Response('', { status: 204 });
    }
    case 'session.status_terminated': {
      await env.DB.prepare(
        `UPDATE agent_sessions SET status='terminated', ended_at=? WHERE id=?`
      ).bind(Date.now(), event.data.id).run();
      return new Response('', { status: 204 });
    }
    default:
      return new Response('', { status: 204 });
  }
}
```

### Custom tool dispatcher — Pattern 9 (HMAC vers sub-agents)

Pour éviter l'overhead webhook sur chaque tool call, on lit le **stream
SSE** depuis le worker (Workers supportent les streams) :

```js
// Background task : drain le stream et dispatch les custom_tool_use
async function drainSessionStream(sessionId, env) {
  const resp = await fetch(
    `https://api.anthropic.com/v1/sessions/${sessionId}/events/stream`,
    {
      headers: {
        'x-api-key': env.ANTHROPICAPIKEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'managed-agents-2026-04-01',
        'Accept': 'text/event-stream',
      },
    },
  );

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events (split on \n\n)
    const events = buffer.split('\n\n');
    buffer = events.pop();

    for (const ev of events) {
      const dataLine = ev.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      const payload = JSON.parse(dataLine.slice(6));

      if (payload.type === 'agent.custom_tool_use') {
        // Dispatch vers le sub-agent HMAC
        const result = await callSubAgent(payload.name, payload.input, env);
        await anthropicFetch(env, 'POST', `/v1/sessions/${sessionId}/events`, {
          events: [{
            type: 'user.custom_tool_result',
            custom_tool_use_id: payload.id,
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }],
        });
      } else if (
        payload.type === 'session.status_idle' &&
        payload.stop_reason?.type !== 'requires_action'
      ) {
        break; // terminal idle
      } else if (payload.type === 'session.status_terminated') {
        break;
      }
    }
  }
}

async function callSubAgent(toolName, input, env) {
  // toolName est de la forme "documents.classify" / "suivi.next_deadline" / etc.
  const [service, method] = toolName.split('.');
  const subAgentUrl = {
    documents: 'https://documents-mcp.ikcp.eu',
    suivi:     'https://suivi-mcp.ikcp.eu',
    reporting: 'https://reporting-mcp.ikcp.eu',
  }[service];

  if (!subAgentUrl) throw new Error(`unknown sub-agent: ${service}`);

  // HMAC SHA-256 sur le body, constant-time compare côté sub-agent
  const body = JSON.stringify({ method, input });
  const hmac = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(env.HMAC_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    ),
    new TextEncoder().encode(body),
  );
  const sig = Array.from(new Uint8Array(hmac))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const r = await fetch(`${subAgentUrl}/mcp/call`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ikcp-signature': sig,
    },
    body,
  });
  return await r.json();
}
```

---

## 7. Plan de phasage

### Phase 1 — semaine 1 (POC)
- [ ] Provisionner DPA Anthropic Enterprise + Zero Data Retention
- [ ] Créer environnement + `marcel-reporting` agent uniquement
- [ ] Déployer `workers/ikcp-agents` minimal (POST + webhook seulement)
- [ ] Test : 1 user beta, 1 commande "génère mon bilan trimestriel"
- [ ] Critère succès : .docx généré + email reçu en < 2 min

### Phase 2 — semaines 2-3 (élargissement)
- [ ] Ajouter `marcel-documents` (OCR + extraction structurée)
- [ ] Ajouter `marcel-suivi` (planning + arbitrages)
- [ ] Custom tool dispatcher complet vers les 3 sub-agents existants
- [ ] Dashboard membre : section "Tâches en cours" avec polling
  `/api/agents/task/:id`

### Phase 3 — mois 2 (consolidation)
- [ ] Memory stores : 1 store par famille pour préférences durables
  (formatting reports, ton, format calendrier, etc.)
- [ ] Outcomes rubric optimisées (itération sur 10 vrais cas)
- [ ] Audit trail D1 → BI dashboard (coût/session, latence p50/p95,
  taux satisfied vs needs_revision)
- [ ] Migration Marcel chat vers `claude-sonnet-4-6` (séparée de
  ce chantier mais à faire avant juin 2026)

---

## 8. Coûts estimés (ordre de grandeur)

Hypothèses cohorte beta 50 familles, 1 rapport DER/trimestre + 2 OCR/mois :

| Item                                  | Volume/mois        | Coût unitaire (Opus 4.8) | Total mensuel |
|---------------------------------------|--------------------|--------------------------|---------------|
| Sessions reporting (DER + iterations) | 50 × 0.33 = 17/mo  | ~$0.40 (12k in / 5k out) | $7            |
| Sessions documents (OCR + extract)    | 50 × 2 = 100/mo    | ~$0.15 (3k in / 1k out)  | $15           |
| Sessions suivi (planning)             | 50/mo              | ~$0.25 (8k in / 3k out)  | $13           |
| Container compute                     | inclus             | $0.05/h après 1550h gratuits | $0       |
| Webhooks                              | gratuit            | -                        | $0            |
| **Total estimé beta 50 familles**    |                    |                          | **~$35/mois** |

Pour scale à 500 familles : ~$350/mois — toujours nettement sous le
coût marginal d'un humain pour ces tâches.

---

## 9. Décisions à valider

1. **Confirmer le DPA Anthropic Enterprise** + Zero Data Retention
   signé avant J0 beta (bloqueur).
2. **Souveraineté** : on accepte que les outputs filtrés transitent par
   l'infra US Anthropic (le PII brut reste EU). À documenter dans la
   charte beta.
3. **Webhook public** : `agents.ikcp.eu` exposé public avec HMAC
   verification only — accepté ou on ajoute Cloudflare Access ?
4. **Memory stores** : on commence sans (Phase 1-2) puis on évalue
   selon retours utilisateurs. Décision pour Phase 3.
5. **Modèle Marcel chat** : Sonnet 4.6 (default) ou Haiku 4.5 (pour
   latency-critical) ? — à benchmarker sur 100 questions beta.

---

*© 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
