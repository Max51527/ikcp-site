# 📌 CHECKPOINT — Plateforme IKCP · 2026-05-28

> Sauvegarde avant bascule Opus 4.8. Clone canonique : `C:\Users\juven\ikcp-site` · `git pull --ff-only` avant toute reprise.
> Tout commité + poussé sur `Max51527/ikcp-site` (`main`). Cloudflare Pages déploie auto. Working tree propre.

---

## 🧭 DÉCISION STRATÉGIQUE (cap produit, actée)
**Modèle = Family Office digital privé, sur invitation** — PAS de white-label CGP (Option D abandonnée).
- Cible : **les clients de Maxime** d'abord, puis croissance **par recommandation / bêta-test**.
- **100 % digital, sauf si le client souhaite contacter Maxime** (humain à la demande).
- **Maxime garde la main** sur qui entre (accès gouverné, validation).
- **APIs & partenaires ajoutés progressivement**, un par un.
- Réglementaire : modèle gouverné + humain = **NIVEAU 2 défendable**. RDV avocat AMF au **1er client payant** (trigger de Maxime).
- **Hermes Agent (Nous Research)** = source d'idées uniquement (mémoire client + playbooks), on garde la stack souveraine. Voir `docs/MARCEL-MEMOIRE-SKILLS.md`.

---

## ✅ FAIT cette session (déployé)

### Accès gouverné = la « porte » du SaaS — OPÉRATIONNEL
- Backend `ikcp-client` : invitation + parrainage + candidatures + **décision admin → accorde le tier (FO/premium)**. Compte existant upgradé immédiatement ; nouveau compte créé au tier accordé à la 1ʳᵉ connexion.
- `app/beta-invite.html` : candidature gouvernée (code → profil → SIREN → seuil 1 M€).
- **`app/admin.html`** : console privée gatée par `ADMIN_SECRET` → générer des codes, voir/approuver/refuser les candidatures.
- **`ADMIN_SECRET` posé** (via Claude Chrome) → gate vérifiée live (403 sans clé). Boucle bêta prête à tester.

### « La Révélation » (valeur live, page Family Office)
- **Schéma patrimonial** généré en direct depuis le RNE réel (dirigeants → société → activité/siège).
- **Orchestration agents visible** : Marcel → Codex → Hermès s'allument (✓) à l'analyse.
- **Leviers détectés** : 3 axes d'optimisation (MIF II : axes à étudier, chiffrage réel par Marcel).
- **Conciergerie en direct** : agent Concierge prépare week-end/dîner/déplacement (réservations partenaires = « en intégration »).
- Aperçu autonome : `proposals/revelation-apercu.html` (live : `ikcp.eu/proposals/revelation-apercu`).

### Site public
- **Hero « IA × Humain » (concept B)** intégré dans `index.html` (orbite Marcel ↔ conseiller, trait d'or, CTA).
- **Playlist IKCP** : renommée + branchée Spotify (`7rGzxlLgjaqoq3bbPzwF6O`).
- `proposals/hero-video-options.html` (3 concepts, B retenu) · `proposals/parcours-beta.html` (parcours 6 étapes).

### Agents IA & espace membre
- **Tier par utilisateur** : Marcel propage le tier réel du membre à la veille (plus de défaut `fo`).
- **Marcel free** = avant-goût 3 échanges puis gate Premium (`app/marcel.html`).
- **PWA réparée** (`sw.js` v1.0.1), **veille.html** (tier `free` par défaut, deep réservé fo), **collections.html** (garde auth + données D1).
- **Explainer FO v2** (`proposals/explainer-marcel-anime.html`) : ouverture positive + réglage de vitesse.

### CI/CD
- `deploy-workers.yml` : job **ikcp-feedback** ajouté (déploie une fois la base D1 créée).

---

## 🩺 ÉTAT AGENTS (health 2026-05-28)
Marcel (ikcp-chat), Codex, Hermès, Lifestyle (9), Veille, Pappers, Client, Témoin, Collector, Voice → 🟢 OK.
**Bâtisseur** → 🟠 déployé, `api_key:false` (attend clé). **ikcp-feedback** → ⏳ prêt en CI, attend base D1. **ikcp-cms-auth** → 🔴 non déployé (CMS via PAT GitHub OK).

---

## ⏳ EN ATTENTE — actions Maxime
1. **Clé Bâtisseur** : Cloudflare → ikcp-batisseur → Settings → Variables → Secret `ANTHROPICAPIKEY` (`sk-ant-…`). → flip `live:true` côté Marcel → 11/11 agents.
2. **Base D1 feedback** : Cloudflare → D1 → créer `ikcp-feedback-db` (Western Europe) → **me coller le `database_id`** (UUID, pas un secret) → je branche `wrangler.toml` → CI déploie.
3. **Photo** `/icons/maxime.jpg` (sinon monogramme « MJ ») — hero + espace membre.
4. **Test du parcours connecté** : admin → code → candidature → validation → login magic link → espace FO → Marcel/veille/services.

---

## 🔜 PROCHAINES ÉTAPES (dev)
- **CMS Sveltia** : décision A (câbler lede/bêta/FAQ/SEO) ou B (nettoyer le CMS aux seuls champs reliés). *(Champs hero accueil+FO déjà synchro.)*
- Porter « La Révélation » (schéma + orchestration + leviers) dans **l'espace membre connecté**.
- **Conciergerie** : brancher de vrais partenaires quand disponibles.
- Mineur : prix en dur dans `app/securite.html` à aligner ; téléchargement docs (R2) à brancher.
- Marcel : mémoire client persistante + playbooks (parké, voir doc dédié).

---

© 2026 IKCP · ORIAS 23001568 · checkpoint avant bascule Opus 4.8
