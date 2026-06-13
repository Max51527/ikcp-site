# 📌 CHECKPOINT — Session Opus 4.8 · 2026-05-28

> Suite de `CHECKPOINT-2026-05-28.md`. Clone canonique `C:\Users\juven\ikcp-site` · `git pull --ff-only` avant tout.
> Tout commité + poussé sur `Max51527/ikcp-site` (main). Cloudflare Pages + workers déploient en auto.

---

## ✅ FAIT cette session (Opus 4.8) — tout déployé

| Brique | Détail | Commit |
|---|---|---|
| **Coûts + grille tarifaire** | `docs/PRICING-2026.md` — Premium reco 59 €, FO sur reco, coût IA Découverte 0/Premium ~5/FO ~30 € | 171d9c3 |
| **CGV** | `cgv.html` (SaaS, outil≠conseil, Stripe, rétractation) + liens footers | cf71027 / c056bac |
| **Stripe front** | `Marcel.Billing` (api.js) + carte Abonnement par tier (profil.html) | 89a59f7 |
| **Guide Stripe** | `docs/SETUP-STRIPE.md` | 6f46031 |
| **Gating coûts IA** | Opus (Codex/Hermès/Bâtisseur) + veille = membres payants only ; prospects = Sonnet | 20f4b7a |
| **Protection anti-copie** | `protect.js` (Ctrl+C→attribution+leurre, filigrane visible sur capture, crédit permanent) sur 84 pages (hors légales/admin) | de70321 / e762858 |
| **Module Investir** | `investir.html` — 9 styles d'investissement, échelle de risque, quiz profil, simulateur intérêts composés (éducatif, MIF II) | 9294a1f |
| **Expertise Marcel** | directive « expertise patrimoniale introuvable ailleurs » (articles, angles morts CGP) — testé live 4164 car. | 8dd2559 |
| **Freemium quota serveur** | TIER_LIMITS free marcel_msgs 5/mois + endpoint `/api/v1/usage/marcel` (check+incrément) + enforcement Marcel (anti-triche) | d66ca91 |
| **Feedback par email** | endpoint `/api/v1/feedback` → email Maxime via Resend (testé `emailed:true`) | 2d2f5f6 |
| **Placeholder login neutre** | `votre@email.fr` | 9fddab5 |
| **Voix** | déjà câblée (STT Whisper + TTS navigateur) — vérifié, rien à faire |

## 🩺 ÉTAT LIVE (sondé 28/05)
- Agents : Marcel, Codex (`api_key:true`), Hermès (`true`), Lifestyle (`true`), Veille (`true`) 🟢 · **Bâtisseur `api_key:false`** 🔴 · Voice STT ok / TTS non configuré.
- ikcp-client : db/kv/resend ✅, **stripe:false**, dev_mode:false. admin 403 (gate ok), usage/marcel 401 (gate ok), feedback `emailed:true` ✅.
- Pappers, Témoin 🟢. Feedback worker déployé (D1:false — non utilisé, on passe par email).

---

## 🔴 LE BLOCAGE N°1 : LOGIN (cookie tiers)
Le login **reboucle** (confirmé Maxime) : cookie posé sur `…workers.dev`, site sur `ikcp.eu` = cookie tiers bloqué par le navigateur. Fix `SameSite=None` insuffisant (Safari/Chrome bloquent les cookies tiers).

**FIX = API en 1ʳᵉ partie sur sous-domaines `ikcp.eu` :**
- **Action Maxime** (CF → Workers & Pages → Settings → Domains & Routes → Add Custom Domain) :
  1. `api.ikcp.eu` → **ikcp-client**
  2. `chat.ikcp.eu` → **ikcp-chat** (Marcel lit le cookie pour le tier/quota → doit être même domaine)
  → vérifier `https://api.ikcp.eu/health` = 200.
