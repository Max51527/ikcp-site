# RGPD + Cybersécurité · IKCP Family Office

> Référentiel complet pour protéger les données clients et la cybersécurité de la plateforme.
> Conformité : RGPD · LCEN · MIF II · DSP2 · ANSSI · ENISA · NF Z42-026

---

## 1. CARTOGRAPHIE DES DONNÉES TRAITÉES

### Catégories de données collectées

| Catégorie | Donnée | Source | Sensibilité |
|---|---|---|---|
| **Identité** | Nom, prénom, civilité, date de naissance, email, téléphone | Formulaire client | 🟡 Personnelle |
| **Société** | SIREN, dénomination, forme juridique, dirigeants, BE | API RNE/Pappers (publique) | 🟢 Publique |
| **Patrimoine** | Comptes bancaires, valorisations, biens immobiliers | DSP2 ou saisie client | 🔴 Sensible financier |
| **Fiscal** | TMI, IFI, donations, déclarations | Saisie client | 🔴 Sensible fiscal |
| **Famille** | Conjoint, enfants, situation matrimoniale | Saisie client | 🟡 Personnelle |
| **Conversations** | Échanges avec Marcel + sub-agents | Worker `ikcp-temoin` | 🔴 Sensible conseil |
| **Documents** | KBIS, statuts, contrats, lettres de mission | Upload client | 🔴 Sensible juridique |
| **Logs** | IP, user-agent, horodatage requêtes | Cloudflare Workers | 🟡 Technique |

### Base légale (RGPD art. 6)

- **Consentement explicite** (art. 6.1.a) : pour newsletter, cookies non essentiels
- **Exécution contractuelle** (art. 6.1.b) : pour le service Premium souscrit
- **Obligation légale** (art. 6.1.c) : pour audit MIF II + conservation 10 ans CGI
- **Intérêt légitime** (art. 6.1.f) : pour cybersécurité (logs, anti-fraude)

---

## 2. PRINCIPES RGPD APPLIQUÉS

### Principes fondamentaux respectés

| Principe RGPD | Application IKCP |
|---|---|
| **Licéité, loyauté, transparence** | Politique de confidentialité accessible · consentement granulaire |
| **Limitation des finalités** | Données utilisées uniquement pour le service souscrit |
| **Minimisation** | Pas de collecte au-delà du strictement nécessaire |
| **Exactitude** | Mise à jour à la demande client + recoupement RNE auto |
| **Limitation de la conservation** | Suppression après résiliation (sauf obligations légales 10 ans) |
| **Intégrité et confidentialité** | Chiffrement at-rest (D1) + in-transit (HTTPS) + audit immutable |
| **Responsabilité (accountability)** | DPO désigné · registre des traitements · audits réguliers |

### Droits des personnes

| Droit | Délai | Modalité |
|---|---|---|
| **Accès** (art. 15) | 1 mois | Export complet PDF + JSON via `dpo@ikcp.fr` |
| **Rectification** (art. 16) | Immédiat | Modification dans l'espace client |
| **Effacement** (art. 17) | 1 mois | Suppression D1 + R2 + log audit (sauf obligations 10 ans) |
| **Limitation** (art. 18) | 1 mois | Suspension traitement |
| **Portabilité** (art. 20) | 1 mois | Export JSON structuré |
| **Opposition** (art. 21) | Immédiat | Désinscription en 1 clic |

### DPO (Délégué à la Protection des Données)

- **Désigné** : Maxime Juveneton (à formaliser CNIL si > 250 salariés ou traitement à grande échelle)
- **Contact** : `dpo@ikcp.fr` (alias dédié)
- **Registre des traitements** (art. 30) : à tenir à jour, exemple structure :
  ```
  Traitement : Cartographie patrimoniale
  Finalité : Conseil patrimonial sur lettre de mission
  Catégories : SIREN, comptes annuels, dirigeants
  Durée : 10 ans après fin de mission
  Destinataires : Maxime Juveneton, Marcel/Codex (IA), notaires partenaires (avec accord)
  Sous-traitants : Anthropic (UE endpoint), Cloudflare (UE region), Pappers (FR)
  Mesures sécurité : chiffrement D1, audit eIDAS, accès MFA
  ```

---

## 3. ARCHITECTURE DE SÉCURITÉ

### Hébergement souverain France/UE

