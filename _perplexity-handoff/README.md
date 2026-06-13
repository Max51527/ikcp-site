# 📦 Dossier de transfert — Projet MARCEL pour Perplexity Pro

> Tout ce dont tu as besoin pour développer le prototype de l'application Marcel.
> Lis les fichiers dans l'ordre indiqué.

---

## 🚀 Démarrage rapide (5 min)

### Étape 1 — Comprendre le projet
Ouvre `00-brief/BRIEF-PERPLEXITY-APP-MARCEL.md`

C'est **le document principal** — il contient :
- Les 4 réponses aux questions de cadrage
- L'architecture complète (site ↔ Family Office ↔ application)
- Les contraintes non négociables (MIF II, RGPD, confidentialité marque)
- La liste des 12 spécialistes Marcel
- Les endpoints workers existants à brancher
- Le design system officiel
- La roadmap 5 jours
- Les critères de succès

### Étape 2 — Voir le squelette PWA déjà créé
Le dossier `01-app-pwa/` contient **7 pages HTML déjà fonctionnelles** :
- `index.html` — login magic link
- `dashboard.html` — vue d'ensemble 6 widgets
- `marcel.html` — chat fullscreen
- `veille.html` — alertes datées
- `carnet.html` — contacts privés CRUD
- `documents.html` — PDF signés eIDAS
- `profil.html` — paramètres + RGPD
- `manifest.json` — PWA installable
- `sw.js` — Service Worker offline
- `icons/marcel.svg` — icône Marcel sphère gradient

**Ta mission** : enrichir ces pages avec les 15 widgets du catalogue (voir `05-widgets/`).

### Étape 3 — Respecter le design system
Le dossier `02-design-system/` contient `marcel.css` avec :
- Palette officielle Marcel (terra/cream/ink + navy/gold pour sections premium)
- Typo : Fraunces (titres serif italique) + Inter (corps sans-serif)
- 12 composants prêts (cards, pills, btn, marcel-mini, marcel-live-bar...)
- Bottom tab nav mobile-first
- Loading state, empty state, toast

**À utiliser tel quel.** Ne pas réinventer.

### Étape 4 — Brancher les endpoints
Le dossier `03-backend-api/` contient `api.js` — wrapper unifié pour 7 workers déjà déployés :
```javascript
import { Marcel } from './api.js';

await Marcel.chat("Pacte Dutreil sur ma holding ?");
await Marcel.cartographie("947972436");
await Marcel.Auth.me();
await Marcel.Me.contacts();
// ... etc
```

Tous les workers tournent déjà en production sur Cloudflare Workers (région WEUR Paris).

### Étape 5 — Structure de la base de données
Le dossier `04-database/` contient :
- `schema.sql` — base v1 (users, sessions, audit, events)
- `schema-v2.sql` — extension v2 (sirens, conversations, contacts, alerts, documents, watches)

Les 19 tables sont déjà déployées sur D1 Paris. Tu n'as pas à recréer la base.

### Étape 6 — Construire les 15 widgets
Le dossier `05-widgets/WIDGETS-FAMILY-OFFICE.md` détaille :
- 15 widgets avec mockups ASCII
- Spec données (quelle table D1, quel endpoint)
- Layout suggéré dashboard
- Plan d'implémentation Sprint 2 J3-J7

---

## 🏗 Structure du dossier

```
_perplexity-handoff/
├── README.md (ce fichier)
│
├── 00-brief/
│   └── BRIEF-PERPLEXITY-APP-MARCEL.md ← lis ça en premier
│
├── 01-app-pwa/
│   ├── index.html · dashboard.html · marcel.html · veille.html
│   ├── carnet.html · documents.html · profil.html
│   ├── manifest.json · sw.js
│   ├── css/marcel.css
│   ├── js/api.js
│   └── icons/marcel.svg
│
├── 02-design-system/
│   └── marcel.css (palette + composants)
│
├── 03-backend-api/
│   └── api.js (wrapper 7 workers)
│
├── 04-database/
│   ├── schema.sql
│   └── schema-v2.sql
│
└── 05-widgets/
    └── WIDGETS-FAMILY-OFFICE.md (15 widgets)
```

---

## 🎯 Top 3 priorités prototype

1. **Widget Marcel-Live** sticky en haut du dashboard (le plus visible)
2. **Widget Veille du jour** (différenciateur Premium FO majeur)
3. **Widget Cartographie société** (démontre la valeur immédiate via SIREN)

Les 12 autres widgets peuvent être faits dans un second temps.

---

## ⚖ Règles non négociables (RAPPEL)

### Marque & confidentialité
- ✅ **Marque produit** : "Marcel" partout (jamais "Cassius")
- ✅ **Cabinet** : "IKCP IKIGAÏ Conseil Patrimonial" (ORIAS 23001568)
- ❌ **Jamais en public** : Anthropic, Claude, GPT, Perplexity, Pappers, Cloudflare
- ✅ **Vocabulaire neutre** : "intelligence souveraine", "veille augmentée", "cartographie société"

### Conformité MIF II
- ❌ Aucune recommandation produit personnalisée
- ✅ Disclaimer obligatoire en fin de chaque réponse IA :
  *"Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier."*
- ✅ Marcel termine TOUJOURS par une question d'orientation

### RGPD souverain
- ✅ Hébergement Cloudflare WEUR Paris uniquement
- ✅ D1 SQLite Paris (CDG)
- ✅ R2 EU jurisdiction pour documents
- ❌ Aucun service US dans le pipeline sensible
- ✅ Endpoint `DELETE /api/v1/me` pour droit à l'oubli (cascade)
- ✅ Endpoint `GET /api/v1/me/export` pour export RGPD

---

## 🛠 Stack technique imposée

- **HTML/CSS/JS vanilla** (pas de React/Next.js/Vue — trop lourd, dépendances)
- **PWA** (manifest + Service Worker)
- **Modules ES** natifs (`<script type="module">`)
- **Fonts** : Fraunces + Inter via Google Fonts
- **Backend** : Cloudflare Workers existants (ne pas réinventer)
- **DB** : D1 (déjà déployée)

---

## 📞 Si tu as besoin de précisions

Tu peux poser des questions à Maxime Juveneton :
- Email : **maxime@ikcp.fr**
- Cabinet : Lyon · Annonay · Megève

Mais le brief 00-brief/ doit déjà répondre à 95 % des questions.

---

© 2026 IKCP — Marcel · Family Office augmenté · ORIAS 23001568
