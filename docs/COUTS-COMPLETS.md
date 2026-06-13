# Audit financier complet · IKCP Family Office

> Synthèse coûts infrastructure + agents IA + APIs + connexions à mettre en place.
> Mise à jour : 12 mai 2026 · usage interne strict · ne pas diffuser.

---

## 📊 Vue d'ensemble · à 50 clients Premium + 5 Sur-mesure

| Poste | Mensuel | Annuel |
|---|---|---|
| **Revenus** | **39 500 €** | **474 000 €** |
| Infrastructure totale | 2 342 € | 28 100 € |
| **Marge brute** | **37 158 €** | **445 900 €** |
| **Taux de marge** | **94,1 %** | **94,1 %** |

---

## 1️⃣ Coût agents IA souverains (poste critique)

### Tarification éditeur · Anthropic EU endpoint (interne)

| Modèle | Input ($/M tokens) | Output ($/M tokens) | Cache hit savings |
|---|---|---|---|
| Sonnet 4.6 | 3 $ | 15 $ | -90 % avec cache |
| Opus 4.7 | 15 $ | 75 $ | -90 % avec cache |
| Haiku 4.5 | 0,80 $ | 4 $ | -90 % avec cache |

### Profil de consommation par tier client

#### Client Freemium (0 €/mois)
- **0 appel agent IA** — uniquement règles JavaScript déterministes + APIs publiques
- Coût pour vous : **0 €**

#### Client Premium (290 €/mois)
- 15 questions/mois en moyenne
- 70 % traitées par Marcel seul (Sonnet 4.6) avec cache aggressive
- 25 % traitées par Marcel + 1 sub-agent (Sonnet 4.6 → Sonnet/Haiku)
- 5 % multi-agents complexes (Marcel + 2-3 sub-agents dont 1 Opus 4.7)
- Témoin (Haiku 4.5) loggue 100 % des interactions

**Calcul détaillé pour 1 mois :**
| Type | Volume | Tokens avg | Coût brut | Avec cache 80 % |
|---|---|---|---|---|
| Marcel solo | 10,5 q | 2 k in + 1 k out | 7,80 € | **1,56 €** |
| Marcel + sub-agent | 3,75 q | 5 k in + 3 k out | 19,50 € | **3,90 €** |
| Multi-agents Opus | 0,75 q | 10 k in + 5 k out | 36,90 € | **7,38 €** |
| Témoin audit | 15 logs | 1 k in + 0,3 k out | 0,18 € | **0,03 €** |
| **TOTAL Premium / mois** | | | | **~12,90 €** |

**Coût Claude par client Premium : ~12 €/mois** (marge sur 290 € = 95,9 %).

#### Client Sur-mesure (5 000 €+/mois)
- 80 questions/mois
- 50 % multi-agents (Opus 4.7 sur fiscalité, transmission, capital)
- Veille personnalisée + reporting trimestriel auto
- Cache hit 60 % (questions plus uniques, moins répétitives)

**Calcul détaillé pour 1 mois :**
| Type | Volume | Coût avec cache 60 % |
|---|---|---|
| Marcel solo | 40 q | **~9,20 €** |
| Marcel + sub-agent | 28 q | **~28,40 €** |
| Multi-agents Opus | 12 q | **~88,60 €** |
| Témoin audit | 80 logs | **~0,18 €** |
| Reporting trimestriel auto | 1/mois | **~6,40 €** |
| Veille personnalisée | 30 j × 5 mn | **~12,80 €** |
| **TOTAL Sur-mesure / mois** | | **~145,58 €** |

**Coût Claude par client Sur-mesure : ~145 €/mois** (marge sur 5 000 € = 97,1 %).

### Projection totale agents IA (50 Premium + 5 Sur-mesure)

| Type clients | Coût mensuel total | Annuel |
|---|---|---|
| 50 Premium × 12 € | 600 € | 7 200 € |
| 5 Sur-mesure × 145 € | 725 € | 8 700 € |
| Veille nocturne admin (4 agents) | 80 € | 960 € |
| Cassius (votre co-pilote) | 50 € | 600 € |
| **TOTAL agents IA** | **1 455 €** | **17 460 €** |

⚠ **Si croissance × 10 (500 Premium + 50 Sur-mesure)** → coût IA ~14 500 €/mois mais revenus 395 000 €/mois (marge brute 96 %+).

