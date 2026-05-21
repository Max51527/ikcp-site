# INFRA-PRODUCTION.md — État opérationnel infrastructure IKCP

> **Source de vérité** sur l'état des workers déployés, ressources Cloudflare, secrets configurés.
> Mise à jour : **21 mai 2026** · Sprint 2 code complet · en attente deploy + secrets Maxime.

---

## 🏢 Compte Cloudflare

- **Email** : maxime@ikcp.fr
- **Account ID** : `eaddc4cc77d99dd397a62e5d5a1b6864`
- **Subdomain workers** : `maxime-ead.workers.dev`
- **Zone gérée** : ikcp.eu (DNS chez Cloudflare)
- **Plan** : Free (Workers Paid Plan recommandé pour > 100 k req/jour)

---

## 🚀 Workers déployés en production

### 1. ikcp-pappers · cartographie SIREN

- **URL** : https://ikcp-pappers.maxime-ead.workers.dev
- **Endpoints** :
  - `GET /health` · ping + statut configuration
  - `GET /search?q=<query>` · recherche par nom
  - `GET /entreprise/:siren` · fiche complète RNE
  - `GET /entreprise/:siren/short` · fiche résumée
- **Bindings** :
  - `PAPPERS_CACHE` (KV) → ID `dabb785927cc4715bf3374cc0cbb9578`
- **Secrets** :
  - `PAPPERS_API_KEY` ✅ configuré (rotation faite 13 mai)
- **Cache** : 1 heure
- **Coût** : Free tier Pappers 100 req/mois (suffisant Bêta)
- **Test santé** :
  ```bash
  curl https://ikcp-pappers.maxime-ead.workers.dev/health
  # → "configured": { "api_key": true, "cache_kv": true }
  ```

### 2. ikcp-chat · Marcel (chef d'orchestre)

- **URL** : https://ikcp-chat.maxime-ead.workers.dev
- **Modèle** : `claude-sonnet-4-6`
- **Endpoints** :
  - `GET /health` · ping
  - `POST /` · `{ message, history }` → `{ reply, web_search_used, season }`
- **Bindings** :
  - `MARCEL_LOGS` (KV) → ID `64d10977135f400783a7e66f119c7b4f`
- **Secrets** :
  - `ANTHROPICAPIKEY` ✅ configuré
- **Tools intégrés** : calc_impot_revenu · calc_droits_succession · calc_donation · calc_ifi · calc_dutreil · web_search Anthropic natif
- **Conformité MIF II** : ✅ tests 13 mai (3/3 passés, refus Tesla validé)

### 3. ikcp-codex · sub-agent fiscal expert

- **URL** : https://ikcp-codex.maxime-ead.workers.dev
- **Modèle** : `claude-opus-4-7`
- **Endpoints** :
  - `GET /health` · ping
  - `POST /` · `{ question, context? }` → `{ reply, agent, model, usage, delegated_by }`
- **Secrets** :
  - `ANTHROPICAPIKEY` ✅ configuré (clé dédiée, recommandé : créer une 2e clé Anthropic uniquement pour Codex)
- **Bindings** : aucun (stateless)
- **Coût indicatif** : ~0,15 € par question complexe (Opus 4.7)
- **Test santé** :
  ```bash
  curl https://ikcp-codex.maxime-ead.workers.dev/health
  # → "agent": "Codex", "model": "claude-opus-4-7", "configured": { "api_key": true }
  ```

### 4. ikcp-temoin · audit log MIF II

- **URL** : https://ikcp-temoin.maxime-ead.workers.dev
- **Endpoints** :
  - `GET /health` · ping + statut bindings
  - `POST /log` · enregistre une interaction (hash SHA-256 + D1)
  - `GET /retrieve/:hash` · lit une entrée par hash
  - `GET /audit?family_id=...` · audit trail d'une famille (admin token requis)
- **Bindings** :
  - `IKCP_TEMOIN_DB` (D1) → ID `1205cae0-659e-4dfd-9846-06053ef3b0cb` · région WEUR (Paris CDG)
- **Secrets** :
  - `IKCP_ADMIN_TOKEN` ✅ configuré (sauvegardé Bitwarden Maxime)
