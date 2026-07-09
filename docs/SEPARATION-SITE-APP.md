# 🗺️ Carte de séparation SITE / APPLICATION

> Un seul coffre GitHub (`Max51527/ikcp-site`), **deux zones étanches**.
> Règle d'or : avant de modifier, demande-toi « je touche au SITE ou à l'APP ? »
> et reste dans le bon dossier. Cette carte te dit exactement où est quoi.

---

## Les 4 zones

### 🌐 ZONE SITE — la vitrine publique (ikcp.eu)
**Où :** les `*.html` à la **racine** du dépôt.
- `marcel.html` — la landing principale (« Better call Marcel »)
- `cabinet.html` — le cabinet humain IKCP
- `index.html` — page d'accueil racine
- `decouvrir.html`, `avis.html`, `articles.html`… — pages publiques
- Pages légales : `mentions-legales.html`, `politique-confidentialite.html`, `cgu.html`, `cgv.html`, `confidentialite-marcel.html`
- Config : `_redirects`, `sw.js` (racine), `version.json`, `robots.txt`, `sitemap.xml`

**Qui la voit :** tout le monde, sur le web. **Jamais** de données client ici.

### 📱 ZONE APP — l'espace membre = ton application Android (ikcp.eu/app/)
**Où :** **tout** ce qui est dans le dossier **`app/`**.
- `app/index.html` — connexion · `app/dashboard.html` — accueil app (= démarrage Android)
- `app/marcel.html` (chat) · `app/simulateurs-pro.html` · `app/patrimoine-pro.html` (cockpit)
- `app/profil.html` · `app/veille.html` · `app/recueil.html` · `app/bilan.html` · `app/strategies.html`
- `app/univers-*.html` (dirigeant, libéral, créateur, sportif) · `app/onboarding.html`
- Le moteur : `app/css/marcel.css`, `app/js/*`, `app/sw.js`, `app/manifest.json`, `app/icons/`
- Pages **propriétaire** (toi seul) : `app/console.html`, `app/agents.html`, `app/securite.html`

**Qui la voit :** les membres connectés. C'est **exactement** ce que ton téléphone affiche.

### 🤝 ZONE PARTAGÉE — l'identité commune
- **La charte** : navy `#1B2A4A`, or `#C9A96E`, crème `#FAF8F4`, polices Playfair Display + Outfit.
  Le site et l'app la partagent → c'est ce qui fait que « le visuel de l'app correspond au site ».
  ⚠️ Si tu changes une couleur de marque, pense à l'appliquer **des deux côtés**.
- `.well-known/assetlinks.json` — **le fichier qui marie l'app Android au domaine** (à la racine
  du site, mais il « appartient » à l'app). **Ne jamais y toucher** sans raison — il enlève la
  barre d'adresse Chrome. C'est LUI qui rend le split en deux dépôts impossible sans republier l'app.

### ⚙️ ZONE BACKEND — les services (avancé, à deux)
**Où :** dossier **`workers/`**. Marcel (`ikcp-marcel/` → déployé sous le nom `ikcp-chat`),
paiement/connexion (`ikcp-client`), agrégation bancaire (`ikcp-powens`), veille, patrimoine, etc.
Le cerveau IA est **Mistral (souverain FR)** partout. On n'y touche qu'ensemble.

## Repérage express : « ce fichier, c'est quoi ? »

| Le chemin commence par… | Zone | Tu modifies quoi |
|---|---|---|
| `app/` | 📱 APP | ce que voit un membre / le téléphone |
| `workers/` | ⚙️ BACKEND | les services (avec moi) |
| `.well-known/`, `*.css` de marque | 🤝 PARTAGÉ | prudence, impacte les deux |
| tout le reste à la racine (`*.html`) | 🌐 SITE | la vitrine publique |

## Pièges à éviter

1. **Ne confonds pas `marcel.html` (racine = SITE, la landing) et `app/marcel.html` (APP = le chat).**
   Ils portent le même nom mais vivent dans deux zones différentes. Le chemin fait foi.
2. **Une page SITE ne doit jamais afficher de données client** — ça, c'est le rôle de l'APP (zone protégée).
3. **La charte reste commune.** L'app a le droit de nuancer (ex. l'univers Créateur en « velours » violet,
   ou la couleur chaleureuse du niveau Découverte) — c'est voulu — mais le socle navy/or/crème doit
   rester reconnaissable, pour que l'app soit lue comme la continuité du site.

## Pourquoi un seul dépôt (rappel)

L'app Android est liée à `ikcp.eu/app/` par le `manifest` + `assetlinks` (à la racine du domaine).
Deux dépôts séparés forceraient soit à déménager l'app (→ republier le `.aab` sur le Play Store),
soit à faire diverger deux chartes (→ l'inverse de ton exigence « l'app doit correspondre au site »).
**Un coffre unique, deux zones étanches** = tu édites partout (github.com), séparation nette,
cohérence garantie, zéro risque Android. Voir `MODIFIER-DE-PARTOUT.md`.

---
© 2026 IKCP — voir aussi MODIFIER-DE-PARTOUT.md et MANUEL-DU-PROPRIETAIRE.md.
