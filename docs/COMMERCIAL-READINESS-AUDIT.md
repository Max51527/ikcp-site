# Audit Go-to-Market — IKCP IA + Family Office
## Commercialisable ? Comment vendre des abonnements ? Écosystème dédié ?

> Audit complet pour transformer la stack actuelle en offre **prête à
> vendre** avec un système d'abonnement IA-natif. Avec checklist
> action par action (vert = OK, rouge = bloqueur).
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## 1. Question #1 — Suis-je commercialisable ?

### 1.1 Les 8 piliers d'une offre IA + patrimoine commercialisable

Une offre IA dans le conseil patrimonial n'est commercialisable que si
les 8 piliers sont remplis. Voici l'audit pilier par pilier.

#### Pilier 1 — Cadre réglementaire patrimoine

| Item | Statut | Action |
|---|---|---|
| ORIAS valide | 🟢 OK | 23001568 actif |
| CIF — adhésion association agréée AMF | 🟢 OK | CNCEF Patrimoine |
| COA — Courtier en opérations bancaires | 🟢 OK | mentionné |
| RC pro CGP couvrant l'IA (extension à demander assureur) | 🟡 À VÉRIFIER | Demander avenant police RC pro mentionnant explicitement « outils IA d'aide à la décision » |
| Cotisation Médiateur de la Consommation (CM2C ou ANM) | 🟡 À VÉRIFIER | obligatoire art. L.611-3 Code conso |
| Convention de courtage banque/AV (LCB-FT) | 🟢 OK | standard CGP |
| Carte professionnelle T (si gestion locative) | ❌ N/A | non concerné |

#### Pilier 2 — Conformité MIF II / DDA / Code monétaire

