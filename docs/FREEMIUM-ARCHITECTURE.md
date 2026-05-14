# Architecture FREEMIUM — Espace Membre IKCP

> **Vision** : transformer ikcp.eu en plateforme freemium acquisition → conversion → fidélisation. Pappers = entry point gratuit. Premium = engagement. Family Office = aboutissement.
>
> **Statut** : plan d'architecture — sprint 3 semaines · **Créé** : 2026-05-07 · **Auteur** : Maxime + Claude

---

## 1. Modèle économique — 3 tiers

### Freemium acquisition

| Tier | Prix | Cible | Lookups Pappers | Marcel | Cartographie | Dossiers | Maxime |
|---|---|---|---|---|---|---|---|
| **Découverte** (free) | 0 € | Prospect curieux | **1 / mois** | Q&A pédagogique générique | Manuelle | — | — |
| **Premium** | **29 €/mois** ou 290 €/an | Particulier engagé · TNS · profession libérale | **10 / mois** | Personnalisé · mémoire · follow-ups | Théodore activé · auto | 1 dossier patrimonial | Mail prioritaire |
| **Family Office** | **Sur devis** (≥ 250 €/mois) | Familles ≥ 5 M€ — *sur recommandation* | **Illimité** | Tous les 11 agents · validation Maxime | Théodore + Olympe + Hermès | Illimité | RDV mensuel · Calendly prioritaire |

### Logique de conversion

```
Découverte (free) ─── 1 lookup épuisé ───► CTA upgrade Premium
       │
       │ (90 j sans activité)
       ▼
   Email réactivation
       │
   Upgrade Premium ───── 6 mois actifs ───► Invitation Family Office
       │                                    par Maxime (manuel + reco)
       │ (Stripe cancel)
       ▼
   Email récup + downgrade Free
```

**Hypothèses revenus (12 mois)** :
- 500 free signups → conversion 5 % = 25 Premium = **725 €/mois**
- + 8 Family Office × 350 €/mois moyen = **2 800 €/mois**
- Total ARR : **42 300 €/an** (soit ~1 ETP cabinet remplacé)

---

## 2. Architecture technique

```
┌──────────────────────────────────────────────────────────────────┐
│                   FRONTEND  client.ikcp.eu                        │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│   │   Login     │  │  Dashboard  │  │   Marcel    │              │
│   │ magic link  │  │  freemium   │  │  embed      │              │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└──────────┼────────────────┼────────────────┼───────────────────-┘
           │                │                │
           ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│            WORKER  ikcp-client (Cloudflare)                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ Auth (magic link · JWT)  +  Quota check  +  Audit log │      │
│  └─────┬──────────────────┬─────────────────┬────────────┘      │
│        │                  │                 │                    │
│        ▼                  ▼                 ▼                    │
│  ┌──────────┐      ┌──────────┐     ┌─────────────┐             │
│  │ /me      │      │ /pappers │     │ /stripe     │             │
│  │ /usage   │      │ /lookup  │     │ /checkout   │             │
│  │ /sync-gp │      │          │     │ /webhook    │             │
│  └─────┬────┘      └────┬─────┘     └──────┬──────┘             │
│        │                │                   │                    │
│        ▼                ▼                   ▼                    │
│  ┌─────────────────────────────────────────────────┐            │
│  │  Cloudflare D1 (users · sessions · usage)       │            │
│  │  Cloudflare KV (rate limit · cache)             │            │
│  └─────────────────────────────────────────────────┘            │
└────┬────────────────────┬─────────────────────────┬──────────────┘
     │                    │                         │
     ▼                    ▼                         ▼
┌──────────┐       ┌──────────────┐         ┌──────────────────┐
│ Stripe   │       │ ikcp-pappers │         │ Resend           │
│ subs     │       │ Worker       │         │ Welcome / quota  │
│ webhook  │       │ + KV cache   │         │ / upgrade emails │
└──────────┘       └──────┬───────┘         └──────────────────┘
                          ▼
                   ┌──────────────┐
                   │ api.pappers  │
                   │ (clé Maxime) │
                   └──────────────┘
                          
                          
   ┌──────────────────────────────────┐
   │  LOGICIEL-GP (PC Maxime)          │
   │  Polling toutes les 5 min :       │
   │  GET /api/v1/cabinet/sync         │
   │  → récupère activités utilisateurs│
   │  → enrichit dossiers locaux       │
   │  Bearer service token             │
   └──────────────────────────────────┘
```

