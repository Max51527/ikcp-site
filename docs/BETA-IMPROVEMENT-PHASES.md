# IKCP Family Office — Phases d'amélioration beta

> **Objet** : structurer l'amélioration continue pendant la phase beta. Trois
> phases progressives alignées sur les cohortes (5 → 15 → 50 familles), avec
> objectifs, KPIs, cycles de feedback et critères de transition. La beta n'est
> pas un test, c'est une **co-construction**.
>
> **Statut** : v1 · 09/05/2026
> **Tenue** : Maxime + Tech
> **Révision** : hebdomadaire pendant beta, mensuelle après bascule commerciale

---

## 0. Méthode itérative — principe directeur

> *« Ship → Listen → Improve. Hebdo. »*

Trois principes :

1. **Cohorte progressive** : on ne lance pas 50 familles d'un coup. 5 → 15 → 50, à chaque palier on valide ou on pivot.
2. **Boucle hebdomadaire** : retours des beta-testers tous les vendredis matin → priorisation → développement → release vendredi suivant.
3. **Roadmap co-construite visible** : les 50 familles voient ce qui arrive (page publique de roadmap), votent, suggèrent.

Chaque phase a :
- **Un objectif clair** (que veut-on apprendre / valider ?)
- **Des KPIs précis** (comment mesure-t-on le succès ?)
- **Une durée bornée** (quand on transitionne ?)
- **Un mécanisme de feedback** (comment écoute-t-on ?)
- **Des critères de transition** (quand passe-t-on à la phase suivante ?)

---

## 1. Phase 1 — Validation produit (cohorte 1, 5 familles)

### 1.1 Période

**S+3 → S+5** (2 semaines, fin mai → mi-juin 2026).

### 1.2 Objectif

**Valider que le produit fonctionne** dans le monde réel. Découvrir les bugs critiques, les frictions d'onboarding, les incompréhensions de copy. Pas de scaling, pas de marketing — qualité.

### 1.3 Cohorte cible — 5 profils diversifiés

| Profil | Caractéristique | Pourquoi |
|---|---|---|
| Famille 1 | TPE classique 8-12 personnes (CA 1-3 M€) | Cas central |
| Famille 2 | ETI 50+ personnes (CA 8-15 M€) | Cas premium |
| Famille 3 | Holding immobilier patrimonial (sans entreprise opérationnelle) | Cas atypique |
| Famille 4 | Famille frontalière (FR + Suisse / Lux) | Cas international |
| Famille 5 | Dirigeant solo + 1 enfant 25 ans | Cas réduit (pression NextGen forte) |

### 1.4 KPIs Phase 1

| KPI | Seuil critique | Cible |
|---|---|---|
| Codes redeemés / 5 envoyés | 4 / 5 | 5 / 5 |
| 1ère question Marcel posée par membre | 8 / 10 | 10 / 10 |
| Module 1 NextGen complété par enfant | 3 / 5 enfants | 5 / 5 |
| Visio Maxime tenue | 5 / 5 familles | 5 / 5 |
| Bugs critiques signalés | < 5 | 0-2 |
| Bugs résolus en < 48 h | 100% des critiques | 100% |
| NPS provisoire | > 6/10 | > 8/10 |

### 1.5 Cycle hebdomadaire Phase 1

```
LUNDI    Triage retours week-end + priorisation 3-5 items
MARDI    Dev / fix
MERCREDI Dev / fix + interview 1 famille (30 min)
JEUDI    Dev / fix + déploiement preview
VENDREDI Release production + email récap aux 5 familles
         + form feedback hebdo (3 questions, 5 min)
SAMEDI/DIMANCHE  Lecture form, identification de patterns
```

### 1.6 Mécanismes de feedback Phase 1

| Mécanisme | Fréquence | Fournit |
|---|---|---|
| Form hebdomadaire (3 questions, 5 min) | Vendredi | Pulse général |
| Interview 1:1 (30 min visio Maxime) | 1×/semaine, rotation | Compréhension profonde |
| Telemetry passif (events D1 + Marcel KV logs) | Continu | Comportement réel |
| Slack/email canal direct (Maxime) | À la demande | Bugs urgents |
| Conseil de famille trimestriel (1ère occurrence) | M+3 | Vue famille consolidée |

