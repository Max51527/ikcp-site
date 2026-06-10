# 📱 Application mobile IKCP — créer & mettre en ligne

> État au lancement bêta. Ton app **existe déjà** sous 2 formes : **PWA installable** (live) + **APK Android** (construit via Bubblewrap, sur ton Desktop). Ce guide = comment la publier proprement.

---

## ✅ Ce que tu as DÉJÀ
| Forme | Statut | Distribution |
|---|---|---|
| **PWA** (web app installable) | 🟢 LIVE sur `ikcp.eu/app` | « Ajouter à l'écran d'accueil » — **gratuit, instantané, sans store** |
| **APK Android** (TWA Bubblewrap) | 🟢 construit localement (`C:\Users\juven\ikcp-android-build`) | Prêt pour Google Play |
| Manifeste store-ready | 🟢 `app/manifest.json` (icônes, raccourcis, catégories) | — |

---

## 🏆 TOP 3 des outils pour créer + publier

| # | Outil | Plateforme | Coût | Difficulté | Quand l'utiliser |
|---|---|---|---|---|---|
| **1** | **PWA + PWABuilder** | Android · iOS · Windows | **Gratuit** (hors compte store) | ⭐ Facile (no-code) | **Maintenant.** Le plus rapide pour générer un paquet store depuis ton site. |
| **2** | **Bubblewrap (TWA)** | Android (Google Play) | Gratuit + Play 25 $ (une fois) | ⭐⭐ Technique (déjà fait) | Tu as déjà l'APK → **Play Store quand tu veux**. |
| **3** | **Capacitor** (Ionic) | iOS + Android natif | Gratuit + Apple 99 $/an + Mac | ⭐⭐⭐ Avancé | iOS App Store + fonctions natives (push, biométrie). **Plus tard.** |

> 🥇 **Recommandation** : pour la bêta (50 familles), **reste sur la PWA** — installation en 1 clic, zéro friction store, mises à jour instantanées. Le store, c'est pour la **crédibilité** quand tu scales (Android d'abord, iOS ensuite).

---

## 🛣️ Les 3 chemins, étape par étape

### Chemin A — PWA (RECOMMANDÉ pour la bêta · 0 €)
**Rien à coder, c'est déjà live.** Comment tes testeurs l'installent :
- **Android (Chrome)** : ouvrir `ikcp.eu/app/dashboard` → menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : ouvrir le site → bouton Partager → « Sur l'écran d'accueil ».
→ L'icône Marcel apparaît, l'app s'ouvre en plein écran, fonctionne hors-ligne.

### Chemin B — Google Play (via PWABuilder OU Bubblewrap)
**Pré-requis** : compte **Google Play Console** (25 $ une seule fois).

**Option rapide — PWABuilder** :
1. Va sur **https://www.pwabuilder.com** → colle `https://ikcp.eu/app`.
2. Il analyse ton manifeste (déjà bon) → bouton **« Package for stores »** → **Android**.
3. Télécharge le **`.aab`** (App Bundle) signé → upload dans Play Console.

**Option technique — Bubblewrap (déjà configuré)** :
```bash
cd C:\Users\juven\ikcp-android-build
bubblewrap update        # récupère la dernière version de la PWA
bubblewrap build         # génère app-release-bundle.aab + APK
```
→ Upload `app-release-bundle.aab` dans Play Console → Production.

> ⚠️ Le fichier `app/.well-known/assetlinks.json` (empreinte SHA256) DOIT rester en ligne pour que la TWA s'ouvre sans barre d'URL. ✅ déjà en place.

### Chemin C — App Store iOS (via Capacitor) — plus tard
**Pré-requis** : **Apple Developer** (99 $/an) + un **Mac** (ou build cloud type Codemagic/Ionic Appflow).

Scaffold prêt à l'emploi (le natif charge directement ton site live → zéro rebuild pour le contenu) :

`capacitor.config.json` :
```json
{
  "appId": "eu.ikcp.app",
  "appName": "Marcel — IKCP",
  "webDir": "app",
  "server": { "url": "https://ikcp.eu/app", "androidScheme": "https" },
  "ios": { "contentInset": "always" }
}
```

Commandes :
```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Marcel — IKCP" eu.ikcp.app --web-dir app
# copier le capacitor.config.json ci-dessus
npx cap add ios
npx cap add android
npx cap open ios       # ouvre Xcode (sur Mac) → archiver → App Store Connect
```

---

## 💰 Récap coûts
| Voie | Coût | Quand |
|---|---|---|
| PWA | **0 €** | maintenant |
| Google Play | **25 $** une fois | quand tu veux la crédibilité Android |
| App Store iOS | **99 $/an** + Mac | après traction |

## ✅ Ce qui est à TOI (credentials — je ne les pose pas)
- Compte **Google Play Console** (25 $) → upload de l'`.aab`.
- Compte **Apple Developer** (99 $/an) → si iOS.
- La **soumission** finale (formulaires store, captures d'écran, politique de confidentialité — tu as déjà `/confidentialite`).

---

© 2026 IKCP — Maxime Juveneton · ORIAS 23001568
