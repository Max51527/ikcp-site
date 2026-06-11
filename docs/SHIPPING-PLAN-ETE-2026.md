# Plan d'expédition Été 2026 — SaaS + Espace membre + App

> **Objectif** : lancer commercialement avec abonnements payants et
> campagne de communication d'ici le **31 août 2026** (84 jours depuis
> ce 9 juin). Plan semaine par semaine, chemin critique identifié,
> répartition Maxime vs Claude.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## 1. Vue d'ensemble du calendrier

```
       JUIN              JUILLET            AOÛT          SEPT
   ┌───────────┬───────────────────┬─────────────────┬──────────┐
   │           │                   │                 │          │
S0 │ S1 │ S2 │ S3 │ S4 │ S5 │ S6 │ S7 │ S8 │ S9 │S10 │S11 │  LAUNCH
   │           │                   │                 │          │
   └─ Infra ───┴─ Légal/Paiement ──┴─ Marketing ─────┴─ Beta payant ─
   └─ Code ────┘                   ↑
                                   App mobile parallèle
```

| Date | Sprint | Livrable | Bloqueurs / Critical Path |
|---|---|---|---|
| **Sem 09-15 juin** | S0 Infra | Deploy workers prod | DPA Anthropic |
| **Sem 16-22 juin** | S1 Légal A | Lettre mission eIDAS + Stripe | Universign/Yousign signé |
| **Sem 23-29 juin** | S2 Légal B | KYC + RC pro IA + DPO | Avenant assurance |
| **Sem 30 juin - 6 juil** | S3 Beta 1 | 10 premières familles bêta payantes (Découverte 1 800€) | Compta Pennylane |
| **Sem 7-13 juil** | S4 Mobile A | Capacitor → submit iOS | Apple Dev account |
| **Sem 14-20 juil** | S4 Mobile B | Submit Android Play | App Store review |
| **Sem 21-27 juil** | S5 Content | 4 articles + 4 newsletters + LinkedIn | Auto via marcel-editorial |
| **Sem 28 juil - 3 août** | S6 Comm | Webinar live #1 + page demo publique ouverte | — |
| **Sem 4-10 août** | S7 Sales | 30 RDV prospects + 5 closings | Cal.com wiring |
| **Sem 11-17 août** | S8 Scale | 25 familles payantes cumulées | — |
| **Sem 18-24 août** | S9 Optim | A/B test pricing + dashboard analytics | — |
| **Sem 25-31 août** | **LAUNCH** | **🚀 Annonce publique + objectif 50 familles cohort 1** | — |

---

## 2. Pré-requis bloquants — actions Maxime **cette semaine**

Si ces 5 actions ne sont pas en cours au plus tard le 14 juin, le
calendrier glisse de 2 à 4 semaines.

| # | Action | Délai | Difficulté | Coût |
|---|---|---|---|---|
| 1 | **DPA Anthropic Enterprise + ZDR** | sales@anthropic.com → réponse 5-10j | 🟢 Email | $0 |
| 2 | **Compte Stripe France activé + KYC** | dashboard.stripe.com → 1-3j validation | 🟢 Web | $0 |
| 3 | **Compte Universign OU Yousign** + template lettre mission | yousign.com → 1j inscription + 1j template | 🟡 Setup | ~€50/mois |
| 4 | **Avenant RC pro mentionnant outils IA** | demande assureur → 5-10j | 🟡 Email/appel | suppl. ~€10-20/mois |
| 5 | **Apple Developer Program** ($99/an) + **Google Play Console** ($25 one-time) | apple.com/developer + play.google.com/console → 1-7j validation Apple | 🟡 Web + ID | $124 |

**À faire EN PARALLÈLE** :
- Désigner un DPO externalisé (KPMG / Smarteo / Captain DPO) — ~€200-500/mois
- Créer une GitHub OAuth App "IKCP CMS" + "IKCP Cockpit" (5 min chacune)

---

## 3. Sprint 0 — Cette semaine (9-15 juin)

### Côté Maxime (~6h cumulées)
- [ ] Envoyer email DPA Anthropic
- [ ] Activer compte Stripe France
- [ ] Souscription Yousign
- [ ] Demande avenant RC pro à l'assureur
- [ ] Apple Developer Program ouvert
- [ ] DPO externalisé contacté
- [ ] 2 GitHub OAuth Apps créées

### Côté Claude (déjà fait dans cette PR — ⏳ en attente de merge)
- [x] 13 agents YAML prêts à `ant beta:agents create`
- [x] Worker `ikcp-agents` + `ikcp-voice` + `ikcp-cms-auth` + `ikcp-admin` codés
- [x] `admin/cockpit.html` cockpit Maxime
- [x] `proposals/dashboard-perfection.html` espace membre client
- [x] `mobile/capacitor.config.ts` config app
- [x] `proposals/legal/cgv-abonnement.html` CGV finales
- [x] `content/tariffs.json` 5 tiers (incl. nouveaux Découverte 1 800€ + Partner CGP 12 000€)
- [x] Migrations D1 006 + 007
- [x] Doc commercial-readiness audit
- [x] Doc PERFECTION V1

