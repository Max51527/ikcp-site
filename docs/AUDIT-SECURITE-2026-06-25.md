# Audit complet — sécurité · opérationnel · prêt-Android (25 juin 2026)

> Audit avant bêta + publication Google Play. 3 auditeurs (workers, frontend, Android) + tests live.
> Convention : 🔴 CRITIQUE · 🟠 HIGH · 🟡 MEDIUM · ⚪ LOW · ✅ corrigé · ⏳ à faire (action Maxime ou batch suivant).

---

## 0. AUDIT OPÉRATIONNEL (tests live)

| Brique | État | Note |
|---|---|---|
| **Marcel (conversation)** | 🔴 **EN PANNE** | renvoie `sovereign_unavailable` → moteur Mistral KO. **Clé `MISTRAL_API_KEY` périmée/absente sur `ikcp-chat`** (reposée seulement sur `ikcp-patrimoine`). |
| Sous-agents (codex…) | ⏳ à vérifier | `/health` OK mais même risque de clé périmée → reposer la clé partout. |
| OCR / Mistral (patrimoine) | ✅ | clé OK (répond « fichier manquant » = passe le check clé). |
| Pappers (data société) | ✅ | répond 200. |
| Moteur pistes (`/opportunites`) | ✅ | répond 200 + disclaimer. |
| Voix souveraine (`/tts`) | ✅ | 151 Ko audio/wav. |

**ACTION MAXIME #1 (débloque le test) :** reposer `MISTRAL_API_KEY` (la nouvelle clé) sur **tous** les workers qui l'utilisent :
`ikcp-chat`, `ikcp-codex`, `ikcp-hermes`, `ikcp-batisseur`, `ikcp-lifestyle` (et vérifier `ikcp-veille` = Perplexity).
```
cd workers/ikcp-chat && npx wrangler secret put MISTRAL_API_KEY   # idem pour chaque worker
```

---

## 1. SÉCURITÉ WORKERS — note initiale 4/10

**Trou systémique :** la plupart des workers traitent l'allowlist CORS comme une autorisation. **Faux** : CORS n'est appliqué que par le navigateur ; un `curl` l'ignore. Résultat : endpoints LLM payants + journal MIF II ouverts à l'abus direct.

| # | Faille | Fichier | Sévérité | État |
|---|---|---|---|---|
| C1 | Sous-agents `POST /` **sans auth** → vidage crédit IA | `ikcp-*/worker.js` | 🔴 | ✅ codex/hermes/batisseur verrouillés (INTERNAL_TOKEN, fail-open → activer le secret) · ⏳ lifestyle (appelé aussi par collections.html → jeton membre) |
| C2 | `ikcp-voice` `/tts` `/stt` sans auth → abus Workers AI | `ikcp-voice` | 🔴 | ⏳ |
| C3 | `ikcp-veille` `/search` lit `tier`/`user_id` du **body** → contournement gating payant + IDOR quota | `ikcp-veille` | 🔴 | ⏳ |
| C4 | `ikcp-temoin` `/log` + `/retrieve/:hash` sans auth → pollution/fuite audit MIF II | `ikcp-temoin` | 🔴 | ⏳ |
| H1 | Marcel : quota anonyme inexistant + `MARCEL_GLOBAL_CAP` off par défaut (fail-open) | `ikcp-marcel` | 🟠 | ⏳ poser le cap |
| H2 | `ikcp-feedback` `POST /feedback` sans rate-limit → spam LLM + email | `ikcp-feedback` | 🟠 | ⏳ |
| H3 | CORS credentialed reflète `*.workers.dev`/`*.pages.dev`/`ikcp.fr` avec `Allow-Credentials:true` → vol données de session | `ikcp-client`, `ikcp-marcel` | 🟠 | ⏳ restreindre allowlist exacte |
| H4 | `ikcp-powens` IDOR total (`?user=`) sur données bancaires | `ikcp-powens` | 🟠 | ⏳ **avant** activation Powens |
| M1-M5 | OCR/finance non-auth, fallback admin, postMessage CMS `"*"`, fuites d'erreur, comparaison token non constante | divers | 🟡 | ⏳ |

