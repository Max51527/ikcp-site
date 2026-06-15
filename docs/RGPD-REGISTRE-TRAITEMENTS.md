# Registre des activités de traitement — IKCP

> Document RGPD (art. 30 du Règlement (UE) 2016/679). À relire, dater et tenir à jour.
> **Responsable de traitement** : IKCP — IKIGAÏ Conseil Patrimonial · Maxime Juveneton · CIF, ORIAS 23001568 · SIREN 947 972 436.
> **DPO / contact** : maxime@ikcp.eu.
> **Dernière mise à jour** : ____ / ____ / 2026.

---

## Synthèse des principes
- **Hébergement** : Union européenne — Cloudflare WEUR + base D1 à Paris (France).
- **Intelligence artificielle** : souveraine — Mistral AI (France). Anthropic (USA) en secours technique, encadré par DPA / clauses contractuelles types (SCC).
- **Sécurité** : HTTPS systématique, authentification par lien magique (aucun mot de passe stocké), journal d'audit horodaté (Témoin), tokens à durée limitée.
- **Aucune donnée n'est vendue.** Aucun transfert hors UE sans DPA conforme.

---

## Traitements

### T1 — Gestion des membres (espace Family Office)
- **Finalité** : fournir l'espace membre, le conseil patrimonial, le cockpit.
- **Base légale** : exécution du contrat (art. 6.1.b) + consentement pour les données patrimoniales.
- **Personnes concernées** : membres bêta (dirigeants, familles).
- **Catégories de données** : identité (prénom, email), profil patrimonial (situation, patrimoine, famille, société/SIREN, objectifs), univers/passions.
- **Destinataires / sous-traitants** : Cloudflare (hébergement), Mistral AI (IA).
- **Durée de conservation** : durée de la relation + ____ (à définir, ex. 3 ans après dernier contact) puis suppression.
- **Sécurité** : auth lien magique, D1 Paris, journal d'audit.

### T2 — Authentification (lien magique)
- **Finalité** : connexion sécurisée sans mot de passe.
- **Base légale** : exécution du contrat.
- **Données** : email, jeton temporaire.
- **Sous-traitant** : Resend/Brevo (envoi email).
- **Conservation** : jeton ~30 j ; logs techniques ____.

### T3 — Prospects / demandes d'accès (candidatures)
- **Finalité** : étudier les demandes d'accès au Family Office.
- **Base légale** : mesures précontractuelles (art. 6.1.b) + intérêt légitime.
- **Données** : email, objectif, SIREN éventuel, message.
- **Sous-traitants** : Cloudflare (D1), Resend (accusé), Notion (suivi, si activé).
- **Conservation** : ____ (ex. 12 mois si non admis).

### T4 — Conseil patrimonial par IA (Marcel + agents)
- **Finalité** : répondre aux questions patrimoniales (information, jamais conseil personnalisé sans lettre de mission — MIF II).
- **Base légale** : exécution du contrat + intérêt légitime.
- **Données** : contenu des questions/réponses, contexte société.
- **Sous-traitants** : **Mistral AI (France)** (modèles + Voxtral voix) ; Anthropic (USA, secours, SCC).
- **Conservation** : historique conversationnel (mémoire Premium/FO) ____ ; sinon non conservé.

### T5 — Retours bêta (feedback)
- **Finalité** : amélioration produit.
- **Base légale** : intérêt légitime.
- **Données** : verbatim, email éventuel, page, note.
- **Sous-traitants** : Cloudflare (D1), Notion (miroir si activé), Mistral (résumé).
- **Conservation** : durée de la bêta + ____.

### T6 — Audit de conformité MIF II (Témoin)
- **Finalité** : traçabilité réglementaire des interactions IA.
- **Base légale** : obligation légale (cadre AMF/MIF II).
- **Données** : empreinte horodatée des échanges.
- **Sous-traitant** : Cloudflare (D1 Paris).
- **Conservation** : **10 ans** (obligation).

### T7 — Cartographie société (SIREN/RNE)
- **Finalité** : afficher la structure de la société du dirigeant.
- **Base légale** : exécution du contrat ; données issues d'un registre public (RNE).
- **Sous-traitant** : **Pappers (France)**.
- **Conservation** : rattachée au profil membre.

### T8 — Emails transactionnels
- **Finalité** : liens d'accès, accusés, notifications.
- **Base légale** : exécution du contrat.
- **Sous-traitant** : Resend / Brevo (EU).
- **Conservation** : logs ____.

### T9 — Veille collection (Collector, optionnel)
- **Finalité** : alertes marchés sur les passions déclarées.
- **Base légale** : consentement.
- **Données** : préférences/veilles déclarées (montres, voitures, etc.).
- **Sous-traitant** : Cloudflare (D1) ; Perplexity (veille web, mode non-souverain).
- **Conservation** : tant que la veille est active.

---

## Sous-traitants (récapitulatif)

| Sous-traitant | Finalité | Localisation | Garantie |
|---|---|---|---|
| Cloudflare | Hébergement (Workers, D1, Pages) | EU — WEUR/Paris | DPA + SCC |
| **Mistral AI** | IA souveraine (Marcel + agents + voix) | **FR — Paris** | DPA |
| Anthropic | Secours IA technique | USA | DPA Schrems II / SCC |
| Pappers | Données sociétés (RNE) | FR | DPA |
| Perplexity | Veille web (mode non-souverain) | USA | DPA / SCC |
| Resend / Brevo | Emails transactionnels | EU | DPA |
| Notion | Suivi feedback/candidatures (si activé) | USA | DPA / SCC |

## Droits des personnes (exercés via maxime@ikcp.eu ou l'app)
Accès · rectification · effacement (`DELETE /api/v1/me`) · portabilité (`/api/v1/me/export`) · limitation · opposition · retrait du consentement. Réponse sous 1 mois.

## Mesures de sécurité
Chiffrement en transit (HTTPS/TLS) · hébergement EU · auth sans mot de passe (lien magique) · jetons à durée limitée · journal d'audit horodaté · accès admin protégé par secret · minimisation des données.

## À finaliser (checklist)
- [ ] Signer/classer les DPA de chaque sous-traitant (Cloudflare, Mistral, Pappers, Resend, Notion, Anthropic, Perplexity).
- [ ] Définir les durées de conservation (champs « ____ » ci-dessus).
- [ ] Procédure de notification de violation (< 72 h à la CNIL).
- [ ] Purge automatique des comptes inactifs.
- [ ] (renfort) Chiffrement applicatif des champs patrimoniaux les plus sensibles.
- [ ] Vérifier l'obligation d'analyse d'impact (AIPD) — traitement de données patrimoniales à grande échelle.

---
© 2026 IKCP — registre interne, ne pas publier.
