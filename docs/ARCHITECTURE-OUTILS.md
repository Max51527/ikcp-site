# 🧭 Architecture des outils — IKCP (chaîne propre)

> Qui fait quoi, comment ça circule, où vivent les données. Référence unique.

---

## 1. La chaîne de A à Z (le flux)

```
   TOI (en français)
        │
   ┌────▼─────────┐   tu décris une évolution
   │  CLAUDE CODE │   → écrit / modifie le code
   └────┬─────────┘
        │ git commit + push
   ┌────▼─────────┐   source de vérité unique
   │   GITHUB     │   Max51527/ikcp-site
   └────┬─────────┘
        │ déclenche (CI/CD : GitHub Actions)
   ┌────▼──────────────────────────────┐
   │            CLOUDFLARE             │  déploiement automatique
   │  Pages (site) · Workers (APIs)    │
   │  D1 · KV · R2 (données souveraines)│
   └────┬──────────────────────────────┘
        │ sert
     ikcp.eu  ──►  Visiteurs / Clients

   ── En parallèle, sans code ──
   SVELTIA (/admin)  → édite le CONTENU (textes, prix) → commit GitHub → redéploie
   STUDIO (/app/studio) → édite le DESIGN (polices, couleurs) → live
   CONSOLE (/app/console) → PILOTE (membres, santé, veille, accès)
   NOTION → retours bêta + documentation
```

---

## 2. Qui fait quoi (rôle de chaque outil)

| Outil | Rôle | Tu l'utilises pour | Qui édite |
|---|---|---|---|
| **Claude Code** | Atelier de dev (IA) | Coder/ajouter fonctions, APIs, agents | toi (en français) ou moi |
| **GitHub** | Source de vérité du code | Historique, déploiement auto | automatique |
| **Cloudflare Pages** | Hébergement du site | Servir ikcp.eu (mondial, HTTPS) | automatique (push) |
| **Cloudflare Workers** | Tes APIs / agents | Marcel, auth, veille, Pappers… | Claude Code |
| **D1 / KV / R2** | Données (France) | Membres, sessions, thème, fichiers | les Workers |
| **Sveltia** (`/admin`) | CMS no-code | Éditer textes/prix/images | toi |
| **Studio** (`/app/studio`) | Éditeur de design | Polices, titres, couleurs | toi |
| **Console** (`/app/console`) | Cockpit de pilotage | Membres, santé, accès, centre technique | toi |
| **Notion** | Org. & retours | Doc, base feedback bêta | toi |

---

## 3. Où vivent les données (gestion)

| Donnée | Emplacement | Souverain |
|---|---|---|
| Code source | GitHub | — |
| Site (HTML/JS) | Cloudflare Pages | 🇪🇺 |
| Membres · sessions · quotas · candidatures | **D1 (Paris)** | 🇫🇷 |
| Mémoire conversationnelle · thème · cache | **KV** | 🇪🇺 |
| Fichiers (futur : pièces jointes, photos) | **R2** | 🇪🇺 |
| Clés API | **Secrets Cloudflare** (chiffrés) | 🇪🇺 |
| Retours bêta | **Notion** + email + D1 (events) | mixte |
| Patrimoine déclaré (bêta) | localStorage (appareil) → D1 (roadmap) | 🇫🇷 |

---

## 4. Le workflow d'édition (qui touche quoi)

| Je veux changer… | J'utilise | Effet |
|---|---|---|
| Un **texte / prix / image** | Sveltia (`/admin`) | commit → redéploie (~1 min) |
| Les **polices / couleurs** | Studio (`/app/studio`) | live |
| Le **design / une nouvelle fonction / un agent** | Claude Code | code → push → déploie |
| **Gérer membres / accès / santé** | Console (`/app/console`) | direct |
| **Centraliser les retours** | Notion (base bêta) | manuel ou auto (token) |

---

## 5. Règle d'or
> **Le frontend ne détient jamais les clés.** Il parle à **tes Workers**, qui détiennent les clés (chiffrées chez Cloudflare) et appellent les APIs externes (Anthropic, Perplexity, Pappers, Resend, Stripe). C'est ce qui protège tout l'environnement.

---

## 6. Liens rapides
| Outil | URL |
|---|---|
| Schéma visuel | `ikcp.eu/app/architecture.html` |
| Console pilotage | `ikcp.eu/app/console.html` |
| Centre technique (consoles API) | console → Réglages |
| CMS contenu | `ikcp.eu/admin` |
| Studio design | `ikcp.eu/app/studio.html` |
| Base retours bêta (Notion) | https://app.notion.com/p/287f73500d774c15a7b514d3b4b78966 |
| Code | https://github.com/Max51527/ikcp-site |

---

*Référence vivante — mise à jour quand l'architecture évolue. IKCP · ORIAS 23001568.*