- **R2 bucket** : ⏸ pas activé (R2 service à activer manuellement Dashboard Cloudflare → Storage → R2)
- **Schéma D1** : table `audit_log` (id, hash, family_id, timestamp, universe, question, answer_summary, agent, model, tokens, sources, mif2_compliant)
- **Rétention** : permanente en D1 · 10 ans en R2 (quand activé)

### 5. ikcp-batisseur · Patrimoine 360° (⏳ PRÊT — en attente deploy + secret)

- **URL cible** : https://ikcp-batisseur.maxime-ead.workers.dev
- **Modèle** : `claude-opus-4-7`
- **Endpoints** :
  - `GET /health` · ping + `configured: { api_key: true/false }`
  - `POST /` · `{ question, context? }` → `{ reply, agent, model, usage, delegated_by }`
- **Secrets requis** :
  - `ANTHROPICAPIKEY` ❌ non configuré — **ACTION : `cd workers/ikcp-batisseur && npx wrangler secret put ANTHROPICAPIKEY`**
- **Bindings** : aucun (stateless)
- **Délégation** : Marcel active `batisseur` quand `live: true` dans SPECIALISTS_REGISTRY
- **Flip live** : `workers/ikcp-marcel/worker.js` → `batisseur: { ..., live: true }`

### 6. ikcp-hermes · Transmission patrimoniale (⏳ PRÊT — en attente deploy + secret)

- **URL cible** : https://ikcp-hermes.maxime-ead.workers.dev
- **Modèle** : `claude-opus-4-7`
- **Endpoints** : idem batisseur
- **Secrets requis** :
  - `ANTHROPICAPIKEY` ❌ non configuré — **ACTION : `cd workers/ikcp-hermes && npx wrangler secret put ANTHROPICAPIKEY`**
- **Délégation** : Marcel active `hermes` quand `live: true` dans SPECIALISTS_REGISTRY

### 7. ikcp-lifestyle · 12 agents Sonnet mutualisés (⏳ PRÊT — en attente deploy + secret)

- **URL cible** : https://ikcp-lifestyle.maxime-ead.workers.dev
- **Modèle** : `claude-sonnet-4-6` (tous les agents)
- **Agents disponibles** dans `prompts.js` : `iris`, `emile`, `leon`, `josephine`, `helene`, `olympe`, `auguste`, `augustin`, `stratege`, `curateur`, `capital`, `pedagogue`, `camille`
- **Endpoint** : `POST /` · `{ agent: "<key>", question, context? }`
- **Secrets requis** :
  - `ANTHROPICAPIKEY` ❌ non configuré — **ACTION : `cd workers/ikcp-lifestyle && npx wrangler secret put ANTHROPICAPIKEY`**
- **Marcel → lifestyle** : via `agentKey` dans SPECIALISTS_REGISTRY (ex. `architecte` → `augustin`)

### 8. ikcp-veille · Veille Perplexity Pro (⏳ PRÊT — en attente deploy + secrets)

- **URL cible** : https://ikcp-veille.maxime-ead.workers.dev
- **Endpoint** : `POST /search` · `{ query, mode: 'quick'|'deep', user_id, tier }`
- **Secrets requis** :
  - `PERPLEXITY_API_KEY` ❌ non configuré
  - `CLIENT_AUTH_PUBKEY` ❌ non configuré
- **Quota** : par utilisateur, journalier (quick: 10/j, deep: 3/j)

---

### 9. ikcp-universign · signature eIDAS (PAUSE)

- **Code** : présent dans `workers/ikcp-universign/`
- **Statut** : ⏸ pas déployé (Maxime a mis en pause Universign le 13 mai)
- **À reprendre** : quand souscription Universign Pro activée

### 6. ikcp-client · magic link + Stripe (existant)

- **URL** : à vérifier (déployé avant 13 mai 2026)
- **Statut** : à auditer prochainement

### 7. ikcp-prospect · capture prospects (existant)

- **URL** : à vérifier
- **Statut** : à auditer

---

## 🗄 Ressources Cloudflare créées