---

## 2️⃣ Coût APIs externes

### Sprint 1 (gratuit · activé immédiatement)

| API | Coût | Quota |
|---|---|---|
| RNE / INPI (Registre National Entreprises) | 0 € | illimité officiel |
| Pappers (wrapper) | 0-30 €/mois | free 100 req/mois ou illimité |
| DVF data.gouv.fr | 0 € | illimité |
| Cadastre.data.gouv.fr | 0 € | illimité |
| Estimer-immo.gouv.fr | 0 € | illimité |
| Légifrance API | 0 € | illimité officiel |
| BOFIP impots.gouv.fr | 0 € | scraping public |
| AMF / ACPR RSS | 0 € | illimité |
| Frankfurter API (BCE forex) | 0 € | illimité |
| CoinGecko (crypto + or) | 0 € | 30 req/min |
| Stooq (indices boursiers EU) | 0 € | rate-limit raisonnable |
| INSEE Sirene | 0 € | illimité officiel |
| BODACC | 0 € | illimité |
| **Total Sprint 1** | **0-30 €/mois** | |

### Sprint 2 (Premium · à activer dès Bêta lancée)

| API | Coût | Notes |
|---|---|---|
| Booking.com Affiliate | 0 € | commission 25 % sur marge hôtel |
| TheFork (resto FR/EU) | 0 € | B2B avec partenariat |
| YouSign eIDAS qualifié | ~1 €/signature × 300/mois | 300 € (à refacturer à 5 € au client) |
| Brevo (emails transactionnels FR) | 25 €/mois | jusqu'à 100k emails |
| Resend (alt) | 20 €/mois | option backup |
| OVHcloud Mailcloud Pro | 5 €/mois | pour adresses cabinet |
| **Total Sprint 2** | **~350 €/mois** | |

### Sprint 3 (Curateur Premium · activé selon demande)

| API | Coût | Notes |
|---|---|---|
| Mr & Mrs Smith Travel Network | 0 € | accréditation 4-6 semaines |
| Amadeus Self-Service | ~500 €/mois | vols + hôtels pro |
| Chrono24 Affiliate (horlogerie) | 0 € | commission |
| Artprice (art market data) | 250 €/mois (3 000 €/an) | indispensable Premium art |
| Classic.com (auto collection) | 50 €/mois | base marché |
| **Total Sprint 3 (selon usage)** | **~800 €/mois** | |

### Sprint 4 (Sur-mesure uniquement · refacturé)

| API | Coût | Refacturable client |
|---|---|---|
| Liv-ex (vins fine wine) | 200 €/mois | oui |
| Wine-Searcher pro | 100 €/mois | oui |
| Budget Insight / Powens (DSP2 banques) | 2 €/utilisateur/mois | inclus tarif Sur-mesure |
| MarineTraffic Pro | 150 €/mois | oui |
| YachtWorld B2B | 0 € | commission |
| John Paul (conciergerie white-label) | partenariat custom | refacturé 1 500-3 000 €/mois |
| **Total Sprint 4** | **~450 €/mois pour 5 clients** | |

### Synthèse APIs (50 Premium + 5 Sur-mesure)

| Sprint | Mensuel |
|---|---|
| Sprint 1 (toujours actif) | 30 € |
| Sprint 2 (Premium activé) | 350 € |
| Sprint 3 (Curateur sur 50 Premium) | 800 € |
| Sprint 4 (Sur-mesure activé 5 clients) | 450 € |
| **TOTAL APIs** | **~1 630 €/mois** |

⚠ **Astuce économique** : facturer 5 €/signature eIDAS aux clients = couvre 100 % le coût YouSign. Reportez Liv-ex et Artprice sur clients Sur-mesure (frais inclus dans 5 000 €+/mois).

---

## 3️⃣ Coût infrastructure Cloudflare

### Configuration recommandée

| Service | Plan | Coût mensuel |
|---|---|---|
| Workers (Marcel, Cassius, Témoin, Pappers, Markets, Funnel, etc.) | Paid Plan | 5 $ |
| D1 SQLite (Paris) | 5 GB inclus + au-delà | ~10-30 € selon volume |
| R2 Object Storage (Frankfurt EU) | 10 GB · zero egress | ~5 € |
| KV Namespaces (cache) | 1 GB free | 0 € |
| Pages (front-end) | inclus Workers | 0 € |
| **Regional Services EU-only** | Add-on critique RGPD | ~50 €/mois |
| Workers AI (si besoin LLM local) | non utilisé | 0 € |
| DNS / SSL | inclus | 0 € |
| **TOTAL Cloudflare** | | **~70-90 €/mois** |