| Service | Localisation | Conformité |
|---|---|---|
| **Cloudflare Workers** | Region WEUR (Paris CDG + Frankfurt) | ✓ Data Localization Suite (Pro Plan + 50 €/mois) |
| **D1 SQLite** | Région WEUR (Paris) | ✓ Données stockées exclusivement en EU |
| **R2 Object Storage** | EU jurisdiction (à activer) | ✓ Pas d'egress vers US |
| **KV Namespace** | EU edge | ✓ Cache éphémère |
| **Anthropic API** | EU endpoint disponible (eu.api.anthropic.com) | ✓ Si activé |
| **Pappers** | FR (Paris) | ✓ |
| **Universign** | FR (Annecy + Paris) | ✓ Dhimyotis · eIDAS qualifié |
| **Brevo (emails)** | FR (Paris) | ✓ ex-Sendinblue |
| **Stripe** | IE (Dublin) | ✓ DPA signé |

### Principe de souveraineté

❌ **À éviter absolument** :
- AWS / Google Cloud / Azure US (sauf région UE avec DPA strict)
- DocuSign (US, malgré régionalisation)
- Plaid (US, banking aggregation)
- OpenAI direct (sauf via Azure EU avec DPA)
- Notion (US, hébergement client data)

✅ **Privilégier** :
- Cloudflare (configurable EU only avec Data Localization Suite)
- Anthropic EU endpoint (depuis 2024)
- Scaleway (FR souverain)
- OVHcloud (FR souverain)
- Universign / YouSign (FR eIDAS)
- Brevo / Mailjet (FR)

### Chiffrement

| Niveau | Méthode | Statut IKCP |
|---|---|---|
| **In-transit (réseau)** | TLS 1.3 obligatoire | ✓ Cloudflare auto |
| **At-rest (D1)** | AES-256 | ✓ Cloudflare géré |
| **At-rest (R2)** | AES-256 + KMS | ✓ Cloudflare géré |
| **Documents sensibles** | Zero-knowledge côté client | ⏳ Sprint 4 (avec libsodium.js) |
| **Mots de passe** | Argon2id ou bcrypt cost ≥ 12 | ⏳ Sprint 1.5 (auth système) |
| **Clés API** | Cloudflare secrets (chiffré) | ✓ Jamais en clair dans le code |

### Audit log immutable (`ikcp-temoin`)

Chaque interaction client est tracée :
- **Hash SHA-256** de la conversation (intégrité prouvable)
- **Horodatage UTC ISO 8601** (eIDAS qualifié à terme)
- **Stockage D1 Paris** + copie R2 EU (rétention 10 ans)
- **Accès admin** réservé via token `IKCP_ADMIN_TOKEN`
- **Droit d'accès client** : export complet sur demande

### Authentification

| Méthode | Statut | Sprint |
|---|---|---|
| **Magic link email** | ⏳ À déployer | Sprint 1.5 |
| **2FA TOTP** (Google Authenticator) | ⏳ Optionnel pour Premium | Sprint 2 |
| **Webauthn / Passkey** | ⏳ Recommandé Sur-mesure | Sprint 4 |
| **MFA SMS OTP** | ✓ Universign signature | LIVE pour eIDAS |

### Gestion des accès (IAM)

- **Maxime** : admin total (account Cloudflare + Anthropic + Pappers)
- **Clients Premium** : accès uniquement à leurs propres données (séparation tenants via `family_id`)
- **Notaires partenaires** : accès scope-limited 24-72h (lien magique signé)
- **Audit** : toute action admin loggée avec horodatage + hash

---

## 4. CYBERSÉCURITÉ TECHNIQUE

### Protection contre les menaces OWASP Top 10 (2021)

| # | Menace | Mitigation IKCP |
|---|---|---|
| **A01** | Broken Access Control | Tenant isolation par `family_id` · vérif systématique côté worker |
| **A02** | Cryptographic Failures | TLS 1.3 forcé · AES-256 D1/R2 · pas de MD5/SHA-1 |
| **A03** | Injection (SQL/XSS) | D1 prepared statements · pas de eval · sanitize HTML |
| **A04** | Insecure Design | Threat modeling à chaque sprint · review code |
| **A05** | Security Misconfiguration | Headers CSP/HSTS · pas de stack traces en prod |
| **A06** | Vulnerable Components | `npm audit` hebdo · Dependabot GitHub |
| **A07** | Identity & Auth Failures | Magic link + 2FA · rate limit login |
| **A08** | Software & Data Integrity | Subresource Integrity · audit log immutable |
| **A09** | Logging & Monitoring | Cloudflare Analytics + Sentry + audit Témoin |
| **A10** | Server-Side Request Forgery | Whitelist URLs externes · validation stricte |

