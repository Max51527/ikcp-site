# Audit honnête · Mockup vs Réel · IKCP Family Office

> **Engagement** : tout ce qui figure sur le site doit être un outil opérationnel.
> Du marketing oui, mais qui fonctionne. Pas de promesse non-tenue.
>
> Mise à jour : 12 mai 2026 · auteur : Maxime Juveneton · doc de pilotage interne.

---

## 🟢 CE QUI EST DÉJÀ LIVE (fonctionne réellement aujourd'hui)

### Calculs déterministes (JavaScript local, zéro dépendance externe)

| Fonctionnalité | Fichier | Source juridique | Statut |
|---|---|---|---|
| Calcul IR 2026 (barème + quotient familial) | `univers-demandez-moi.html` | art. 197 CGI · LF 2026 | 🟢 LIVE |
| Calcul transmission Dutreil + AV + donation | `univers-demandez-moi.html` | art. 779 I + 990 I + 787 B CGI | 🟢 LIVE |
| Calcul don défiscalisé IR (66 %) et IFI (75 %) | `univers-demandez-moi.html` | art. 200 + 978 CGI | 🟢 LIVE |
| 5 règles d'observation patrimoniale (Marcel funnel) | `marcel-funnel.html` | rules-based, conformes MIF II | 🟢 LIVE |
| Filtre Bêta SIREN + KBIS + code 3 étapes | `ikcp-eu-onglet-family-office.html` | logique de validation | 🟢 LIVE |
| Protection copie + IP tracking | toutes pages | art. L.111-1, L.122-4, L.335-2 CPI | 🟢 LIVE |

### APIs publiques branchées sans clé (CORS-OK)

| API | Fonctionnalité | Fichier | Statut |
|---|---|---|---|
| DVF data.gouv.fr (via api.cquest.org) | Prix m² immobilier par CP | `univers-demandez-moi.html` | 🟢 LIVE |
| CoinGecko | BTC + ETH + or live | `widgets-ikcp.html` · ticker | 🟢 LIVE |
| Frankfurter (BCE) | Forex EUR/USD/GBP/CHF/JPY | `widgets-ikcp.html` · `family-office-actifs.html` | 🟢 LIVE |
| api.ipify.org | IP tracking pour protection copie | toutes pages | 🟢 LIVE |
| Spotify Embed iframe | Playlist publique démo (à remplacer par votre playlist) | `widgets-ikcp.html` | 🟢 LIVE |

### Backend opérationnel (déjà déployé)

| Service | Fonctionnalité | Statut |
|---|---|---|
| **ikcp-mcp** (Scaleway fr-par) | 7 calculs fiscaux (IR, IFI, Dutreil, donation, démembrement, plus-value, succession) | 🟢 OPÉRATIONNEL |
| ikcp.eu domain + DNS | Site live | 🟢 OPÉRATIONNEL |
| Backup OneDrive automatisé | Sauvegardes Documents/IKCP, .claude, cassius-repo, ikcp-mcp | 🟢 OPÉRATIONNEL |
| Newsletter UPPERCUT (Beehiiv) | Publication hebdomadaire | 🟢 OPÉRATIONNEL |

---

## 🟡 CE QUI EST MOCKUP VISUEL (à brancher pour devenir réel)

### Sprint 1 · semaines 1-2 (CRITIQUE pour Bêta)

| Fonctionnalité visible | Statut actuel | Pour passer en LIVE | Effort |
|---|---|---|---|
| **Cartographie SIREN Marcel** | 3 SIREN mockés (947972436, 775670417, 812345678) | Déployer worker `ikcp-pappers` avec clé free 100 req/mois | 1 j |
| **Authentification magic link** | Pas encore en place | Worker `ikcp-auth` + Brevo email transactionnel | 1 j |
| **Encaissement abonnement Premium** | Bouton "Souscrire" non branché | Stripe Checkout + Customer Portal + webhook | 1 j |
| **Signature lettre de mission eIDAS** | Pas en place | YouSign API + template lettre IKCP pré-rédigée | 0,5 j |
| **Audit log permanent (témoin)** | Pas en place | Worker `ikcp-temoin` + D1 SQLite Paris + R2 EU chiffré | 1,5 j |
| **Formulaire Bêta SIREN+KBIS** | Validation côté client uniquement, KBIS pas vraiment vérifié | Worker `ikcp-beta-validate` qui parse PDF + check date 90 j | 1 j |
| **Formulaire Cercle Fondateurs** | Envoie en alerte mock seulement | Worker `ikcp-cocreation` qui envoie vers Maxime + base D1 | 0,5 j |
| **Demande d'invitation RDV** | Formulaire visuel seulement | Worker `ikcp-invitation` → email vers Maxime + log | 0,5 j |

