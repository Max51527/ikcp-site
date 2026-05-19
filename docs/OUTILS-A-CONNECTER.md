# 🔌 Outils & API à connecter — Marcel Family Office

> Document interne ops · 2026-05-18
> Inventaire exhaustif des intégrations pour rendre Marcel autonome
> Cabinet IKCP · ORIAS 23001568

---

## ✅ Déjà connecté (LIVE)

| Outil | Usage | Worker | Coût mensuel |
|---|---|---|---|
| **Anthropic Claude** | Marcel + 12 sub-agents | ikcp-chat, ikcp-codex, ikcp-hermes, ikcp-lifestyle | 50-150 €/50 users |
| **Perplexity Pro** | Veille augmentée temps réel | ikcp-veille | 40-80 €/50 users |
| **Pappers** | Cartographie SIREN française | ikcp-pappers | 30 €/mois forfait |
| **Resend** | Magic link auth + digest matin | ikcp-client, ikcp-collector | 20 € (5k emails) |
| **Cloudflare** | D1 Paris, R2 EU, KV, Workers | toute l'infra | 5-25 €/mois |
| **Rebrickable** | Module collector LEGO collections | ikcp-collector | gratuit |

**Total infra actuelle** : ~150-300 €/mois pour 50 utilisateurs Premium.

---

## 🔴 Critique à connecter (avant ouverture bêta payante)

### 1. **Stripe** — paywall + facturation
- **Usage** : Tier Premium 49/149/390 €/mois + facturation LM cabinet
- **Worker** : ikcp-client `/stripe/checkout` `/stripe/portal` `/stripe/webhook` (code déjà prêt, secret manquant)
- **Setup** :
  ```bash
  # 1. Stripe Dashboard → Products → créer 3 prix
  #    - Premium Essentiel 49 €/mois → price_xxxxx
  #    - Premium Family 149 €/mois → price_yyyyy
  #    - Sur-mesure 390 €/mois → price_zzzzz
  # 2. Pousser secrets
  cd workers/ikcp-client
  npx wrangler secret put STRIPE_SECRET_KEY        # sk_live_…
  npx wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_…
  # 3. Webhook Stripe → URL : https://ikcp-client.maxime-ead.workers.dev/stripe/webhook
  ```
- **Effort** : 30 min config + 2 h tests
- **Coût** : 1,4 % + 0,25 € par transaction
- **Priorité** : 🔴 indispensable Sprint 3

### 2. **DVF gouv.fr** — valorisation immobilière auto
- **Usage** : auto-update valeur biens immo dans cartographie patrimoine
- **API** : https://api.cquest.org/dvf (gratuite, données publiques)
- **Workflow** : code postal + type → m² moyen → estimation auto
- **Effort** : 3 h (nouveau worker `ikcp-architecte` ou extension Pappers)
- **Coût** : 0 €
- **Priorité** : 🔴 critique pour widget Patrimoine consolidé

### 3. **YouSign / Universign / DocuSign** — signature eIDAS qualifiée
- **Usage** : signature DER, Lettre de Mission, donation-partage, OBO
- **YouSign** (FR, recommandé) : https://yousign.com/api
- **Universign** : workers/ikcp-universign en pause
- **Effort** : 4 h (réactiver Universign OU brancher YouSign)
- **Coût** : YouSign 39 €/mois forfait Pro + 1 €/signature
- **Priorité** : 🔴 Sprint 3 (avant 1ère mission LM signée)

---

## 🟠 Important Sprint 2-3

### 4. **Bridge / Powens / Linxo** — agrégation comptes bancaires
- **Usage** : valorisation automatique financière (PEA, AV, comptes-titres)
- **Bridge by Bankin'** (FR) : https://bridgeapi.io
- **Powens** (FR, ex-Budget Insight) : https://powens.com
- **Workflow** : OAuth bancaire → lecture soldes → injection D1
- **Effort** : 6 h (nouveau worker `ikcp-bridge` ou direct ikcp-client)
- **Coût** : ~0,30-0,80 €/user/mois (selon volume API calls)
- **Priorité** : 🟠 différenciateur Premium Family