### KV Namespaces

| Nom | ID | Usage |
|---|---|---|
| `PAPPERS_CACHE` | `dabb785927cc4715bf3374cc0cbb9578` | Cache fiches Pappers 1h |
| `MARCEL_LOGS` | `64d10977135f400783a7e66f119c7b4f` | Logs Marcel anonymisés |
| `marcel-cache` | `1f37030252fb4adda942da92a23a5e22` | Cache Marcel responses |
| `marcel-config` | `08ff500eb66744139c09d083f3723d65` | Config Marcel runtime |
| `IKCP_SESSIONS` | `a49ebe05d2a74931a004f94e478b1cc0` | Sessions client (existant) |
| `IKCP_SHORTLINKS` | `8d81b0b2d939430b90fd70d1abd3c79e` | Liens courts (existant) |
| `CLIENTS` | `32533bafcd804efcb576a2624350e669` | (existant) |
| `LICENSES` | `2f0c9eb69a704bc1b94a993b928eb056` | (existant) |
| `ikcp-prospect-IDEMPOTENCY` | `74bdfd3c46a643b39d40247f64b6393d` | (existant) |
| `ikcp-prospect-RATE_LIMIT` | `b432d188bcf14fc49c9933796c27f0bb` | (existant) |
| `PROXY_LOG` | `fd88808210144457844b710a6f654cbe` | (existant) |
| `PROXY_RATE` | `34fcab0e990248bc93eb8a29ea0eda5f` | (existant) |
| `findmymcp-cache` | `7f92407438ac42aca59172ee096de8a4` | (autre projet) |

### D1 Databases

| Nom | UUID | Région | Usage |
|---|---|---|---|
| `ikcp_temoin_db` | `1205cae0-659e-4dfd-9846-06053ef3b0cb` | WEUR (Paris) | Audit log Témoin |
| `marcel-audit` | `5ce24454-e642-4d14-bdc8-b688ce53a8d9` | WEUR | Marcel audit (existant) |
| `findmymcp-db` | `babb3c6e-00f5-4305-954d-a9d3e5a4953e` | WEUR | (autre projet) |

### R2 Buckets

⏸ **R2 pas activé sur le compte** (à activer manuellement Dashboard Cloudflare → Storage → R2 → Get Started).
Une fois activé, créer : `ikcp-temoin` (audit archive 10 ans).

---

## 🔑 Secrets configurés (sans les valeurs, par sécurité)

### Worker `ikcp-pappers`
- `PAPPERS_API_KEY` ✅ (rotation 13 mai 2026)

### Worker `ikcp-chat` (Marcel)
- `ANTHROPICAPIKEY` ✅

### Worker `ikcp-codex`
- `ANTHROPICAPIKEY` ✅ (clé dédiée Codex)

### Worker `ikcp-temoin`
- `IKCP_ADMIN_TOKEN` ✅ (sauvegardé Bitwarden)

### Workers `ikcp-client` / `ikcp-prospect`
- À auditer

---

## 💰 Crédit Anthropic

- **Initial** : 25 $
- **Consommé Sprint 1** (~0,80 $ : 3 tests Marcel + 2 tests Codex + tests divers)
- **Restant** : ~24,20 $
- **Projection 50 clients × 1 mois** : ~7 €/mois (Marcel seul) + ~3 €/mois (délégations Codex) = **10 €/mois pour 50 clients**

→ Le crédit actuel couvre **2 ans** pour 50 clients réels. Très confortable.

---

## 📊 Pappers — quota

- **Plan** : Free 100 req/mois
- **Cache** : 1h par SIREN (réduit fortement les appels)
- **Estimation 50 clients** : 50 × 1 cartographie initiale + 50 × ~5 mises à jour mois = 300 appels/mois
- **Action recommandée** : passer plan payant ~30 €/mois (illimité) dès 30+ clients

---

## 🌐 DNS et domaines

- **ikcp.eu** : DNS chez **Hostinger** (pas Cloudflare) · Hébergement migré vers Cloudflare Pages `ikcp-eu`
  - ⚠️ **ACTION REQUISE** : mettre à jour le DNS Hostinger (voir ci-dessous)
  - En attendant : site live sur https://ikcp-eu.pages.dev (code à jour, Marcel fonctionnel)
