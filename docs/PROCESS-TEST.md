# 🧪 Process de test opérationnel — IKCP Family Office

> But : valider la plateforme sur de vrais usages avant d'ouvrir. Phase par phase,
> avec un script pas-à-pas et une grille de retour exploitable.

---

## 1. Les 3 phases

| Phase | Qui | Durée | Objectif | Gate de sortie |
|---|---|---|---|---|
| **0 · Toi (testeur n°0)** | Maxime | 1-2 j | Tout casser avant les clients | 0 friction bloquante |
| **1 · Famille pilote** | 1 famille que tu connais | 1 sem. | Onboarding réel observé | 1 retour exploitable + 0 bug bloquant |
| **2 · Cercle restreint** | 5 testeurs engagés | 4-6 sem. | Valeur + conversion | NPS ≥ 8 · 5 actifs · ≥ 2 signaux payant |

---

## 2. Script de test pas-à-pas (à suivre dans l'ordre)

> ✅ = conforme · ⚠️ = friction · ❌ = bloquant. Note chaque ligne.

| # | Étape | Action | Résultat attendu | Statut |
|---|---|---|---|---|
| 1 | **Accès** | ouvrir `ikcp.eu/app/` | login sobre navy/or s'affiche | ⬜ |
| 2 | **Login** | saisir email → recevoir le lien → cliquer | arrive sur le dashboard (pas de reboucle) | ⬜ |
| 3 | **Onboarding** | prénom, situation, passions, SIREN `947972436` | ✓ société identifiée en ~2 s | ⬜ |
| 4 | **Dashboard** | observer | bloc activation (%) + 2 espaces (patrimoine / passions) | ⬜ |
| 5 | **Univers** | cliquer une passion cochée | ouvre Marcel avec question pré-remplie | ⬜ |
| 6 | **Marcel** | poser : « Comment réduire mes droits de succession ? » | réponse qui **s'écrit en direct**, experte, finit par une question + disclaimer | ⬜ |
| 7 | **Patrimoine** | ajouter 2-3 biens (résidence, locatif, holding) | donut + valeur nette se construisent | ⬜ |
| 8 | **IFI** | immobilier > 1,3 M€ | alerte IFI auto + lien Marcel | ⬜ |
| 9 | **Analyse** | « Analyser avec Marcel » depuis le patrimoine | Marcel reçoit le résumé chiffré | ⬜ |
| 10 | **Veille** | ouvrir Veille | digest du jour **lisible** (sans jargon/[1]) + « Qu'est-ce qui me concerne ? » | ⬜ |
| 11 | **Voix** | activer « lire à voix haute » / micro | lecture + dictée OK | ⬜ |
| 12 | **Thème** | passer le compte en **Premium** (console) → recharger | ambiance **navy/or** (vs terracotta free) | ⬜ |
| 13 | **Mémoire** | parler à Marcel → quitter → revenir | « ↑ reprise de votre dernier échange » | ⬜ |
| 14 | **Mobile/PWA** | ouvrir sur téléphone → « installer » | s'installe comme une app | ⬜ |
| 15 | **Conformité** | vérifier chaque réponse IA | disclaimer L.541-1 partout · 0 reco produit · 0 mention « Claude » | ⬜ |

---

## 3. Scénarios par profil (Phase 2)

| Profil | Scénario type | Ce qu'on observe |
|---|---|---|
| **Dirigeant TNS** | rémunération, holding, cession | profondeur fiscale, délégation Codex |
| **Profession libérale** | retraite, PER, prévoyance | clarté, pédagogie |
| **Famille / transmission** | donation, Dutreil, démembrement | Hermès, sérénité |
| **Passionné (art/auto/vin)** | valorisation, conciergerie | univers lifestyle, Cassius |

---

## 4. Grille de retour testeur (après 2 semaines)

| Question | Format |
|---|---|
| Recommanderiez-vous Marcel à un pair ? | NPS /10 |
| Qu'est-ce qui vous a **le plus aidé** ? | libre |
| Qu'est-ce qui vous a **bloqué / frustré** ? | libre |
| Qu'est-ce qui **manque** pour que ce soit indispensable ? | libre |
| Paieriez-vous pour la version complète ? À quel prix ? | oui/non + € |

→ Remontée dans la **base Notion « Bêta — Retours »** (à activer).

---

## 5. Critères de succès (gates)

| Critère | Cible |
|---|---|
| Testeurs actifs (≥ 3 sessions) | ≥ 5 |
| NPS moyen | ≥ 8/10 |
| Réponses Marcel jugées utiles | ≥ 85 % |
| Bugs bloquants | 0 |
| Signal conversion (payant/reco) | ≥ 2 |

---

## 6. Suivi des anomalies

| Priorité | Définition | Délai de correction |
|---|---|---|
| 🔴 P0 bloquant | empêche d'utiliser (login, Marcel HS) | immédiat |
| 🟠 P1 majeur | dégrade fortement l'expérience | 48 h |
| 🟢 P2 mineur | cosmétique, confort | prochaine itération |

> Où les noter : base Notion bêta + feedback in-app (espace membre). Le **watchdog** alerte par email si un service tombe.

---

*Process vivant — révisé après chaque phase. IKCP · ORIAS 23001568.*