---

## 3. Auth — Magic link (zero password)

**Pourquoi magic link** : pas de mot de passe à gérer, pas de leak possible, parfait pour un public premium qui n'aime pas mémoriser.

### Flow

1. Utilisateur saisit son email sur `client.ikcp.eu`
2. Worker génère un token aléatoire 32 chars, hash SHA-256 stocké en KV avec TTL 15 min
3. Email envoyé via Resend : *"Cliquez pour vous connecter à votre Salon IKCP"* + lien `client.ikcp.eu/auth/verify?token=...`
4. Clic → Worker vérifie le hash → crée session JWT (HS256, 30 j) → cookie HttpOnly + Secure + SameSite=Strict
5. Redirige vers `/salon`

### Sécurité
- Magic link **single-use** (brûlé après vérif)
- TTL **15 min**
- Rate limit **3 envois/email/heure**
- Audit log toutes les connexions (table `audit_log`)

---

## 4. Stripe — Abonnements & automation

### Produits Stripe à créer

| Stripe Product ID (à créer) | Nom | Prix | Récurrence |
|---|---|---|---|
| `prod_ikcp_premium_monthly` | IKCP Premium · Mensuel | **29 €/mois** | mensuel |
| `prod_ikcp_premium_yearly` | IKCP Premium · Annuel | **290 €/an** | annuel (-17 %) |
| `prod_ikcp_fo` | IKCP Family Office | **Sur devis** | manuel par Maxime |

### Workflow upgrade Premium

```
User clique "Upgrade Premium"
        │
        ▼
POST /api/v1/stripe/checkout {priceId}
        │
        ▼
Worker crée Stripe Checkout session avec :
  - customer_email (= user.email)
  - success_url = client.ikcp.eu/salon?upgraded=1
  - cancel_url  = client.ikcp.eu/salon
  - metadata = { user_id }
        │
        ▼
User redirigé vers Stripe Checkout (paiement CB / SEPA)
        │
        ▼
Stripe webhook → POST /api/v1/stripe/webhook
        │
        ├─► event = checkout.session.completed
        │   → users.tier = 'premium'
        │   → users.stripe_customer_id = cus_...
        │   → email "Bienvenue Premium" (Resend)
        │   → push Notion : tier upgraded
        │
        ├─► event = customer.subscription.deleted
        │   → users.tier = 'free' (downgrade)
        │   → email "On vous regrette" + offre récup
        │
        └─► event = invoice.payment_failed
            → email Maxime + user
            → tier reste 'premium' pendant 7 j (grace period)
```

### Webhook signature

Tous les webhooks Stripe sont signés. Le Worker vérifie la signature HMAC avec `STRIPE_WEBHOOK_SECRET` avant de traiter.

---

## 5. Quotas & rate limits

### Compteurs mensuels (D1 table `usage`)

```sql
CREATE TABLE usage (
  user_id TEXT NOT NULL,
  year_month TEXT NOT NULL,           -- "2026-05"
  pappers_lookups INTEGER DEFAULT 0,
  marcel_messages INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, year_month)
);
```

### Quota par tier

| Tier | Pappers | Marcel msgs | Marcel mémoire | Cartographie auto |
|---|---|---|---|---|
| Découverte | 1/mois | 30/mois | non | non |
| Premium | 10/mois | illimité | oui (90 j) | oui |
| Family Office | illimité | illimité | oui (perm.) | oui |

### Réponse quota épuisé (HTTP 402)

```json
{
  "error": "quota_exceeded",
  "tier": "free",
  "limit": 1,
  "used": 1,
  "reset_at": "2026-06-01T00:00:00Z",
  "upgrade_url": "https://client.ikcp.eu/abonnement"
}
```

Le frontend intercepte le 402 → affiche modal upgrade Stripe.

### Reset mensuel

Cron Worker tous les 1ers du mois à minuit (`0 0 1 * *`) :
- Pas de DELETE — on garde l'historique
- Le compteur est cherché par `(user_id, year_month)` — change automatiquement de mois

---

## 6. Pappers — partage de la clé Maxime

**Risque** : Pappers free tier 100 req/mois. Si 100 free users × 1 lookup → on est à la limite.

**Stratégie** :
1. **Cache KV 1h** — déjà en place, divise les requêtes par 5-10×
2. **Pappers Standard** (99 €/mois, 1500 req/mois) dès 30+ utilisateurs payants — autofinancé
3. **Pappers Pro** (299 €/mois, 5000 req/mois) à partir de 100 Premium — toujours autofinancé