### Coûts annexes hébergement

| Service | Coût | Notes |
|---|---|---|
| Domain ikcp.eu (DNS) | 50 €/an | déjà en place |
| Scaleway fr-par (ikcp-mcp existant) | 10 €/mois | déjà en place |
| OneDrive Personal (backups) | 0 € | déjà inclus Microsoft 365 |
| **TOTAL hébergement** | **~13 €/mois** | |

---

## 4️⃣ Outils transverses (paiement, signature, com')

| Outil | Coût | Notes |
|---|---|---|
| **Stripe** (paiements abonnements) | 1,4 % + 0,25 € par transaction EU | sur 39 500 €/mois → ~580 € |
| **Calendly / Cal.com self-hosted** | 0 € | open source |
| **Sentry** (monitoring erreurs) | 26 $/mois | optionnel mais recommandé |
| **Plausible Analytics** (RGPD-friendly FR) | 9 €/mois | alternatif Google Analytics |
| **GitHub Pro** (versionning code) | 4 €/mois | repo privé |
| **TOTAL outils** | **~650 €/mois** | |

---

## 5️⃣ Récapitulatif mensuel total

| Poste | Mois 1 (lancement) | Mois 6 (50 Premium) | Mois 12 (50 + 5 SM) |
|---|---|---|---|
| Agents IA souverains | 50 € | 800 € | 1 455 € |
| APIs externes | 30 € | 380 € | 1 630 € |
| Cloudflare + hébergement | 70 € | 90 € | 100 € |
| Stripe (commission) | 50 € | 415 € | 580 € |
| Outils (signature, monitoring) | 40 € | 200 € | 650 € |
| **TOTAL infrastructure** | **240 €** | **1 885 €** | **4 415 €** |
| **Revenus** | 0 € | 14 500 € | 39 500 € |
| **Marge brute** | -240 € | 12 615 € | 35 085 € |
| **Taux** | — | 87 % | 89 % |

---

## 6️⃣ Coûts initiaux (one-shot)

### Développement (à faire OU à externaliser)

| Brique | Effort jours | Coût externalisé | Coût Maxime + Claude Code |
|---|---|---|---|
| Architecture Claude Agent SDK + sub-agents | 6 j | 4 800 € | 0 € (temps) |
| Workers Cloudflare (5 workers principaux) | 5 j | 4 000 € | 0 € |
| Front-end PWA + mobile + manifest | 4 j | 3 200 € | 0 € |
| Stripe Checkout + Customer Portal | 2 j | 1 600 € | 0 € |
| YouSign eIDAS intégration | 1 j | 800 € | 0 € |
| Tests + déploiement | 3 j | 2 400 € | 0 € |
| **TOTAL DEV** | **21 j** | **16 800 €** | **0 €** |

### Accréditations (4-8 semaines, à lancer maintenant)

| Accréditation | Coût | Délai |
|---|---|---|
| Mr & Mrs Smith Travel Network | 0 € | 4 semaines |
| Booking Affiliate Partner | 0 € | 2 semaines |
| TheFork B2B partner | 0 € | 2 semaines |
| Stripe Connect (KYC complet) | 0 € | 3-5 jours |
| Pappers premium key (illimité) | 360 €/an | 1 j |
| Adhésion AFFO | ~2 000 €/an | 2 mois |
| **TOTAL accréditations** | **~2 360 €/an** | |

### Sécurité juridique

| Item | Coût |
|---|---|
| Mise à jour lettre de mission + CGV Premium / Sur-mesure | 800 € (avocat) |
| Audit RGPD complet par DPO externe | 1 500 € |
| Mention obligatoire ORIAS + carte pro | déjà en place |
| **TOTAL juridique** | **2 300 € one-shot** |

### Total investissement initial

| Si dev externalisé | Si dev Maxime + Claude Code |
|---|---|
| 21 460 € | 4 660 € |

**Recommandation** : dev en Maxime + Claude Code (vous progresez en compétences), externalisez uniquement le juridique et l'audit RGPD.

---

## 7️⃣ Connexions critiques à mettre en place — ordre de priorité

