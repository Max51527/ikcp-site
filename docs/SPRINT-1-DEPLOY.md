# Sprint 1 · Guide de déploiement réel

> **Objectif** : passer de mockup à production en 5-7 jours.
> Tous les workers Cloudflare prêts à déployer, RGPD souverain France, testables en réel.

---

## 🎯 Ce que Sprint 1 vous donne

Au bout du Sprint 1, vous avez **4 services live** :

| Worker | Rôle | Bloquant pour |
|---|---|---|
| `ikcp-pappers` | Cartographie SIREN réelle via RNE | Funnel Marcel (saisie SIREN visiteur) |
| `ikcp-marcel` | Agent IA conversationnel patrimonial | Conseil Premium (290 €/mois) |
| `ikcp-temoin` | Audit log immutable MIF II + eIDAS | Conformité juridique cabinet |
| `ikcp-universign` | Signature électronique souveraine | Lettre de mission Premium / Sur-mesure |

Plus une **page test-harness** (`proposals/test-harness.html`) qui valide chaque worker en réel.

---

## 📋 Prérequis (1 jour)

### 1. Comptes à créer / vérifier

| Service | URL | Coût | Action |
|---|---|---|---|
| Cloudflare | https://dash.cloudflare.com | gratuit pour démarrer | Compte Pro recommandé (5 $/mois) pour Workers Paid + Regional Services EU |
| Anthropic Console | https://console.anthropic.com | Pay-as-you-go | Activer crédit 50 $ initial · clé API `sk-ant-...` |
| Pappers | https://www.pappers.fr/api | Free 100 req/mois | Compte → générer une API key |
| Universign Pro (Dhimyotis) | https://www.universign.eu/professionnel/ | Pack à choisir | Souscription pack "Qualified" eIDAS · récupérer `api_key` + `profile_id` |
| Brevo (emails) | https://www.brevo.com | Free 300 emails/jour | Compte FR · récupérer SMTP API key |
| Stripe | https://dashboard.stripe.com | 1,4 % + 0,25 €/transac EU | Activer compte FR · KYC complet |

### 2. Installer wrangler CLI (Cloudflare)

```bash
# Sur Windows PowerShell
npm install -g wrangler

# Vérifier
wrangler --version  # ≥ 3.0
```

---

## 🚀 Déploiement (5-7 jours)

### Jour 1 — Cloudflare + Pappers

```bash
# 1.1 Login Cloudflare
wrangler login

# 1.2 Aller dans le dossier worker
cd "C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-pappers"

# 1.3 Créer le KV namespace pour le cache
wrangler kv namespace create PAPPERS_CACHE
# → copier l'ID retourné dans wrangler.toml ligne `id = "..."`

# 1.4 Ajouter votre clé Pappers
wrangler secret put PAPPERS_API_KEY
# → coller votre clé API Pappers

# 1.5 Déployer
wrangler deploy
# → URL : https://ikcp-pappers.<votre-subdomain>.workers.dev

# 1.6 Tester
curl https://ikcp-pappers.<votre-subdomain>.workers.dev/health
curl https://ikcp-pappers.<votre-subdomain>.workers.dev/entreprise/947972436
```

✅ **Critère réussite** : la fiche IKCP s'affiche en JSON.

---

### Jour 2 — Marcel (agent IA)

```bash
cd "C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-marcel"

# 2.1 (Optionnel) KV logs
wrangler kv namespace create MARCEL_LOGS

# 2.2 Clé Anthropic
wrangler secret put ANTHROPICAPIKEY
# → coller votre sk-ant-... depuis console.anthropic.com

# 2.3 Déployer
wrangler deploy

# 2.4 Tester (depuis ligne de commande)
curl -X POST https://ikcp-marcel.<votre-subdomain>.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"message":"Quel est le barème IR 2026 pour 120 000 € avec 2 parts ?","history":[]}'
```

✅ **Critère réussite** : Marcel répond avec un calcul IR chiffré + question MIF II.

---

### Jour 3 — Témoin (audit log)

```bash
cd "C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-temoin"

# 3.1 Créer la base D1 à Paris
wrangler d1 create ikcp_temoin_db --location weur
# → copier le database_id dans wrangler.toml

# 3.2 Créer le bucket R2 EU
wrangler r2 bucket create ikcp-temoin --location eu

# 3.3 Initialiser le schéma D1
wrangler d1 execute ikcp_temoin_db --remote --file=schema.sql

# 3.4 Token admin (générer puis stocker)
openssl rand -hex 32
# → copier le résultat
wrangler secret put IKCP_ADMIN_TOKEN
# → coller le token

# 3.5 Déployer
wrangler deploy

# 3.6 Tester
curl https://ikcp-temoin.<votre-subdomain>.workers.dev/health
```

✅ **Critère réussite** : `configured.d1: true` et `configured.r2: true`.

---

### Jour 4 — Universign (signature eIDAS)

⚠ **Pré-requis** : compte Universign Pro actif avec pack Qualified souscrit.