- **ikcp.fr** : à mapper → redirection 301 vers ikcp.eu
- **api.ikcp.eu** (à mapper) : sous-domaine pour exposer les workers en custom domain
  - `api.ikcp.eu/pappers/*` → ikcp-pappers
  - `api.ikcp.eu/marcel/*` → ikcp-chat
  - `api.ikcp.eu/codex/*` → ikcp-codex
  - `api.ikcp.eu/temoin/*` → ikcp-temoin

### 🔧 Basculer ikcp.eu vers Cloudflare Pages (action manuelle Hostinger)

1. Se connecter sur hPanel Hostinger → Domaines → ikcp.eu → DNS Zone Editor
2. Supprimer l'enregistrement A actuel qui pointe vers l'hébergement Hostinger
3. Ajouter un enregistrement CNAME :
   - Type : CNAME
   - Name : @ (ou ikcp.eu)
   - Value : `ikcp-eu.pages.dev`
   - TTL : 300
4. Si CNAME sur apex non supporté → utiliser un enregistrement ALIAS/ANAME
5. Attendre propagation DNS (5-60 min)
6. Le domaine personnalisé dans Pages se validera automatiquement

### 📦 Cloudflare Pages — projet `ikcp-eu`

- **URL preview** : https://ikcp-eu.pages.dev (✅ LIVE · code à jour)
- **Projet** : `ikcp-eu` (créé le 19 mai 2026)
- **Branche production** : `main`
- **Auto-deploy** : GitHub Actions `.github/workflows/deploy-pages.yml` (sur push main)
- **Domaine custom** : `ikcp.eu` (⏳ en attente mise à jour DNS Hostinger)

---

## 🧪 Test rapide infra (commandes copiables)

```bash
# Test global infra
echo "=== Pappers ==="; curl -s https://ikcp-pappers.maxime-ead.workers.dev/health
echo ""
echo "=== Marcel ===";  curl -s https://ikcp-chat.maxime-ead.workers.dev/health
echo ""
echo "=== Codex ===";   curl -s https://ikcp-codex.maxime-ead.workers.dev/health
echo ""
echo "=== Temoin ===";  curl -s https://ikcp-temoin.maxime-ead.workers.dev/health
```

Tous doivent retourner `"status": "ok"` + `configured` à `true` pour les secrets requis.

---

## 🚦 Checklist santé infra (à faire chaque semaine)

- [ ] Tous les workers répondent `200 OK` sur `/health`
- [ ] Tous les secrets configurés sont `true` dans `/health`
- [ ] Crédit Anthropic restant > 5 $ (sinon recharger)
- [ ] Quota Pappers consommé < 80 % (sinon passer plan payant)
- [ ] Logs Cloudflare `tail` : pas d'erreurs récurrentes
- [ ] Backup OneDrive .claude + IKCP-OS quotidien OK (script PS planifié)

---

## 📞 Contacts / accès

- **Compte Cloudflare** : maxime@ikcp.fr
- **Compte Anthropic Console** : maxime@ikcp.fr · 25 $ crédit initial
- **Compte Pappers** : à vérifier dashboard
- **Compte Bitwarden** : pour stocker tokens admin (à mettre en place si pas fait)

---

## 🔄 Procédure restauration en cas de perte

Si un worker ou une ressource est perdue :

1. Le code est sur GitHub : `git clone https://github.com/Max51527/ikcp-site.git`
2. Suivre `docs/SPRINT-1-DEPLOY.md` pour redéployer les workers
3. Re-uploader les secrets (depuis Bitwarden)
4. Les KV/D1 IDs changent → mettre à jour les `wrangler.toml` correspondants
5. Données D1 perdues → si pas de backup R2, perte définitive (à éviter via R2 quand activé)

**Backup OneDrive Maxime** : sauvegarde quotidienne 22h du dossier complet `ikcp-site/` (script PS).

---

**Document maintenu à jour à chaque déploiement** © 2026 IKCP
