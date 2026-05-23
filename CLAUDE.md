# CLAUDE.md — Projet ikcp-site

> Site cabinet IKCP (IKIGAÏ Conseil Patrimonial) + plateforme Family Office augmenté.
> Hérite des règles globales `~/.claude/CLAUDE.md` (charte UPPERCUT, IKCP, ton, sécurité).
> Sous-projet : voir `workers/CLAUDE.md` pour les agents IA et Marcel.

---

## 🎯 Identité du projet

- **URL** : https://ikcp.eu (production) — Cloudflare Pages
- **Domaine secondaire** : ikcp.fr (en cours de migration vers .eu)
- **Repo Git** : https://github.com/Max51527/ikcp-site
- **Cible** : dirigeants TNS · professions libérales · familles entrepreneuriales · 500 k€-50 M€ patrimoine
- **Positionnement** : *"Premier Family Office Ardéchois IA & Humain"* (claim qualifié, voir `docs/POSITIONING-VS-AUREP-AFFO.md`)
- **Bêta** : 50 familles fondatrices au S2 2026 · 6 mois Premium offerts

## 📁 Structure du repo

```
ikcp-site/
├── CLAUDE.md                  ← ce fichier · règles projet
├── *.html                     ← pages publiques live (annonay-*, ardeche-*, etc.)
├── workers/                   ← agents IA + APIs Cloudflare Workers
│   ├── CLAUDE.md              ← règles agents (lu automatiquement)
│   ├── ikcp-pappers/          ← cartographie SIREN (✅ LIVE)
│   ├── ikcp-marcel/           ← Marcel chef d'orchestre Sonnet 4.6 (✅ LIVE)
│   ├── ikcp-codex/            ← Codex sub-agent fiscal Opus 4.7 (✅ LIVE)
│   ├── ikcp-temoin/           ← audit log MIF II (✅ LIVE)
│   ├── ikcp-universign/       ← signature eIDAS (⏸ pause)
│   ├── ikcp-client/           ← magic link auth + Stripe (existant)
│   ├── ikcp-prospect/         ← capture prospects (existant)
│   └── ikcp-api/              ← API legacy (existant)
├── proposals/                 ← mockups visuels HTML (preview)
│   ├── marcel-funnel.html     ← entrée prospect (cartographie SIREN)
│   ├── family-office-*.html   ← propositions design Family Office
│   ├── widgets-ikcp.html      ← bannières widgets pour la com'
│   ├── test-harness.html      ← tests workers en réel
│   └── ...
├── docs/                      ← documentation interne
│   ├── AGENTS-STRATEGY.md     ← stratégie Marcel + sub-agents (Option A)
│   ├── AUDIT-MOCKUP-VS-REEL.md← honnêteté live vs mockup
│   ├── COUTS-COMPLETS.md      ← modèle économique 50 clients
│   ├── API-AUDIT.md           ← 80 APIs cartographiées
│   ├── SPRINT-1-DEPLOY.md     ← guide déploiement workers
│   ├── TEST-LOCAL.md          ← tester sans déployer
│   └── INFRA-PRODUCTION.md    ← état infra prod (URLs, secrets, IDs)
└── _archive/                  ← anciennes versions
```

## 🔐 Règles sécurité — NON NÉGOCIABLES

1. **Secrets jamais dans le code** : ni dans worker.js, ni dans wrangler.toml, ni dans .env commité
2. **Toujours `wrangler secret put`** pour pousser une clé chez Cloudflare
3. **`.gitignore` protège** : `.dev.vars`, `*.env`, `**/api-keys*`, `**/*.key`
4. **Les clés API restent dans** : password manager (Bitwarden recommandé) OU directement chiffrées chez Cloudflare via `wrangler secret put`
5. **Si une clé fuit dans le chat ou git** : révoquer immédiatement (Pappers/Anthropic dashboard) puis regénérer

## ⚖ Conformité — règles d'or

### MIF II (art. L.541-1 CoMoFi)
- **Aucun outil ne donne de conseil personnalisé** sans lettre de mission
- **Marcel + sub-agents terminent par une question**, jamais par une recommandation produit
- **Refus systématique** sur questions du type "Acheter Tesla maintenant ?" → redirection RDV Maxime
- **Disclaimer obligatoire** en fin de chaque réponse : *"Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier."*

