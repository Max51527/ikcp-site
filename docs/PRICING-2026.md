# 💶 Modèle de coûts & grille tarifaire — IKCP Family Office (2026)

> Aligné sur l'archi réelle (11 agents, Perplexity gaté par tier, SaaS « Finary-style »).
> Remplace les hypothèses prix de `COUTS-COMPLETS.md` (mai 2026, périmé : 290 €, DER/LM, Opus 4.7).
> Usage interne · révision à chaque changement de tarif éditeur. **Estimations, pas un engagement comptable.**

---

## 1️⃣ Le vrai coût variable = les tokens IA (pas l'app)

L'app (PWA + futur Capacitor) coûte **~125 €/an fixe**. Ce qui scale avec **chaque client actif**, c'est l'IA :

| Brique | Modèle | Tarif éditeur (par M tokens) | Rôle |
|---|---|---|---|
| Marcel | Sonnet 4.x | 3 $ in / 15 $ out · **cache −90 %** | orchestrateur, 80 % des réponses |
| Codex / Hermès / Bâtisseur | Opus 4.x | **15 $ in / 75 $ out** | délégations complexes (le poste qui pique) |
| Lifestyle (9 agents) | Sonnet 4.x | 3 $ / 15 $ | art de vivre |
| Veille rapide (quick) | Perplexity `sonar` | ~modéré + coût/recherche | premium + fo |
| Veille approfondie (deep) | Perplexity `sonar-deep-research` | **élevé** (raisonnement) | **fo only** (gaté) |

👉 **Décision-clé déjà prise** : la veille *deep* (chère) est **réservée au FO**, la *quick* à Premium, **rien** pour Découverte. C'est ce gating qui protège la marge.

---

## 2️⃣ Coût IA estimé par client actif / mois

Hypothèses prudentes (cache prompt actif, profil d'usage réaliste).

### Découverte (0 €)
- 0 appel agent (JS déterministe + 1 cartographie Pappers).
- **Coût IA : 0 €.** ✅ Aucune perte possible.

### Premium (usage ~20 questions/mois)
| Type | Vol. | Coût net est. |
|---|---|---|
| Marcel solo (Sonnet + cache) | ~16 | ~1,8 € |
| Délégation Opus (Codex/Hermès) | ~3 | ~2,2 € |
| Veille quick (Perplexity) | ~15 | ~0,8 € |
| Audit log (Témoin) | 20 | ~0,1 € |
| **Total Premium** | | **~5 €/mois** (fourchette 4-8 € selon intensité) |

### Family Office (usage ~60 questions/mois, deep research)
| Type | Vol. | Coût net est. |
|---|---|---|
| Marcel solo | ~40 | ~4,5 € |
| Délégation Opus (multi-agents) | ~15 | ~12 € |
| Veille quick + **deep** | ~30 + 4 | ~10 € |
| Reporting / synthèses auto | — | ~3 € |
| **Total FO** | | **~30 €/mois** (fourchette 20-45 € selon intensité) |

> ⚠️ **Plancher de prix = ce coût IA**, pas l'app. Un FO très actif peut dépasser 45 €/mois IA → le prix FO doit garder une marge même sur le client le plus gourmand.

---

## 3️⃣ Positionnement : accessible ≠ low-cost

Cible 1-30 M€ : **le frein n'est pas le prix, c'est la confiance et la valeur perçue.** Un prix trop bas **dévalorise** (signal « petit SaaS »).

**Ancrage gagnant :**
> « Les fonctions d'un Family Office — qui coûte **150 000 à 300 000 €/an** — accessibles dès 1 M€, pour une fraction du prix. »

Ainsi ancré, **même 50-150 €/mois passe pour une affaire** tout en restant premium. Wedge = **accessible, pas cheap**.

---

## 4️⃣ Grille tarifaire proposée (post-bêta)

| Tier | Prix | Coût IA | Marge brute | Cible |
|---|---|---|---|---|
| **Découverte** | 0 € | 0 € | — (acquisition) | Prospects, aimant à leads |
| **Premium** | **49-79 €/mois** | ~5 € | **~90-94 %** | Dirigeants, autonomes, veille + Marcel |
| **Family Office** | **sur recommandation** (indicatif 290-490 €/mois ou forfait annuel) | ~30 € | **~90 %+** | 1-30 M€, accompagnement complet 11 agents |

### Scénarios Premium (marge à l'unité)
| Prix Premium | Coût IA | Marge €/client | Marge % |
|---|---|---|---|
| 39 € | 5 € | 34 € | 87 % |
| **59 €** (reco) | 5 € | **54 €** | **92 %** |
| 79 € | 5 € | 74 € | 94 % |

**Reco : Premium à 59 €/mois** (ou ~590 €/an avec 2 mois offerts) — accessible, marge confortable, signal premium préservé. FO **sans prix public** (« sur recommandation », forfait négocié) → préserve le positionnement sur-mesure + couvre les usages intensifs.

### Frais Stripe (à intégrer)
~1,5 % + 0,25 € par transaction EU → sur 59 € = ~1,15 €. Marge nette Premium ≈ **53 €/client**.

---

## 5️⃣ Projection (illustrative, post-bêta)

| Scénario | Clients | Revenu/mois | Coût IA/mois | Infra fixe | Marge brute/mois |
|---|---|---|---|---|---|
| Démarrage | 20 Premium + 3 FO | ~2 050 € | ~190 € | ~100 € | **~1 760 €** |
| Croissance | 100 Premium + 10 FO | ~8 800 € | ~800 € | ~150 € | **~7 850 €** |

> Marge brute **~88-90 %** maintenue tant que le gating Perplexity/Opus tient. KPI à surveiller : **coût IA/client** (alerte si > 10 € Premium / > 50 € FO).

---

## 6️⃣ Ce qui reste à décider (Maxime)
1. **Prix Premium** : 39 / **59** / 79 € ? (reco 59 €)
2. **FO** : prix indicatif affiché ou 100 % « sur recommandation » ? (reco : sur reco)
3. **Bêta** : gratuite (décidé) → la grille s'applique **post-bêta**, prix « co-construit » annoncé aux fondateurs.
4. **Annuel avec remise** (2 mois offerts) pour lisser la trésorerie ?

---

*Estimations basées sur les tarifs éditeurs connus 2026 et un usage moyen. Le coût réel par client doit être suivi en production (monitoring usage). Document interne IKCP · ORIAS 23001568.*
