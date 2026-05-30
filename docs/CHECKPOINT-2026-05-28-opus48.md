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

© 2026 IKCP · ORIAS 23001568 · checkpoint session Opus 4.8
