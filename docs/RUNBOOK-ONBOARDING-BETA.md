# IKCP Beta — Runbook onboarding cohorte

> **Objet** : procédure opérationnelle d'onboarding d'une famille beta-testeur
> de la prise de contact à l'activation complète. Inclut les 4 templates
> email et le calendrier type sur 30 jours.
>
> **Version** : v1.0 — 09/05/2026
> **Owner** : Maxime Juveneton
> **À distribuer aux** : équipe IKCP, prestataires onboarding éventuels

---

## 0. Vue d'ensemble du parcours

```
J−14   Identification prospect (carnet d'adresses + LinkedIn + recommandations)
       │
J−7    Email pré-qualification → 10 questions → réponse < 5 min
       │
J−3    Visio Maxime 30 min → validation mutuelle → attribution code
       │
J0     Email WELCOME avec code beta + lien charte beta-tester
       │
J+1    Premier login magic-link → onboarding dashboard
       │
J+1    Email J+1 "Premiers pas" → guide 5 actions à faire le 1er jour
       │
J+7    Email J+7 "Bilan première semaine" → form 3 questions + RDV cadrage
       │
J+14   Visio Maxime 45 min → analyse situation + lancement module 1 NextGen
       │
J+30   Email mensuel + form retour 10 questions
       │
M+2    Visio mensuelle + module 2 NextGen
M+3    Form mensuel
M+4    Visio trimestrielle famille étendue (premier conseil de famille)
M+5    Form mensuel + bilan parcours NextGen
M+6    Décision : passage payant, prolongation beta, ou exit
```

**Effort Maxime estimé** : 4-6 h par famille sur 6 mois (1 visio cadrage 45 min + 4-5 visios 30 min + 1 visio famille trimestrielle 60 min + suivi email).

---

## 1. Phase 1 — Identification & pré-qualification (J−14 à J−3)

### 1.1 Critères de sélection cohorte 1 (5 familles)

Pour la **cohorte 1** (S+3 → S+5), 5 profils diversifiés selon
`docs/BETA-READINESS-AUDIT.md` §1.3 :

| Famille | Profil | Pourquoi |
|---|---|---|
| F1 | TPE classique 8-12 personnes (CA 1-3 M€) | Cas central |
| F2 | ETI 50+ personnes (CA 8-15 M€) | Cas premium |
| F3 | Holding immobilier patrimonial (sans entreprise opé) | Cas atypique |
| F4 | Famille frontalière (FR + Suisse / Lux) | Cas international |
| F5 | Dirigeant solo + 1 enfant 25 ans | Cas réduit, pression NextGen forte |

### 1.2 Pipeline prospects — sources

- **Carnet d'adresses Maxime** : prospects qualifiés sur 10 ans
- **LinkedIn** : post de Maxime + ciblage "dirigeant entreprise familiale"
- **Recommandations** : notaires, experts-comptables, anciens clients
- **Événements** : salons FO, AG fédérations CGP

### 1.3 Pré-qualification — formulaire 10 questions

Envoyé par email (template ci-dessous) ou via une page dédiée
(à créer Phase 2). Réponse en 5 min.

```
1. Activité de votre entreprise ?
2. Forme juridique (SAS/SARL/SCI/SCEA) et année de création ?
3. CA approximatif ?
4. Nombre d'enfants concernés (âge entre 18 et 40 ans) ?
5. Patrimoine net global approximatif (fourchette suffit) ?
6. Avez-vous déjà un FO / family officer / banque privée ?
7. Avez-vous déjà fait un pacte Dutreil ?
8. Êtes-vous résident fiscal français exclusif ?
9. Quel est votre principal enjeu patrimonial actuel ?
10. Disponibilité pour une visio 30 min de cadrage avec Maxime ?
```

### 1.4 Visio Maxime 30 min (J−3)

