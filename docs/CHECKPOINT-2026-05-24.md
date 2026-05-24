# 📌 CHECKPOINT — État de la plateforme IKCP · 2026-05-24

> Enregistrement de la session de travail (sprint bêta-readiness).
> Clone canonique unique : `C:\Users\juven\ikcp-site` · toujours `git pull --ff-only` avant de travailler.

---

## ✅ FAIT cette session (déployé)

### Site public (Cloudflare Pages — futur ikcp.eu)
- **Marcel réparé** : SyntaxError fatale corrigée · widget v=20 sur 90 pages.
- **Hero épuré** : panneau montgolfière retiré, accès Marcel via bulle flottante déployable.
- **Rassurance homepage** : bloc fondateur Maxime (monogramme MJ si photo absente) + label « Pensé pour vous, dirigeant(e)s & familles ».
- **Family Office** : prix 290 €/mois retiré partout (phase bêta = « offert / sur invitation »). « 50 k€/an » conservé (= coût FO traditionnel).
- **Offre 3 niveaux** : Découverte 0€ (0 token) / Premium 29€ / FO sur devis (sans montant).
- **Explainer animé** : modale « Voir en 90 s » sur la page Family Office.
- **SIREN privacy** : SIREN réel retiré des démos (footers légaux conservés).

### Agents IA (workers Cloudflare)
- **Marcel** (ikcp-chat, Sonnet 4.6) LIVE · max_tokens 2048 · disclaimer MIF II garanti serveur · follow_ups avec filet de sécurité.
- **Codex** (fiscal, Opus 4.7) LIVE + câblé.
- **Hermès** (transmission, Opus 4.7) LIVE + activé dans Marcel.
- **Lifestyle** (9 agents Sonnet) LIVE + activés.
- **Veille** (Perplexity Pro) LIVE (gated utilisateur connecté).
- **Bâtisseur** (Opus 4.7) déployé mais ⚠️ clé ANTHROPIC manquante → `live:false`.
- **Pappers** (cartographie SIREN) LIVE · CORS corrigé (pages.dev autorisé).

### Espace membre (app/)
- 11 pages + PWA · auth magic link (Resend live) · backend ikcp-client v2.0 (D1/JWT, routes /me/*).
- Tiers + quotas : **free = 0 token** (simulateurs + 1 cartographie) / premium / fo.

### Infra / CI-CD
- `deploy-pages.yml` : site → Pages auto.
- `deploy-workers.yml` : marcel, voice, batisseur, hermes, veille, lifestyle, **client, pappers** (ajoutés) auto.
- Règle CLONE UNIQUE dans CLAUDE.md + garde-fou `git pull` dans daily-run.ps1 (anti-écrasement SEO).

### Tests
- Parcours prospect « Hélène Marchand » validé de A à Z (Marcel expert + MIF II, cartographie, simulateurs, conversion magic link).

---

## ⏳ EN ATTENTE (action Maxime)
1. **Bascule Cloudflare** : custom domain ikcp.eu + www → vérification DNS en cours.
2. **Test espace membre connecté** : login magic link (email Maxime).
3. **Clé Bâtisseur** : `cd workers/ikcp-batisseur && npx wrangler secret put ANTHROPICAPIKEY` puis flip `live:true`.
4. Supprimer l'ancien clone Desktop (déprécié).

---

## 🔜 À CONSTRUIRE (validé, à faire)

### #1 — Marcel : réponse courte + « Voir le détail »
- **Constat** : réponses denses (3000+ car.) intimidantes au 1er contact.
- **Approche** : Marcel structure déjà « *L'essentiel : …* » puis `---` puis le détail.
  → Le widget affiche la synthèse (avant le 1er `---`) + bouton **« Voir le détail ↓ »** qui déplie le reste.
  → Changement **widget** (chatbot-widget.js, fonction de rendu) — pas de changement worker.

### #4 — SIREN → 2 agents IA (parcours augmenté)
- **Objectif** : après la cartographie Pappers, enrichir l'analyse via 2 spécialistes.
- **Flux proposé** :
  1. Cartographie SIREN (Pappers) → données société (capital, forme, dirigeants…).
  2. Bouton **« Analyser ma structure »** → envoie le contexte Pappers à Marcel.
  3. Marcel délègue à **2 agents** :
     - **Codex** (fiscal) — « quelle fiscalité sur cette structure ? » (LIVE)
     - **Bâtisseur** (patrimoine 360°/holding) — « cartographie patrimoniale 360° » (⚠️ attend clé)
       → En attendant Bâtisseur : fallback sur **Hermès** (transmission) qui est LIVE.
  4. Enregistrement de l'analyse dans l'espace membre (D1, route /me/sirens — déjà existante).
- **Conformité** : chaque agent termine par une question + disclaimer MIF II (déjà en place).

---

## 🔁 REPRISE SESSION SUIVANTE — commencer ici

**Lire d'abord** : ce fichier + `CLAUDE.md` (règle clone unique). Travailler dans `C:\Users\juven\ikcp-site`, `git pull --ff-only` avant tout.

### 🔑 Action n°1 (Maxime, débloque TOUT — 2 min, sans IA)
La bascule Cloudflare est bloquée : l'enregistrement **A racine de ikcp.eu pointe encore vers Hostinger**.
→ CF Dashboard → Websites → ikcp.eu → DNS → supprimer l'enreg. **A `@`** (vers Hostinger) → Pages → ikcp-eu → Custom domains → re-déclencher `ikcp.eu` (+ `www`). CF recrée le CNAME Pages. ikcp.eu sert alors la nouvelle version.

### 🎨 Décision édition en ligne (actée)
- ❌ PAS Webflow (casserait l'intégration Workers/Marcel).
- ✅ CMS visuel léger (**Sveltia/Decap**) sur le repo → édition navigateur → commit Git → Pages publie. À construire (point #7).
- ✅ En attendant : édition via GitHub web (crayon → commit → live 30 s).

### 🔜 Dev à poursuivre
- Espace membre : tester parcours connecté (login Maxime), enrichir.
- Agents : clé `ANTHROPICAPIKEY` sur ikcp-batisseur → flip live:true.
- #4 déjà fait : bouton « Analyser avec Marcel » post-SIREN (→ Codex + Hermès).
- #1 déjà fait : Marcel réponse courte + « Voir le détail » (widget v=21).

---

© 2026 IKCP · checkpoint session bêta-readiness