- **Action Claude (dès domaines OK)** :
  - cookie `Domain=.ikcp.eu; SameSite=Lax` (verify + logout) dans `workers/ikcp-client/worker.js` (~l.212/223)
  - `wrangler.toml` ikcp-client : `APP_URL = "https://api.ikcp.eu"`
  - `app/js/api.js` : `ENDPOINTS.client = 'https://api.ikcp.eu'`, `ENDPOINTS.chat = 'https://chat.ikcp.eu'`
  - redeploy ikcp-client + ikcp-chat (push CI)
  → cookie 1ʳᵉ partie envoyé à api + chat → login persiste partout (Safari inclus).

## ⏳ AUTRES ACTIONS MAXIME
- **Bâtisseur** : CF → ikcp-batisseur → Settings → Variables → Secret `ANTHROPICAPIKEY` = `sk-ant-…` → dis « fait » → flip `live` dans Marcel SPECIALISTS_REGISTRY (l.54).
- **Stripe** (quand monétisation) : compte + produits + secrets (voir `docs/SETUP-STRIPE.md`).
- **Charges mensuelles (€)** : à donner → calcul du seuil de rentabilité (combien de Premium pour l'équilibre).

## 🔜 BACKLOG (buildable, certains sans login)
- **OCR avis d'imposition** (Tesseract.js client-side, zéro upload) → pré-remplit simulateurs. Sans dépendance login.
- **Bilan patrimonial visuel** (graphiques allocation/IFI/transmission).
- **Mémoire souveraine Marcel** (idée Hermes, auditable) — voir `docs/MARCEL-MEMOIRE-SKILLS.md`. Test nécessite login OK.
- **Interface FO à photos** : `proposals/espace-membre-fo.html` → promouvoir en expérience membre réelle. Test nécessite login OK.
- **Icônes de partage** visibles (`window.ikcpShare`) sur family-office + investir.

---

## ✅ AJOUTS (suite session Opus 4.8)
- **Login par jeton** (commit b1788f8) : `requireSession` accepte `Authorization: Bearer` ; verify renvoie `#s=<token>` ; api.js capte/stocke/envoie le jeton ; Marcel transmet l'auth. → **contourne le cookie tiers, plus de reboucle, ~30j**. CORS +Authorization (client + chat). *Vérifié : rejets 401/403 OK ; succès = nécessite 1 clic email (test Maxime).*
- **Espace test client** : endpoint admin `/set-tier` + carte 🧪 dans admin → Maxime se passe en FO pour tester l'expérience client.
- **Tour de contrôle** (admin) : santé système live (10 services), accès rapides (CMS/site/app/Cloudflare/GitHub), état automatisations. = la page « tout gérer ».
- **Cron veille nocturne** (ikcp-veille, commit 52d77aa) : `scheduled()` 6h UTC → digest patrimonial Perplexity → KV 36h + GET `/digest` ; veille.html affiche « Veille du jour ». Comble le gap automatisation.
- **Feedback email**, **module Investir**, **protection 84 pages**, **reveal.js (mouvement)**, **icônes partage**, **aperçu.html**, **expertise Marcel**, **freemium quota serveur** — tous live.

## 🔎 AUDIT IA/AUTO/API (28/05)
- **IA** : Marcel/Codex/Hermès/Lifestyle/Veille 🟢 ; Bâtisseur 🔴 clé ; Voice 🟡 TTS off.
- **Automatisations** : Collector (6h) + Veille nocturne (6h, nouvelle). SEO = poste Maxime.
- **API actives souveraines** : Pappers, INSEE, Resend (FR) + Anthropic/Perplexity (DPA). Stripe prêt (clé). Legacy à nettoyer : ikcp-api/prospect (Notion/PISTE), Universign (pausé), Brevo (contourné).

## 🎛️ GESTION = 4 couches (pas un nouveau site)
Cockpit `/app/admin` (business) · Sveltia `/admin` (contenu) · Cloudflare (infra) · Claude+GitHub (code). La **Tour de contrôle** dans /app/admin les réunit.

## ⏳ RESTE (Maxime)
1. **Test login** (clic email → reste sur dashboard ?) — débloque l'espace membre.
2. **Clé Bâtisseur** (→ 11ᵉ agent). 3. **Stripe** (compte+secrets, quand monétisation). 4. **Charges mensuelles** (→ seuil rentabilité).
Backlog : espace membre sur-mesure (après login OK), OCR avis d'imposition, interface FO à photos en réel, mémoire Marcel.

---

## ✅ AJOUTS (fin de session — login validé + features addictives)
- **LOGIN VALIDÉ DE BOUT EN BOUT** : testé par Claude via compte technique (hook retiré). Cause réelle du reboucle trouvée + corrigée = **`/me` plantait** (`D1_ERROR: no such column: prenom`, base D1 antérieure) → 500 → boucle. Fix : `handleMe` résilient (jamais 500) + `ensureUserColumns()` (ALTER auto à la connexion). Commits de61e04 / 639a02e. **Le login fonctionne.**
- **QA parcours** : bugs corrigés (collections `askSpecialist` non exposée = bouton mort ; doublon `askMarcelAbout` ; libellé securite ; ancre #abonnement ; prix en dur neutralisés). Commit e535dd2.
- **App téléphone** : `pwa-install.js` (invite installation Android/iOS) liée au compte (jeton persistant). Commit c1f390b.
- **SCORE PATRIMONIAL** (`score.html`) — lead magnet addictif : diagnostic 360° 7 territoires → jauge animée 0-100 + sous-scores + 3 leviers prioritaires → chaque levier ouvre Marcel (`family-office?q=`). Partage viral + en hero + dans aperçu. MIF II (diagnostic, pas conseil). Commits ab9fb2e / e41afc0 / 2e184b1.
- **CLAUDE.md** remis à l'état réel (commit 8ef8b03).

## 🧰 OUTILS ADDICTIFS LIVE (lead magnets, éducatifs, branchés Marcel)
- `/score.html` — Score Patrimonial 360° (7 territoires) + évolution.
- `/transmission.html` — transmission intergénérationnelle (droits sans/avec anticipation, barèmes 2026).
- `/remuneration.html` — salaire vs dividendes selon forme sociale (SAS/TNS).
- `/epargne-salariale.html` — PEE+PER+abondement, sortie quasi-franchise dirigeant.
- `/investir.html` — styles d'investissement + quiz + simulateur.
Tous : MIF II (info, pas conseil), `?q=` → ouvre Marcel, dans `/apercu.html`.

## 🗼 PASSERELLE WEBMASTER (pilotage sans tout coder)
- `/webmaster.html` — console : flux Brouillon→Prévisualiser→Publier + lancements (CMS, staging, prod, cockpit, GitHub publish, Cloudflare).
- Branche **`staging`** → preview Cloudflare `staging.ikcp-eu.pages.dev` (vérifier preview deployments activés dans CF Pages).
- Publier = merge `staging`→`main` (2 clics GitHub). Doc : `docs/WORKFLOW-WEBMASTER.md`.
- Règle Claude : push `main` par défaut ; « sur staging » → push branche `staging`.

## 🔜 ROADMAP ADDICTIVE (à poursuivre)
- **Conciergerie réelle** : Cal.com (RDV Maxime, gratuit/souverain) → Booking/TheFork.
- **Veille API utile** : DVF (prix immo par adresse, gratuit 🇫🇷) = le plus « waouh ».
- **Score persistant connecté** : sauvegarder le score du membre + suivi dans le temps (progression = rétention).
- **Chantiers patrimoniaux** : checklist de complétion (% par territoire) dans le dashboard → biais de complétion.
- **Push PWA** (sw.js prêt) : re-engagement (veille du jour, alertes).
- **OCR avis d'imposition** (Tesseract client-side) → pré-remplit Score + simulateurs.
- **Interface FO à photos** (espace-membre-fo.html) → expérience membre réelle.
- **Mémoire Marcel** (doc dédié).

---

© 2026 IKCP · ORIAS 23001568 · checkpoint session Opus 4.8
