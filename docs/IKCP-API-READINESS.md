# IKCP API-Readiness — Plan d'opérationnalisation

> **Objectif** : rendre le site ikcp.eu et son écosystème prêts à recevoir, émettre et orchestrer des appels API avec partenaires externes (assureurs, signature, KYC, CRM, paiement).
>
> **Statut** : document opérationnel — dernière révision 24/04/2026

---

## 1. Où vous en êtes aujourd'hui

| Brique | État | Verrous |
|---|---|---|
| Frontend | PWA Hostinger (LiteSpeed) | CORS OK, mais Hostinger = blackbox (pas de bindings, pas de Range stream optimisé pour vidéo) |
| Backend API | 4 Cloudflare Workers : `ikcp-chat`, `ikcp-marcel`, `ikcp-prospect`, `ikcp-ga4` | Architecture ad-hoc, pas de standards communs |
| Stockage | Cloudflare KV (`MARCEL_LOGS`), `ikcp-prospect-IDEMPOTENCY`, `RATE_LIMIT` | Pas de base relationnelle, pas de R2 |
| Auth | Bearer token simple (`ADMIN_TOKEN` sur dashboard) | Pas d'auth client standardisée |
| Monitoring | Wrangler tail, Cloudflare logs | Pas de tableau de bord ops unifié |
| Documentation | README par Worker | Pas d'OpenAPI spec |

**Verdict** : vous avez **70% de l'infra** déjà en place. Il manque surtout la **standardisation** pour pouvoir ajouter rapidement de nouvelles APIs (Yousign, Ubble, Nortia) sans tout redévelopper.

---

## 2. Architecture cible API-ready

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND IKCP.EU                           │
│  ikcp.eu (Hostinger) ─── chatbot-widget.js ─── simulateurs       │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS + CORS
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  GATEWAY : ikcp-api (Cloudflare)                  │
│                                                                   │
│   ┌──────────────────────────────────────────────────────┐       │
│   │  Point d'entrée unique : api.ikcp.eu (custom domain) │       │
│   │  Router : /v1/chat, /v1/kyc, /v1/signature, etc.     │       │
│   │  Auth : Bearer tokens + HMAC signatures              │       │
│   │  Rate limiting : par IP + par API key                │       │
│   │  Logs structurés + trace_id partout                  │       │
│   └────────────────────────┬─────────────────────────────┘       │
│                            │                                      │
│   ┌────────────────────────┼──────────────────────────┐          │
│   ▼                        ▼                          ▼          │
│ /v1/chat               /v1/docs                 /v1/kyc         │
│ /v1/prospect           /v1/sign                 /v1/pay         │
│ /v1/analytics          /v1/webhooks             /v1/partners    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ Cloudflare D1   │ │ Cloudflare R2   │ │ Cloudflare KV       │
│ Base relation.  │ │ Documents       │ │ Cache / rate limit  │
│ clients/dossiers│ │ PDFs/signatures │ │ sessions            │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
                             │
         ┌───────────────────┴──────────────────────┐
         ▼                                          ▼