### Headers HTTP de sécurité (à configurer)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.maxime-ead.workers.dev https://api.ipify.org;
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Rate limiting

- **API workers** : max 60 requêtes/heure/IP (KV bucket)
- **Login** : max 5 tentatives/15 min (anti-brute force)
- **Pappers** : cache 1h pour réduire les appels (économie + sécurité)

### Pen tests et audits

| Audit | Fréquence | Prestataire suggéré |
|---|---|---|
| **Audit RGPD** | Annuel | DPO externe (Mayan, Privacy Tech, Sennhauser) |
| **Pen test** | Annuel ou avant grande release | YesWeHack / Synacktiv (FR) |
| **Bug bounty** | Continu (Sprint 5+) | YesWeHack programme privé |
| **Code review sécurité** | Avant chaque déploiement majeur | Maxime + Claude Code |
| **Vulnerability scan** | Hebdo | Snyk · GitHub Advanced Security |

### Backup et plan de continuité

- **Backup D1 quotidien** : exports automatiques vers R2 EU (séparé)
- **Réplication géographique** : Cloudflare automatique (région secondaire EU)
- **RPO** (Recovery Point Objective) : 24h max
- **RTO** (Recovery Time Objective) : 4h max
- **Test de restauration** : trimestriel
- **Backup OneDrive Maxime** : sauvegarde quotidienne 22h du dossier `ikcp-site/`

---

## 5. CONFORMITÉ MIF II + AMF

### Règle d'or des outils IA

⚠ **Aucun outil IA d'IKCP ne donne de conseil personnalisé** au sens de l'art. L.541-1 CoMoFi.

- Marcel + sub-agents **terminent toujours par une question**, jamais une recommandation produit
- **Refus systématique** sur questions du type "Acheter X ?" → redirection RDV Maxime
- **Disclaimer obligatoire** en fin de chaque réponse
- **Citation des sources** (CGI, BOFIP, jurisprudence) systématique

### Lettre de mission (art. 325-3 RGAMF)

- Obligatoire **avant tout conseil personnalisé** (Premium full ou Sur-mesure)
- Signée eIDAS qualifié via Universign
- Archivée 10 ans en R2 EU chiffré
- Modèle conforme CNCEF Patrimoine + ORIAS

### DER (Document d'Entrée en Relation)

- Remis dès le 1er contact patrimonial (art. 325-3 RGAMF)
- Mention obligatoire ORIAS 23001568, CIF/COA
- Procédure réclamation (Médiateur AMF)

### Audit log conservation 10 ans

- D1 : conservation permanente avec index optimisé
- R2 : copie immutable (objet versionné non-supprimable)
- Recherche par `family_id` + plage de dates
- Export sur demande (RGPD ou contrôle AMF)

---

## 6. RGPD AGENT IA — particularités

### Anthropic API (Claude)

| Point | Statut |
|---|---|
| **DPA Anthropic** | À signer (template fourni par Anthropic Enterprise) |
| **EU endpoint disponible** | ✓ `eu.api.anthropic.com` (depuis 2024) |
| **Pas d'entraînement sur les données** | ✓ Garanti par Anthropic Commercial Terms |
| **Conservation conversations Anthropic** | 30 jours par défaut, désactivable sur demande Enterprise |
| **Logging IKCP** | Audit log via worker `ikcp-temoin` (D1 EU) |

### Mention obligatoire à fournir au client

À intégrer dans la **politique de confidentialité** :

> *"Vos questions à Marcel et aux agents IA spécialisés sont traitées via l'API Anthropic Claude. Anthropic, en tant que sous-traitant RGPD, garantit que vos données ne sont **pas utilisées pour entraîner les modèles**. L'endpoint UE est utilisé en priorité. Les conversations sont supprimées des serveurs Anthropic après 30 jours, mais conservées dans notre audit log souverain (Paris) pour la durée légale (10 ans MIF II)."*

### Décision automatisée (RGPD art. 22)

⚠ **Marcel ne prend AUCUNE décision automatisée** au sens RGPD.
- Pas de scoring crédit
- Pas de refus de service automatique
- Pas de recommandation produit "à votre place"

→ Marcel **assiste**, Maxime **décide**. Toujours.

---

## 7. COOKIES ET TRACKING

### Cookies utilisés