**Total Sprint 1 : ~7 jours de dev · 0 € infrastructure (free tiers)**.

### Sprint 2 · semaines 3-4 (Marcel intelligence)

| Fonctionnalité visible | Statut actuel | Pour passer en LIVE | Effort |
|---|---|---|---|
| **Marcel chat conversationnel** | Bulles statiques mockées | Worker `ikcp-marcel` Claude SDK + sub-agents | 3 j |
| **Mode pilote / mute Marcel** | Toggle UI seulement | Logique routing dans worker | 0,5 j |
| **Univers Patrimoine (au-delà du Pappers)** | Display Pappers seul | Branchement INSEE + BODACC + agrégation entités liées | 1 j |
| **Univers Fiscalité conseils IA** | Calculs locaux uniquement | Sub-agent Codex (Opus 4.7) avec MCP Légifrance + BOFIP | 1,5 j |
| **Univers Transmission Dutreil personnalisé** | Calcul générique | Sub-agent Hermès qui adapte au profil entreprise réel | 1 j |
| **Veille Légifrance / BOFIP nocturne** | Pas en place | Cron trigger Cloudflare → MCP scrapers → D1 changelog | 2 j |

**Total Sprint 2 : ~9 jours de dev · ~50 €/mois Claude API au démarrage**.

### Sprint 3 · semaines 5-8 (Live marchés + lifestyle)

| Fonctionnalité visible | Statut actuel | Pour passer en LIVE | Effort |
|---|---|---|---|
| **Ticker CAC 40 / S&P 500 / NASDAQ** | Mock auto-jittering | Worker `ikcp-markets` proxy Yahoo/Stooq + cache 60s KV | 1 j |
| **Cours OR (PAX Gold proxy CoinGecko)** | Déjà live mais via proxy crypto | Brancher GoldAPI ou Metals.dev (~30 €/mois) | 0,5 j |
| **Univers Immobilier complet** | DVF par CP seulement | + adresses précises géocodage + MeilleursAgents (négociation) | 2 j |
| **Réservations Booking** | Boutons "Découvrir" mockés | Booking Affiliate API + iframe résultats + commission tracking | 2 j |
| **Réservations TheFork** | Idem | TheFork API B2B + flow réservation embarqué | 1 j |
| **Conciergerie 24/7 (envoi message Maxime)** | Input seulement | Worker `ikcp-conciergerie` → email + SMS Twilio + log D1 | 0,5 j |
| **Calendrier évènements privés** | 4 évènements statiques | Cal.com self-hosted + RSVP + emails confirmation Brevo | 1 j |
| **Ambiance musicale (Kevin MacLeod)** | Liste cliquable mockée | Brancher fichiers MP3 sur R2 + player HTML5 + state | 0,5 j |
| **Playlist Maxime Spotify** | Embed playlist Jazz démo | Vous donnez l'ID, je remplace (3 chars de code) | 5 min |

**Total Sprint 3 : ~9 jours de dev · ~50-100 €/mois APIs additionnelles**.

### Sprint 4 · mois 2-3 (Curateur Premium)

| Fonctionnalité visible | Statut actuel | Pour passer en LIVE | Effort |
|---|---|---|---|
| **Univers Art (côtes artistes)** | 3 artistes mockés | Artprice API + cache D1 (3 000 €/an, refacturé Sur-mesure) | 2 j |
| **Univers Voyage premium hôtels** | Booking only | + Mr & Mrs Smith API (accréditation 4 sem) | 2 j |
| **Univers Marchés deals PE** | Mock 1 deal | Pitchbook ou Crunchbase + filtres thèse client | 3 j |
| **Univers Voyage jet privé** | Description seulement | PrivateFly API + Stratajet (commission 5-10 %) | 2 j |
| **École NextGen — 6 modules** | Cards visuelles + progression mockée | Worker `ikcp-nextgen` + quiz interactifs + attestation eIDAS | 4 j |
| **Bibliothèque NextGen** | 5 ressources mockées | Vidéos hébergées R2 + podcasts + livres + tracking progression | 2 j |
| **Mentor Maxime RDV** | Bouton mockup | Calendly perso branché + alertes WhatsApp | 0,5 j |

**Total Sprint 4 : ~15,5 jours de dev · ~350 €/mois APIs Premium**.

### Sprint 5 · mois 4-6 (Sur-mesure pleine puissance)

