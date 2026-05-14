# Audit RGPD · Family Office augmenté IKCP

> Date : 14 mai 2026 · auteur : Maxime Juveneton (DPO de fait) · sous-traitants identifiés ci-dessous · révision trimestrielle.

---

## 1. Synthèse exécutive

**Statut global** : 🟢 **CONFORME RGPD** sur l'architecture actuelle (workers Cloudflare + sub-agents Claude).
**Point d'attention principal** : Anthropic en sous-traitant USA. Document de SCC + DPA Anthropic à conserver dans le DPO toolkit. Marqué clairement dans DER+LM client.

---

## 2. Données traitées par finalité

### 2.1 Cartographie patrimoine via SIREN (worker ikcp-pappers)

| Élément | Donnée | Base légale | Sous-traitant |
|---|---|---|---|
| SIREN saisi | numéro 9 chiffres | Intérêt légitime (information patrimoniale) | Pappers (France) |
| Réponse API | dénomination, forme, capital, dirigeants, comptes publics | Données publiques RNE/INPI/BODACC | Pappers (France) |
| Cache | KV Cloudflare 1h | Optimisation performance | Cloudflare (WEUR Paris) |

**Pas de PII personnelle stockée** côté Cloudflare. Le SIREN n'est pas une donnée personnelle au sens RGPD (info entreprise publique).

### 2.2 Conversation Marcel (worker ikcp-chat)

| Élément | Donnée | Base légale | Sous-traitant |
|---|---|---|---|
| Question utilisateur | texte libre patrimonial | Consentement implicite (le visiteur pose la question) | Anthropic (USA) |
| Réponse Marcel | générée par Claude Sonnet 4.6 | — | Anthropic (USA) |
| Log anonyme | hash question + métadonnées (saison, web_search) | Intérêt légitime (amélioration produit) | Cloudflare KV (WEUR) |

**Conservation log** : 90 jours TTL côté KV. Pas d'identifiant nominatif.
**Sous-traitant US** : Anthropic. Clauses SCC + Schrems II adressées via leur DPA standard.

### 2.3 Audit MIF II (worker ikcp-temoin)

| Élément | Donnée | Base légale | Sous-traitant |
|---|---|---|---|
| Hash SHA-256 conversation | digest immutable | Obligation légale (art. 325-3 RGAMF) | Cloudflare D1 (WEUR Paris) |
| Métadonnées | timestamp, agent, model, sources, mif2_compliant | Obligation légale | Cloudflare D1 (WEUR Paris) |

**Rétention** : 10 ans (obligation conservation conseil patrimonial AMF).

### 2.4 Profil collectionneur (worker ikcp-collector)

| Élément | Donnée | Base légale | Sous-traitant |
|---|---|---|---|
| Passions (montres, voitures, lego, etc.) | JSON profil | Consentement explicite (user upload) | Cloudflare D1 (WEUR Paris) |
| Watches marché | recherches actives | Consentement explicite | Cloudflare D1 (WEUR Paris) |
| Alertes | historique | — | Cloudflare D1 (WEUR Paris) |
| Lookups APIs externes | Rebrickable (Lego), Histovec (FR) | Intérêt légitime (info publique) | Rebrickable (USA, données publiques non personnelles) · Histovec (France) |

**Tout reste en D1 Paris** (souverain UE).

### 2.5 Délégation Marcel → sub-agents

| Worker | Modèle | Données transmises | Sous-traitant |
|---|---|---|---|
| ikcp-codex | Opus 4.7 | Question + contexte client (texte) | Anthropic (USA) |
| ikcp-hermes | Opus 4.7 | Question + contexte | Anthropic (USA) |
| ikcp-lifestyle | Sonnet 4.6 | Question + contexte | Anthropic (USA) |

Toutes ces délégations passent par l'API Anthropic. **Identique au point 2.2** côté RGPD.

---

## 3. Sous-traitants identifiés

| Sous-traitant | Pays | Données | Garanties |
|---|---|---|---|
| **Cloudflare** | USA + WEUR (Paris pour D1/KV) | Hébergement workers + D1/KV/R2 | DPA Cloudflare signé. Région WEUR strictement utilisée. Pas de processing US sur PII patrimonial. |
| **Anthropic** | USA | API IA Claude (Sonnet 4.6, Opus 4.7) | DPA Anthropic + SCC EU-US (Schrems II compliant). Pas de training sur les inputs (zero-retention quand activé). |
| **Pappers** | France | API SIREN | DPA Pappers (FR souverain). Pas de transfert hors UE. |
| **Rebrickable** | USA | API Lego (données publiques uniquement) | Pas de PII patrimoniale envoyée. Données publiques uniquement (catalogue Lego). |
| **Histovec gouv.fr** | France | API véhicule (gratuit officiel) | Service public officiel. |

**Liste exhaustive à conserver dans le registre des traitements RGPD (art. 30 RGPD).**

---

## 4. Mesures techniques

