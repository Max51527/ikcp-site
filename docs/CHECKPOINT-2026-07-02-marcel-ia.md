# 🗂️ Marcel IA — Fichier source de développement (checkpoint 2 juillet 2026)

> Référence technique complète du produit à date. Remplace les checkpoints précédents pour l'état d'ensemble (les anciens `CHECKPOINT-*.md` restent comme historique).
> Repo : `github.com/Max51527/ikcp-site` · clone canonique unique `C:\Users\juven\ikcp-site` · déploiement Cloudflare Pages (frontend) + Workers (backend), CI/CD auto sur push `main`.

---

## 1. Architecture en un coup d'œil

```
  Navigateur
     │
     ├── Pages publiques + Espace membre (app/) ──► Cloudflare PAGES (HTML/CSS/JS statique)
     │
     └── fetch API ──► 14 Cloudflare WORKERS
                          · ikcp-chat (Marcel) = orchestrateur, Mistral souverain (UE)
                          · spécialistes, données, agrégation, doctrine
                                  │
                                  └──► D1 (Paris) + KV + Vectorize (doctrine RAG)
```
100 % souverain déclaré : moteur IA UE (Mistral), hébergement France/UE (Cloudflare WEUR), zéro dépendance US sur le pipeline sensible (Anthropic = secours uniquement).

## 2. Les 14 workers (tous `/health` 200 au 2 juillet)

| Worker | Rôle | Point notable |
|---|---|---|
| **ikcp-chat** (Marcel) | Orchestrateur, tools fiscaux, doctrine, délégation spécialistes | `mistral-souverain` primaire ; **filtre MIF II déterministe** (neutralise « idéal/je recommande/privilégiez/vous devriez… ») + filtre souveraineté (aucun nom de moteur/infra) appliqués sur CHAQUE réponse |
| **ikcp-client** | Auth lien magique, tiers, **Stripe** (checkout/webhook/portal), RGPD | Login **LIVE** (Resend, expéditeur « Marcel IA Patrimoniale »). Stripe : code complet, idempotent (table `stripe_events`), secrets posés par Max — test live en cours |
| **ikcp-pappers** | Identité société (SIREN) | 🟡 à court de crédits (401) — non bloquant, voir §4 |
| **ikcp-patrimoine** | Coffre `/state` (cross-device), audit 360° | — |
| **ikcp-powens** | Agrégation bancaire DSP2 | Coquille déployée, **pas encore configuré** (attend client_id/secret/D1) — slot UI réservé dans `patrimoine-pro.html` |
| **ikcp-rag** | Doctrine propriétaire IKCP | **26 fiches**, embeddings Mistral, seuil 0.45, **réservé Premium** (gating par `memberTier`) |
| **ikcp-veille** | Actualité (Perplexity) | Premium/FO uniquement |
| **ikcp-voice** | STT (Mistral Voxtral) + TTS (VoxCPM2) | Souverain |
| **ikcp-collector** | Cotations collection (montres, voitures, vins…) | CRON quotidien |
| **ikcp-temoin** | Journal d'audit MIF II | D1 Paris |
| **ikcp-codex / hermes / batisseur / lifestyle** | Spécialistes fiscal/transmission/360°/lifestyle | Délégation depuis Marcel |
| **ikcp-feedback** | Feedback bêta | D1 |

## 3. Front — pages publiques

- `index.html`, `marcel.html` (page produit : SIREN → cartographie → Marcel + **vitrine app** avec mockup mobile, cible rappelée « Dirigeant(e)s · Professions libérales · Influenceurs & créateurs », badge « 🔜 Bientôt disponible », QR en attente)
- `dirigeants.html` / `influenceurs.html` / `sportifs.html` — landings SEO d'acquisition, avant/après chiffré, pont de conversion vers `/creer-mon-compte`
- `creer-mon-compte.html`, `cabinet.html`
- `_headers` — **bug de cache résolu (2 juillet)** : Cloudflare Pages plafonne de force le cache des `.js` à 4h (réécrit silencieusement `no-cache`/`max-age=0`). Contournement : `public, max-age=0, must-revalidate` (honoré, revalidation ETag systématique). SW et `version.json` toujours frais.
- `_redirects` — V1 resserrée : **console de pilotage canonique = `/app/console`** (1070 lignes, contrôle complet membres/tiers/stats/feedback/candidatures/partenaires) ; les 5 autres consoles + 9 pages dev/legacy redirigent vers elle ou le dashboard ; doublons `patrimoine`/`simulateurs` → versions `-pro`.

## 4. Espace membre (`app/`) — état détaillé