| Cookie | Finalité | Base légale | Durée |
|---|---|---|---|
| `ikcp_session` | Session authentifiée | Exécution contractuelle | Session |
| `ikcp_csrf` | Protection CSRF | Intérêt légitime | Session |
| `ikcp_consent` | Mémorisation choix RGPD | Obligation légale | 13 mois |

### Tracking exclu

❌ Pas de Google Analytics
❌ Pas de Facebook Pixel
❌ Pas de Hotjar
❌ Pas de cookie tiers publicitaire

### Si analytics nécessaire

✅ **Plausible Analytics** (FR souverain, sans cookie, RGPD-compliant) — 9 €/mois
✅ **Matomo** self-hosted (open source)

---

## 8. FORMATION & GOUVERNANCE

### Maxime — formation continue

- **CNIL** : cours en ligne RGPD (gratuit)
- **CNCEF** : webinaires conformité MIF II
- **ANSSI** : guide d'hygiène informatique (à appliquer)
- **AFCDP** : association DPO (adhésion ~300 €/an)

### Procédures internes

| Procédure | Statut | Action |
|---|---|---|
| **Politique de mots de passe** | À formaliser | Bitwarden + 2FA obligatoire |
| **Procédure de fuite de données** | À formaliser | Notification CNIL sous 72h (art. 33 RGPD) |
| **Procédure de réponse à un droit RGPD** | À formaliser | Workflow 1 mois |
| **Charte informatique** | À formaliser | Si embauche future |
| **Plan de continuité d'activité** | À formaliser | RPO 24h / RTO 4h |

---

## 9. CHECKLIST DE LANCEMENT BÊTA

### Avant d'ouvrir aux 50 fondateurs

- [ ] **Politique de confidentialité** visible et acceptée à l'inscription
- [ ] **CGV** rédigées par avocat (CNCEF Patrimoine fournit modèle)
- [ ] **DER** automatisé via Universign à l'onboarding
- [ ] **Lettre de mission** déclenchée au passage Premium (Universign eIDAS)
- [ ] **Cookie banner** RGPD-compliant (consentement granulaire)
- [ ] **Page DPO** + adresse `dpo@ikcp.fr`
- [ ] **Mentions légales** complètes (LCEN art. 6 III)
- [ ] **Audit log Témoin** vérifié sur 10 conversations test
- [ ] **2FA** disponible pour Premium
- [ ] **Backup D1** automatique testé (restauration OK)
- [ ] **CSP headers** déployés sur tous les sous-domaines
- [ ] **Anthropic DPA** signé (Enterprise tier)
- [ ] **Stripe DPA** signé
- [ ] **Pappers DPA** signé
- [ ] **Universign DPA** signé

### Coût estimé conformité Bêta

| Poste | Coût initial | Annuel |
|---|---|---|
| Avocat CGV + politique confidentialité | 1 500 € | — |
| DPO externe (audit annuel) | 1 200 € | 1 200 € |
| Cloudflare Data Localization Suite | — | 600 € |
| Universign Pro (eIDAS qualifié) | 200 € | 600 € |
| Bitwarden Business | — | 36 €/utilisateur |
| Plausible Analytics | — | 108 € |
| Sentry monitoring | — | 312 € |
| **TOTAL Bêta (an 1)** | **2 900 €** | **~2 900 €/an** |

---

## 10. CERTIFICATIONS À VISER (mois 12+)

| Certification | Utilité | Coût indicatif |
|---|---|---|
| **ISO 27001** | Sécurité de l'information · gold standard | 25-50 k€ (audit + mise en conformité) |
| **HDS** (Hébergement Données de Santé) | Si données santé client (rare en CGP) | 15 k€ |
| **SOC 2 Type II** | Si clientèle US visée | 30 k€ |
| **NF Z42-026** | Archivage électronique opposable | 5 k€ |

→ **À l'échelle Bêta (50 clients)** : pas urgent. À envisager au-delà de 200 clients.

---

## 11. CONTACTS UTILES

| Organisme | URL | Usage |
|---|---|---|
| **CNIL** | https://www.cnil.fr | Notifications fuite, questions RGPD |
| **ANSSI** | https://www.ssi.gouv.fr | Guides cybersécurité, certifications |
| **AMF** | https://www.amf-france.org | Conformité conseil financier |
| **CNCEF Patrimoine** | https://www.cncefpatrimoine.com | Référentiel CIF |
| **AFCDP** | https://www.afcdp.net | Association DPO France |
| **YesWeHack** | https://www.yeswehack.com | Bug bounty FR |

---

**Document maintenu par Maxime Juveneton · révision trimestrielle · usage strictement interne**
© 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