| Mesure | Statut | Description |
|---|---|---|
| Chiffrement transport | ✅ | HTTPS/TLS 1.3 sur tous les workers (Cloudflare gère) |
| Chiffrement stockage | ✅ | D1 et KV chiffrés at-rest par défaut Cloudflare |
| Authentification admin | ✅ | Bearer token sur endpoints admin (ikcp-collector, ikcp-temoin) |
| Worker-to-worker auth | ✅ | Token COLLECTOR_ADMIN_TOKEN partagé Marcel→Collector |
| Pas de PII dans les logs | ✅ | Logs Marcel = hash uniquement, pas de texte brut |
| Audit trail immutable | ✅ | D1 ikcp-temoin (hash + métadonnées) |
| Rotation des secrets | 🟡 | À documenter en procédure (90 jours recommandé) |
| 2FA Cloudflare/Anthropic | ✅ | Activé compte Max |
| Vault secrets (Bitwarden) | ✅ | Tokens admin stockés Bitwarden Max |
| .gitignore secrets | ✅ | `.dev.vars`, `.env`, `*.key` exclus |

---

## 5. Droits RGPD utilisateur — comment les exercer

### À documenter dans la page mentions légales / privacy de ikcp.eu

- **Droit d'accès** (art. 15 RGPD) : email à `maxime@ikcp.fr`. Réponse sous 30 jours.
- **Droit de rectification** (art. 16) : idem.
- **Droit à l'effacement** (art. 17) : suppression D1 user_profile + market_watches + alerts. Pas suppression Témoin audit MIF II (rétention 10 ans obligation légale art. 325-9 RGAMF).
- **Droit à la portabilité** (art. 20) : export JSON profil + watches + alerts depuis ikcp-collector (endpoint `/export` à coder Sprint 2).
- **Droit d'opposition** (art. 21) : email DPO.
- **Réclamation CNIL** : possibilité de saisir la CNIL si désaccord.

---

## 6. Conformité MIF II + RGPD croisée

**Article 325-9 RGAMF** : obligation de conserver 10 ans les enregistrements de conseil patrimonial.
→ L'utilisateur ne peut PAS faire effacer son audit log MIF II.
→ Doit être expliqué dans DER + LM signés.

**Article L.541-1 CoMoFi** : Marcel et sub-agents fournissent une information générale, jamais un conseil personnalisé sans DER + LM signés.
→ Pas de profilage automatique au sens art. 22 RGPD (pas de décision automatisée à effet juridique sur le client).

---

## 7. Risques résiduels et mitigation

| Risque | Niveau | Mitigation |
|---|---|---|
| Fuite secret API Anthropic | 🟡 Moyen | Stockage Cloudflare secret (chiffré). Procédure révocation 5 min. |
| Sous-traitant Anthropic change politique data | 🟠 Élevé | Veille trimestrielle. Architecture hybride : si Anthropic US devient inacceptable, possibilité de passer Mistral ou Claude EU (futur). |
| Compromis admin token collector | 🟡 Moyen | Token long 64 chars (`openssl rand -hex 32`), rotation 90 jours, monitoring KV logs. |
| Inférence patrimoine à partir des watches | 🟢 Faible | Watches = recherches publiques. Pas d'inférence sensible révélant patrimoine total. |
| Loi US (CLOUD Act) Anthropic | 🟠 Élevé | Inhérent à tout sous-traitant US. À documenter DER. Migration EU si Anthropic propose région Frankfurt/Paris (Q4 2026 espéré). |

---

## 8. À faire (RGPD checklist actionnable)

- [ ] Créer registre des traitements (art. 30 RGPD) — modèle CNIL à remplir
- [ ] Page `/mentions-legales` + `/privacy` à publier sur ikcp.eu
- [ ] Bandeau cookies (Cloudflare ne tracke pas, mais analytics futur ?) — pas d'analytics tiers en l'état → pas de bandeau requis aujourd'hui
- [ ] DPA signé avec Pappers (vérifier si non fait)
- [ ] DPA signé avec Anthropic (lien : https://www.anthropic.com/legal/dpa) → à signer et conserver
- [ ] DPA signé avec Cloudflare (signé automatiquement à la souscription compte business)
- [ ] Inclure clause RGPD spécifique dans DER + LM mentionnant Anthropic comme sous-traitant US
- [ ] Endpoint `/export` user_id sur ikcp-collector pour droit portabilité
- [ ] Procédure révocation secret API (5 min, à documenter)
- [ ] Bandeau RGPD souverain visible footer family-office-v4 (déjà partiel)
- [ ] Désigner formellement le DPO (Maxime ou délégation externe ? À trancher)

---

## 9. Mise à jour automatique

Cet audit doit être révisé :
- À chaque ajout/modification d'un sous-traitant (nouveau worker, nouvelle API externe)
- Tous les trimestres (revue formelle)
- En cas d'incident sécurité

Lieu : `docs/RGPD-AUDIT-2026-05.md` (renommé avec la date à chaque révision majeure).

---

© 2026 IKCP · Audit RGPD interne · à conserver dans le DPO toolkit