### 1.7 Critères de transition Phase 1 → Phase 2

Pour passer en Phase 2, il faut que **tous** les seuils critiques soient atteints :

- ✅ ≥ 4/5 codes redeemés
- ✅ ≥ 8/10 membres ont posé une question Marcel
- ✅ Bugs critiques tous résolus
- ✅ NPS > 6
- ✅ Au moins 3 retours qualitatifs *« je recommanderais »*

Si **non atteints** : extension Phase 1 de 2 semaines + investigation cause + ajustements.

---

## 2. Phase 2 — Stabilisation features (cohorte 2, 15 familles)

### 2.1 Période

**S+5 → S+8** (3 semaines, mi-juin → début juillet 2026).

### 2.2 Objectif

**Stabiliser les features les plus demandées** par la cohorte 1. Ajouter ce qui manque manifestement (signal fort de plusieurs familles). Préparer le scaling à 50.

### 2.3 Cohorte cible — 10 nouvelles familles

Sélection orientée *diversité* :
- Compléter les segments manquants de Phase 1
- Ajouter 2-3 familles avec **enfants mineurs** (qui ne suivent pas NextGen mais dont les parents préparent)
- Ajouter 1-2 familles avec **fratrie complexe** (recomposée, non-actifs partagés)

Les 5 familles de Phase 1 continuent avec un statut "membre fondateur" et accès anticipé aux nouvelles features.

### 2.4 KPIs Phase 2

| KPI | Seuil critique | Cible |
|---|---|---|
| Activation cohorte 2 (Marcel + module 1) | 12 / 15 | 15 / 15 |
| Modules NextGen complétés par enfant | 2 / membre | 3 / membre |
| Famille active >= 2 fois/semaine | 8 / 15 | 12 / 15 |
| Conseil de famille tenu (1er occurrence) | 5 / 15 | 10 / 15 |
| NPS | > 25 | > 35 |
| Demandes features prioritaires identifiées | 5 demandes consolidées | — |
| Roadmap publique mise à jour | hebdomadaire | — |

### 2.5 Top features candidates Phase 2 (à prioriser selon retours Phase 1)

Pré-liste qui sera affinée après Phase 1 :

- **Documents-agent OCR** (3-4 sem · 12 k€) : permet upload doc → classement auto. Très demandé.
- **Suivi-agent cron** (2 sem · 6 k€) : rappels J-8, alertes drift, propositions arbitrage.
- **Page mentions légales + CGU + cookies** (1 sem) : conformité.
- **Dashboard admin Maxime** (3 j) : suivi codes + membres + alertes opérationnelles.
- **Stripe checkout pour TPE** (3 j) : permettre l'upgrade self-service vers le tier payant.
- **Plus de schémas SVG** (1-2 j par schéma) : si retours indiquent que c'est un asset différenciant fort.
- **Mode collaboratif sur les annotations** (1 sem) : commentaires partagés en temps réel.

### 2.6 Cycle hebdomadaire Phase 2

Identique à Phase 1, avec ajout :
- **Mardi 10h** : roadmap meeting (Maxime + tech) → priorisation des 3 demandes du moment
- **Vendredi 14h** : page roadmap publique mise à jour (cf. §5)

### 2.7 Critères de transition Phase 2 → Phase 3

- ✅ ≥ 12/15 activées
- ✅ ≥ 3 features identifiées comme prioritaires + livrées
- ✅ NPS > 25
- ✅ Aucun bug critique en backlog > 7 jours
- ✅ Process onboarding stabilisé (≤ 30 min de Maxime par nouvelle famille)
- ✅ Au moins 2 témoignages utilisables (avec accord) pour communication

Si non atteints : extension Phase 2 + analyse.

---

## 3. Phase 3 — Scaling + monétisation (cohorte 3, 50 familles)

### 3.1 Période

**S+8 → S+24** (4 mois, juillet → octobre 2026).

### 3.2 Objectif

**Atteindre les 50 familles**. Mesurer la conversion vers le tier payant (Premium 6 800 €/an et TPE 2 400 €/an). Préparer la **bascule commerciale** pour novembre 2026 (lancement public).

