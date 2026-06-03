# 🎯 Rétroplanning — Lancement test opérationnel IKCP Family Office

> Établi 2026-06-02. Méthode : on part de la DESTINATION, on remonte jusqu'à aujourd'hui.

---

## 1. Où on veut aller (la destination)

**Vision** : le **Family Office digital privé sur invitation** — Marcel (freemium/premium) + Cassius (FO), 100 % digital sauf contact humain souhaité, souverain France.

**Objectif du test opérationnel** : prouver, sur de vrais utilisateurs, que la plateforme **crée de la valeur ressentie** et **convertit** — avant d'ouvrir plus large.

**Critères de succès (gates de fin de test)**
| Critère | Cible |
|---|---|
| Testeurs actifs (usage réel ≥ 3 sessions) | **≥ 5** |
| NPS moyen | **≥ 8/10** |
| Qualité Marcel (réponses jugées utiles) | **≥ 85 %** |
| Bugs bloquants | **0** |
| Signal de conversion (intérêt payant / reco) | **≥ 2 testeurs** |

---

## 2. Le rétroplanning (de la destination → aujourd'hui)

| Phase | Quand | Objectif | Qui |
|---|---|---|---|
| **S+6 à 8 — Décision** | sem. 6-8 | Bilan test → élargir à ~10 / activer Stripe / RDV avocat AMF au 1er payant | Maxime |
| **S+3 à 6 — Cercle restreint** | sem. 3-6 | 5 testeurs engagés · retours hebdo (Notion) · itérations | Max + moi |
| **S+2 — 1ʳᵉ famille pilote** | sem. 2 | Onboarding réel d'1 famille que tu connais · observe les frictions | Maxime |
| **S+1 — Ton parcours testeur** | sem. 1 | TOI = testeur n°0 : login → FO → Cassius → patrimoine → veille · liste les frictions | Maxime |
| **S0 — Finitions pré-test** | cette semaine | Sveltia auth · thème · espaces · base retours Notion · (Bâtisseur opt.) | moi + clés Max |
| **J0 — Aujourd'hui** | — | Plateforme ~95 % prête, lançable | ✅ |

---

## 3. Les jalons (ce qui débloque l'étape suivante)

| Jalon | Condition pour passer à la suite |
|---|---|
| Finitions → Pilote | Ton parcours testeur OK (0 friction bloquante) + base retours Notion en place |
| Pilote → Cercle | 1ʳᵉ famille onboardée sans accroc + 1 retour exploitable |
| Cercle → Décision | 5 actifs · NPS ≥ 8 · 0 bug bloquant |
| Décision → Ouverture/Monétisation | Stripe activé · (1er payant → RDV avocat AMF sous 30 j) |

---

## 4. Répartition des tâches

| À TOI (credentials / décisions) | À MOI (build / itération) |
|---|---|
| Sveltia : GitHub OAuth (3 étapes) | Espaces membre, Studio, thème, perso |
| Token Notion (base retours) | Brancher feedback → Notion |
| Clé Bâtisseur (option) | Streaming Marcel, mémoire conv. |
| GO essai 7 jours (business) | Implémenter l'essai côté serveur |
| Onboarder la 1ʳᵉ famille | Corriger les frictions remontées |

---

*Estimation indicative — le tempo réel dépend des retours. Document vivant, révisé à chaque phase. IKCP · ORIAS 23001568.*