| Fonctionnalité visible | Statut actuel | Pour passer en LIVE | Effort |
|---|---|---|---|
| **Agrégation bancaire automatique** | AUM portfolio mocké 14,2 M€ | Powens/Bridge DSP2 + sync nocturne + dashboards | 3 j |
| **Cassius co-pilote admin** | Page mockup statique | Cron 07:00 + veille agents nocturnes + email brief Maxime | 5 j |
| **Salon famille messagerie E2E** | 4 bulles mockées | WebRTC + signal protocol + push notifications | 4 j |
| **Cartographie biens immobiliers** | SVG France mock | Mapbox GL + cadastre overlay + DVF par bien | 2 j |
| **Reporting trimestriel PDF auto** | Mention "produit par Olympe" | Worker `ikcp-reporting` + Puppeteer PDF + envoi automatique | 3 j |
| **Studio Sur-mesure (admin Maxime)** | Mockup paramétrage par famille | Vraie config par tenant + déploiement sous-domaine custom | 6 j |
| **Salon famille passions** | Statique | Forum privé per-family, modéré, archivé eIDAS | 2 j |
| **PWA installable iOS/Android** | Meta tags présents, pas de manifest | manifest.json + service worker + icônes 192/512 px | 0,5 j |
| **Liaison externe avocats/notaires** | Carte mockup | Worker `ikcp-liaison` + accès scope-limited + signature trail | 4 j |

**Total Sprint 5 : ~29,5 jours de dev · ~500 €/mois APIs pleine charge**.

---

## 📊 SYNTHÈSE EFFORTS

| Sprint | Effort dev | Délai calendaire | Coût mensuel infra ajouté |
|---|---|---|---|
| **Sprint 1** (Bêta-ready) | 7 j | 2 semaines | 0 € (free tiers) |
| **Sprint 2** (Marcel IA) | 9 j | 2 semaines | 50 € |
| **Sprint 3** (Marchés + lifestyle) | 9 j | 4 semaines (en parallèle accréditations) | 100 € |
| **Sprint 4** (Curateur Premium) | 15,5 j | 8 semaines | 350 € |
| **Sprint 5** (Sur-mesure complet) | 29,5 j | 12 semaines | 500 € |
| **TOTAL** | **70 jours dev** | **~6 mois** | **~1 000 €/mois pleine charge** |

À 50 Premium × 290 € + 5 Sur-mesure × 5 000 € = **39 500 €/mois**. Marge brute pleine charge : 97,5 %.

---

## ⚠️ RÈGLE D'OR — La promesse minimale viable

**Ne PAS ouvrir la Bêta tant que ces 7 piliers Sprint 1 ne sont pas LIVE :**

1. ✅ Cartographie SIREN réelle (RNE/Pappers)
2. ✅ Magic link authentification
3. ✅ Stripe encaissement test (au moins simulé en mode sandbox)
4. ✅ YouSign lettre de mission
5. ✅ Audit log témoin (conformité juridique)
6. ✅ Validation Bêta SIREN+KBIS réelle (pas mock)
7. ✅ Marcel chat avec au moins 1 sub-agent (Codex fiscal) qui répond pour de vrai

**Le reste (Sprints 2-5) peut être communiqué en "à venir" avec date** — mais ce qui est SUR le site dans une démo doit être ACTIVABLE.

---

## 🎯 STRATÉGIE DE COMMUNICATION HONNÊTE

### Sur le site public (ikcp.eu)
- **Mention claire** : *"Family Office augmenté en Bêta — fonctionnalités déployées au fil des sprints, transparence totale sur la roadmap."*
- **Status badge par univers** : 🟢 Live · 🟡 En cours · 🟠 Sprint 3-4 · 🔴 Sprint 5+
- **Pas de fonctionnalité affichée comme "Live" si elle est mockée**

### Sur LinkedIn (com')
- **Roadmap publique** chaque mois — montrer ce qui passe de mockup à live
- **Authentique** : "ce mois-ci on a branché l'agrégation bancaire DSP2" plutôt que "tout fonctionne déjà"
- **Storytelling fondateurs** : laisser les bêta-testeurs co-bâtisseurs parler de leur expérience

### Aux bêta-testeurs
- **Charte de transparence dès l'onboarding** : ils savent que c'est en construction, ils sont co-bâtisseurs
- **Roadmap accessible** : ils voient leurs feedbacks devenir des fonctionnalités
- **Aucune surprise** : si une fonctionnalité affichée crashe ou est mockée, dire "Sprint X · semaine Y" plutôt que de bluffer

---

## 🚦 PROCHAINE ACTION CONCRÈTE

**Démarrer Sprint 1 cette semaine** = 7 jours de dev critique pour avoir une Bêta vraiment opérationnelle, RGPD-conforme, juridiquement sécurisée.

Sans Sprint 1, **ne pas ouvrir aux 50 bêta-testeurs**. Avec Sprint 1, **vous pouvez encaisser dès J+15** et accepter les 12 premiers fondateurs sans risque.

---

**Doc de pilotage interne · maintenu chaque semaine · révision Maxime** © 2026 IKCP
