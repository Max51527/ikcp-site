# Charte Beta-Tester · IKCP Family Office

**Version** : v1.0 — 09/05/2026
**Émetteur** : IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · SIREN 947 972 436

Cette charte définit les engagements réciproques entre IKCP et les
familles participant à la phase beta du Family Office Augmenté
(2e semestre 2026 · 50 familles maximum).

---

## 1. Objet

Vous (« le Beta-Tester ») acceptez d'utiliser pendant **6 mois** la plate-forme
IKCP Family Office Augmenté gratuitement, en échange de retours mensuels
structurés. À l'issue, vous décidez librement de poursuivre en formule
payante (Premium 6 800 €/an ou Essentiel 2 400 €/an) ou de quitter sans frais.

---

## 2. Ce que vous obtenez

- ✅ **Accès complet** à la plate-forme : Marcel illimité, dashboard family
  office, dénicheur d'offres, formation NextGen 6 modules, expertise
  internationale, services premium.
- ✅ **Maxime Juveneton** en visio mensuelle pendant 6 mois (45 min).
- ✅ **Sub-comptes** pour vos enfants ou co-titulaires (vues différenciées).
- ✅ **Code beta personnel** non transférable : `BETA-FAMI-XXXX-YYYY`.
- ✅ **Statut « membre fondateur »** : accès anticipé aux nouvelles features,
  reconnaissance dans la liste des contributeurs (avec votre accord).
- ✅ **Tarif préférentiel** garanti à vie si vous passez en formule payante
  fin de beta (-20 % sur la formule de votre choix · cumulable avec parrainage).

---

## 3. Ce que nous attendons de vous

- 📝 **Retour mensuel structuré** (formulaire 10 questions · ~15 min).
- 🎙️ **Interview 1:1 visio** (30 min) : 1 fois minimum sur les 6 mois,
  rotation entre beta-testers.
- 💬 **Signal des bugs critiques** dès détection (email à `beta@ikcp.fr`).
- 🤐 **Confidentialité** : ne pas reproduire ni distribuer les écrans, prompts,
  schémas ou contenus pédagogiques de la plate-forme à des tiers (NDA mutuelle).
- 🗣️ **Transparence** : nous indiquer si vous êtes par ailleurs lié à un
  cabinet de gestion de patrimoine concurrent (la beta reste ouverte mais
  IKCP reste informé).

---

## 4. Engagement IKCP

### 4.1 Confidentialité

IKCP s'engage à :
- Ne **jamais partager** votre nom, vos chiffres, vos documents avec un tiers
  sans votre **accord écrit explicite**.
- Anonymiser tout usage statistique (« cas type », sans identifiant).
- Conserver vos données dans l'**Espace Économique Européen** (Cloudflare EU,
  conformité DORA + RGPD).

### 4.2 Sécurité

- Chiffrement R2 at-rest (AES-256, Cloudflare default).
- Authentification magic-link (pas de mot de passe à mémoriser).
- Audit log de tout accès à vos données (export disponible sur simple demande).
- Hash SHA-256 sur chaque document uploadé (traçabilité).

### 4.3 Vos droits RGPD (art. 15 à 22 RGPD)

À tout moment, vous pouvez :