### 5. **Brevo / Mailjet** — campagnes newsletter (complément Resend)
- **Usage** : newsletter UPPERCUT PATRIMOINE (déjà Beehiiv) + invitations bêta segmentées
- **Note** : Beehiiv suffit pour UPPERCUT. Brevo utile pour campagnes ciblées par tier.
- **Effort** : 2 h
- **Coût** : Brevo gratuit jusqu'à 300 emails/jour
- **Priorité** : 🟠 utile mais optionnel

### 6. **Légifrance API** — base juridique structurée
- **Usage** : citation jurisprudence Cass. com. / Conseil d'État dans Codex/Hermès
- **API** : https://api.legifrance.gouv.fr (gratuite, OAuth PISTE gouv.fr)
- **Effort** : 5 h (intégration tool dans Codex worker)
- **Coût** : 0 €
- **Priorité** : 🟠 améliore qualité Codex (déjà bon via prompt mais Légifrance = source officielle)

### 7. **BOFIP** — doctrine fiscale officielle
- **Usage** : citation précise BOI-X-XX-XXX dans Codex (déjà fait via prompt)
- **API** : https://bofip.impots.gouv.fr (pas d'API officielle, scraping autorisé)
- **Effort** : 8 h (worker scrapeur + KV cache)
- **Coût** : 0 €
- **Priorité** : 🟡 nice-to-have

---

## 🟡 Bonus différenciateur (Sprint 4+)

### 8. **Chrono24 / WatchCharts API** — cote montres temps réel
- **Usage** : auto-refresh quotidien cote pièces horlogerie surveillées
- **Chrono24** : pas d'API officielle (scraping nécessaire OU partenariat)
- **WatchCharts** : API non publique
- **Workaround** : passer par Perplexity (déjà fait, fonctionne)
- **Priorité** : 🟡 contourné par Perplexity

### 9. **RM Sotheby's / Classic.com** — cote auto collection
- **Usage** : valorisation Porsche / Ferrari / classic cars
- **Pas d'API publique** — Perplexity fait le job
- **Priorité** : 🟡 contourné

### 10. **Liv-ex API** — cote vins fine wine
- **Usage** : Auguste auto-refresh Pétrus, DRC, Bordeaux primeurs
- **API** : https://www.liv-ex.com/api (payant, ~2000 €/an)
- **Workaround** : Perplexity Auguste
- **Priorité** : 🟡 contourné

### 11. **Sotheby's / Christie's / Phillips** — calendriers ventes art
- **Usage** : Émile alerte avant ventes
- **Pas d'API publique** — Perplexity fait le job
- **Priorité** : 🟡 contourné

### 12. **AXA Art / Hiscox** — assurance collections
- **Usage** : devis assurance en 1 clic depuis fiche pièce
- **AXA Art** : pas d'API publique, partenariat à explorer
- **Hiscox** : portail courtier B2B
- **Workaround** : email automatique courtier partenaire IKCP
- **Effort** : 2 h (worker `ikcp-concierge` qui envoie email pre-formaté)
- **Priorité** : 🟡 service concierge

### 13. **Banque de France API** — indices, scoring entreprise
- **Usage** : enrichir cartographie société (score crédit, indices sectoriels)
- **API** : https://api.banque-france.fr/ (gratuite avec inscription)
- **Effort** : 6 h
- **Coût** : 0 €
- **Priorité** : 🟡 Pappers couvre déjà l'essentiel

### 14. **OpenSanctions** — vérification compliance dirigeants
- **Usage** : screening AML/PEP des dirigeants société (conformité CIF)
- **API** : https://www.opensanctions.org/api
- **Effort** : 4 h
- **Coût** : 0-200 €/mois selon volume
- **Priorité** : 🟡 conformité renforcée

