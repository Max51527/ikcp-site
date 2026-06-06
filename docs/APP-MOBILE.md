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

## ⏳ PHASE 2 — Publication App Store + Google Play (après bêta)

**Approche : Capacitor** — on embarque le site existant dans une coque native.
Zéro réécriture : la même base `/app` devient un binaire iOS + Android.

### Étapes techniques (je m'en occupe quand tu déclenches)
1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init "IKCP" "eu.ikcp.app"` — config `server.url = https://ikcp.eu/app` (mode hybride : l'app charge le site, mises à jour instantanées sans re-soumettre).
3. `npx cap add ios && npx cap add android`
4. Icônes/splash natifs (générés depuis les PNG existants).
5. Plugins natifs utiles : Push Notifications (APNs/FCM), Haptics, Share, Biometric (Face ID pour déverrouiller).

### 🔑 Tes étapes (credentials — je ne peux pas les faire à ta place)
| Action | Coût | Où |
|---|---|---|
| Compte **Apple Developer** | 99 €/an | developer.apple.com |
| Compte **Google Play Console** | 25 € (une fois) | play.google.com/console |
| Certificats signature iOS | inclus | via Xcode (Mac requis) |
| Soumission + review Apple | — | ~1 à 2 semaines |

> ⚠️ **Mac requis** pour builder/soumettre l'app iOS (Xcode). Android se build sous Windows.
> Si pas de Mac : service de build cloud (ex. Codemagic / EAS) — à arbitrer le moment venu.

### Trigger Phase 2
Quand ton ami CGP a testé la Phase 1 et validé l'expérience → tu me dis **« GO stores »**
et je prépare tout le scaffold Capacitor + le guide pas-à-pas de soumission.

---

## 🔔 Bonus court terme (entre Phase 1 et 2)
- **Notifications push réelles** : la veille quotidienne pousse une alerte sur le téléphone
  (« Loi de finances : ce qui vous concerne »). Manque : clé VAPID + envoi depuis `ikcp-veille`.
  → dis « notifications push » si tu veux que je branche ça avant les stores.

---

© 2026 IKCP — Maxime Juveneton · ORIAS 23001568
