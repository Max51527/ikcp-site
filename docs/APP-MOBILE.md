# 📱 Application mobile IKCP — roadmap en 2 phases

> Décision Maxime (2026-06-06) : **« les deux, en phases »**.
> On ne retarde pas la bêta — l'app installable part cette semaine ; la publication
> dans les stores vient après validation du 1ᵉʳ bêta-testeur (ami CGP).

---

## ✅ PHASE 1 — App installable « native-feel » (LIVE)

L'espace membre `/app` est une **vraie application installable**, sans store :

| Brique | État | Détail |
|---|---|---|
| Installable | ✅ | `manifest.json` (standalone, icônes 192/512 + maskable, raccourcis) |
| Plein écran | ✅ | `display: standalone` — pas de barre de navigateur |
| Barre d'onglets | ✅ | `app/js/appnav.js` — Accueil · Patrimoine · **Marcel** (bouton central) · Univers · Veille. Auto-injectée via `api.js`, exclut le chat immersif |
| Hors-ligne | ✅ | Service Worker `sw.js` v1.0.2 (cache app-shell + dernières pages) |
| Splash + chrome | ✅ | status bar navy `#1B2A4A`, splash icône |
| Notifications | ✅ (code) | `push` + `notificationclick` prêts — manque la clé VAPID + l'envoi serveur |
| Voix | ✅ | `voice.js` (dictée Marcel) |

**Comment installer (à tester ce week-end) :**
- **iPhone (Safari)** : ouvrir `ikcp.eu/app` → Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮ → « Installer l'application » (ou bannière auto).
- L'icône apparaît sur l'écran d'accueil, l'app s'ouvre plein écran avec la barre d'onglets.

---

## ✅ FAIT (2026-06-06) — APK Android construit EN LOCAL

Finalement, pas besoin de PWABuilder : l'APK a été **construit directement sur le PC**
(Bubblewrap + Gradle, JDK 17 + SDK Android téléchargés automatiquement).

| Élément | Détail |
|---|---|
| **APK signé** | `C:\Users\juven\Desktop\Marcel-IKCP-FamilyOffice.apk` (≈ 1,4 Mo) — à installer / envoyer |
| **AAB Play Store** | `C:\Users\juven\Desktop\Marcel-IKCP-PlayStore.aab` (pour publication store plus tard) |
| Package | `eu.ikcp.app` · versionName 1.0.0 · TWA ouvrant `ikcp.eu/app` |
| Empreinte SHA-256 | `83:F2:…:54` — injectée dans `/.well-known/assetlinks.json` (LIVE) → **pas de barre d'URL** |
| Projet de build | `C:\Users\juven\ikcp-android-build\` (hors repo git) |

**⚠️ CLÉ DE SIGNATURE — à sauvegarder absolument :**
- Keystore : `C:\Users\juven\ikcp-android-build\android.keystore`
- Mot de passe : `C:\Users\juven\ikcp-android-build\KEYSTORE-PASSWORD.txt`
- **Copie ces 2 fichiers dans Bitwarden.** Sans eux, impossible de publier une mise à jour
  de l'app (Play Store refuse un APK signé par une autre clé). Ne les commit jamais.

**Installer l'APK (toi + ton ami CGP) :**
1. Copie `Marcel-IKCP-FamilyOffice.apk` sur le téléphone Android (câble, Drive, mail, WhatsApp).
2. Réglages → Sécurité → autorise « installer des applis inconnues » pour le gestionnaire de fichiers.
3. Ouvre l'APK → Installer → icône **Marcel** sur l'écran d'accueil, plein écran, sans barre d'URL.

**Rebuild après une montée de version** (depuis `ikcp-android-build`) :
```
# bump appVersionName/appVersionCode dans twa-manifest.json, puis :
export JAVA_HOME="C:\Users\juven\.bubblewrap\jdk\jdk-17.0.11+9"
PASS=$(cat KEYSTORE-PASSWORD.txt)
./gradlew assembleRelease bundleRelease --no-daemon \
  -Pandroid.injected.signing.store.file=android.keystore \
  -Pandroid.injected.signing.store.password=$PASS \
  -Pandroid.injected.signing.key.alias=ikcp \
  -Pandroid.injected.signing.key.password=$PASS
