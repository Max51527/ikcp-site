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

## 🚀 LANCEMENT (ouverture privée gouvernée, pas public)
Le « lancement » = inviter les 2-3 premiers clients fondateurs → retours → itérer → élargir vers 50.

**Pré-vol :**
- ✅ #5 **Polish PWA mobile** : vraies icônes PNG (192/512/180), manifest + apple-touch-icon. L'espace membre s'installe comme une app (iOS/Android).
- ✅ #6 **QA espace membre** : toutes les pages protégées ont garde d'auth + SW + API ; 10 workers bien câblés. (mineur : SW absent sur onboarding.html.)
- ⏳ #1 **Test parcours connecté A→Z** (Maxime + moi) — LE point critique avant d'inviter.
- ⏳ #2 clé Bâtisseur · #3 base D1 feedback (coller l'ID) · #4 photo maxime.jpg — Maxime.
- ⏳ #7 1ᵉʳ client payant → RDV avocat AMF (trigger Maxime).

**App mobile** : la **PWA installable EST l'app** pour la bêta (0 €, souverain). **Vraie app stores plus tard via Capacitor** (réutilise la PWA) : ~99 €/an Apple + 25 € Google + temps. App native repartie de zéro = ❌ (10-30 k€, doublon).

---

## ⚖️ MODÈLE LÉGAL & PAIEMENT (décision 2026-05-28)
**PAS de DER ni de Lettre de Mission** — il n'y a pas de souscription à un produit régulé.
Modèle **SaaS « à la Finary »** :
- **Contrat d'utilisation (CGU) + CGV + Politique de confidentialité + Mentions légales**, **acceptés à l'inscription**.
- **Disclaimers MIF II conservés** (renforcent « outil d'information, pas de conseil »).
- ✅ **Consentement MIF II déjà posé à l'onboarding** (commit 9c39c2d) — à relier au futur « contrat d'utilisation ».
- ⚠️ **Nuance CIF** : le contrat doit tracer la ligne NETTE — l'outil = info/analyses/cartographie, **pas** de conseil perso ni de gestion ; le conseil régulé = **mission CGP distincte** (là, DER/LM réapparaissent). C'est ce qui distingue le SaaS du conseil régulé pour l'AMF.
- **Paiement = Stripe Checkout hébergé** dans `ikcp-client` (aucune donnée carte dans notre code ; PCI géré par Stripe). Stripe actuellement `false`. Maxime : crée le compte Stripe (compte PRO) + produits/prix Premium/FO + **pose `STRIPE_SECRET_KEY` en secret lui-même** (Claude ne touche jamais aux identifiants de paiement).

### File conformité/paiement — AVANCEMENT (session Opus 4.8, 2026-05-28)
1. ✅ **Modèle coûts + grille tarifaire** → `docs/PRICING-2026.md` (Premium reco **59 €**, FO sur reco, coût IA Découverte 0 € / Premium ~5 € / FO ~30 €, marge ~90 %).
2. ✅ **CGV** créées → `cgv.html` (+ liens footers). CGU/mentions/confidentialité existaient déjà et sont solides (CGU Art.3 = ligne MIF II). DER retiré du footer espace membre (reste pour mission CGP distincte).
3. ✅ **Stripe Checkout** : backend (Checkout/Portal/Webhook) déjà codé + schema OK ; ajouté front (`Marcel.Billing` dans api.js + carte Abonnement dans profil.html par tier). Guide : `docs/SETUP-STRIPE.md`.
4. ⏳ **Consentement** : déjà posé à l'onboarding (commit 9c39c2d) — couvre l'acceptation du cadre.

### Reste à faire
- **Maxime** : activer Stripe (compte PRO + produits/prix + 4 secrets + webhook) → voir `docs/SETUP-STRIPE.md`. Décider prix Premium (reco 59 €).
- **Maxime** : clé Bâtisseur, base D1 feedback (coller l'ID), photo maxime.jpg.
- **Ensemble** : test du parcours connecté A→Z (brique 4) + test paiement Stripe en mode Test.
*(Rappel honnête : revue avocat unique recommandée au 1ᵉʳ client payant ; Claude n'est pas avocat, ne garantit pas la conformité juridique. CGU/CGV = projets à valider.)*

---

© 2026 IKCP · ORIAS 23001568 · checkpoint avant bascule Opus 4.8
