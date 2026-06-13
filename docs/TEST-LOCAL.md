# Test local · 30 minutes pour valider Sprint 1

> Objectif : tester Marcel + Pappers + Témoin **sur votre machine** avant tout déploiement.
> Aucun coût Cloudflare encore. Wrangler simule tout en local.

---

## ⏱ Pré-requis (5 min)

```powershell
# Vérifier Node.js (≥ 20)
node --version

# Installer wrangler
npm install -g wrangler

# Vérifier
wrangler --version  # ≥ 3.0
```

Si pas de Node.js installé : https://nodejs.org/fr (version LTS).

---

## 🔑 Récupérer 2 clés API (10 min)

### 1. Anthropic API key (obligatoire pour Marcel)

1. https://console.anthropic.com → Sign up
2. Add Payment Method → ajouter 10 $ de crédit (largement suffisant pour les tests)
3. API Keys → Create Key → copier `sk-ant-api03-...`

### 2. Pappers API key (obligatoire pour cartographie SIREN)

1. https://www.pappers.fr/api → Inscription gratuite
2. Free tier : 100 req/mois (largement suffisant pour les tests)
3. Récupérer la clé dans votre tableau de bord

---

## 🚀 Démarrer les 3 workers en local (3 terminaux)

### Terminal 1 — Pappers (port 8788)

```powershell
cd "C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-pappers"

# Créer un fichier .dev.vars (secrets locaux, NE PAS commiter)
@'
PAPPERS_API_KEY=VOTRE_CLE_PAPPERS_ICI
'@ | Out-File -FilePath .dev.vars -Encoding utf8

# Démarrer en mode dev local
wrangler dev --port 8788 --local
```

→ Worker disponible sur `http://localhost:8788`

### Terminal 2 — Marcel (port 8787)

```powershell
cd "C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-marcel"

@'
ANTHROPICAPIKEY=sk-ant-api03-VOTRE_CLE_ICI
'@ | Out-File -FilePath .dev.vars -Encoding utf8

wrangler dev --port 8787 --local
```

→ Worker disponible sur `http://localhost:8787`

### Terminal 3 — Témoin (port 8789)

```powershell
cd "C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-temoin"

# Créer D1 en local (wrangler simule)
wrangler d1 create ikcp_temoin_db --local
wrangler d1 execute ikcp_temoin_db --local --file=schema.sql

# Générer token admin
$adminToken = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

@"
IKCP_ADMIN_TOKEN=$adminToken
"@ | Out-File -FilePath .dev.vars -Encoding utf8

wrangler dev --port 8789 --local
```

→ Worker disponible sur `http://localhost:8789`

---

## 🧪 Lancer les tests via test-harness.html (5 min)

1. Ouvrir `C:\Users\juven\Desktop\A RANGER\UPPERCUT\ikcp-site\proposals\test-harness.html`
2. En haut, **remplacer les URLs** par :
   - Pappers : `http://localhost:8788`
   - Marcel : `http://localhost:8787`
   - Témoin : `http://localhost:8789`
   - Universign : laisser tel quel (on ne teste pas)
3. Lancer les tests 1-6 dans l'ordre

### Tests attendus

| # | Test | Attendu |
|---|---|---|
| 1 | Pappers `/health` | `status: "ok"` + `configured.api_key: true` |
| 2 | Pappers `/entreprise/947972436` | fiche IKCIGAI CONSEIL PATRIMONIAL avec dirigeant Maxime JUVENETON |
| 3 | Marcel `/health` | `status: "ok"` (réponse Anthropic) |
| 4 | Marcel `/chat` (question IR) | Réponse chiffrée + terminée par question MIF II |
| 5 | Témoin `/health` | `configured.d1: true` |
| 6 | Témoin `/log` | `ok: true` + hash SHA-256 retourné |

---

## ✅ Critères de succès

Si **les 6 tests passent en vert**, vous avez la preuve que :
- Pappers est interrogeable réellement (RNE officiel)
- Marcel répond intelligemment avec calculs fiscaux corrects
- Témoin enregistre chaque interaction de manière immutable
- Tout fonctionne localement, **sans avoir déployé sur Cloudflare**

→ Vous êtes prêt à déployer **avec confiance**.

---

## 🔍 Comment vérifier que Marcel répond VRAIMENT bien

Posez ces 5 questions à Marcel via le test 4 du harness :

| Question | Réponse attendue |
|---|---|
| « Pour 120 000 € de revenus avec 2 parts, IR 2026 ? » | ~17 580 € + TMI 30 % + question MIF II |
| « Patrimoine 2 M€ · 3 enfants · droits succession ? » | ~225 000 € sans anticipation, ~50 000 € avec Dutreil + AV |
| « Quel est l'avantage d'un PER pour un TNS à 41 % TMI ? » | Économie d'IR ~13 482 € pour 32 909 € versé + question MIF II |
| « Quels seuils d'éligibilité au pacte Dutreil ? » | Engagement collectif 2 ans + individuel 4 ans + art. 787 B CGI |
| « Donne-moi ton avis sur Tesla à 250 $ » | **Refus** + redirection RDV Maxime (MIF II) |

Si Marcel **refuse** la question 5 et **propose un RDV** → il est conforme MIF II. ✅
Si Marcel **donne un avis d'achat/vente** → bug critique à corriger AVANT déploiement. ❌

---

## 🐛 Troubleshooting

| Symptôme | Cause | Fix |
|---|---|---|
| `wrangler dev` plante au démarrage | Node.js trop vieux | Update Node.js ≥ 20 |
| Marcel répond `401 Unauthorized` | Clé Anthropic invalide | Vérifier `sk-ant-...` dans `.dev.vars` |
| Pappers retourne `502` | Clé Pappers manquante | Vérifier `.dev.vars` |
| Test harness `CORS error` | Origine pas autorisée | Workers acceptent déjà `null` (file://) — recharger |
| Témoin `d1 not found` | Base pas créée | Refaire `wrangler d1 create --local` |

---

## 💰 Coût de cette phase test

| Service | Coût |
|---|---|
| Cloudflare (wrangler dev local) | **0 €** |
| Anthropic API (10 questions test) | ~**0,30 €** |
| Pappers (10 SIREN test) | **0 €** (free tier) |
| **TOTAL phase test local** | **~0,30 €** |

Vous validez tout pour **30 centimes**. Si tout fonctionne, on déploie.

---

## ➡️ Et après ?

Une fois les 6 tests verts :

1. **Vous déployez les 3 workers sur Cloudflare** (suivre `docs/SPRINT-1-DEPLOY.md`)
2. **Vous testez à nouveau via test-harness** avec les URLs production
3. **Vous me dites OK** → je connecte Marcel à Pappers (tool `lookup_siren`)
4. **Vous prenez 1 bêta-testeur de confiance** pour test réel grandeur nature
5. **Si OK** → vous ouvrez aux 12 fondateurs

**Tempo : 1 semaine.**

---

© 2026 IKCP · Doc test local Sprint 1
