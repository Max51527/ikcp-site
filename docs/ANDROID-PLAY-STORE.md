# Publier Marcel sur Google Play (TWA) — guide pas à pas

> État au 26 juin 2026 : **emballage technique 100% prêt** (manifest, icônes 192/512 maskable, assetlinks, service worker — tous vérifiés live sur ikcp.eu). Il reste 3 actions, toutes côté Maxime (compte Google requis).

## Pré-requis vérifiés ✅
- `https://ikcp.eu/app/manifest.json` → 200 (standalone, scope `/app/`, start_url `/app/dashboard.html`).
- `https://ikcp.eu/.well-known/assetlinks.json` → 200 application/json (package `eu.ikcp.app`, 1 empreinte).
- Icônes 192 + 512 (maskable) → 200 image/png.
- HTTPS + service worker OK.

## Étape 1 — Construire l'app (PWABuilder, ~10 min)
1. Aller sur **pwabuilder.com**.
2. Saisir **exactement** : `https://ikcp.eu/app/` → *Start*.
3. *Package For Stores* → **Android**.
4. Réglages (cliquer "All settings / Advanced") :
   - **Package ID** : `eu.ikcp.app`  *(doit matcher assetlinks)*
   - **App name** / **Launcher name** : `Marcel`
   - **Start URL** : `/app/dashboard.html` · **Scope** : `/app/`
   - **Display** : standalone · **Theme/Status bar** : `#1B2A4A` · **Background** : `#FAF7F0`
   - **Signing key** : *laisser PWABuilder en générer une* → **télécharger le `.zip`** (contient `signing.keystore` + identifiants).
5. Récupérer le **`.aab`** (à uploader sur Play) + le `assetlinks.json` généré (contient l'empreinte de CETTE clé).

> ⚠️ **Sauvegarder le `.keystore` + les identifiants** dans Bitwarden + OneDrive chiffré. Sans cette clé, **impossible de mettre à jour l'app** plus tard.

## Étape 2 — Google Play Console (25 $ une fois)
1. **play.google.com/console** → créer un compte développeur (25 $).
2. *Créer une application* → nom `Marcel`, catégorie **Finance**, gratuite.
3. *Production* (ou *Test fermé* pour la bêta) → uploader le **`.aab`**.

## Étape 3 — Lier le domaine (le piège n°1) 🔑
Google **re-signe** l'app avec SA clé (Play App Signing) → l'empreinte change → il faut l'ajouter.
1. Play Console → *Configuration → Intégrité de l'app* → copier le **SHA-256 de la clé "App signing key" de Google**.
2. Éditer `C:\Users\juven\ikcp-site\.well-known\assetlinks.json` → **ajouter cette 2ᵉ empreinte** dans `sha256_cert_fingerprints` (garder les deux : upload + Play).
3. `git add .well-known/assetlinks.json && git commit && git push` → Cloudflare redéploie.
4. Vérifier : ouvrir l'app installée → **pas de barre d'URL Chrome** = liaison OK.

## Fiche Play (à préparer, non bloquant pour le build)
- Politique de confidentialité : `https://ikcp.eu/rgpd` (ou /mentions) — existante.
- Déclaration *Data safety* : données hébergées France, magic-link, pas de pub, pas de revente.
- Visuels : icône 512, *feature graphic* 1024×500, ≥ 2 captures téléphone.

## Rappel sécurité avant d'ouvrir large
- Activer le verrou sous-agents : `powershell -ExecutionPolicy Bypass -File "C:\Users\juven\pose-internal-token.ps1"`.
- Voix + veille : déjà protégées par rate-limit IP.
- Reste (lifestyle, témoin, CORS, jeton membre) : lot « jeton membre » — à finir avant une diffusion massive.

---
© 2026 IKCP — guide vivant.