### Phase 1 — Semaine 1 (avant lancement Bêta)
- ☑ Worker `ikcp-pappers` (RNE wrapper) — **bloquant pour le funnel Marcel**
- ☑ Worker `ikcp-temoin` (audit log) — **bloquant juridiquement**
- ☑ Stripe Checkout + Customer Portal — **bloquant pour encaissement**
- ☑ YouSign eIDAS — **bloquant pour lettres de mission**
- ☑ Brevo (emails transactionnels) — **bloquant pour magic links**

### Phase 2 — Semaines 2-4 (premiers Bêta-testeurs)
- Worker `ikcp-marcel` (orchestrateur Claude SDK)
- Sub-agent Codex fiscal (Opus 4.7 via endpoint EU)
- Sub-agent Bâtisseur patrimoine
- Witness logging vers D1 + R2 chiffré
- Authentification magic link via Brevo

### Phase 3 — Mois 2-3 (montée en charge)
- Booking Affiliate + TheFork API → univers Concierge
- Frankfurter + CoinGecko + Stooq → univers Marchés (live)
- Sub-agent Concierge (Sonnet 4.6)
- Sub-agent Architecte immobilier
- Tableau de bord centralisé `family-office-actifs.html` live

### Phase 4 — Mois 4-6 (Premium pleine puissance)
- Mr & Mrs Smith (après accréditation)
- Amadeus Self-Service
- Chrono24 + Artprice (univers Curateur)
- École NextGen complète (6 modules)
- Cassius co-pilote admin (brief matin 7:30)

### Phase 5 — Mois 6-12 (Sur-mesure premium)
- Budget Insight / Powens (DSP2 agrégation bancaire)
- Liv-ex (vins fine wine)
- MarineTraffic + YachtWorld
- Partenariat John Paul (conciergerie white-label)
- API d'avocats d'affaires (Septeo, partenariats notaires)

---

## 8️⃣ Modèle économique consolidé · 12 mois projection

### Hypothèses
- Mois 1-3 : 0 client (dev + lancement bêta)
- Mois 4-6 : 10 → 30 Premium (montée bêta)
- Mois 7-9 : 30 → 50 Premium (Bêta complète) + 2 Sur-mesure
- Mois 10-12 : 50 Premium + 5 Sur-mesure stables

### Revenus cumulés 12 mois
| Trimestre | Revenus | Coûts | Marge |
|---|---|---|---|
| T1 (mois 1-3) | 0 € | -8 000 € | -8 000 € |
| T2 (mois 4-6) | 13 000 € | -4 500 € | +8 500 € |
| T3 (mois 7-9) | 70 000 € | -8 000 € | +62 000 € |
| T4 (mois 10-12) | 118 500 € | -13 245 € | +105 255 € |
| **TOTAL ANNÉE 1** | **201 500 €** | **-33 745 €** | **+167 755 €** |

### Investissement initial à amortir
- ~5 000 € dev + 2 300 € juridique = 7 300 €
- Amorti dès le mois 5

---

## 9️⃣ Risques économiques identifiés & mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Sur-consommation agents IA (cache mal géré) | Moyenne | -500-2000 €/mois | Cache aggressive + monitoring usage par client |
| API tierce indisponible (Pappers/Booking) | Faible | Service dégradé | Fallback déterministe local + SLA contractuel |
| Bug RGPD (données EU/US) | Faible mais critique | Sanctions CNIL | Audit DPO + Regional Services Cloudflare EU only |
| Litige bêta-testeur | Faible | Réputationnel | Audit log Témoin + signature eIDAS |
| Concurrent (Forsis, autre FO) | Moyenne | Perte clients | Différenciation IA + héritage Montgolfier + co-création |

---

## 🔑 Indicateurs clés à surveiller

| KPI | Cible Mois 6 | Cible Mois 12 |
|---|---|---|
| Coût Claude / client Premium | < 15 €/mois | < 12 €/mois |
| Taux marge brute | > 85 % | > 90 % |
| Conversion freemium → Premium | > 8 % | > 12 % |
| Churn mensuel | < 3 % | < 2 % |
| NPS bêta-testeurs | > 50 | > 70 |
| Partenariats apportés par bêta-testeurs | 5 | 25 |

---

**Document maintenu par Maxime Juveneton · révision mensuelle · usage strictement interne** © 2026 IKCP