### Côté ops (Maxime quand tout est en main)
- [ ] `wrangler d1 execute ikcp-prod --file migrations/006_agent_sessions.sql`
- [ ] `wrangler d1 execute ikcp-prod --file migrations/007_memory_stores.sql`
- [ ] `wrangler kv:namespace create AGENT_KV` (+ VOICE_CACHE, VOICE_RATE)
- [ ] Push 14 secrets dans ikcp-agents
- [ ] Push 4 secrets dans ikcp-voice
- [ ] Push 6 secrets dans ikcp-admin (dont GITHUB_CLIENT_ID/SECRET)
- [ ] Push 2 secrets dans ikcp-cms-auth
- [ ] `ant auth login` puis `ant beta:environments create` + 13 × `ant beta:agents create`
- [ ] Webhook Anthropic configuré (URL agents.ikcp.eu/webhooks/anthropic)
- [ ] DNS Cloudflare 8 sous-domaines

---

## 4. Sprint 1 (16-22 juin) — Légal partie A

### Maxime
- [ ] Validation finale CGV/CGU/Mentions légales/Politique cookies
- [ ] Configuration Stripe Checkout 5 tiers (Découverte 1 800€, Augmenté 6 800€, etc.)
- [ ] Stripe Tax FR (20%) activé
- [ ] Template lettre de mission sur Yousign — flow signature 2 étapes (preview → signature qualifiée eIDAS)
- [ ] Création GitHub repo OAuth app pour cockpit admin

### Claude (livrable supplémentaire à coder cette semaine)
- [ ] Code dans `ikcp-client` : endpoint POST `/api/checkout` → crée session Stripe Checkout
- [ ] Webhook Stripe `payment_intent.succeeded` → bump tier en D1 + envoi welcome email Resend
- [ ] Page `/proposals/onboarding-paiement.html` : wizard 4 étapes (profil → mandat → KYC → paiement)
- [ ] Tests E2E checkout en mode test Stripe

**Livrable fin Sprint 1** : Un prospect peut souscrire **Découverte 1 800€** depuis le site et recevoir sa lettre de mission par email.

---

## 5. Sprint 2 (23-29 juin) — Légal partie B

### Maxime
- [ ] Avenant RC pro signé
- [ ] DPO opérationnel
- [ ] Contrat Onfido pour KYC LCB-FT (1-3j setup)
- [ ] Compte Pennylane ouvert et lié au compte bancaire pro