### Worker `ikcp-pappers` — extension tier-aware

```js
// Dans ikcp-pappers worker.js, avant l'appel Pappers :
async function checkQuota(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { ok: false, status: 401 };
  
  // Verify session JWT (signed by ikcp-client)
  const token = auth.substring(7);
  const session = await verifyJWT(token, env.JWT_SECRET);
  if (!session) return { ok: false, status: 401 };
  
  // Check quota for current month
  const month = new Date().toISOString().slice(0, 7);
  const limits = { free: 1, premium: 10, fo: 999999 };
  const used = await env.D1.prepare(
    'SELECT pappers_lookups FROM usage WHERE user_id=? AND year_month=?'
  ).bind(session.user_id, month).first();
  
  if ((used?.pappers_lookups || 0) >= limits[session.tier]) {
    return { ok: false, status: 402, body: { error: 'quota_exceeded' } };
  }
  return { ok: true, user: session };
}
```

### Incrémentation après succès

```js
// Après réponse Pappers OK :
await env.D1.prepare(
  'INSERT INTO usage (user_id, year_month, pappers_lookups) VALUES (?, ?, 1) ' +
  'ON CONFLICT(user_id, year_month) DO UPDATE SET pappers_lookups = pappers_lookups + 1'
).bind(user_id, month).run();
```

---

## 7. Lien Logiciel-GP (cabinet local)

### Polling depuis logiciel-gp

Le logiciel local de Maxime n'est pas exposé sur internet. Il **interroge** `client.ikcp.eu` toutes les 5 min :

```
GET https://client.ikcp.eu/api/v1/cabinet/sync?since=<last_sync_timestamp>
Authorization: Bearer <CABINET_SERVICE_TOKEN>
```

Réponse :
```json
{
  "since": "2026-05-07T14:30:00Z",
  "now": "2026-05-07T14:35:00Z",
  "events": [
    {
      "type": "pappers_lookup",
      "user_id": "uuid-...",
      "user_email": "client@example.com",
      "siren": "947972436",
      "company_name": "IKIGAI...",
      "ts": "2026-05-07T14:32:11Z"
    },
    {
      "type": "marcel_message",
      "user_id": "uuid-...",
      "topic": "succession",
      "tier": "premium",
      "ts": "2026-05-07T14:33:48Z"
    },
    {
      "type": "subscription_upgraded",
      "user_id": "uuid-...",
      "from_tier": "free",
      "to_tier": "premium",
      "ts": "2026-05-07T14:34:02Z"
    }
  ]
}
```

Le logiciel-gp enrichit les fiches prospect/client locales en temps réel (≤ 5 min lag).

### Push depuis logiciel-gp

Pour valider un dossier ou pousser un livrable signé :
```
POST https://client.ikcp.eu/api/v1/cabinet/dossier/<id>/validate
Authorization: Bearer <CABINET_SERVICE_TOKEN>
{
  "validated_by": "Maxime Juveneton",
  "validated_at": "2026-05-07T14:40:00Z",
  "document_url": "https://r2.ikcp.eu/docs/..."
}
```

---

## 8. Automation (Make scenarios)

| Trigger | Action |
|---|---|
| User signup free | → Email "Bienvenue · 1 lookup offert" (Resend) → push Notion CRM |
| User épuise quota Pappers | → Email "Upgrade pour 9 lookups de plus" + popup au prochain login |
| Stripe `subscription.created` | → users.tier=premium → Email "Bienvenue Premium" → push Notion → notif Slack/SMS Maxime |
| Stripe `subscription.deleted` | → users.tier=free → Email récup |
| Stripe `payment_failed` | → Grace period 7 j → email + alerte Maxime |
| 90 j sans activité | → Email réactivation + lookup gratuit bonus |
| 6 mois Premium actif | → Notif Maxime "Candidat Family Office ?" |
| Family Office signup (manuel Maxime) | → users.tier=fo → email custom + Calendly mensuel |

Tout ça se branche via Make sur le webhook `ikcp-client/api/v1/event-bus`.

---

## 9. Sprint de mise en place — 3 semaines

### Semaine 1 — Auth & Stripe