**✅ Points sains :** webhook Stripe (HMAC constant-time + idempotent), **zéro injection SQL** (tout en `prepare().bind()`), **zéro secret en dur**, anti-IDOR correct sur le coffre patrimonial (`ikcp-patrimoine`), `keep_vars` généralisé, minimisation RGPD.

---

## 2. SÉCURITÉ FRONTEND — note initiale 4/10

| # | Faille | Fichier | Sévérité | État |
|---|---|---|---|---|
| F-C1 | XSS via sortie IA/web dans la veille (`markdownToHtml` + sources sans échappement) → **vol de jeton** | `app/veille.html` | 🔴 | ✅ **CORRIGÉ** |
| F-C2 | XSS via sortie IA dans le bouton « Écouter » de Marcel (interpolation `onclick`) | `app/marcel.html` | 🔴 | ✅ **CORRIGÉ** (lit depuis l'objet JS) |
| F-H1 | XSS stockée via `b.photo` du cockpit (synchro serveur) | `app/patrimoine.html` | 🟠 | ✅ **CORRIGÉ** (URL validée https/data + nettoyée) |
| F-H2 | Jeton admin passé en `?token=` (logs/historique/Referer) | `app/console.html`, `app/beta.html` | 🟠 | ⏳ batch (passer en en-tête — nécessite MAJ worker) |
| F-M1 | Aucune CSP | toutes pages | 🟡 | ✅ **CORRIGÉ** (`_headers` : CSP + connect-src verrouillé + anti-clickjacking) |
| F-M2 | Patrimoine + jeton en clair dans localStorage | plusieurs | 🟡 | ⏳ purger au logout |
| F-M3 | Chart.js CDN sans SRI | `simulateurs-pro.html` | 🟡 | ⏳ épingler version + SRI ou self-host |
| F-L1 | `OWNER_HASHES` côté client | gestion/pilotage | ⚪ | risque faible (serveur re-vérifie) |

---

## 3. PRÊT-POUR-ANDROID (TWA) — ~90% prêt

✅ EXISTE : manifest `/app/manifest.json` (standalone, scope `/app/`), icônes 192+512 (maskable), `.well-known/assetlinks.json` (package `eu.ikcp.app`), service worker, viewport/theme-color, HTTPS.

⚠️ 3 points à traiter :
- **#A — deux manifests** : viser EXACTEMENT `https://ikcp.eu/app/manifest.json` au build (pas le manifest racine).
- **#B — maskable** : vérifier l'emblème dans la safe-zone sur maskable.app.
- **#C — Play App Signing (piège n°1)** : Google re-signe l'app → il faudra **ajouter le SHA-256 de la clé Play** dans `assetlinks.json` (garder les 2 empreintes) sinon la barre d'URL Chrome réapparaît.

**ACTION MAXIME :** sécuriser le `.keystore` qui a produit l'empreinte actuelle (sans lui, pas de mise à jour possible) → Bitwarden + OneDrive chiffré.

---

## 4. PLAN PRIORISÉ

1. 🔴 **Maxime** : reposer `MISTRAL_API_KEY` partout → Marcel revit (débloque le test).
2. ✅ **Fait** : XSS critiques frontend (F-C1, F-C2, F-H1) + CSP.
3. 🔴 **Batch workers** (à faire ensemble, nécessite 1 secret `INTERNAL_TOKEN`) : auth S2S sous-agents (C1), gating jeton sur `/tts`/`/stt` (C2) + veille (C3) + témoin (C4), verrou Powens (H4), `MARCEL_GLOBAL_CAP` (H1), CORS credentialed restreint (H3).
4. 🟡 Durcissements : F-H2 (token admin en en-tête), F-M2/M3, fuites d'erreur.
5. 📱 Android : build TWA sur `/app/`, double-empreinte assetlinks, fiche Play.

> Après le batch #3, posture sécurité estimée ~7,5-8/10. Le détail complet par finding est dans l'historique de session.
