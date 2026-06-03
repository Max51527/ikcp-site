# Prototype RuFlo — évaluation pour IKCP

> Bac à sable isolé. **Aucun lien avec le site live ni les workers Cloudflare.**
> Installé le 2026-06-03 (session Opus 4.8) à la demande de Maxime : *« installer / prototyper ruflo pour l'essayer »*.

## C'est quoi RuFlo ?

[`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) (npm `ruflo@alpha`, v3.10.36) — un **méta-harnais d'orchestration multi-agents** au-dessus de Claude Code. C'est le successeur / rebrand de `claude-flow` (les fichiers internes s'appellent encore `.claude-flow`, `CLAUDE_FLOW_*`, `@claude-flow/*`).

Briques principales :
- **Swarms d'agents** : topologies hiérarchique / mesh, jusqu'à 15 agents coordonnés (positionné « 100+ agents »).
- **Mémoire vectorielle** (AgentDB) : indexation HNSW, embeddings 384-dim, recherche sémantique sub-milliseconde.
- **Auto-apprentissage** : « reasoning bank » + patterns neuronaux, entraînés sur les trajectoires de tâches réussies.
- **Hooks Claude Code** : 11 types de hooks branchés sur chaque outil (PreToolUse, PostToolUse, SessionStart, etc.).
- **Multi-provider** : routage Anthropic / OpenAI / Google / Ollama + embeddings locaux (Transformers.js).
- **Fédération** : collaboration cross-machine zero-trust / mTLS (plugin optionnel, non installé ici).

## Comment ça a été installé

```bash
mkdir -p prototypes/ruflo-test && cd prototypes/ruflo-test
npx -y ruflo@alpha init      # 12 dossiers, 106 fichiers créés
```

`init` génère :

| Élément | Détail |
|---|---|
| `CLAUDE.md` | guidance swarm + règles de coordination SendMessage |
| `.claude/settings.json` | **11 types de hooks** + statusLine + permissions + config `claudeFlow` |
| `.claude/skills/` | 30 skills |
| `.claude/commands/` | 16 slash-commands |
| `.claude/agents/` | 6 agents (researcher, coder, tester, reviewer, coordinateurs swarm…) |
| `.claude/helpers/` | scripts node (`hook-handler.cjs`, `intelligence.cjs`, `learning-service.mjs`…) |
| `.mcp.json` | serveur MCP `claude-flow` (lance `npx -y ruflo@latest mcp start`) |
| `.claude-flow/` | runtime : config.yaml, data, logs, sessions |

## Ce qui a été testé (✅ fonctionne)

| Commande | Résultat |
|---|---|
| `ruflo --help` | ✅ CLI complète (init, swarm, memory, neural, security, hive-mind…) |
| `ruflo doctor` | ✅ 12 checks OK, 5 warnings (voir ci-dessous) |
| `ruflo memory init` | ✅ DB sql.js + HNSW, 6/6 tests de vérif passés |
| `ruflo memory store --key … --value …` | ✅ stocké, vecteur 384-dim généré |
| `ruflo memory search --query …` | ⚠️ « No results found » sur une entrée unique (seuil sémantique / indexation — à creuser) |
| `ruflo swarm init --topology hierarchical-mesh` | ✅ swarm créé, message-bus, auto-scale |
| `ruflo providers list` | ✅ 7 providers listés, tous *Not configured* (aucune clé) |

Embeddings : modèle **`all-MiniLM-L6-v2`** téléchargé depuis `huggingface.co` au 1ᵉʳ run puis exécuté **en local** (Transformers.js) — aucune clé requise.

## ⚠️ Points de vigilance pour IKCP (RGPD / souveraineté / sécu)

Avant tout usage au-delà du bac à sable, à arbitrer au regard des règles `CLAUDE.md` (RGPD souverain France, MIF II, secrets) :

1. **`npx -y ruflo@latest` dans `.mcp.json`** → le serveur MCP retélécharge la **dernière** version à chaque démarrage. Risque chaîne d'appro + non-reproductibilité. → **épingler une version exacte** si adopté.
2. **Chiffrement au repos OFF** (warning doctor) : mémoire / sessions / terminal stockés en **clair** (mode 0600 seulement). Rédhibitoire pour des données patrimoniales clients.
3. **Téléchargement modèle depuis huggingface.co** (CDN US/Cloudflare) au 1ᵉʳ run. À pré-charger / mettre en cache souverain si déploiement sensible.
4. **Routage LLM par défaut = Anthropic** (`claude-opus-4-8` / `claude-haiku` pour le routing). Même posture que l'usage Anthropic actuel d'IKCP — pas de provider US *supplémentaire* tant qu'OpenAI/Google ne sont pas configurés.
5. **11 hooks branchés sur chaque outil** + daemon avec workers planifiés (audit 4h, optimize 2h) et `autoTrain`. Puissant mais opaque ; `daemon.autoStart` est à `false` par défaut (bien). Ne jamais copier ce `settings.json` à la racine du repo live sans revue.
6. **Statut alpha** (`ruflo@3.10.36`, dist-tags alpha/v3alpha). API instable.

## Recommandation

RuFlo recoupe directement l'architecture **Marcel + sous-agents** d'IKCP (orchestration, mémoire, routage). Intéressant comme **source d'inspiration** (patterns de coordination, mémoire HNSW locale, hooks self-learning) mais **pas prêt pour la prod patrimoniale** en l'état (alpha, chiffrement au repos off, supply-chain `@latest`).

→ Prochaine étape suggérée si on veut aller plus loin : monter un POC ciblé sur **un seul** mécanisme (ex. mémoire vectorielle locale pour Marcel) plutôt que d'adopter le harnais complet.

## Nettoyage

Bac à sable supprimable sans impact :

```bash
rm -rf prototypes/ruflo-test
```

Les artefacts runtime (`*.db`, `.swarm/`, `.claude-flow/data|logs|sessions`) sont gitignorés et **ne sont pas** committés.