| Page | État |
|---|---|
| `dashboard.html` | **Refondu** — Marcel au centre (hero conversation), 4 intentions, carte SIREN, signature **« Révéler mes pistes de réflexion »** (juridique/financier/fiscal, MIF II strict), 3 accès (audit 360°/schémas Premium/simulateurs), veille proactive, observation quotidienne (Premium). Nav : Accueil · Patrimoine · **M** (bouton vocal, clic pour parler, Whisper souverain) · Outils · **Stratégies**. Bulle flottante retirée (2 entrées propres). |
| `strategies.html` | Bibliothèque de **7 schémas visuels Premium** : OBO, apport-cession, Dutreil, holding/mère-fille, rémunération, démembrement, OBO immobilier — schéma SVG + avant/après chiffré 2026. |
| `bilan.html` | Audit 360° (Free = bilan, Premium = audit complet + export PDF). |
| `produits.html` | Catalogue **49 produits** — dont **régimes matrimoniaux** (6 fiches : communauté légale, séparation de biens, participation aux acquêts, communauté universelle, avantage matrimonial, changement de régime), ETF/actions/PEL-CEL/viager ajoutés. |
| `allocation.html` | **Nouveau** — guide d'allocation d'actifs **dynamique** : 2 curseurs (horizon, risque) → donut SVG animé (interpolation entre 4 profils) + projection avec bande d'incertitude. Hypothèses de rendement illustratives affichées, base neutre 100 000 €, jamais personnalisé (MIF II strict). |
| `console.html` | **La** console de pilotage (canonique). |
| `simulateurs-pro.html` | 12 calculateurs + liens de découverte vers `produits`/`allocation`. |
| `missions.html`, `simulateur-carriere.html`, `profil.html` (déclenche Stripe Checkout) | Inchangés / fonctionnels. |

## 5. Doctrine RAG — 26 fiches (Premium uniquement)

19 fiches issues de la doc Notion « Documentation » (OBO, Dutreil, holding, PV pro, SCI, IFI OBO, assurance-vie, régimes sociaux…) + 5 fiches-modèles (OBO, Dutreil, immo pro, rémunération/dividendes, IFI) + 2 nouvelles (**régimes matrimoniaux**, **allocation dirigeant**). Ingestion via `ikcp-rag/ingest-push` (curl — Python urllib bloqué par Cloudflare 1010). Gating : `ikcp-marcel/worker.js` n'injecte la doctrine dans le contexte que si `memberTier === 'premium' || 'fo'`.

## 6. Conformité MIF II — double verrou

1. **Prompt système** : formulation neutre imposée (conditionnel + faits comparés), calcul correct (IS sur bénéfice restant après rémunération déductible), marge de prudence (jamais 100 % distribué).
2. **Filtre déterministe** (`sanitizeOut`, ceinture-et-bretelles) : neutralise à coup sûr « idéal / je recommande / je conseille / vous devriez / privilégiez / optez pour / le meilleur choix / la meilleure option » → formulations neutres, **même si le modèle désobéit au prompt**. Même mécanisme que le filtre de souveraineté (aucun nom de moteur/infra exposé).

## 7. Monétisation

- **Freemium** : gratuit = cartographie SIREN + simulateurs + audit léger. **Premium** = doctrine RAG + audit 360° complet + 7 schémas + observation quotidienne.
- **Prix retenus** : 49 €/mois · 490 €/an (positionnement conseil patrimonial réel, volontairement au-dessus d'un simple agrégateur type Finary).
- **Stripe** : code complet et branché (`ikcp-client` → `handleStripeCheckout`/`handleStripeWebhook`/`handleStripePortal`). Secrets posés par Max (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_PREMIUM_MONTHLY` = `price_1ToPkNL0UeKYHH25SfYsKJBp`, `STRIPE_PRICE_PREMIUM_YEARLY` = `price_1ToPloL0UeKYHH25UCGBLZfH`, `STRIPE_WEBHOOK_SECRET`). **Test de checkout live en cours de confirmation.**
- **Powens** (agrégation bancaire) : non inclus dans le pricing actuel tant que non branché — slot UI réservé, coquille worker déployée.

## 8. Automatisation — routine hebdomadaire

Tâche planifiée `ikcp-weekly-visual-polish` (lundi 9h15) : chaque semaine, **propose** (jamais de push direct sur `main`) une amélioration **forme** (visuel/engagement, vérifiée en preview) + **fond** (fraîcheur des barèmes, veille juridique/financière/fiscale sourcée, une fiche/stratégie doctrine rédigée) via une **Pull Request** que Maxime valide.

## 9. Ce qui reste (actions Maxime)

1. 🔴 **Confirmer le test Stripe live** (checkout carte test → badge Premium sur le dashboard).
2. 🟡 **Powens** : créer le client-application sur la console Powens (redirect URI `https://ikcp-powens.maxime-ead.workers.dev/callback`) + poser `POWENS_CLIENT_ID`/`POWENS_CLIENT_SECRET`/`POWENS_ENC_KEY` + binder le D1.
3. 🟡 **DPA Mistral** (zéro-rétention) — souverain contractuel.
4. 🟡 **Play Store Android** — upload du `.aab`, 2ᵉ empreinte Google (assetlinks).
5. ⬜ Décision : `produits`/`articles`/`carnet`/`documents`/`immobilier` — V1 ou post-V1 (défaut : post-V1).

---

© 2026 IKCP — Marcel IA · ORIAS 23001568
