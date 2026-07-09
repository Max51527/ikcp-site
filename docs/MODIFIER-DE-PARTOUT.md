# 🌍 Modifier le Site et l'App depuis n'importe où (sans ton PC)

> Ton dépôt GitHub est ton atelier accessible partout : ordinateur, tablette, même
> le téléphone. Deux zones bien séparées, un seul coffre. Éditer sur github.com
> **publie directement** — la mise en ligne se déclenche toute seule (~1 min).

---

## Les deux zones (à ne jamais confondre)

| Zone | Où | Ce que tu y touches |
|---|---|---|
| 🌐 **SITE public** | racine du dépôt (`marcel.html`, `cabinet.html`…) | la vitrine ikcp.eu |
| 📱 **APPLICATION** | dossier **`app/`** | l'espace membre = ton app Android |
| ⚙️ Services (avancé) | dossier `workers/` | Marcel, paiement, veille… (on n'y touche qu'à deux) |

**Accès directs (mets-les en favori sur ton téléphone) :**
- SITE → `https://github.com/Max51527/ikcp-site` (les fichiers à la racine)
- APP → `https://github.com/Max51527/ikcp-site/tree/main/app`

## Éditer une page en 4 gestes (marche sur téléphone)

1. Ouvre le fichier voulu sur github.com (ex. `app/marcel.html`).
2. Touche l'icône **crayon** ✏️ (« Edit this file ») en haut à droite.
3. Modifie le texte.
4. Bouton vert **« Commit changes »** → « Commit directly to the main branch » → valider.

➡️ C'est publié. La mise en ligne démarre seule. Sur ton téléphone : ferme/rouvre l'app 2 fois.

## L'éditeur complet dans le navigateur (github.dev)

Pour une session de travail plus confortable (plusieurs fichiers, recherche) :
sur la page du dépôt, **appuie sur la touche `.` (point)** — un VS Code complet
s'ouvre dans le navigateur, sur ton dépôt. Tu modifies, puis onglet « Source
Control » → message → **Commit & Push**. Aucune installation.

## Les 3 règles d'or (pour ne jamais casser)

1. **Reste dans ta zone.** Tu retouches la vitrine → fichiers de la racine.
   Tu retouches l'app → dossier `app/`. Jamais l'un en croyant l'autre.
2. **Un changement à la fois**, avec un message clair (« corrige le prix sur la page tarifs »).
   Si ça déraille, on retrouve et on annule cette version précise.
3. **Jamais coller de mot de passe / clé** dans un fichier. Les clés vivent
   ailleurs (chez Cloudflare). En cas de doute → demande-moi.

## Si tu casses quelque chose

- Depuis le PC : bouton **« Annuler-la-derniere-publication »**.
- Depuis n'importe où : github.com → onglet **Commits** → ta bêtise → **« Revert »** → confirme.
  La version d'avant revient en ligne en 1 min. **Rien n'est jamais perdu**, tout l'historique reste.

## Pourquoi un seul dépôt (et pas deux)

L'app Android est **collée à l'adresse `ikcp.eu/app/`** (c'est le fichier `assetlinks`
à la racine du site qui enlève la barre d'adresse Chrome). Site et app partagent
donc le domaine ET la charte graphique. Les garder dans **un seul coffre bien
cloisonné** = tu édites partout, ils restent visuellement cohérents, et tu ne
republies jamais l'app Android par accident. La séparation est **dans l'organisation**,
pas dans deux dépôts qui divergeraient.

---
© 2026 IKCP — voir aussi MANUEL-DU-PROPRIETAIRE.md et SEPARATION-SITE-APP.md.