### 3.3 Cohorte cible — 35 nouvelles familles

Recrutement plus large :
- Pipeline Maxime (carnet d'adresses)
- LinkedIn (post de Maxime + 5-10 reposts)
- Recommandations des 15 familles existantes (parrainage : -20% sur la 1ère année payante pour le parrain)
- Partenaires complémentaires (notaires, experts-comptables)
- Article presse / podcast (à arbitrer)

### 3.4 KPIs Phase 3

| KPI | Seuil critique | Cible |
|---|---|---|
| Familles totales actives | 35 / 50 | 50 / 50 |
| Modules NextGen complétés en moyenne | 2,5 / membre | 4 / membre |
| Visio Maxime tenues / mois | 30+ | 50+ |
| NPS | > 30 | > 45 |
| Conversion en payant fin de beta | > 30% (15 / 50) | > 50% (25 / 50) |
| Témoignages publiables (avec accord) | 5 | 10+ |
| Bugs critiques > 7 j | 0 | 0 |
| Coût Anthropic API mensuel | < 800 € | < 500 € |

### 3.5 Mesures à cette phase

- **Dashboard admin v1** opérationnel (suivi 50 familles)
- **Stripe checkout** activé pour conversion TPE / Premium
- **Charte AI usage clients** publiée
- **Mentions légales / CGU / cookies** en production
- **Onboarding self-service** pour TPE (Maxime visio en option, plus en obligation)
- **Page roadmap publique** maintenue à jour

### 3.6 Cycle Phase 3

Bi-hebdomadaire (le rythme s'apaise) :

```
SEMAINE A — release feature majeure
SEMAINE B — tests + petites améliorations + onboarding nouveaux
```

### 3.7 Critères fin de beta — bascule commerciale

Pour ouvrir le tarif payant au public en novembre 2026 :

- ✅ ≥ 50 familles ont vécu le produit (≥ 1 mois)
- ✅ NPS > 30
- ✅ ≥ 25% conversion vers payant en fin de beta
- ✅ ≥ 10 témoignages publiables (avec accord et droit à l'image)
- ✅ Conformité juridique complète (CGV, mentions, cookies, AI Act, RC Pro avenant)
- ✅ Coût marginal par client < 60 €/mois (i.e. marge brute > 90%)
- ✅ Maxime peut accueillir 30+ familles/mois sans saturation (process automatisé)

---

## 4. Process de feedback — outils et formats

### 4.1 Form hebdomadaire (5 min, 3 questions)

```
1. Cette semaine, sur 0-10, à quel point IKCP vous a apporté de la valeur ?
2. Une fonctionnalité qui a manqué cette semaine ?
3. Un commentaire libre (optionnel)
```

Envoi vendredi 17h, réponse moyenne attendue 3 min.

### 4.2 Form mensuel (15 min, 10 questions)

Cf. `BETA-READINESS-AUDIT.md` §5.3. À envoyer le 1er de chaque mois.

### 4.3 Interview 1:1 (30 min visio)

Rotation : 1 famille par semaine en Phase 1, 2 / mois en Phase 3.

Script léger (15 min de conversation libre + 15 min de questions ciblées) :
- Que faites-vous *concrètement* avec IKCP cette semaine ?
- Si IKCP disparaissait demain, qu'est-ce qui vous manquerait le plus ?
- Y a-t-il une chose qui vous a empêché de l'utiliser plus ?
- Qu'est-ce que vos enfants en disent ?
- À votre place, je prioriserais quoi pour la suite ?

### 4.4 Telemetry passive

Events D1 + Marcel logs KV — métriques mesurées sans intrusion :
- Nombre de questions Marcel par membre / semaine
- Modules NextGen ouverts vs complétés
- Taux d'abandon par étape d'onboarding
- Pages les plus consultées
- Heures d'usage (proxy d'engagement)

### 4.5 Panel hebdomadaire (Phase 2-3)

Vendredi 14h, 30 min visio avec **3 beta-testers volontaires en rotation**. Format atelier : on présente la roadmap de la semaine suivante, on récolte les avis, on ajuste avant lundi.

### 4.6 Page roadmap publique (transparence)

`proposals/roadmap-publique.html` (à créer Phase 2). Liste des 5-10 prochaines features avec :
- État (idea / in-progress / shipped)
- Vote des beta-testers (👍 / 👎)
- Estimation de release
- Auteur de la suggestion (anonymisé sauf accord)

---

## 5. Roadmap d'amélioration co-construite — exemple de structure

```
🟢 SHIPPED
- Sources Marcel cliquables (S+1)
- Calculateur économies vs banque privée (S+1)
- Endpoint export RGPD (S+1)
- Sub-comptes liés (S+2)

🟡 IN PROGRESS — cette semaine
- Documents-agent OCR (release prévue S+5)
- Page mentions légales + CGU (juriste, S+3)

🔵 NEXT — votes ouverts
- Mode collaboratif annotations [12 votes]
- Notification push échéance [9 votes]
- Stripe checkout TPE [7 votes]
- Sub-agent art (Artprice) [4 votes]
- Multilingue EN [3 votes]

⚫ BACKLOG — Phase 3
- Reporting-agent PDF (DER/RA auto)
- Juridique-agent + RAG Légifrance
- App native iOS/Android
- Dashboard admin v1
- Connexion banque privée (Open Banking AISP)
```

Chaque vendredi : déplacement des items selon ce qui a été shipped / commencé / priorisé.

---

## 6. Gouvernance des décisions pendant la beta

### 6.1 Décisions prises par Maxime seul

- Toute décision réglementaire ou éthique
- Tout arbitrage MIF II / DDA
- Toute communication aux beta-testers (emails, posts, réponses presse)
- Validation des CGU / NDA

### 6.2 Décisions co-construites avec beta-testers

- Priorité des features (panel hebdo + votes roadmap)
- Définition des modules NextGen (retours qualitatifs)
- Tarification finale (test prix avec 2-3 beta-testers représentatifs)
- Branding / wording (test A/B sur landing)

### 6.3 Décisions techniques (Tech)

- Architecture, choix de stack, refactoring
- Coût de l'infrastructure (Anthropic, Cloudflare)
- Déploiements, monitoring, incidents

### 6.4 Décisions stratégiques (revue mensuelle)

Maxime + Claude (tech advisor) — 1er du mois, 1h :
- Analyse KPIs du mois
- Validation transitions de phase
- Décisions structurantes (recrutement, partenariats, levée)

---

## 7. Risques anticipés et plans d'atténuation

| Risque | Probabilité | Mitigation |
|---|:---:|---|
| **Saturation Maxime** | Élevée | Marcel en première ligne · automatisation onboarding · panel hebdo plutôt que 1:1 individuels |
| **Bug critique en production** | Moyenne | Hotfix branch · rollback automatique Cloudflare · plan d'incident documenté |
| **Beta-tester rage-quit** | Faible | Form de désinscription propre · interview de sortie pour comprendre · cap sur 50 (pas plus) |
| **Demandes contradictoires des beta-testers** | Élevée | Roadmap publique avec votes · Maxime arbitre selon vision produit · explicabilité |
| **Plateforme concurrente émerge** | Moyenne | Vitesse d'exécution · profondeur cumulative · marque déposée |
| **Coût Anthropic explose** | Faible | Prompt caching agressif · monitoring quotidien · plafond budget alerte |
| **Régulateur demande des comptes** | Faible | AI-ACT-REGISTRY tenu · MIF II by-design · transparence proactive |

---

## 8. Synthèse calendrier complet beta

```
S+0 (09/05/2026)  Audit livré · décision Go partiel
S+1               Préparation tech + conformité
S+2               Préparation marketing + sélection cohortes
S+3 (30/05/2026)  ▶ PHASE 1 démarre · 5 familles
S+5 (13/06/2026)  ⏵ Transition Phase 1→2 si critères atteints
S+5               PHASE 2 démarre · +10 familles (15 total)
S+8 (04/07/2026)  ⏵ Transition Phase 2→3
S+8               PHASE 3 démarre · +35 familles (50 total)
S+24 (24/10/2026) ⏵ Fin de beta · décision bascule commerciale
S+26 (07/11/2026) ▶ LANCEMENT COMMERCIAL public
```

---

*Document opérationnel — révision hebdomadaire.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