┌──────────────────────┐                 ┌──────────────────────┐
│  APIs SORTANTES      │                 │  WEBHOOKS ENTRANTS   │
│  Yousign · Ubble     │                 │  Calendly (RDV)      │
│  Nortia · Stripe     │                 │  Make.com (scénarios)│
│  Anthropic · Resend  │                 │  Notion (CRM sync)   │
│  Powens/BI (agrég.)  │                 │  Yousign (callbacks) │
└──────────────────────┘                 └──────────────────────┘
```

---

## 3. Les 8 préparatifs techniques à faire (par ordre)

### Préparatif 1 — Créer un **domaine API dédié** `api.ikcp.eu`

**Pourquoi** : séparer le site vitrine (Hostinger) du backend API (Cloudflare). Donne une URL stable, pro, versionnable.

**Comment** :
1. Dans Cloudflare Dashboard → DNS → Add record
   - Type `CNAME`, name `api`, target `maxime-ead.workers.dev`, proxy OFF (DNS-only)
2. Créer un Worker `ikcp-api` avec route `api.ikcp.eu/*`
3. Worker router vers les sous-Workers existants (`/v1/chat` → `ikcp-chat`, etc.)

**Livrable** : `https://api.ikcp.eu/v1/health` qui répond `{status:"ok"}`.

---

### Préparatif 2 — Créer le **Worker gateway `ikcp-api`** avec standards communs

**Standards à imposer** :
- Toutes les réponses JSON structurées : `{success, data, error, trace_id, timestamp}`
- Codes HTTP corrects : 200/201 succès, 400 validation, 401 auth, 404 not found, 429 rate limit, 500 erreur
- Header `X-Request-ID` généré à chaque requête (traçabilité)
- Header `X-API-Version` de la réponse (`v1`)
- CORS standardisé pour ikcp.eu uniquement sur les endpoints sensibles
- Compression gzip automatique

**Code squelette** (à créer dans `workers/ikcp-api/worker.js`) :

```js
export default {
  async fetch(request, env, ctx) {
    const trace = crypto.randomUUID();
    const url = new URL(request.url);
    const path = url.pathname;

    // Version & health
    if (path === '/v1/health') return json({success:true, data:{version:'1.0.0', uptime:Date.now()}}, 200, trace);

    // Auth
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({success:false, error:'unauthorized'}, 401, trace);

    // Rate limit
    const rl = await rateLimit(env, auth.principal, path);
    if (!rl.ok) return json({success:false, error:'rate_limited', retry_after:rl.retryAfter}, 429, trace);

    // Router
    if (path.startsWith('/v1/chat'))      return routeChat(request, env, auth, trace);
    if (path.startsWith('/v1/prospect'))  return routeProspect(request, env, auth, trace);
    if (path.startsWith('/v1/sign'))      return routeSign(request, env, auth, trace);
    if (path.startsWith('/v1/kyc'))       return routeKyc(request, env, auth, trace);
    if (path.startsWith('/v1/docs'))      return routeDocs(request, env, auth, trace);
    if (path.startsWith('/v1/webhooks'))  return routeWebhooks(request, env, auth, trace);

    return json({success:false, error:'not_found'}, 404, trace);
  }
};

function json(body, status=200, trace='') {
  return new Response(JSON.stringify({...body, trace_id:trace, timestamp:new Date().toISOString()}), {
    status,
    headers: {
      'Content-Type':'application/json; charset=utf-8',
      'X-Request-ID': trace,
      'X-API-Version': 'v1',
      'Access-Control-Allow-Origin': 'https://ikcp.eu'
    }
  });
}
```

---

### Préparatif 3 — Mettre en place **l'authentification API**

**Deux niveaux** :

**Niveau 1 — API keys clients (pour usage interne / partenaires)**
- Format : `ikcp_live_<32-char-random>`
- Stockage : table D1 `api_keys(id, key_hash, principal, scopes, created_at, last_used_at, revoked_at)`
- Transmission : header `Authorization: Bearer ikcp_live_...`
- Hash SHA-256 côté serveur, jamais stocké en clair

**Niveau 2 — HMAC signatures (pour webhooks entrants)**
- Chaque partenaire (Yousign, Make.com, Calendly) signe son POST avec un secret partagé
- Le Worker vérifie la signature HMAC avant de traiter
- Évite les usurpations

**Table D1 à créer** (schema) :
```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT UNIQUE NOT NULL,
  principal TEXT NOT NULL,
  scopes TEXT NOT NULL,  -- JSON array : ["chat:read","prospect:write"]
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  rate_limit_per_min INTEGER DEFAULT 60
);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

---

### Préparatif 4 — Créer la **base D1** (SQL relationnelle)

**Pourquoi** : KV est idéal pour cache et key-value simple, mais dès qu'on veut des relations client ↔ dossier ↔ documents ↔ souscriptions, il faut du SQL.

**Schémas minimum (v1)** :

```sql
-- Prospects / clients
CREATE TABLE persons (
  id TEXT PRIMARY KEY,  -- UUID v4
  email TEXT UNIQUE,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  birth_date TEXT,
  kyc_status TEXT DEFAULT 'pending',  -- pending/verified/rejected
  kyc_provider TEXT,  -- ubble/idnow
  kyc_verified_at INTEGER,
  source TEXT,  -- marcel/formulaire/calendly
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  lead_score INTEGER DEFAULT 0,
  notes TEXT
);

-- Dossiers patrimoniaux
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id),
  status TEXT DEFAULT 'draft',  -- draft/analysis/recommendation/signed/active/closed
  type TEXT,  -- bilan/souscription_av/transmission/etc.
  assigned_to TEXT,  -- maxime
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  data_json TEXT  -- profil patrimonial en JSON
);

-- Documents (DER, RA, contrats, bulletins signés)
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id),
  type TEXT NOT NULL,  -- DER/lettre_mission/rapport_adequation/DIPA/contrat/kbis
  r2_key TEXT NOT NULL,  -- path dans R2
  mime_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT,  -- hash pour intégrité
  signature_provider TEXT,  -- yousign/universign
  signature_id TEXT,
  signed_at INTEGER,
  created_at INTEGER NOT NULL
);

-- Souscriptions (contrats chez assureurs)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id),
  person_id TEXT NOT NULL REFERENCES persons(id),
  partner TEXT NOT NULL,  -- nortia/alpheys/direct
  product_type TEXT NOT NULL,  -- assurance_vie/per/capi
  insurer TEXT,  -- apicil/spirica/generali
  contract_number TEXT,
  initial_amount INTEGER,  -- en centimes
  status TEXT DEFAULT 'pending',  -- pending/active/cancelled
  subscribed_at INTEGER,
  created_at INTEGER NOT NULL
);

-- Événements (audit log complet)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  person_id TEXT,
  file_id TEXT,
  type TEXT NOT NULL,  -- chat_message/form_submit/kyc_started/signature_sent/...
  payload_json TEXT,
  source TEXT,  -- worker_name
  trace_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_person ON events(person_id);
CREATE INDEX idx_events_file ON events(file_id);
CREATE INDEX idx_events_type_date ON events(type, created_at);
```

**Création via MCP Cloudflare** : 1 clic, je peux le faire.

---

### Préparatif 5 — Mettre en place **R2 pour les documents**

**Buckets à créer** :
- `ikcp-docs-private` : DER, RA, contrats signés (privé, Worker sert avec auth)
- `ikcp-media-public` : assets publics (vidéos hero, images, OG)
- `ikcp-archives` : archivage long terme 10 ans (classe infrequent access, coût ~0)

**Convention de nommage R2** :
```
docs/{person_id}/{file_id}/{type}-{date}.pdf
media/hero/balloon-{version}.mp4
archives/{year}/{month}/{person_id}/{document_id}.pdf
```

**Horodatage eIDAS** : chaque document de conseil est horodaté via un service qualifié (Universign, DocStamp) dès sa signature. Le hash SHA-256 + timestamp sont stockés en D1 pour prouver l'intégrité à 10 ans.

---

### Préparatif 6 — Système de **webhooks bidirectionnels**

**Entrants** (ce qu'on reçoit) :
- `POST /v1/webhooks/yousign` — callbacks Yousign (signature completed, declined, expired)
- `POST /v1/webhooks/ubble` — callback Ubble (KYC verified, rejected)
- `POST /v1/webhooks/calendly` — nouveau RDV
- `POST /v1/webhooks/make` — scénario Make.com (génération de leads, synchro Notion…)
- `POST /v1/webhooks/stripe` — paiement honoraires

Chaque webhook :
1. Vérifie la signature HMAC
2. Enregistre l'event brut dans D1 (`events`)
3. Dispatche vers le handler métier
4. Répond 200 rapidement (acknowledge < 3s), traitement asynchrone si long

**Sortants** (ce qu'on envoie) :
- Notifications Maxime (email + SMS quand hot lead)
- Push Notion (fiche prospect)
- Alertes monitoring (Slack/Discord/email si erreur critique)

---

### Préparatif 7 — **Monitoring & observabilité**

**Logs structurés** : tout log Worker au format JSON
```js
console.log(JSON.stringify({
  level:'info', event:'prospect_created', person_id:'...', source:'marcel', trace_id:'...'
}));
```

**Métriques** (Cloudflare Analytics Engine) :
- Nombre de requêtes par endpoint
- Latence p50/p95/p99
- Erreurs par code HTTP
- Hot leads/jour, conversions

**Dashboard opérationnel** :
- Refaire `/admin` en vrai cockpit (roadmap Dashboard Maxime v2)
- Onglets : Prospects · Conversations · Simulateurs · Docs · Souscriptions · Alertes

**Alerting** : un Worker Cron toutes les 10 min qui vérifie :
- Dernière souscription < 48h ?
- Erreurs 500 > 1% des appels ?
- Key Anthropic qui fuite ?
- Budget API > seuil ?

---

### Préparatif 8 — **Documentation OpenAPI 3.1**

Une fois l'API stabilisée, rédiger `docs/api/openapi.yaml` :
- Tous les endpoints documentés
- Schémas des payloads
- Exemples de requêtes/réponses
- Auth expliquée

**Avantages** :
- Les partenaires (Nortia, Yousign) ont une doc propre
- Génération automatique de SDKs (TypeScript, Python)
- Tests automatisés (Dredd, Schemathesis)
- Portail dev : https://api.ikcp.eu/docs (Swagger UI)

---

## 4. Plan d'exécution 30 jours

### Semaine 1 — Fondations
- [ ] Créer `api.ikcp.eu` (DNS + Worker)
- [ ] Squelette `ikcp-api` avec router, auth Bearer, trace_id, health check
- [ ] Créer D1 database `ikcp-prod` + schémas `persons`, `files`, `events`

### Semaine 2 — Intégration de l'existant
- [ ] Migrer `ikcp-chat` → endpoint `/v1/chat` du nouveau gateway
- [ ] Migrer `ikcp-prospect` → `/v1/prospect`
- [ ] Logs structurés + events en D1 pour toutes les requêtes

### Semaine 3 — Partenaires externes
- [ ] Intégration Yousign POC (`/v1/sign`) — 1er endpoint de signature
- [ ] Intégration Ubble POC (`/v1/kyc`) — 1ère vérification d'identité
- [ ] Webhooks entrants avec HMAC

### Semaine 4 — Observabilité & docs
- [ ] Dashboard `/admin` v2 : lecture D1 + KV + R2
- [ ] OpenAPI spec + Swagger UI
- [ ] Cron alerting
- [ ] Tests end-to-end : un faux dossier complet de bout en bout

---

## 5. Coûts estimés (Cloudflare + partenaires)

| Service | Phase lancement | 100 clients | 1000 clients |
|---|---|---|---|
| Cloudflare Workers (req/mois) | 0 € | 5 € | 20 € |
| D1 (lectures + écritures) | 0 € | 5 € | 25 € |
| KV (ops) | 0 € | 1 € | 5 € |
| R2 (stockage + lectures) | 0 € | 1 € | 15 € |
| Anthropic Claude (avec cache) | 50 € | 300 € | 2000 € |
| Yousign | 0 € (POC 30j) | 50 € | 500 € |
| Ubble | 0 € (POC) | 150 € | 1200 € |
| Total infra | ~50 € | ~510 € | ~3800 € |

**Break-even** (avec 0,5%/an sur AUM et 50k€/client) : ~100 clients actifs.

---

## 6. Décisions à prendre maintenant

| Décision | Options | Ma recommandation |
|---|---|---|
| Orchestrateur externe | Make.com / n8n / Zapier | **Make.com** (vous connaissez déjà, rapide à itérer) |
| Base de données | D1 / Supabase / Neon | **D1** (reste sur Cloudflare, latence 0, coût 0 au début) |
| Stockage documents | R2 / S3 / GCS | **R2** (0 egress, conforme DORA/RGPD, intégré) |
| CDN médias | R2 + Worker / Stream / Bunny.net | **Stream** pour vidéos hero, **R2** pour docs |
| Signature | Yousign / Universign / Docusign | **Yousign** (français, API moderne, tarifs CGP) |
| KYC | Ubble / IDnow / Onfido | **Ubble** (PVID ANSSI, français, intégré fintechs FR) |
| Notifications Maxime | Email (Resend) + SMS (OVH) | **Resend** + **Make.com** pour orchestrer |

---

## 7. Risques et points de vigilance

| Risque | Impact | Mitigation |
|---|---|---|
| Fuite API keys clients | Élevé | Hash en D1, rotation trimestrielle, scopes limités |
| Webhook replay attacks | Moyen | Signature HMAC + idempotency keys |
| Rate limit abuse | Moyen | KV compteurs par IP + par key, 429 + Retry-After |
| AI Act classification "haut risque" | Élevé | Registre IA tenu à jour dès le design, validation humaine systématique |
| RGPD (stockage 10 ans vs droit à l'oubli) | Moyen | Table `persons.deletion_requested_at` + anonymisation avec conservation audit |
| Cloudflare outage | Moyen | Uptime 99.99%+, status page, fallback email |

---

## 8. Prochaines actions concrètes (je peux les faire pour vous)

- [ ] **Aujourd'hui** : créer D1 database `ikcp-prod` + schémas base (10 min via MCP)
- [ ] **Aujourd'hui** : créer buckets R2 `ikcp-docs-private`, `ikcp-media-public`, `ikcp-archives`
- [ ] **Cette semaine** : écrire le squelette Worker `ikcp-api` avec auth + trace_id
- [ ] **Cette semaine** : migrer 1er endpoint (`/v1/chat`) vers le nouveau gateway
- [ ] **Cette semaine** : contacter Yousign + Ubble pour obtenir les POC gratuits 30 jours

Dites "go" et j'enchaîne les 4 premiers points. Les contacts partenaires, vous seul pouvez les faire (je peux rédiger les emails).

---

*Document vivant — mis à jour à chaque jalon atteint.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial*
