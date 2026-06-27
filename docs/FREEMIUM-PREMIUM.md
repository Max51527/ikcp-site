# Modèle Freemium — Découverte vs Premium (source de vérité)

> Offre = **2 tiers seulement** : **Découverte (gratuit)** et **Premium (59 €/mois)**. 100 % IA self-service, aucun humain inclus (l'humain = consultation séparée). Le tier `fo` (Family Office) est **hérité/abandonné** — conservé en alias technique pour d'éventuels comptes anciens, **jamais attribué** aux nouveaux.

## La distinction (matrice officielle)

| Capacité | 🆓 Découverte (free) | 💎 Premium (59 €/mois) |
|---|---|---|
| Marcel (conversation, Sonnet souverain) | **5 messages / mois** | **illimité** |
| Sous-agents experts (Opus : Codex fiscal, Hermès transmission, Bâtisseur) | ❌ | ✅ |
| Veille temps réel (Perplexity) | ❌ | ✅ |
| Cartographie société (Pappers) | 1 / mois | 10 / mois |
| Mémoire conversationnelle | ❌ | 90 jours |
| Agrégation bancaire (Powens) | ❌ | ✅ |
| Simulateurs patrimoniaux | aperçu (les gratuits) | les 12 |
| OCR photo d'avis, PDF Bilan/Audit, synchro compte | aperçu / limité | ✅ |
| Essai | — | **14 jours de Premium offerts** à l'inscription |

## Où c'est appliqué (et donc à garder cohérent)

**Backend — `workers/ikcp-client/worker.js` = SOURCE DE VÉRITÉ**
- `TIER_LIMITS` : `free` / `premium` (+ `fo` legacy = illimité). Pappers, marcel_msgs, memory, powens par tier.
- `effectiveTier()` : un compte `free` de moins de 14 jours est traité comme **`premium`** (essai). ✅ corrigé (était `fo`).
- `/me` renvoie le **tier effectif** (essai = premium) + `trial` (jours restants) → le frontend s'y fie.

**Backend — `workers/ikcp-chat` (Marcel)**
- Quota mensuel : free = 5, premium/fo = illimité (sinon message d'upsell, zéro coût LLM).
- `isPaidMember = premium || fo` → débloque les **sous-agents Opus** + **veille**.
- Orchestrateur = Sonnet pour tous (l'Opus, c'est les sous-agents, pas Marcel).

**Frontend**
- `<html data-tier="…">` piloté par `localStorage.ikcp_tier` (posé par `/me`). CSS masque/affiche selon le tier.
- Défaut quand tier inconnu = **`free`** (moindre privilège). ✅ corrigé (`api.js`, `patrimoine-pro.html` étaient à `fo`).
- Premium reçoit : mémoire, voix premium, tous simulateurs, sous-agents (via backend).

## Corrigé le 26 juin 2026 (distinction Free/Premium nette)
1. **Essai = Premium** (était « Family Office complet ») — `ikcp-client effectiveTier`.
2. **Faille de moindre privilège** : défaut tier `fo` → `free` (`api.js` veille, `patrimoine-pro.html`).
3. **Cohérence admin** : attribution par défaut `fo` → `premium` (`admin.html`, `console.html`).
4. `fo` documenté comme **legacy** (plus jamais attribué).

## Règle d'or coût (Maxime)
> **Le FREE ne consomme AUCUN token LLM payant** : simulateurs (JS local) + 1 cartographie Pappers/mois. Marcel conversationnel = Premium. La profondeur (Opus + veille) = Premium. Lié [[decision_drop_fo_focus_dirigeant_freemium]], [[decision_consultation_150_freemium]].