```

> Comme l'app charge `ikcp.eu/app` en direct, **toute modif du site se reflète sans rebuild**.
> On ne rebuild l'APK que pour changer l'icône, le nom, ou publier une nouvelle version au store.

---

## 📦 (Archive) PHASE 2 alternative — PWABuilder (si jamais le build local casse)

> **Android d'abord** : gratuit, pas de Mac, pas de 99 €/an Apple. iOS plus tard.
> Machine Maxime : Node ✓ mais **pas de JDK / Android SDK** → on **n'installe rien**.
> On utilise **PWABuilder** (Microsoft, gratuit) qui empaquette notre PWA en APK signé.

### Pourquoi PWABuilder (TWA) et pas Capacitor ici
- La PWA `/app` est déjà complète → PWABuilder l'emballe en **TWA** (Trusted Web Activity) :
  une app Android native qui ouvre le site en plein écran, **sans barre d'URL**.
- **Auto-mise à jour** : toute modif du site se reflète dans l'app, **sans re-soumettre**.
- Build dans le navigateur → **aucune install Android Studio** sur le PC.
- Capacitor aurait exigé JDK + Android SDK (~1,5 Go) — inutile pour une bêta.

### ✅ Ce que JE prépare dans le repo (fait)
- [x] `manifest.json` prêt TWA (standalone, icônes 192/512 maskable, raccourcis).
- [x] `/.well-known/assetlinks.json` en place (plomberie pour masquer la barre d'URL) —
      **empreinte à remplacer** une fois l'APK généré (voir étape 4).
- [x] Identité app : nom **« Marcel — Family Office »**, package **`eu.ikcp.app`**.

### 📲 TES étapes (≈ 10 min, navigateur, gratuit)
1. Va sur **https://www.pwabuilder.com** → colle **`https://ikcp.eu/app/dashboard`** (URL propre, sans `.html`) → *Start*.
2. PWABuilder analyse la PWA (doit être au vert) → bouton **Package For Stores** → **Android**.
3. Options : laisse **Package ID = `eu.ikcp.app`**, garde « Signing key = **New** ».
   → **Download**. Tu obtiens un `.zip` avec : `app-release-signed.apk`, `app-release.aab`,
   le **`signing.keystore`** + ses **mots de passe**, et un **`assetlinks.json`**.
4. **Ouvre l'`assetlinks.json` du zip** → copie le bloc → **colle-le moi ici** (ou juste
   l'empreinte SHA-256). Je le commit → barre d'URL supprimée, app « vraie ».
5. **⚠️ SAUVEGARDE le `signing.keystore` + mots de passe** dans Bitwarden. Sans lui,
   impossible de mettre à jour l'app plus tard. (Ne me l'envoie PAS — c'est ton secret.)

### Installer l'APK (toi + ton ami CGP)
- Copie **`app-release-signed.apk`** sur le téléphone Android (câble, Drive, ou envoie-le).
- Réglages → Sécurité → autorise **« installer des applis inconnues »** pour le gestionnaire de fichiers.
- Ouvre l'APK → Installer. Icône **Marcel** sur l'écran d'accueil, ouverture plein écran.
- Pour ton ami : envoie-lui le **fichier APK** (WhatsApp/mail) + le lien `ikcp.eu/app/beta-invite`.

### Play Store public (optionnel, plus tard)
- Le **`.aab`** sert à publier sur le Play Store : compte **Google Play Console = 25 € une fois**.
- Quand tu veux le store public → dis **« GO Play Store »**, je te guide la soumission.
- Tant que la bêta = toi + 1 ami, l'**APK direct suffit** (pas besoin des 25 €).

### Trigger
Lance PWABuilder quand tu veux → renvoie-moi l'`assetlinks.json`, je finalise. C'est tout.

---

## 🍎 PHASE 3 — iOS (plus tard, si la bêta convainc)
Apple Developer 99 €/an + Mac (ou build cloud type Codemagic). On verra après l'Android.

---

## 🔔 Bonus court terme
- **Notifications push réelles** : la veille quotidienne sonne sur le téléphone
  (« Loi de finances : ce qui vous concerne »). Manque : clé VAPID + envoi depuis `ikcp-veille`.
  → dis « notifications push » pour que je branche ça.

---

© 2026 IKCP — Maxime Juveneton · ORIAS 23001568