### 15. **CalCom / Calendly API** — RDV Maxime intégré
- **Usage** : prise de RDV dans l'app sans sortir
- **API Calendly** : oui
- **Effort** : 3 h
- **Coût** : 12 €/mois Calendly Pro (déjà payé)
- **Priorité** : 🟡 UX bonus

### 16. **Notarius / Notaires.fr** — annuaire notaires
- **Usage** : Hermès suggère un notaire local à l'utilisateur
- **API** : pas d'API officielle
- **Workaround** : KV interne avec liste de notaires partenaires IKCP
- **Priorité** : 🟡

### 17. **Météo France** — anticipation séjours
- **Usage** : Iris affiche météo Megève S9 lors de la suggestion chalet
- **API** : openweathermap.org gratuit
- **Effort** : 1 h
- **Priorité** : ⚪ gadget

---

## 📊 Synthèse priorisation

| Sprint | Outil | Effort | Coût mensuel | Impact business |
|---|---|---|---|---|
| **Sprint 2 J0** | Stripe paywall | 2h30 | 0 € fixe + 1,4 % | 🔴 monétisation |
| **Sprint 2 J0** | DVF immobilier | 3 h | 0 € | 🔴 cartographie |
| **Sprint 3** | YouSign signature eIDAS | 4 h | 39 € + 1€/signature | 🔴 LM cabinet |
| **Sprint 3** | Bridge agrégation banque | 6 h | 15-40 € (50 users) | 🟠 différenciateur |
| **Sprint 3** | Légifrance API | 5 h | 0 € | 🟠 Codex officiel |
| **Sprint 4** | OpenSanctions AML | 4 h | 0-200 € | 🟡 compliance |
| **Sprint 4** | AXA Art email auto | 2 h | 0 € | 🟡 concierge |
| **Sprint 4** | Calendly intégré | 3 h | 0 € (déjà payé) | 🟡 UX |
| **Sprint 5** | Banque de France | 6 h | 0 € | 🟡 scoring |
| **Sprint 5** | BOFIP scraping | 8 h | 0 € | 🟡 Codex+ |

**Total Sprint 2-3 critique** : ~20 h dev + ~100 €/mois infra.
**Marge mensuelle 50 users Premium FO** : 50 × 149 € = 7 450 € − 300 € coûts = **7 150 €/mois marge brute** (~96 %).

---

## 🤖 Stratégie agents Perplexity — usage actuel vs étendu

### Actuel (1 endpoint générique)
```
POST ikcp-veille.maxime-ead.workers.dev/search
→ requête libre, tier check, audit Témoin
```

### Étendu Sprint 2 (par sub-agent dédié)
Chaque sub-agent (Joséphine, Léon, Auguste, Émile, Iris, Hélène, Olympe, Augustin) gagne un **tool** dans son worker qui appelle Perplexity en backstage :

```javascript
// Dans ikcp-lifestyle/worker.js
const tools = [
  {
    name: 'search_market_realtime',
    description: 'Recherche temps réel sur le marché secondaire ou les actualités du domaine (cote, ventes, calendriers).',
    input_schema: { /* … */ },
  }
];

// Quand Joséphine appelle ce tool → fetch ikcp-veille
```

→ **L'utilisateur ne voit jamais Perplexity**. Il parle à Joséphine qui semble omnisciente.

### Plus avancé Sprint 4 — Perplexity Spaces persistants
- 1 Space Perplexity par utilisateur Premium (custom instructions = son profil + ses watches)
- API Spaces : https://docs.perplexity.ai/api-reference (en construction publique)
- Veille truly continue, contextualisée perso

---

## ⚖ Mise à jour `reference_rgpd_sous_traitants.md` requise

Quand on active un nouveau sous-traitant (Stripe, YouSign, Bridge, etc.), il faut :
1. Vérifier le DPA / Schrems II (si US-based → préférer EU)
2. Mettre à jour le bandeau RGPD app + page `/app/securite.html`
3. Logger l'événement dans `audit_index` D1
4. Notifier les utilisateurs Premium par email si traitement nouveau

---

© 2026 IKCP — Marcel · Family Office augmenté · ORIAS 23001568