### RGPD (souverain France)
- **Hébergement** : Cloudflare Workers en région WEUR (Paris/Frankfurt)
- **D1 SQLite** : data center Paris (CDG)
- **R2 Object Storage** : EU jurisdiction (à activer)
- **Aucun service US** dans le pipeline sensible (pas de Plaid, DocuSign, Bloomberg)
- **Bandeau RGPD** visible sur toute page client

### AMF (cartographie ORIAS)
- **Mention ORIAS 23001568** systématique en footer
- **Statut CIF** (CNCEF Patrimoine) + **COA** rappelés
- **Lettre de mission** obligatoire avant tout conseil patrimonial complet (Premium / Sur-mesure)

## 🎨 Conventions UI

### Palette cabinet IKCP
```
--navy:    #1B2A4A   (texte principal, headers)
--navy-deep:#0E1729  (gradients dark sections)
--cream:   #FAFAF8   (fond pages publiques)
--cream-2: #F4EFE7   (alternance, cards)
--gold:    #C9A96E   (accents, CTAs secondaires)
--gold-bright:#E2C896 (sur fond dark)
--gold-deep: #8B6F3F (texte gold sur cream)
--ink:     #2C2418   (corps texte)
--ink-mute:#6B5D52   (texte secondaire)
```

### Typographie
- **Titres** : Playfair Display (serif italic pour emphase)
- **Corps** : Outfit (sans-serif, 400-600)
- **Code/data** : JetBrains Mono

### Ton et copie
- **Vouvoiement** systématique côté client (formel, premium)
- **Inclusif** : "dirigeant(e)", "fondateur(rice)", "co-bâtisseur(se)"
- **Pédagogique sans condescendance** : on parle à un dirigeant cultivé
- **Jamais "Claude"** côté client → dire "intelligence souveraine" / "agents IA souverains"

## 🌿 Workflow Git

### 🔐 RÈGLE CLONE UNIQUE — NON NÉGOCIABLE (anti-perte de travail)

- **Clone canonique unique** : `C:\Users\juven\ikcp-site`. C'est LE seul endroit où travailler.
- **TOUJOURS `git pull --ff-only origin main` AVANT toute session/modif** — manuelle ou automatisée (SEO inclus).
- **Incident 2026-05-22** : une session SEO lancée depuis un 2e clone en retard a écrasé le hero minimaliste (commit 48ba1f3). Récupéré via git, clones resynchronisés.
- **Ne jamais committer depuis un clone sans avoir pull d'abord.** Si tu détectes deux clones divergents → STOP, signale à Maxime, resync avant tout.
- L'ancien clone `Desktop\A RANGER\UPPERCUT\ikcp-site` est **déprécié** (à supprimer par Maxime une fois confirmé).

```bash
# Avant tout commit
git pull --ff-only origin main # TOUJOURS d'abord — sync clone canonique
git status                    # vérifier les changements
grep -r "sk-ant-" workers/    # vérifier qu'aucune clé n'est dans le code

# Commit standard
git add <fichiers spécifiques>  # JAMAIS git add . sans vérifier
git commit -m "feat(workers): description claire"

# Push
git push origin main
```

**Convention messages commit** :
- `feat(workers):` nouveau worker / nouvel endpoint
- `fix(workers):` correction bug
- `docs:` nouveau document
- `feat(proposals):` nouvelle maquette
- `chore:` config, gitignore, dépendances

## 🚦 Statut Sprint 1 → Sprint 2 (au 21 mai 2026)

### Sprint 1 — LIVE
```
✅ ikcp-pappers      LIVE  · cartographie SIREN réelle
✅ ikcp-chat (Marcel) LIVE  · Sonnet 4.6 · MIF II validé
✅ ikcp-temoin       LIVE  · audit log D1 Paris WEUR
✅ ikcp-codex        LIVE  · Opus 4.7 · expertise fiscale senior
✅ Marcel ↔ Codex    LIVE  · délégation auto (delegate_to_specialist tool)
⏸ ikcp-universign   PAUSE · signature eIDAS (reprendre Sprint 3)
```