| Droit | Comment l'exercer |
|---|---|
| **Accès** à toutes vos données | Bouton « Exporter mes données » dans le dashboard → JSON complet horodaté SHA-256 |
| **Rectification** | Modification directe dans le dashboard ou demande à `dpo@ikcp.eu` |
| **Effacement** (droit à l'oubli) | Email à `dpo@ikcp.eu` · suppression effective sous 30 jours · log audit conservé (anonymisation, accepté CNIL) |
| **Limitation** du traitement | `dpo@ikcp.eu` |
| **Portabilité** | Export JSON 1 clic dans le dashboard |
| **Opposition** | À tout moment, sans motif, sans frais |
| **Réclamation CNIL** | https://www.cnil.fr/fr/plaintes |

### 4.4 Engagement de réversibilité

Si vous quittez la beta ou refusez de passer payant fin de période :
- **Tout votre contenu** (documents, conversations, plans) reste exportable
  via `GET /api/export/me` pendant 30 jours après la fin de votre accès.
- **Suppression complète** garantie sous 30 jours sur simple demande
  (`DELETE /api/users/me` ou email `dpo@ikcp.eu`).
- **Audit log** anonymisé conservé 5 ans (obligation légale LCB-FT).

---

## 5. Données traitées et finalités

### 5.1 Identité et contact

| Donnée | Finalité | Base légale | Conservation |
|---|---|---|---|
| Email, prénom, nom | Authentification + communication | Art. 6.1.b · contrat | Durée beta + 5 ans (LCB-FT) |
| Téléphone (optionnel) | Notifications urgentes | Art. 6.1.a · consentement | Idem |

### 5.2 Patrimoine et conversations

| Donnée | Finalité | Base légale | Conservation |
|---|---|---|---|
| Chiffres patrimoniaux (saisis par vous) | Hyper-personnalisation Marcel | Art. 6.1.b | Durée relation + 10 ans (NF Z42-013) |
| Conversations Marcel | Contexte mémoire + amélioration produit (anonymisée) | Art. 6.1.b | 90 j (KV) puis D1 si payant |
| Documents uploadés | OCR + classification + coffre-fort | Art. 6.1.b | Durée relation + 10 ans |

### 5.3 Sous-traitants RGPD (avec garanties)

| Sous-traitant | Rôle | Localisation | Garanties |
|---|---|---|---|
| **Cloudflare** | Hébergement Workers + R2 + D1 + KV | EU (Paris, Amsterdam) | DORA · ISO 27001 · SOC 2 · DPA signé |
| **Anthropic** | Modèle IA Claude (chat + vision OCR) | US | DPA signé · Standard Contractual Clauses · **conservation 30 j max** · **pas de retraining sur vos données** |
| **Resend** | Envoi email (magic link, notifs) | EU + US | DPA · pas de stockage du contenu après envoi |
| **Notion** | CRM (fiche prospect uniquement, pas de patrimoine) | US | DPA · données limitées au strict nécessaire |

**Important sur Anthropic Claude** : vos messages, documents et données envoyés
au modèle Claude (vision OCR notamment) sont **chiffrés en transit (TLS 1.3)**,
**conservés 30 jours maximum** chez Anthropic à des fins exclusives de
détection d'abus, et **ne sont jamais utilisés pour entraîner ou améliorer
les modèles** (clause contractuelle Anthropic Enterprise — voir
[Anthropic Trust Center](https://trust.anthropic.com/)).

### 5.4 Données qui ne sortent jamais d'IKCP

- Vos **identifiants bancaires** (Lombard, AV) : jamais envoyés à un tiers.
- Vos **mots de passe** : jamais stockés (auth magic-link uniquement).
- Vos **documents originaux** : seul le contenu textuel pertinent est envoyé
  à Anthropic pour OCR. Le binaire reste dans R2 EU sous votre contrôle.

---

## 6. Limitations et avertissements

- **MIF II / DDA** : la plate-forme prépare des analyses pédagogiques. Toute
  recommandation produit personnalisée est validée par Maxime (CGP CIF + COA)
  avant envoi. **Marcel n'est pas un conseiller en investissement.**
- **AI Act UE** : le système est classé "haut risque" par sa nature
  (assistance financière). Registre IA tenu à jour (`docs/AI-ACT-REGISTRY.md`).
  Supervision humaine systématique sur toute recommandation.
- **Pas de garantie de gain** : les optimisations identifiées par Marcel
  (économies fiscales, opportunités) sont **indicatives**. Validation
  juriste / notaire / expert-comptable systématique.
- **Beta = produit en évolution** : bugs possibles, features à venir,
  changements UI. Vous acceptez ces aléas — c'est le sens même d'une beta.

---

## 7. Durée et fin

- **Début** : à la date de redemption de votre code beta.
- **Durée** : 6 mois calendaires.
- **Fin de période** :
  - Vous pouvez basculer en formule payante (Premium ou Essentiel) avec
    le **tarif préférentiel garanti à vie** (-20 %).
  - Ou vous pouvez quitter — sans frais, sans pénalité, vos données sont
    exportables et supprimables à tout moment.

---

## 8. Modifications

Cette charte peut évoluer pendant la beta (clarifications, mise à jour de
sous-traitants). Toute modification matérielle vous est communiquée par
email avec un délai de 30 jours pour exercer votre droit d'opposition.

---

## 9. Contact

| Sujet | Contact |
|---|---|
| Question produit · bug | `beta@ikcp.fr` |
| Question RGPD · droits | `dpo@ikcp.eu` |
| Question commerciale | `maxime@ikcp.fr` |
| Réclamation CNIL | https://www.cnil.fr/fr/plaintes |

---

## 10. Acceptation

En cliquant « Accéder à la beta » avec votre code, vous reconnaissez avoir
lu, compris et accepté la présente charte.

Pour tracer votre acceptation, l'horodatage de la redemption du code et
votre adresse IP sont conservés dans le journal d'audit IKCP (NF Z42-013).

---

*Charte v1.0 · 09/05/2026 · IKCP — IKIGAÏ Conseil Patrimonial*
*ORIAS 23001568 · CIF — CNCEF Patrimoine · COA*
*Maxime Juveneton — `maxime@ikcp.fr` — `dpo@ikcp.eu`*
