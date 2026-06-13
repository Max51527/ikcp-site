# IKCP Family Office — App mobile (Capacitor)

> Wrap natif iOS + Android de la PWA `client.ikcp.eu` pour publication
> App Store + Google Play. Mises à jour PWA déployées sans repassage
> validation Apple/Google (le contenu est servi par Cloudflare Pages).

---

## ⚠ Avertissement Apple App Store Review Guideline 4.2

**Risque de rejet en première soumission : 40-60%.**

L'App Store Review Guideline 4.2 — *Minimum Functionality* — stipule
qu'une app qui est essentiellement un wrapper de site web peut être
rejetée :

> *"Your app should include features, content, and UI that elevate
> it beyond a repackaged website. If your app is not particularly
> useful, unique, or 'app-like', it doesn't belong on the App Store."*

### Mitigations à mettre en place AVANT la soumission

Pour passer la review, ajouter au minimum :

1. **Stockage offline** d'au moins 1 contenu (le dernier rapport DER ou
   la dernière newsletter) — démontre que l'app a sa propre logique
   au-delà du web.
2. **Camera native** pour scanner les documents (au lieu du seul
   drag-drop web) — fait usage du hardware natif iOS.
3. **Push notifications activées** dès le premier launch — démontre
   l'intégration native (APNs).
4. **Haptic feedback** sur les actions clés (tap "Générer rapport",
   tap "Marcel parle") — autre démonstration native.
5. **Au moins 1 écran UI vraiment natif** (pas du WebView) — par
   exemple l'onboarding magic-link.

### Plan B si rejet

- Soit on itère sur la review feedback Apple (1-2 cycles, 5-14 jours)
- Soit on bascule sur PWA "Add to Home Screen" pour l'été (iOS 16.4+
  supporte Web Push depuis mars 2023, suffit pour la beta payante)
- Re-tenter app native au Q1 2027 avec un budget UX natif dédié

---


>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

## Setup initial (sur poste dev avec Xcode + Android Studio)

```sh
cd mobile
npm install
npx cap add ios
npx cap add android
npx cap sync
```

## Build iOS

Pré-requis : macOS + Xcode + Apple Developer account (99 $/an).

```sh
npm run ios          # ouvre le projet dans Xcode
# Dans Xcode :
# 1. Signing & Capabilities → Team = IKCP Developer ID
# 2. Bundle Identifier = fr.ikcp.familyoffice
# 3. Push Notifications + Sign In With Apple capabilities activées
# 4. Archive → Distribute App → App Store Connect
```

## Build Android

Pré-requis : Android Studio + compte Google Play Console (25 $ one-time).

```sh
npm run android      # ouvre le projet dans Android Studio
# Dans Android Studio :
# 1. Build → Generate Signed Bundle (AAB)
# 2. Upload sur Play Console
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ App Store / Play Store                                  │
│ ─────────────────────────                               │
│ • Téléchargement : "IKCP Family Office"                 │
│ • Bundle : 5-10 MB (juste le wrapper Capacitor)         │
│ • Updates wrapper : ~2/an (nouvelles capabilities natifs)│
└──────────┬──────────────────────────────────────────────┘
           │ install
           ▼
┌─────────────────────────────────────────────────────────┐
│ App native iOS / Android                                │
│ ────────────────────────                                │
│ • WebView qui charge https://client.ikcp.eu/            │
│ • Plugins natifs : push, biométrie, status bar          │
│ • Splash : logo IKCP (1.5s) puis WebView                │
└──────────┬──────────────────────────────────────────────┘
           │ load
           ▼
┌─────────────────────────────────────────────────────────┐
│ client.ikcp.eu (Cloudflare Worker + Pages)              │
│ ──────────────────────────                              │
│ • Magic-link auth                                       │
│ • Dashboard family office                               │
│ • Marcel chat                                           │
│ • Génération rapports (via ikcp-agents Managed Agents)  │
│ • Mises à jour LIVE — pas de validation stores requise  │
└─────────────────────────────────────────────────────────┘
```

## Mises à jour

| Type de mise à jour | Où | Validation requise |
|---|---|---|
| Bug fix CSS/JS pages client.ikcp.eu | Git push → Cloudflare Pages | ❌ instantané |
| Nouvelle feature backend Worker | `wrangler deploy` | ❌ instantané |
| Ajout d'un plugin Capacitor natif (ex: Face ID) | rebuild + soumission stores | ✅ ~1-7 jours |
| Changement bundle identifier ou permissions | rebuild + soumission stores | ✅ ~1-7 jours |

## Capabilities natifs intégrés

| Plugin | Usage |
|---|---|
| `@capacitor/push-notifications` | Notif "votre DER est prêt", alertes échéances |
| `@capacitor/biometric-auth` | Face ID / Touch ID / empreinte avant ouverture dashboard |
| `@capacitor/splash-screen` | Splash IKCP 1.5s au démarrage |
| `@capacitor/status-bar` | Status bar sombre cohérent palette |

## Liens vers le reste de la stack

- Backend dynamique : `workers/ikcp-client/` (auth, dashboard, magic-link)
- Agents async (DER, OCR, suivi) : `workers/ikcp-agents/` + `agents/*.yaml`
- Contenu éditable no-code : `admin/` (Sveltia CMS)
- Marcel chat sync : `workers/ikcp-marcel/`

## CORS / origines acceptées par les Workers

Les Workers `ikcp-agents`, `ikcp-client` et `ikcp-marcel` doivent
accepter en CORS :
- `https://client.ikcp.eu` (PWA)
- `https://app.ikcp.eu` (sous-domaine app optionnel)
- `capacitor://localhost` (iOS native scheme)
- `http://localhost` + `https://localhost` (Android)

Déjà configuré dans `workers/ikcp-agents/worker.js` (ALLOWED_ORIGINS).
À répliquer dans ikcp-client + ikcp-marcel si pas déjà fait.

## Roadmap

| Étape | Effort | Quand |
|---|---|---|
| 1. PWA fonctionnelle sur client.ikcp.eu | déjà fait ✅ | - |
| 2. Wrap Capacitor + smoke test simulator | 1-2 jours | Phase 1 beta |
| 3. Icônes + splash + screenshots stores | 1 jour | Phase 1 beta |
| 4. Submission Apple + Google | 1 jour soumission + 1-7j review | Phase 2 |
| 5. Native push notifications wired vers Resend → APNs/FCM | 2 jours | Phase 2 |
| 6. Biometric auth wired sur magic-link | 1 jour | Phase 2 |

## Estimation coûts

| Item | Coût |
|---|---|
| Apple Developer Program | $99/an |
| Google Play Console | $25 one-time |
| Push notifications APNs/FCM | gratuit |
| Build & sync | gratuit (open-source) |
| **Total an 1** | **~$130** |
