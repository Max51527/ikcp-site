# 🗼 Workflow Webmaster — piloter la plateforme IKCP

> Console : `ikcp.eu/webmaster.html` (privée, noindex). Le poste de pilotage de Maxime.

## Les 3 lanes (qui modifie quoi)
| Lane | Quoi | Outil | Qui |
|---|---|---|---|
| **Contenu** | textes, prix, FAQ, images | Sveltia CMS `ikcp.eu/admin/` | Maxime (sans code) |
| **Pilotage** | membres, candidatures, stats, tiers, retours, santé agents | Cockpit `ikcp.eu/app/admin` | Maxime (clé admin) |
| **Infra** | workers, secrets (clés IA/Stripe), domaines | Cloudflare dashboard | Maxime |
| **Code** | design, agents IA, espace membre, outils | Claude → Git | Claude sur demande |

## Le flux Brouillon → Publication (staging → prod)
1. **Brouillon** : pour une modif de code, briefer Claude « **Sur staging : …** » → Claude pousse sur la branche `staging`.
2. **Prévisualiser** : Cloudflare Pages déploie `staging` sur **`staging.ikcp-eu.pages.dev`** (site brouillon, n'affecte pas la prod).
   - ⚠️ Prérequis : dans CF Pages → projet `ikcp-eu` → Settings → Builds & deployments → **Preview deployments = activés** (défaut). Si le brouillon ne s'affiche pas, vérifier ce réglage.
3. **Publier** : `ikcp.eu/webmaster.html` → bouton **« Publier le brouillon »** → ouvre la comparaison GitHub `main...staging` → **Create pull request → Merge** → la prod (`ikcp.eu`) se met à jour en ~1 min.

## Règle Claude (sessions futures)
- Par défaut, Claude pousse sur `main` (déploiement direct prod) — comportement actuel.
- Si Maxime dit « **sur staging** » → Claude pousse sur la branche `staging` (brouillon), puis Maxime publie via la console.
- Toujours `git pull --ff-only` avant tout (règle clone unique).

© 2026 IKCP · ORIAS 23001568
