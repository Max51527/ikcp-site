# 🧠 Marcel — Mémoire client + Bibliothèque de playbooks

> Idées inspirées de Hermes Agent (Nous Research), **réinterprétées pour rester
> souveraines (RGPD France) et conformes (MIF II, NIVEAU 2 AMF)**.
> Décision 2026-05-28 : on NE remplace PAS la stack (Workers + Claude). On
> reprend uniquement les bons concepts, en version contrôlée et auditable.

---

## Idée 1 — Mémoire client persistante (« Marcel vous connaît mieux à chaque échange »)

**Quoi** : après chaque conversation, Marcel extrait les **faits durables** que le
client a partagés (situation familiale, objectifs, événements de vie, préférences,
sociétés) → stockés dans une mémoire structurée (D1) → réinjectés aux sessions
suivantes. Marcel ne redemande jamais ce qu'il sait déjà ; il s'affine.

**Différence clé vs Hermes** : ce n'est PAS de l'auto-évolution de comportement.
C'est de la **mémoire factuelle** — déclarative, auditable, sous contrôle.

**Conformité** :
- Faits déclarés par le client, pas d'inférence opaque sur sa personne.
- **RGPD** : exportable (`/api/v1/me/export`) + effaçable (`DELETE /api/v1/me`) — déjà en place.
- **MIF II** : personnalise le CONTEXTE, ne change pas la posture de conseil (toujours info + question).

**Implémentation (esquisse)** :
- Table `client_memory` (user_id, cle, valeur, source_conversation_id, created_at).
- Étape de résumé en fin de conversation (Claude extrait des « candidats mémoire »).
- Injection dans le system prompt de Marcel (comme `fetchUserContextFromClient` aujourd'hui, mais enrichi et évolutif).
- Page profil : le client voit / corrige / supprime ce que Marcel a retenu (transparence).

**Valeur bêta** : rend l'expérience nettement plus bluffante dès les premiers clients.

---

## Idée 2 — Bibliothèque de playbooks experts (« skills », version contrôlée)

**Quoi** : au lieu que l'agent « invente » ses compétences, une **bibliothèque de
playbooks validés** (ex. *cession dirigeant 150-0 B ter*, *bilan retraite TNS*,
*Dutreil + holding animatrice*, *démembrement résidence*) que Marcel **sélectionne**
pour structurer ses réponses.

**Différence clé vs Hermes** : les skills ne sont pas auto-générés à l'exécution.
Ils sont **rédigés / validés par Maxime, versionnés (Git), auditables**.

**Conformité** :
- Déterministe et traçable — chaque playbook se termine par une **question** (MIF II)
  et cite ses sources (CGI/BOFIP), jamais de reco produit.
- Sous contrôle éditorial total → zéro dérive réglementaire.

**Implémentation (esquisse)** :
- Dossier `workers/ikcp-marcel/playbooks/` (ou `_data/playbooks.json`) versionné.
- Marcel choisit le playbook pertinent et l'utilise comme trame de réponse.
- Évolution : un playbook peut suggérer une « prochaine étape » (toujours en question).

---

## ⏱️ Timing (aligné sur « tester la bêta d'abord »)
- **Idée 1 (mémoire)** : candidate à un build LÉGER avant/pendant la bêta — c'est un
  booster d'expérience direct. À confirmer par Maxime.
- **Idée 2 (playbooks)** : à construire **après** les premiers retours bêta (les vrais
  cas clients nourriront les bons playbooks).

> On NE construit rien tant que la bêta n'a pas démarré, sauf décision explicite.