```bash
cd "C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-universign"

# 4.1 D1
wrangler d1 create ikcp_universign_db --location weur
# → copier database_id

# 4.2 Schema
wrangler d1 execute ikcp_universign_db --remote --file=schema.sql

# 4.3 Secrets
wrangler secret put UNIVERSIGN_API_KEY
wrangler secret put UNIVERSIGN_PROFILE_ID

# 4.4 Deploy
wrangler deploy

# 4.5 Test health
curl https://ikcp-universign.<votre-subdomain>.workers.dev/health
```

✅ **Critère réussite** : `configured.api_key: true` + `configured.profile_id: true`.

---

### Jour 5 — Domaines + Regional Services EU

```bash
# 5.1 Mapper les workers à vos sous-domaines ikcp.eu
# Dashboard Cloudflare → Workers & Pages → ikcp-pappers → Triggers → Custom Domains
# Ajouter :
#   api.ikcp.eu/pappers/*    → ikcp-pappers
#   api.ikcp.eu/marcel/*     → ikcp-marcel
#   api.ikcp.eu/temoin/*     → ikcp-temoin
#   api.ikcp.eu/universign/* → ikcp-universign

# 5.2 Activer Regional Services EU
# Dashboard Cloudflare → Network → Data Localization Suite
# Activer "Regional Services" zone "EU only"
# Coût additionnel ~50 €/mois mais critique pour RGPD souverain
```

---

### Jour 6-7 — Test harness + intégration front

1. Ouvrir `proposals/test-harness.html` dans le navigateur
2. Remplir les URLs des workers en haut de page
3. Lancer les 7 tests dans l'ordre
4. **Tous doivent passer en vert**

Si OK → intégrer aux pages front-end :
- `marcel-funnel.html` → remplacer le SIREN mock par appel `ikcp-pappers`
- `univers-demandez-moi.html` → idem
- Marcel chat → appeler `ikcp-marcel` au lieu des bulles statiques

---

## 🧪 Validation finale Sprint 1

Avant d'ouvrir aux bêta-testeurs, cochez :

- [ ] `ikcp-pappers/health` répond OK
- [ ] `ikcp-pappers/entreprise/947972436` retourne la fiche IKCP réelle
- [ ] `ikcp-marcel/health` répond OK
- [ ] Marcel répond à une question patrimoniale avec calcul chiffré
- [ ] Marcel termine sa réponse par une question (MIF II)
- [ ] `ikcp-temoin/health` → `d1:true, r2:true`
- [ ] `ikcp-temoin/log` enregistre une entrée test dans D1 (visible dans Dashboard)
- [ ] `ikcp-universign/health` → `api_key:true, profile_id:true`
- [ ] Test envoi d'une signature électronique sur 1 PDF de test
- [ ] Regional Services EU activé (zone Cloudflare = "EU only")
- [ ] Sous-domaines `api.ikcp.eu/*` mappés et HTTPS OK
- [ ] CORS strict : seul ikcp.eu et localhost dans `ALLOWED_ORIGINS`

Si **les 12 cases sont vertes**, vous êtes prêt à encaisser votre premier client Premium.

---

## 💰 Coût mensuel réel Sprint 1 (sans clients)

| Poste | Mensuel |
|---|---|
| Cloudflare Workers Paid Plan | 5 $ |
| Cloudflare Regional Services EU | ~50 € |
| D1 + R2 | ~5 € |
| Pappers Free | 0 € |
| Anthropic API (tests + 5 clients) | ~10 € |
| Universign (5 signatures test) | 4 € |
| Brevo Free | 0 € |
| **TOTAL** | **~75 €/mois** |

À 1 seul client Premium qui souscrit (290 €/mois), vous êtes **déjà rentable** sur l'infra.

---

## 🔐 Sécurité — les 5 secrets critiques

| Secret | Stocké dans | Jamais commiter |
|---|---|---|
| `PAPPERS_API_KEY` | wrangler secret | ❌ jamais dans worker.js |
| `ANTHROPICAPIKEY` | wrangler secret | ❌ |
| `UNIVERSIGN_API_KEY` | wrangler secret | ❌ |
| `UNIVERSIGN_PROFILE_ID` | wrangler secret | ❌ |
| `IKCP_ADMIN_TOKEN` | wrangler secret | ❌ |

**Règle d'or** : si un secret apparaît en clair dans le code ou un .env commité, considérer compromis et regénérer.

---

## 🐛 Troubleshooting fréquent

| Symptôme | Cause probable | Fix |
|---|---|---|
| `404 SIREN not found` | Mauvais SIREN ou Pappers down | Vérifier sur pappers.fr |
| `502 pappers_upstream_error` | Quota Pappers Free dépassé | Passer plan payant 30 €/mois |
| Marcel ne répond pas | Clé Anthropic invalide ou crédit 0 | Vérifier console.anthropic.com → Billing |
| `CORS error` dans la console front | Origin pas dans `ALLOWED_ORIGINS` | Ajouter votre domaine dans worker.js |
| D1 `database not found` | `database_id` mal copié | Refaire `wrangler d1 list` |
| Universign 401 | API key ou profile_id invalide | Re-générer dans Universign Pro |

---

## 📞 Support

- Cloudflare : https://community.cloudflare.com
- Anthropic : https://docs.anthropic.com + support@anthropic.com
- Pappers : support@pappers.fr
- Universign : support@universign.eu (réactif FR)

---

**Sprint 1 prêt à lancer. Reste à exécuter.** © 2026 IKCP
