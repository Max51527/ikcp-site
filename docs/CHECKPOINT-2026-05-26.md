# 📌 CHECKPOINT — Plateforme IKCP · 2026-05-26

> Sauvegarde de session. Clone canonique unique : `C:\Users\juven\ikcp-site` · `git pull --ff-only` avant toute reprise.
> Tout est commité + poussé sur `Max51527/ikcp-site` (branche `main`). Cloudflare Pages déploie automatiquement.

---

## ✅ FAIT cette session (déployé / en ligne)

### Site public ikcp.eu
- **Hero « IA × Humain » (concept B)** intégré dans `index.html` : orbite **Marcel** cliquable (ouvre le chat) reliée par un trait d'or animé au médaillon **conseiller humain** (« MJ » → photo dès dépôt de `/icons/maxime.jpg`), tagline « Une intelligence souveraine. Un conseiller humain. » + CTA. Colonne droite réactivée (2 colonnes ≥980px) ; ancien panneau montgolfière conservé dormant (`.sky-block` masqué).
- **Playlist hero** : renommée « Playlist IKCP » (était « Maxime ») + branchée sur Spotify (embed `7rGzxlLgjaqoq3bbPzwF6O`).

### Agents IA (worker ikcp-marcel / ikcp-chat)
- **Tier par utilisateur sur la veille** : Marcel propage le tier RÉEL du membre connecté (`free`/`premium`/`fo`) à ikcp-veille au lieu d'un `fo` codé en dur. `consult_veille` masqué aux free/anon (plus de 403 stérile ; web_search reste dispo). Réservé premium/fo.
- **delegate_to_specialist** : enum régénéré depuis `SPECIALISTS_IDS_LIVE` → ne propose jamais un worker non déployé (Bâtisseur tant que sans clé).
- Démo live validée : question transmission → réponse Dutreil structurée (art. 787 B), pattern « L'essentiel », disclaimer L.541-1, follow-ups, contexte saisonnier.

### Espace membre (app/)
- **PWA réparée** (`sw.js` v1.0.1) : précache nettoyé (fichiers fantômes retirés), install résiliente (`allSettled`), icônes push = `marcel.svg`.
- **veille.html** : tier ne fail plus ouvert sur `fo` (défaut `free`) ; mode deep réservé fo, premium = quick.
- **collections.html** : garde d'authentification + bandeau « démonstration » (données d'exemple).
- **Marcel free = avant-goût 3 échanges** (`marcel.html`) : compteur local par membre, puis gate « Passez en Premium » + CTA offres. premium/fo illimités. *(Décision Maxime : option B.)*

### Family Office
- **Explainer animé Marcel v2** (`proposals/explainer-marcel-anime.html`) : ouverture reframée en positif (« Une porte. Une équipe. Votre patrimoine en orbite. » — retrait du « patrimoine dispersé ») + réglage de vitesse 1× / 1.5× / 0.5×. En ligne : `ikcp.eu/proposals/explainer-marcel-anime`.

### Propositions
- **3 concepts vidéo hero** (`proposals/hero-video-options.html`) — **B validé** et intégré (voir ci-dessus). A (Ascension) et C (Construction) restent dispo.

### CI/CD
- `deploy-workers.yml` : job **ikcp-feedback** ajouté (path + dispatch + deploy). *Déploiement effectif une fois la base D1 créée.*

---

## 🩺 ÉTAT DES AGENTS (health 2026-05-26)
| Agent | État |
|---|---|
| Marcel (ikcp-chat), Codex, Hermès, Lifestyle (9), Veille, Pappers, Client, Témoin, Collector, Voice | 🟢 OK |
| **Bâtisseur** | 🟠 déployé, `api_key:false` → attend clé Anthropic |
| ikcp-feedback | ⏳ prêt en CI, attend la base D1 |
| ikcp-cms-auth | 🔴 non déployé (CMS fonctionne via PAT GitHub) |

---

## ⏳ EN ATTENTE — actions Maxime (≈5 min)
1. **Clé Bâtisseur** (active le 11ᵉ agent) :
   ```
   cd workers/ikcp-batisseur && npx wrangler secret put ANTHROPICAPIKEY
   ```
   → clé `sk-ant-...` depuis console.anthropic.com (réutiliser celle de Codex/Hermès OK). Prévenir → flip `live:true`.
2. **Base D1 feedback** (active l'option A — stockage des retours bêta) :
   ```
   cd workers/ikcp-feedback
   npx wrangler d1 create ikcp-feedback-db --location weur
   npx wrangler d1 execute ikcp-feedback-db --remote --file=schema.sql
   ```
   → coller le `database_id` (UUID, pas un secret) → branchement dans `wrangler.toml` → CI déploie.
3. **Photo** `/icons/maxime.jpg` (sinon monogramme « MJ ») — pour le hero + l'espace membre.

---

## 🔜 PROCHAINES ÉTAPES (dev)
- Tester le parcours connecté de bout en bout (login magic link Maxime) — valider le tier réel propagé à la veille.
- Brancher collections.html sur `/api/v1/me/collections` (données réelles) quand pertinent.
- Enrichir l'espace membre (tâche #3 ouverte).
- Mineur : prix 49€/149€ en dur dans `app/securite.html` à aligner sur la facturation réelle ; téléchargement docs (R2) à brancher.

---

© 2026 IKCP · ORIAS 23001568 · checkpoint session bêta-readiness
