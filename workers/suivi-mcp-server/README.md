# IKCP Suivi MCP server — Deuxième prototype sub-agent

Sub-agent qui **surveille en continu** les patrimoines clients et déclenche
des **alertes** + **propositions d'arbitrage** pour Maxime.

Deuxième prototype IKCP du pattern MCP servers (cf.
[`docs/CLAUDE-AGENT-SDK-INTEGRATION.md`](../../docs/CLAUDE-AGENT-SDK-INTEGRATION.md))
après [`documents-mcp-server`](../documents-mcp-server/README.md).

## Tools exposés

| Tool | Description |
|---|---|
| `next_deadline(user_id, horizon_days?)` | Prochaine échéance fiscale/patrimoniale dans l'horizon (défaut 30 j) |
| `check_drift_allocation(user_id, seuil_pct?)` | Détecte drift > seuil (défaut 5 pts) + propose 1-3 arbitrages |
| `schedule_reminder(user_id, date, label, ...)` | Programme un rappel J-8 dans D1 echeances |
| `propose_arbitrage(user_id, titre, ...)` | Crée un arbitrage en attente Maxime (file MIF II) |

## Cron triggers

Configurés dans `wrangler.toml` :

| Cron | Quand | Action |
|---|---|---|
| `0 7 * * *` | Daily 7h UTC (9h Paris) | Scan toutes les échéances qui tombent à J+8 → email Resend aux utilisateurs concernés |
| `0 9 1 * *` | Monthly 1er à 9h UTC | Scan drift allocation tous portefeuilles avec snapshot < 90 j → arbitrages auto si drift > 5 pts |

## Architecture

```
   Cron quotidien 7h UTC
        │
        ▼
   suivi-mcp-server.runDailyDeadlineCheck()
        │ SELECT echeances WHERE date = J+8 AND rappel_sent_at IS NULL
        │
        ├── pour chaque échéance trouvée :
        │   · récupère email user (D1 users)
        │   · envoie email rappel via Resend
        │   · UPDATE echeances SET rappel_sent_at = now()
        │
        ▼
   Beta-tester reçoit l'email J-8

   ─────────────────────────────────────────

   Marcel ou ikcp-client appelle next_deadline(user_id) ad-hoc
        │ via service binding + auth HMAC
        ▼
   suivi-mcp-server.next_deadline()
        │ SELECT echeances next 5
        ▼
   Retour : { next: {...}, other: [...] }
```

## RGPD

| Mesure | Statut |
|---|:---:|
| Lecture D1 limitée à `echeances` + `patrimoine_snapshot` du user_id ciblé | ✅ |
| Pas de stockage email externe (Resend en transit uniquement) | ✅ |
| Audit log de chaque arbitrage créé (table events) | ✅ |
| Suppression cascade : si user_id supprimé → echeances + arbitrages cascade D1 | 🟡 ON DELETE CASCADE à ajouter au schema |

## Configuration

### 1. Secrets

```bash
cd workers/suivi-mcp-server

# Auth HMAC (même valeur que sur ikcp-client + documents-mcp-server)
wrangler secret put MCP_SHARED_SECRET

# Resend (envoi rappels emails)
wrangler secret put RESEND_API_KEY
```

### 2. D1 binding

Récupérer l'ID de la DB ikcp-client-db et le mettre dans `wrangler.toml`.

### 3. Déployer

```bash
wrangler deploy
# → https://ikcp-suivi-mcp-server.maxime-ead.workers.dev/mcp/health
```

## Smoke tests

```bash
# Health
curl https://ikcp-suivi-mcp-server.maxime-ead.workers.dev/mcp/health
# → { status: "ok", configured: { db: true, resend: true, ... } }

# next_deadline (depuis Marcel via service binding)
# (calcul HMAC requis — voir documents-mcp-server/README.md pour le pattern)
```

## Test du cron daily en local

```bash
# Cloudflare Workers permet de tester un cron en dev :
wrangler dev --test-scheduled
# Puis dans un autre terminal :
curl "http://localhost:8787/__scheduled?cron=0+7+*+*+*"
```

## Coûts mensuels (cohorte 1 → cohorte 3)

| Volume | Cron daily checks | Resend emails | D1 reads |
|---|---|---|---|
| 5 familles | ~5 emails/mois | gratuit (< 3000) | gratuit |
| 50 familles | ~50 emails/mois | gratuit | gratuit |
| 500 familles | ~500 emails/mois | gratuit | ~5 €/mois |

## ROI

- **1 erreur d'échéance évitée par an** (TF, CFE, IFI) ≈ **2-5 k€ de pénalité économisée**
- **1 arbitrage automatique préparé/mois** = ~30 min Maxime gagnées
- Coût marginal mensuel : **< 1 €** pour 50 familles

## Évolutions Phase 2

- [ ] Webhook depuis `documents-mcp-server` : si avis CFE classifié → `schedule_reminder()` automatique
- [ ] Sub-agent appelable via Marcel `query_subagent('suivi', 'next_deadline')`
- [ ] Notifications push Web (VAPID) en plus de Resend email
- [ ] Cron weekly pour relance des arbitrages > 14 j en attente Maxime
- [ ] Détection patterns d'inactivité (membre n'a pas posé de question Marcel depuis 30 j → relance Maxime)

---

*Deuxième prototype · IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