### Sprint 2 — Code complet · ⏳ Deploy bloqué sur secrets Maxime
```
✅ family-office.html LIVE  · hero vidéo parallaxe + funnel SIREN → /app/index.html
✅ app/* pages        LIVE  · nav SVG unifiée · veille active · carnet · profil
✅ app/index.html     LIVE  · magic link auth · dev_verify_url mode dev
✅ chatbot-widget.js  LIVE  · app upsell après 3 échanges · dead AGENTS_URL nettoyé
✅ api.js             LIVE  · dead agentChat/agentStream supprimés · clean
✅ ikcp-client/worker PRÊT  · auth sans Stripe/Resend · voir docs/DEPLOY-MINIMAL.md
✅ deploy-workers.yml PRÊT  · 6 workers dans CI/CD (workflow_dispatch + push auto)
✅ Marcel routing     LIVE  · SPECIALISTS_REGISTRY + agentKey + delegateToSpecialist
✅ ikcp-lifestyle     PRÊT  · 12 agents Sonnet prompts.js (stratege, curateur, capital…)
⏳ ikcp-batisseur     PRÊT  · worker Opus 4.7 codé · attente deploy + ANTHROPICAPIKEY
⏳ ikcp-hermes        PRÊT  · worker Opus 4.7 codé · attente deploy + ANTHROPICAPIKEY
⏳ ikcp-veille        PRÊT  · worker Perplexity codé · attente deploy + secrets
```

### Actions Maxime requises pour activer Sprint 2

1. **GitHub Actions** → "Deploy Cloudflare Workers" → `workflow_dispatch` → target `all`
2. `cd workers/ikcp-batisseur && npx wrangler secret put ANTHROPICAPIKEY`
3. `cd workers/ikcp-hermes && npx wrangler secret put ANTHROPICAPIKEY`
4. `cd workers/ikcp-lifestyle && npx wrangler secret put ANTHROPICAPIKEY`
5. `cd workers/ikcp-veille && npx wrangler secret put PERPLEXITY_API_KEY`
6. Confirmer `/health` OK sur chaque worker → flip `live: false → true` dans Marcel SPECIALISTS_REGISTRY

→ **Voir `docs/INFRA-PRODUCTION.md`** pour les URLs et IDs ressources exacts.

## 📞 Liens critiques

- **Cabinet** : https://ikcp.eu
- **Newsletter** : Beehiiv UPPERCUT PATRIMOINE
- **Dashboard Cloudflare** : Account ID `eaddc4cc77d99dd397a62e5d5a1b6864`
- **Dashboard Anthropic** : https://console.anthropic.com
- **Dashboard Pappers** : https://www.pappers.fr/api
- **Repo GitHub** : https://github.com/Max51527/ikcp-site

## ⚡ Comportement Claude attendu

Quand tu travailles sur ce projet, tu dois :

1. **Toujours vérifier** où tu es (cwd) avant de modifier
2. **Lire `INFRA-PRODUCTION.md`** avant de toucher aux workers
3. **Ne jamais commiter de secret** (vérifier deux fois)
4. **Respecter la palette IKCP** sur tout nouveau visuel
5. **MIF II** : tout outil de simulation termine par une question, jamais une recommandation
6. **Rappeler à Maxime** s'il s'apprête à faire une action destructive (rm, force push, drop table)
7. **Mettre à jour ce CLAUDE.md** quand l'architecture évolue significativement

## 🆘 Si tu démarres une nouvelle session

Lis dans cet ordre :
1. Ce fichier (`CLAUDE.md`)
2. `docs/INFRA-PRODUCTION.md` (état actuel infra)
3. `docs/AGENTS-STRATEGY.md` (architecture Marcel)
4. `workers/CLAUDE.md` (règles agents)
5. `docs/AUDIT-MOCKUP-VS-REEL.md` (live vs mockup)

Tu sauras exactement où on en est en 5 minutes.

---

© 2026 IKCP — Maxime Juveneton · ORIAS 23001568