| Jour | Tâche |
|---|---|
| J1 | Créer D1 `ikcp-client-db` + schema (users, sessions, magic_tokens, usage, audit_log) |
| J2 | Worker `ikcp-client` : magic link send + verify + JWT + cookie |
| J3 | Templates email Resend (welcome, magic link, quota, upgrade) — domaine `ikcp.eu` vérifié |
| J4 | Stripe : créer les 2 produits Premium (mensuel + annuel) en mode test |
| J5 | Worker `ikcp-client` : `/stripe/checkout` + `/stripe/webhook` (signature HMAC) |

### Semaine 2 — Pappers + UX

| Jour | Tâche |
|---|---|
| J6 | Pappers Worker : ajouter `checkQuota` (auth Bearer + D1 + 402) |
| J7 | Pappers Worker : `incrementUsage` après succès |
| J8 | Page `client.ikcp.eu/salon` : dashboard freemium (cf. mockup [membre-preview.html](../proposals/membre-preview.html)) |
| J9 | Page `client.ikcp.eu/abonnement` : 3 tiers + checkout Stripe |
| J10 | Page `/auth/login` : input email + magic link |

### Semaine 3 — Logiciel-GP + automation

| Jour | Tâche |
|---|---|
| J11 | Endpoint `/api/v1/cabinet/sync` (Bearer + cursor since) |
| J12 | Endpoint `/api/v1/cabinet/dossier/:id/validate` |
| J13 | Côté logiciel-gp : poller toutes les 5 min (script Node ou PowerShell) |
| J14 | Make scenarios : signup → Notion · upgrade → Slack · cancel → email récup |
| J15 | Tests E2E : signup → lookup gratuit → quota → upgrade Stripe → webhook → tier=premium → 10 lookups OK |

---

## 10. Risques & mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Quota Pappers explose** avant 30 Premium payants | Moyen | Moyen | Cache 1h agressif + free tier strict 1/mois + suggérer "saisie manuelle" en fallback |
| **Stripe webhook pas reçu** (réseau, race condition) | Faible | Élevé | Webhook signé + idempotency key + retry Stripe automatique 3j + cron de reconciliation quotidien |
| **Magic link par email rate-limited** | Faible | Moyen | Resend free 3000/mois suffit · upgrade 20 €/mois si > 3k |
| **AI Act classification "haut risque"** | Moyen | Élevé | Disclaimer MIF II + validation humaine documentée + registre IA (déjà prévu) |
| **Logiciel-GP local devient indispo** | Moyen | Faible | Polling resume sans perte (curseur `since`), historique conservé 30 j en D1 |
| **Free tier abusé** (fake emails) | Moyen | Faible | Verification email + KV rate limit IP/mois + captcha si besoin |
| **Cancellation massive Stripe** | Faible | Moyen | Email exit survey + réduction "encore 3 mois à 50 %" |

---

## 11. Decisions à valider avant J1

| # | Décision | Reco par défaut |
|---|---|---|
| 1 | Domaine espace membre | **`client.ikcp.eu`** (CNAME → worker) |
| 2 | Prix Premium mensuel | **29 €/mois** (positionnement avocat fiscaliste light) |
| 3 | Prix annuel | **290 €/an** (-17 %, 2 mois offerts) |
| 4 | Quota Pappers free | **1/mois** (assez pour tester, déclenche conversion) |
| 5 | Quota Pappers premium | **10/mois** (couvre 1 famille étendue + entreprises) |
| 6 | Email service | **Resend** (DPA EU, 3000/mois free, dev-friendly) |
| 7 | Magic link TTL | **15 min** + single-use |
| 8 | JWT TTL session | **30 jours** + cookie HttpOnly |
| 9 | Cabinet polling fréquence | **5 minutes** (équilibre fraîcheur / charge) |
| 10 | Stripe mode | **test** d'abord, puis live après QA complète |

---

## 12. KPI à suivre

- **Free signups / mois**
- **Taux conversion free → premium** (objectif 5 %)
- **Taux conversion premium → FO** (objectif 8 % à 6 mois)
- **MRR** (Monthly Recurring Revenue)
- **Churn rate Premium** (< 5 % / mois)
- **Pappers cache hit rate** (> 60 %)
- **Marcel : sessions / user / mois**
- **Logiciel-GP sync lag** (< 10 min)

Tableau de bord dans `client.ikcp.eu/admin?token=<ADMIN_TOKEN>` (Maxime only).

---

*Document vivant — mis à jour à chaque jalon atteint.*
*Maxime Juveneton — IKCP*