| Item | Statut | Action |
|---|---|---|
| Lettre de mission **digitale** signée eIDAS qualifiée | 🔴 BLOQUEUR | Wirer Universign OU Yousign (worker existe en pause) |
| DER (Document d'Entrée en Relation) avec adéquation IA | 🔴 BLOQUEUR | Mentionner explicitement les outils Marcel + agents Managed + memory store |
| Profil client (Connaître son Client) digital | 🟡 EN COURS | Questionnaire dans ikcp-client à enrichir |
| Profil de risque MIF II / DDA | 🟡 EN COURS | À automatiser via Marcel chat |
| Disclaimer **devoir de conseil** sur chaque livrable IA | 🟢 OK | Implémenté dans les 13 agents YAML |
| Registre des conflits d'intérêts | 🟢 OK | inutile si pas de commissions cachées |
| Traçabilité décisions IA (audit log) | 🟢 OK | `ikcp-temoin` worker + `agent_sessions` D1 |

#### Pilier 3 — RGPD / DPO / Sub-processors

| Item | Statut | Action |
|---|---|---|
| DPA Anthropic Enterprise + Zero Data Retention signé | 🔴 BLOQUEUR | sales@anthropic.com — refuser le démarrage commercial sans |
| DPA Cloudflare EU | 🟢 OK | signature standard Cloudflare |
| DPA Mistral La Plateforme | 🟡 À SIGNER | sales@mistral.ai |
| DPA Resend (email) | 🟡 À SIGNER | option EU residency à activer |
| Registre des traitements ART. 30 RGPD | 🟡 À ÉCRIRE | template existe |
| Politique de confidentialité publique | 🟢 OK | proposals/legal/politique-cookies.html |
| CGU / CGV avec spécificité IA | 🟡 À ÉCRIRE | référencer chaque agent + memory store |
| Délégué à la Protection des Données (DPO) | 🟡 À DÉSIGNER | DPO externalisé ~ €200-500/mois (KPMG, Smarteo) |
| Procédure d'exercice des droits (Art. 15-22) | 🟡 À DOCUMENTER | endpoint `/api/me/export` à coder |
| Suppression compte + memory store | 🟡 À CODER | endpoint `DELETE /api/me` |

#### Pilier 4 — AI Act EU 2024/1689

| Item | Statut | Action |
|---|---|---|
| Classification système IA (risque limité — conseil patrimonial) | 🟢 OK | Art. 5 ne s'applique pas, transparence Art. 50 |
| Information utilisateur "interaction avec une IA" | 🟢 OK | mentionné dans Marcel chat front |
| Registre AI Act des systèmes utilisés | 🟢 OK | `docs/AI-ACT-REGISTRY.md` existe (à mettre à jour avec les 13 agents) |
| Documentation technique chaque modèle | 🟡 À ENRICHIR | model card par agent (Claude Fable 5 vs Opus 4.8) |
| Évaluation impact sur droits fondamentaux | 🟡 À FAIRE | template ENISA |
| Mécanisme de signalement bugs IA | 🟡 À CODER | endpoint `/api/feedback/ai-issue` |

#### Pilier 5 — Contractuel client

| Item | Statut | Action |
|---|---|---|
| Lettre de mission digitale eIDAS | 🔴 BLOQUEUR | cf pilier 2 |
| CGV abonnement IA avec quotas | 🟡 À ÉCRIRE | tier × agent × volume |
| Politique de remboursement | 🟡 À ÉCRIRE | 14j légal + politique commerciale |
| Politique de suspension pour non-paiement | 🟡 À ÉCRIRE | grace period 7j |
| Engagement de service (SLA) | 🟡 À ÉCRIRE | 99% Cloudflare + best effort Anthropic |
| Clause de confidentialité réciproque | 🟢 OK | template standard |

#### Pilier 6 — Paiement et facturation

| Item | Statut | Action |
|---|---|---|
| Compte Stripe activé | 🔴 BLOQUEUR | stripe.com → activer + vérifier KYC |
| Stripe Checkout configurable par tier | 🟢 CODE PRÊT | dans ikcp-client |
| Stripe Customer Portal pour le client | 🟢 CODE PRÊT | dans ikcp-client |
| Facturation auto avec TVA FR (20%) | 🟡 STRIPE TAX | activer Stripe Tax FR |
| Comptabilisation auto vers Pennylane ou Indy | 🔴 À WIRER | webhook Stripe → Pennylane API |
| Devis automatisé pour Bespoke | 🟡 À CODER | template + signature eIDAS |

#### Pilier 7 — Onboarding client

| Item | Statut | Action |
|---|---|---|
| Magic-link email passwordless | 🟢 OK | ikcp-client + Resend |
| Questionnaire profil 5 min | 🟡 À CODER | wizard 8-12 questions |
| Lettre de mission digitale eIDAS | 🔴 BLOQUEUR | cf pilier 2 |
| KYC LCB-FT (pièce d'identité + adresse) | 🔴 BLOQUEUR | Onfido OU France Connect+ |
| Premier RDV Maxime (Cal.com) | 🟡 À WIRER | self-host gratuit |
| Initialisation memory store famille | 🟢 OK | endpoint déjà codé |
| Première session offerte (rapport patrimoine) | 🟡 À WIRER | offcir CTA dans dashboard |

#### Pilier 8 — Support et opérations

| Item | Statut | Action |
|---|---|---|
| Adresse de support (email + délai) | 🟡 À PUBLIER | support@ikcp.fr — SLA 24h |
| Chat support sur le dashboard | 🟡 OPTION | Marcel peut router vers Maxime |
| Monitoring uptime + alerts | 🟡 À CODER | Sentry ou Better Uptime |
| Reporting d'incident < 24h | 🟡 À DOCUMENTER | playbook |
| Procédure de churn / résiliation | 🟡 À ÉCRIRE | export auto data + suppression memory store |

### 1.2 Verdict commercialisable ?

```
╔══════════════════════════════════════════════════════════════╗
║  STATUT DE COMMERCIALISATION                                 ║
║                                                              ║
║  🔴 5 BLOQUEURS — INTERDIT DE FACTURER tant que non résolus :║
║  1. DPA Anthropic Enterprise + ZDR                           ║
║  2. Lettre de mission digitale eIDAS                         ║
║  3. KYC LCB-FT (Onfido / France Connect+)                    ║
║  4. Compte Stripe activé + KYC validé                        ║
║  5. Comptabilisation auto Pennylane / Indy                   ║
║                                                              ║
║  🟡 14 À COMPLÉTER (sous 30 jours) — beta gratuite OK,       ║
║     mais payant non avant complétude                         ║
║                                                              ║
║  🟢 19 OK — fondations solides                               ║
║                                                              ║
║  ESTIMATION TIME-TO-MARKET PAYANT :                          ║
║   • Beta gratuite  → IMMÉDIAT (signer DPA Anthropic suffit)  ║
║   • Payant 6 800€/an → 4 à 6 semaines                        ║
║   • Bespoke sur devis → 6 à 8 semaines                       ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 2. Question #2 — Comment obtenir des abonnements ?

### 2.1 Le funnel d'acquisition pour CGP IA-natif (4 étapes)

```
┌────────────────────────────────────────────────────────────────┐
│  ÉTAPE 1 — ATTIRER (trafic qualifié)                          │
│  Cible : dirigeants entreprise familiale 2-50 M€ CA, 45-65 ans│
│                                                                │
│  • SEO content : 1 article conviction / semaine (Marcel-      │
│    editorial génère 50% du brouillon)                          │
│  • LinkedIn outreach : 5 dirigeants ciblés / jour              │
│  • Newsletter UPPERCUT publique (≠ newsletter perso payante)   │
│  • Webinar trimestriel "Comment Marcel fonctionne" (60 min)    │
│  • Référencement Pages Jaunes / annuaires CGP                  │
│  • Partenariats notaires + EC (cabinets de 5-20 collabs)       │
└─────────────────────────────┬──────────────────────────────────┘
                              │ 100 visites/jour cible
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  ÉTAPE 2 — CONVERTIR EN LEAD                                   │
│                                                                │
│  • Démo live publique sur /proposals/demo-agents-voix.html    │
│    (1/IP/jour, voix Marcel obligatoire)                        │
│  • Téléchargement du livre blanc « 7 outils IA pour le        │
│    dirigeant d'entreprise familiale »                          │
│  • Diagnostic patrimonial gratuit en 10 min (questionnaire)   │
│  • Inscription newsletter UPPERCUT publique                    │
│                                                                │
│  Conversion cible : 5% → 5 leads/jour → 150/mois              │
└─────────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  ÉTAPE 3 — QUALIFIER + RDV                                     │
│                                                                │
│  • Auto-réponse Marcel chat 24/7 sur les questions amont      │
│  • Lead nurturing : 3 emails sur 14 jours (drip Brevo)        │
│  • Cal.com booking RDV 30 min avec Maxime                      │
│  • Avant le RDV : profil patrimonial pré-rempli côté client   │
│    + résumé envoyé à Maxime par marcel-strategie               │
│                                                                │
│  Conversion cible : 20% lead → RDV → 30 RDV/mois              │
└─────────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  ÉTAPE 4 — CLOSE                                               │
│                                                                │
│  • RDV de 30 min : Maxime montre la stack en LIVE              │
│  • Démo en direct d'un cas concret du prospect (Powens,       │
│    DVF, OCR de son avis IR)                                    │
│  • Tarif annoncé : 6 800€/an (paiement annuel ou mensuel       │
│    566€/mois) — 1 mois offert si signature dans 48h            │
│  • Signature lettre de mission eIDAS pendant le call           │
│  • Paiement Stripe checkout link envoyé end of call            │
│                                                                │
│  Conversion cible : 40% RDV → paiement → 12 ventes/mois       │
└────────────────────────────────────────────────────────────────┘

  RÉCAP : 3 000 visites/mois → 150 leads → 30 RDV → 12 ventes
          ARPU 6 800€/an × 12 = 81 600€ MRR additionnel/mois
          (annuel ramené mensuel : 6 800€ × 12 ÷ 12 = 6 800/mois/client)
          → revenu mensuel cumulé après 12 mois : 81 600€/mois
```

### 2.2 5 leviers conversion qui marchent en SaaS B2B premium FR

| Levier | Effet | Coût d'implémentation |
|---|---|---|
| **Démo live "wow"** | Plus impactant que tout discours commercial | déjà fait ✅ |
| **Tarif ancré sur valeur, pas sur coût** | 6 800€/an = 5% du salaire annuel client = no-brainer | OK |
| **Effet rareté (50 places)** | Augmente perceived value + urgency | OK |
| **Témoignages clients avec chiffres** | Social proof essentielle B2B | À collecter après cohorte 1 |
| **Garantie satisfait ou remboursé 14j** | Reduce purchase friction | À ajouter CGV |

### 2.3 Pricing — recommandations vs tes 3 tiers actuels

| Tier | Prix actuel | Reco | Justification |
|---|---|---|---|
| Freemium | 0€ | Garder mais limiter à 5 q/mois Marcel | Sinon trop généreux, attire pas de revenus |
| Augmenté | 6 800€/an | OK | Cohérent avec coût d'opportunité d'un CGP traditionnel |
| Bespoke | sur devis | 15 000€/an plancher visible | Donne une ancre, libre négociation au-dessus |
| **NOUVEAU — Découverte 3 mois** | 1 800€ | **Ajouter** | Réduit barrière d'entrée pour testeurs |
| **NOUVEAU — Partner CGP** | 12 000€/an | **Ajouter** | Pour autres CGP qui veulent white-label Marcel |

### 2.4 Cadence opérationnelle Maxime

```
LUNDI matin   — Audit dashboard admin (cf §3) + revue indicateurs
LUNDI 14h-18h — Démos prospects + RDV closing
MARDI matin   — Création contenu (article + LinkedIn) avec marcel-editorial
MARDI         — Sessions clients (rapports, mémos)
MERCREDI      — Sessions clients
JEUDI         — Sessions clients + partenariats
VENDREDI 10h  — CRON auto envoi newsletter perso (rien à faire)
VENDREDI PM   — Hebdo perso (relectures, formation, reading)
```

---

## 3. Question #3 — Écosystème dédié pour tout gérer

### 3.1 Vision : un seul tableau de bord admin

Tout passe par **admin.ikcp.eu/cockpit** (à créer). Maxime ouvre une
fenêtre le matin et voit en 30 secondes :

```
┌─────────────────────────────────────────────────────────────────────┐
│ COCKPIT IKCP — Lundi 8 juin 2026, 8h47                              │
│                                                                     │
│ ┌────────────────────────┐  ┌────────────────────────┐             │
│ │ MRR : 38 400€          │  │ Familles actives : 28  │             │
│ │ Δ +4 800€ vs sem-1     │  │ Δ +5 vs sem-1          │             │
│ └────────────────────────┘  └────────────────────────┘             │
│                                                                     │
│ ┌────────────────────────┐  ┌────────────────────────┐             │
│ │ Sessions cette semaine │  │ Coût API ce mois       │             │
│ │ 84 sessions agents     │  │ $284 (vs $580 budget)  │             │
│ │ 162 questions Marcel   │  │ 49% utilisé            │             │
│ └────────────────────────┘  └────────────────────────┘             │
│                                                                     │
│ ─── ACTIONS DU JOUR ───                                            │
│ • [Urgent] Family D. — relancer RDV signature lettre mission       │
│ • [À faire] Family M. — DER Q2 livré, prévoir RDV restit           │
│ • [À faire] 3 nouveaux leads à qualifier                            │
│ • [Auto] Newsletter envoyée vendredi à 28 familles ✓               │
│                                                                     │
│ ─── 7 DERNIÈRES SESSIONS ───                                       │
│ ▸ patrimoine    user_abc123  satisfied  2min          12s ago      │
│ ▸ transmission  user_def456  satisfied  3min          5min ago     │
│ ▸ reporting     user_ghi789  satisfied  1min50         1h ago      │
│ ...                                                                 │
│                                                                     │
│ ─── ALERTES ───                                                    │
│ 🟡 user_jkl: 2 questions sans réponse, risque churn                │
│ 🔴 Marcel chat error rate 4.2% (>3% seuil) — investiguer           │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Composants de l'écosystème admin

| Composant | Stack | Status |
|---|---|---|
| **Cockpit page** | `admin/cockpit.html` (Cloudflare Pages) | 🟢 LIVRÉ ↓ |
| **Worker `ikcp-admin`** | endpoints stats + actions | 🟢 LIVRÉ ↓ |
| **Auth admin** | OAuth GitHub limité à Maxime | 🟢 LIVRÉ ↓ |
| **Live activity SSE** | stream sessions en cours | 🟢 LIVRÉ ↓ |
| **CRM léger** | leads + statuts dans D1 (table `leads`) | 🟡 À CODER (J+15) |
| **Alertes Slack/email** | push si churn risk ou error spike | 🟡 À CODER (J+30) |
| **Vue financière** | MRR / ARPU / churn / LTV / CAC | 🟡 À CODER (J+30) |

Voir `workers/ikcp-admin/` et `admin/cockpit.html` (livrés dans cette PR).

### 3.3 Roadmap de l'écosystème — 6 sprints de 2 semaines

| Sprint | Focus | Livrable |
|---|---|---|
| **S1** | Cockpit MVP | stats clients + sessions + coût |
| **S2** | CRM leads + Cal.com booking | wizard onboarding |
| **S3** | Stripe + facturation auto + comptabilité | abonnements vivants |
| **S4** | Lettre de mission eIDAS + KYC LCB-FT | premier paiement légal |
| **S5** | Alertes opérationnelles + SLA | qualité prod |
| **S6** | Vues financières (MRR, churn, LTV, CAC) | pilotage data-driven |

---

## 4. Indicateurs de succès — feuille de route 12 mois

| Mois | Familles payantes | MRR | Sessions/mois | Coût API |
|---|---:|---:|---:|---:|
| M1 (sept 2026) | 3 | 1 700€ | 30 | $50 |
| M3 | 12 | 6 800€ | 120 | $200 |
| M6 | 30 | 17 000€ | 300 | $480 |
| M12 | 60 | 34 000€ | 600 | $960 |
| M18 (objectif) | 100 | 56 000€ | 1 000 | $1 600 |

Marge nette infra > 96% sur l'API, **le coût principal c'est ton temps**
(d'où l'admin cockpit pour le rentabiliser).

---

*Audit Go-to-Market v1.0 · 2026-06 · © IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