### Claude
- [ ] Intégration Onfido KYC dans onboarding wizard
- [ ] Webhook Stripe `invoice.paid` → push facture vers Pennylane
- [ ] Endpoint `/api/me/export` (RGPD art. 20 — portabilité)
- [ ] Endpoint `DELETE /api/me` (RGPD art. 17 — droit à l'effacement + suppression memory store)
- [ ] Registre AI Act mis à jour avec les 13 agents

**Livrable fin Sprint 2** : Conformité légale complète. Première facture peut être émise.

---

## 6. Sprint 3 (30 juin - 6 juillet) — Beta payante #1

### Objectif : **5 familles payantes Découverte 1 800€**

### Maxime
- [ ] Sélection des 5 prospects dans son réseau actuel (client CGP existants)
- [ ] RDV de souscription 30 min × 5
- [ ] Onboarding personnalisé pour chacun (Marcel chat + 1 analyse 360° offerte)

### Claude
- [ ] Page « Bienvenue » dynamique en fonction du tier
- [ ] Email de bienvenue template
- [ ] Configuration Resend domaine d'envoi vérifié + DKIM

**Livrable fin Sprint 3** : **9 000€ encaissés**. Cas concrets pour communication ultérieure.

---

## 7. Sprint 4 (7-20 juillet) — App mobile

### Maxime
- [ ] Icônes IKCP en 1024×1024 pour stores + screenshots dashboard sur iPhone/Android
- [ ] Description App Store / Play Store (FR + EN)
- [ ] Politique de confidentialité dédiée mobile

### Claude
- [ ] Build local sur poste Maxime : `cd mobile && npm install && npx cap add ios && npx cap add android`
- [ ] Tests dans simulateur iOS + émulateur Android
- [ ] Submission App Store Connect (review ~1-7j)
- [ ] Submission Play Console (review ~1-3j)
- [ ] Webhook Resend → ikcp-agents → push notification APNs/FCM

**Livrable fin Sprint 4** : **App native disponible iOS + Android**. Beta familles ont push notifications.

---

## 8. Sprint 5-6 (21 juil - 3 août) — Communication

### Maxime
- [ ] Article 1 LinkedIn « Pourquoi j'ai construit Marcel »
- [ ] Article 2 LinkedIn « 13 agents IA pour votre patrimoine — ce que ça change »
- [ ] Webinar live #1 (Zoom) « Démo de Marcel en 30 min »
- [ ] Invitation 100 contacts ciblés sur LinkedIn

### Claude
- [ ] Page `/blog` qui rend `content/conviction/*.md` éditable Sveltia
- [ ] Composant intégré démo voix sur page d'accueil ikcp.eu
- [ ] Newsletter UPPERCUT publique (séparée de la newsletter perso payante)
- [ ] Setup automatique tracking conversions (Plausible analytics)

**Livrable fin Sprint 6** : **2 000 visites organiques**. 30 leads qualifiés.

---

## 9. Sprint 7-9 (4-24 août) — Closing

### Objectif : **20 familles payantes Augmenté 6 800€**

### Maxime
- [ ] Cal.com booking widget sur ikcp.eu
- [ ] 30 RDV démo de 30 min
- [ ] 1 mois offert sur signature dans 48h
- [ ] Témoignages des 5 premières Découverte capturés (vidéo / texte)

### Claude
- [ ] Page `/temoignages` avec carrousel
- [ ] Email drip nurture 3 emails sur 14j (template Brevo)
- [ ] Système de référencement parrainage (1 mois offert au parrain + filleul)

**Livrable fin Sprint 9** : **161 600€ ARR cumulé** (5 × 1 800€ + 20 × 6 800€ = 145 000€). En réalité MRR = 12 100€/mois moyenne pondérée.

---

## 10. Sprint 10-11 (25-31 août) — LAUNCH 🚀

### Maxime
- [ ] Article presse "Maxime Juveneton lance Marcel"
- [ ] Post LinkedIn de lancement
- [ ] Communiqué de presse Patrimoine24 / Décideurs Magazine / Family Wealth Report

### Claude
- [ ] Page d'accueil ikcp.eu mise à jour avec compteur live de familles inscrites
- [ ] Section « Ils nous font confiance » (logos clients qui acceptent)
- [ ] Tracking ROAS sur campagnes éventuelles

**Livrable fin août** : **50 familles cohort 1 fermée. ARR ~340 000€.**

---

## 11. Indicateurs de pilotage hebdo (cockpit admin)

À partir du Sprint 3, regarder chaque lundi matin dans admin.ikcp.eu/cockpit :

| KPI | Cible J+30 (juillet) | Cible J+60 (août) | Cible J+90 (sept) |
|---|---:|---:|---:|
| Familles payantes | 5 | 15 | 50 |
| MRR | 750€ | 5 800€ | 25 000€ |
| ARR | 9 000€ | 70 000€ | 340 000€ |
| Sessions agents/mois | 25 | 150 | 500 |
| Coût API/mois | $40 | $150 | $400 |
| Marge brute | 99% | 99% | 99% |
| Visites site/mois | 500 | 2 000 | 5 000 |
| Conversion visite→lead | 3% | 5% | 6% |
| Conversion lead→client | 15% | 25% | 30% |

---

## 12. Risques et plan B

| Risque | Probabilité | Plan B |
|---|---|---|
| DPA Anthropic > 3 semaines | 🟡 | Continuer beta gratuite, retarder lancement payant |
| Apple App Store rejette | 🟡 | PWA suffit pour beta — soumission v2 affinée |
| Pas de prospects qualifiés | 🟡 | Activer partenariats notaires / EC, achat liste Apollo |
| Concurrence sort offre similaire | 🟢 | Différenciation par memory store + 13 agents + voix |
| Bug critique en prod | 🟡 | Sentry + alerts ops + rollback wrangler instantané |

---

## 13. Décisions à prendre maintenant

1. **Tier d'entrée principal** : Découverte 1 800€/3 mois OU Augmenté 6 800€/12 mois en direct ?
   - **Reco** : Découverte en porte d'entrée + upgrade automatique Augmenté à la fin des 3 mois si le client convertit. Réduit la friction d'achat initial de 78%.
2. **Partner CGP** : activé dès septembre ou attendre 2027 ?
   - **Reco** : attendre 2027 pour ne pas se disperser. Focus sur familles directes.
3. **App mobile** : sortir iOS + Android ensemble ou iOS en premier ?
   - **Reco** : iOS en premier (dirigeants 55-65 ans plus iPhone), Android +2 semaines.
4. **Webinar live** : 1× / mois ou 2× / mois ?
   - **Reco** : 1× / mois pour qualité. Réservé via Cal.com.
5. **Page démo publique** : reste avec rate limit 1/IP/jour ou bypass pour leads qualifiés ?
   - **Reco** : actuel + bypass par UTM source (LinkedIn = 3 démos/jour).

---

*Plan Été 2026 v1.0 · 2026-06-09 · © IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