Objectif :
- Validation mutuelle (envie commune de travailler ensemble)
- Brief sur la beta (durée 6 mois, gratuit, retours mensuels)
- Présentation rapide de la plate-forme (capture d'écran dashboard)
- Réponses aux questions
- **À l'issue, attribution du code beta** si match → email WELCOME

---

## 2. Phase 2 — Activation (J0 à J+7)

### 2.1 Génération du code beta

```bash
# Dans workers/ikcp-client (avec D1 binding configuré)
node scripts/generate-beta-codes.mjs --count 1 --notes "Famille X · CA 12 M€ · résidence 75" --source "rdv-maxime"
# → BETA-FAMI-XXXX-YYYY
# → INSERT D1 automatique
```

### 2.2 Email WELCOME (J0)

Voir [Template 1](#template-1--email-welcome-j0) ci-dessous.

### 2.3 Activation par le beta-testeur

Le beta-testeur :
1. Clique sur le code dans l'email → arrive sur `landing-beta-dirigeants.html`
2. Saisit son code → POST `/auth/beta-redeem`
3. Saisit son email → magic-link Resend
4. Clique sur le magic-link → connecté au dashboard
5. Voit le wizard d'onboarding (5 étapes)

### 2.4 Wizard d'onboarding 5 étapes (à coder Phase 2)

À implémenter dans le dashboard membre :

| Étape | Action | Effort beta-testeur |
|---|---|---|
| 1 | Validation identité (nom, prénom, email confirmé) | 30 sec |
| 2 | Renseignement de la situation famille (membres, âges) | 2 min |
| 3 | Saisie patrimoine global (fourchette ou détaillé) | 5 min |
| 4 | Première question à Marcel (suggestion fournie) | 2 min |
| 5 | Sélection des modules NextGen démarrés | 1 min |

**Total : ~10 min**. Pas de barrière à l'entrée.

### 2.5 Email J+1 (lendemain)

Voir [Template 2](#template-2--email-j1-premiers-pas) ci-dessous.

### 2.6 Email J+7 (1ère semaine)

Voir [Template 3](#template-3--email-j7-bilan-1re-semaine) ci-dessous.

---

## 3. Phase 3 — Engagement profond (J+14 à J+30)

### 3.1 Visio Maxime 45 min (J+14)

Objectif :
- Vérifier que le beta-testeur a pu activer le compte sans difficulté
- Approfondir la situation patrimoniale
- Lancer le **module 1 NextGen** (vue 360°) avec les enfants si présents
- Identifier 2-3 sujets prioritaires pour les mois à venir

### 3.2 Email mensuel (J+30 puis chaque mois)

Voir [Template 4](#template-4--email-mensuel-j30-puis-mensuel) ci-dessous.

### 3.3 Form mensuel structuré

Lien envoyé dans l'email mensuel. 10 questions, 15 min.

```
1. Note globale 0-10 (NPS)
2. Module NextGen le plus utile ce mois
3. Qu'est-ce qui a manqué ?
4. Qu'est-ce qui ne sert à rien ?
5. Une fonction à ajouter ?
6. Marcel répond-il pertinent ? (0-10)
7. Ferais-tu adhérer un ami ?
8. Tarif Premium 6 800 €/an : juste / cher / abordable ?
9. Quelle est votre prochaine étape patrimoniale ?
10. Commentaire libre (optionnel)
```

---

## 4. Phase 4 — Décision fin de beta (M+5 à M+6)

### 4.1 Visio bilan 60 min (M+5)

Objectif :
- Recap des 5 mois écoulés (modules complétés, arbitrages, optimisations identifiées)
- Préparation décision M+6 (continuer payant, prolonger beta, exit)
- Demande d'un témoignage publiable (avec validation/anonymisation)

### 4.2 Email décision (M+6)

Trois options proposées :
- **Bascule Premium 6 800 €/an** avec **-20% à vie** (= 5 440 €/an)
- **Bascule Essentiel TPE 2 400 €/an** avec **-20% à vie** (= 1 920 €/an)
- **Exit propre** : export RGPD + suppression de compte sous 30 jours

### 4.3 KPI de décision

Pour valider la transition vers commercial public :
- Conversion ≥ 25% (15 / 50 familles passent payant)
- NPS > 30
- 10 témoignages publiables avec accord
- 0 incident critique en backlog

---

## 5. Templates email

### Template 1 — Email WELCOME (J0)

**Subject** : `Bienvenue dans la beta IKCP Family Office, [Prénom]`

```
Bonjour [Prénom],

Merci d'avoir accepté de rejoindre la beta IKCP Family Office.

Vous faites partie des 50 familles dirigeantes sélectionnées pour
participer aux 6 mois de beta gratuite (S2 2026). En échange de votre
retour mensuel structuré (~15 min), vous bénéficiez d'un accès complet
à la plate-forme et d'un accompagnement personnel par Maxime.

▸ Votre code d'accès : [BETA-FAMI-XXXX-YYYY]
▸ Page d'activation : https://ikcp.eu/beta
▸ Charte beta-tester (à lire avant activation) :
  https://ikcp.eu/proposals/charte-beta-tester.html

Pour activer votre accès :
1. Allez sur https://ikcp.eu/beta
2. Saisissez votre code
3. Indiquez votre email — vous recevrez un lien magique
4. Cliquez sur le lien → vous serez connecté à votre espace IKCP

Le wizard d'onboarding vous guidera ensuite (~10 min) :
· Saisie de la situation famille
· Patrimoine global (fourchette suffit)
· Première question à Marcel
· Choix des premiers modules NextGen

Notre prochain rendez-vous : visio 45 min programmée le [DATE]
(lien Calendly en confirmation).

Bonne navigation,

Maxime Juveneton
IKCP — IKIGAÏ Conseil Patrimonial
maxime@ikcp.fr · 06 XX XX XX XX

PS : si vous avez la moindre difficulté technique, écrivez à
beta@ikcp.fr — réponse sous 4 h en semaine.
```

### Template 2 — Email J+1 « Premiers pas »

**Subject** : `[Prénom], 5 actions à faire dans votre espace IKCP aujourd'hui`

```
Bonjour [Prénom],

Vous avez activé votre espace IKCP hier — bienvenue.

Voici 5 actions concrètes pour bien démarrer :

1. ▸ Posez votre première question à Marcel
   Une question patrimoniale qui vous trotte dans la tête depuis longtemps.
   Ex : « Si je donne 100 k€ à mon fils maintenant, combien de droits ? »
   → ouvrez le chat Marcel depuis le dashboard

2. ▸ Complétez la fiche patrimoine (5 min)
   Plus vous renseignez précisément, plus Marcel est pertinent.
   Vous pouvez rester en fourchette pour la beta.
   → onglet « Patrimoine » dans le dashboard

3. ▸ Démarrez le module 1 NextGen
   « Vue 360° patrimoniale » — 1h30, accessible aux enfants si vous
   créez leur sous-compte.
   → onglet « Formation NextGen »

4. ▸ Activez les notifications email
   J−8 sur vos échéances fiscales. Vous ne raterez plus rien.
   → onglet « Préférences »

5. ▸ Invitez votre famille (sous-comptes)
   Conjoint, enfants 18+. Permissions ajustables.
   → onglet « Famille »

Notre visio 45 min est programmée [DATE]. D'ici là, votre support
direct si nécessaire : beta@ikcp.fr ou répondez à cet email.

Maxime
```

### Template 3 — Email J+7 « Bilan 1re semaine »

**Subject** : `[Prénom], comment se passe votre première semaine IKCP ?`

```
Bonjour [Prénom],

Une semaine déjà depuis votre activation. Vous avez :
· Posé [N] questions à Marcel
· [Commencé / Pas commencé] le module 1 NextGen
· [Renseigné / Partiellement renseigné] votre patrimoine

Trois questions rapides pour calibrer la suite (réponse en 3 min) :

1. Sur 0-10, à quel point IKCP vous est-il utile cette semaine ?

2. Une fonctionnalité qui vous a manqué ?

3. Un commentaire libre (frictions, idées, surprises) ?

Lien direct vers le formulaire : https://ikcp.eu/beta/feedback?week=1

Et n'oubliez pas notre visio cadrage 45 min ce [JOUR + DATE] —
on fera le point ensemble.

Maxime
```

### Template 4 — Email mensuel (J+30 puis mensuel)

**Subject** : `[Prénom], votre bilan mensuel IKCP — [Mois]`

```
Bonjour [Prénom],

[Mois] est terminé. Voici votre bilan IKCP :

▸ Activité IA ce mois
   · [N] questions traitées par Marcel
   · [N] documents classés automatiquement
   · [N] arbitrages préparés (en attente de validation)
   · [X] € d'optimisations identifiées

▸ Modules NextGen
   · [Membre 1] : module [N] [complété / en cours]
   · [Membre 2] : module [N] [complété / en cours]

▸ Échéances à venir
   · [Date] : [Échéance] — [État]
   · [Date] : [Échéance] — [État]

Votre form mensuel structuré (10 questions, 15 min) :
https://ikcp.eu/beta/feedback?month=[N]

Visio mensuelle programmée [DATE] — 30 min, on regarde votre file
d'arbitrages et on discute de la suite.

Vos données IKCP restent à vous : bouton « Exporter mes données »
disponible 24/7 dans le dashboard.

À très vite,

Maxime
```

---

## 6. Suivi opérationnel — outils Maxime

### 6.1 Dashboard admin (à coder Phase 2)

Page interne `/admin` (auth bearer token) qui affiche :
- 50 codes émis (combien redeemés / restants / expirés)
- 50 familles avec statut activation, NPS, dernière connexion
- File arbitrages en attente
- Conversations Marcel récentes (modération)
- Alertes (erreurs > 1%, codes expirés, retours négatifs)

### 6.2 Calendrier Calendly

Type d'événement dédié : `IKCP Beta · cadrage 45 min` + `IKCP Beta ·
suivi mensuel 30 min` + `IKCP Beta · conseil de famille 60 min`.

Lien préalablement collé dans les templates email.

### 6.3 Boîte email beta@ikcp.fr

À configurer via Cloudflare Email Routing :
- Réception : transfert automatique vers maxime@ikcp.fr
- Envoi : depuis maxime@ikcp.fr (pas de séparation pour la beta)
- Rate limit : surveillance abus avec Cloudflare Shield

---

## 7. Indicateurs de réussite onboarding

| KPI | Seuil critique | Cible | Mesure |
|---|---|---|---|
| Taux de redeem code | 80% | 95% | D1 `beta_codes.used_count` |
| Activation complète (J+1) | 70% | 90% | events Marcel + dashboard ouvert |
| Module 1 commencé J+14 | 60% | 80% | events D1 `events.who='NextGen'` |
| Form J+7 rempli | 50% | 75% | feedback table |
| Visio J+14 tenue | 80% | 100% | Calendly stats |
| NPS J+30 | > 7 | > 9 | form mensuel |

---

## 8. Plan d'action en cas de blocage

### 8.1 Beta-testeur silencieux (J+7 sans activité)

- Email automatique de relance "as-tu rencontré une difficulté ?"
- Si toujours silencieux à J+14 : appel téléphonique Maxime
- Si toujours silencieux à J+30 : email de désengagement gracieux + offre
  d'un rendez-vous physique au cabinet

### 8.2 Bug bloquant signalé

- Réponse < 4 h en semaine, < 24 h le week-end
- Hotfix dans les 48 h pour les bugs critiques
- Email de suivi au beta-testeur dès résolution
- Compensation : 1 mois supplémentaire offert si gêne durable

### 8.3 Demande de remboursement (n/a en beta gratuite)

Sans objet — la beta est entièrement gratuite. Mais si le beta-testeur a
souscrit après une période payante (post-conversion), le remboursement
au prorata est de droit dans les 14 jours suivant la souscription.

---

*Runbook v1.0 · 09/05/2026 · révision avant chaque cohorte.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
