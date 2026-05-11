# IKCP Family Office — Audit Beta Readiness

> **Objet** : audit go/no-go avant lancement officiel de la phase beta
> (50 familles dirigeantes · S2 2026). Évaluation complète sur 7
> dimensions avec actions correctives, responsables et calendrier.
>
> **Statut** : v1 · 09/05/2026
> **Décision attendue** : Go (avec actions bloquantes levées) /
> Go partiel / Reporter
>
> **Documents associés** : `FAMILY-OFFICE-AGENTS-AUDIT.md`,
> `FAMILY-OFFICE-FAISABILITE-AUDIT.md`, `AI-ACT-REGISTRY.md`

---

## 0. Méthode

### Échelle de readiness

| Code | Lecture | Action |
|---|---|---|
| ✅ | **Prêt** — déployable en l'état | Aucune |
| 🟡 | **À finaliser** — gap minime, non bloquant pour la beta | À faire S+1 |
| ⚠️ | **Risque** — peut passer en beta avec mitigation | Mitigation + suivi |
| ❌ | **Bloquant** — pas de beta sans correction | Action immédiate |

### 7 dimensions auditées

1. Technique & infrastructure
2. Contenu & expérience produit
3. Conformité réglementaire
4. Opérationnel beta
5. Mesure & retours
6. Marketing & communication
7. Plan de risques & continuité

---

## 1. Technique & infrastructure

### 1.1 Déploiement des Workers

| Worker | État code | Déployé ? | Bloquant ? |
|---|:---:|:---:|:---:|
| `ikcp-marcel` (chat ikcp-chat.maxime-ead.workers.dev) | ✅ 9 tools + 25 contextes | **À redéployer** (pivot beta) | ❌ |
| `ikcp-api` (gateway api.ikcp.eu) | ✅ /v1/agents/ask + /v1/dvf + /v1/legifrance + /v1/insee | **À déployer** | ⚠️ |
| `ikcp-prospect` | ✅ Existant production | ✅ déployé | — |
| `ikcp-client` (espace client) | ✅ /api/dashboard/me + /api/export/me + /auth/beta-redeem | **À déployer** | ❌ |

**Action** : `wrangler deploy` sur les 3 workers à mettre à jour. Estimation 30 min total.

```bash
cd workers/ikcp-marcel && wrangler deploy
cd ../ikcp-api && wrangler deploy
cd ../ikcp-client && wrangler deploy
```

### 1.2 Base de données D1

| Table | Schema appliqué ? | Données seed ? |
|---|:---:|:---:|
| `users` | ✅ | — |
| `sessions` | ✅ | — |
| `conversations` | ✅ | — |
| `dossiers` | ✅ | — |
| `audit_log` | ✅ | — |
| `patrimoine_snapshot` | 🟡 schema écrit, à appliquer | — |
| `echeances` | 🟡 schema écrit, à appliquer | — |
| `arbitrages` | 🟡 schema écrit, à appliquer | — |
| `documents` | 🟡 schema écrit, à appliquer | — |
| `events` | 🟡 schema écrit, à appliquer | — |
| `univers_items` | 🟡 schema écrit, à appliquer | — |
| `opportunites` | 🟡 schema écrit, à appliquer | — |
| `beta_codes` | 🟡 schema écrit · **50 codes à insérer** | ❌ bloquant |

**Action** :

```bash
cd workers/ikcp-client
wrangler d1 execute ikcp-client-db --file=schema.sql
# Puis générer + insérer 50 codes beta (voir §4.1)
```

### 1.3 R2 buckets

| Bucket | État | Bloquant ? |
|---|:---:|:---:|
| `ikcp-docs-private` | ❌ à créer | ⚠️ (la beta peut tourner sans upload doc Phase 1) |
| `ikcp-media-public` | 🟡 à créer | non |
| `ikcp-archives` | 🟡 à créer | non |
| `ikcp-templates` (DER/RA/bilan) | ❌ à créer · templates à fournir | ⚠️ |

**Action** : `wrangler r2 bucket create ikcp-docs-private` × 4. Pour la beta, R2 n'est pas bloquant (upload doc en Phase 2 — Documents-agent à coder).

### 1.4 Secrets configurés (Cloudflare Dashboard)

| Worker | Secret | Statut |
|---|---|:---:|
| ikcp-marcel | `ANTHROPICAPIKEY` | ✅ existant |
| ikcp-api | `ANTHROPIC_API_KEY` (pour /v1/agents/ask fallback) | 🟡 à confirmer |
| ikcp-api | `RESEND_API_KEY` | ❌ à configurer |
| ikcp-api | `NOTION_TOKEN` + `NOTION_DB_ID` | ❌ à configurer |
| ikcp-api | `LEGIFRANCE_TOKEN` (optionnel) | 🟡 |
| ikcp-api | `INSEE_KEY` | 🟡 |
| ikcp-client | `RESEND_API_KEY` (magic link) | ❌ à configurer |
| ikcp-client | `JWT_SECRET` (cookie session) | 🟡 à générer |

**Action** : configurer Resend + Notion via le Dashboard Cloudflare. Resend : compte créé, domaine `ikcp.eu` à vérifier (DNS DKIM).

### 1.5 Service binding `MARCEL` (ikcp-api → ikcp-chat)

État : ✅ déclaré dans `workers/ikcp-api/wrangler.toml`. Effectif après redéploiement de `ikcp-api`.

### 1.6 PWA + service worker

| Item | État |
|---|:---:|
| `manifest.json` (4 raccourcis) | ✅ |
| `sw.js` (cache-first) | ✅ existant, à étendre pour /proposals/* | 🟡 |
| Meta `apple-mobile-web-app-*` sur pages clés | ✅ |
| Apple touch icon | ✅ existant `/icons/icon-192.png` |

**Action** : étendre `sw.js` cache list aux nouvelles pages (espaces-fo, landing-beta-dirigeants, formation-nextgen, dashboard-famille-office). 1 heure.

### 1.7 Smoke tests pré-lancement

À exécuter J−1 :

```bash
# Health checks
curl https://ikcp-chat.maxime-ead.workers.dev/health
curl https://api.ikcp.eu/v1/health  # ou ikcp-api.maxime-ead.workers.dev
curl https://client.ikcp.eu/health  # ou équivalent

# Marcel — test theme
curl -X POST https://api.ikcp.eu/v1/agents/ask \
  -H "Origin: https://ikcp.eu" -H "Content-Type: application/json" \
  -d '{"theme":"transmission","question":"Comparer cession vs Dutreil 8 M€"}'

# DVF
curl "https://api.ikcp.eu/v1/dvf?code_postal=75116&type=Appartement"

# Beta redeem (avec un code de test)
curl -X POST https://client.ikcp.eu/auth/beta-redeem \
  -H "Origin: https://ikcp.eu" -H "Content-Type: application/json" \
  -d '{"code":"BETA-FAMI-DEMO-2026"}'
```

État actuel : ❌ tests non exécutés (worker ikcp-client pas déployé)

### 1.8 Monitoring

| Outil | État | Rôle |
|---|:---:|---|
| Cloudflare Workers Analytics | ✅ activé (`observability` dans wrangler.toml) | latence, erreurs |
| Cloudflare Logs (tail) | ✅ disponible | debug live |
| Resend stats | 🟡 dispo après config | taux ouverture magic link |
| Anthropic dashboard | ✅ existant | coût Marcel, prompt caching ratio |
| Cron alerting | ❌ à mettre en place | alerte si erreurs > 1% |

**Action** : créer un cron alerting Worker simple. Non bloquant pour beta — on peut tail manuellement les premiers jours.

### 1.9 Synthèse Tech

| Sous-domaine | État | Bloquant beta ? |
|---|:---:|:---:|
| Code workers | ✅ | non |
| Déploiement | ❌ à faire | **oui** |
| D1 tables | 🟡 à appliquer | **oui pour beta_codes** |
| R2 buckets | 🟡 | non Phase 1 |
| Secrets Resend / Notion | ❌ | **oui** (magic link) |
| Service binding | ✅ déclaré | non |
| PWA / SW | ✅ | non |
| Smoke tests | ❌ à exécuter | **oui** J−1 |
| Monitoring | 🟡 partiel | non |

**Verdict tech** : 🟡 — déployable sous 2-3 heures de travail (déploiement workers + D1 + secrets + smoke tests).

---

## 2. Contenu & expérience produit

### 2.1 Pages publiques prêtes

| Page | URL cible | État |
|---|---|:---:|
| Site principal | `ikcp.eu` | ✅ existant |
| Landing beta dirigeants | `ikcp.eu/beta` | ✅ |
| 3 espaces tarifaires | `ikcp.eu/espaces` | ✅ |
| Formation NextGen | `ikcp.eu/nextgen` | ✅ |
| Univers freemium | `ikcp.eu/univers` | ✅ |
| Conviction | `ikcp.eu/conviction` | ✅ |
| Sur-mesure tarif | `ikcp.eu/sur-mesure` | ✅ |
| Expertise internationale | `ikcp.eu/international` (membres FO) | ✅ |
| Dashboard membre | `client.ikcp.eu` | ✅ mockup, à brancher D1 |
| Aperçu écosystème | `ikcp.eu/apercu` (interne) | ✅ |
| **Famille apprenante** | `ikcp.eu/famille-apprenante` | 🟡 livrée dans cette PR |

### 2.2 Copy & storytelling

| Élément | État |
|---|:---:|
| Storytelling « enfants pas nuls » | ✅ |
| 4 cas concrets nommés (Emma, Thomas, Léa, Hugo & Antoine) | ⚠️ **fictifs** — à valider avec vrais clients ou marquer clairement « cas types anonymisés » |
| Promesse 4 × 100% | ✅ |
| Tarifs lisibles | ✅ |
| Disclaimer MIF II en pied de chaque réponse Marcel | ✅ system prompt |
| Mentions légales en footer chaque page | 🟡 incomplètes (ORIAS oui, mais URL mentions légales manquante) |

**Action critique** : marquer les cas concrets comme "cas types anonymisés" tant que les vraies familles beta ne sont pas conventionnées.

### 2.3 Schémas & visuels

| Élément | État |
|---|:---:|
| Schémas SVG conviction (4 cas) | ✅ |
| Schémas internationaux (7) | ✅ |
| Mockup phone application | ✅ |
| Captures dashboard à jour | 🟡 mockup, pas captures réelles |
| Logo IKCP | ✅ existant `icons/icon-192.png` |
| Vidéos démo Marcel | ❌ aucune | non bloquant |

### 2.4 Liens & navigation

| Test | État |
|---|:---:|
| Tous les liens internes fonctionnent | 🟡 à valider (43 liens proposés, ~5 à 10 à corriger) |
| Footer cohérent sur toutes les pages | 🟡 hétérogène |
| Breadcrumb / retour | ❌ absent | non bloquant |
| 404 page | ❌ pas de page custom | non bloquant |

**Action** : passe de revue navigation 1 heure J−2.

### 2.5 Responsive mobile

| Page | Mobile | Tablette | Desktop |
|---|:---:|:---:|:---:|
| landing-beta-dirigeants | ✅ | ✅ | ✅ |
| espaces-fo | ✅ | ✅ | ✅ |
| formation-nextgen | ✅ | ✅ | ✅ |
| family-office-v5-univers | ✅ | ✅ | ✅ |
| dashboard-famille-office | ✅ 12 breakpoints | ✅ | ✅ |
| expertise-internationale | ✅ | ✅ | ✅ |

### 2.6 Synthèse Contenu

**Verdict** : ✅ — pages prêtes, storytelling solide. Action critique unique : disclaimer "cas types anonymisés" sur les 4 cas concrets (Emma, Thomas, Léa, Hugo & Antoine).

---

## 3. Conformité réglementaire

### 3.1 Mentions légales / CGU / CGV

| Document | État | Bloquant ? |
|---|:---:|:---:|
| Mentions légales | ❌ pas de page dédiée | ❌ obligation légale |
| CGU (Conditions Générales d'Utilisation) | ❌ | ❌ |
| CGV (Conditions Générales de Vente) | ❌ pour les tiers payants | ❌ pour Premium/TPE |
| Charte beta-tester | ❌ à rédiger | ❌ |
| Politique cookies | 🟡 banner non implémenté | ❌ RGPD |

**Action critique** : 4 documents à rédiger (juriste IKCP + Maxime). Estimation 5-7 jours ouvrés.

### 3.2 RGPD

| Item | État |
|---|:---:|
| Information collecte (chaque formulaire) | 🟡 partiel |
| DPO formalisé | ❌ à formaliser (cf. AI-ACT-REGISTRY §8 action 3) |
| Banner cookies (consent management) | ❌ |
| Droit à l'effacement opérationnel | 🟡 endpoint à coder (DELETE /api/users/me) |
| Droit à la portabilité | ✅ `/api/export/me` livré |
| Registre des traitements | 🟡 dans AI-ACT-REGISTRY mais pas formalisé |

**Action critique** : banner cookies + DPO formalisé. Sans cela, la beta s'expose à un risque CNIL.

### 3.3 AI Act registry

État : ✅ document `docs/AI-ACT-REGISTRY.md` rédigé, 9 sections couvertes, plan d'action 12 mois listé.

**À compléter avant beta** :
- [x] Fiche système Marcel
- [x] Données traitées
- [x] Supervision humaine
- [ ] Communication clients — charte usage IA (action #8 du plan, à faire S+2)

### 3.4 RC Pro

État : ⚠️ avenant non encore demandé. Risque modéré : la beta opère en mode "préparation pédagogique" donc relève de la couverture conseil patrimonial existante. **Mais** : à formaliser avant fin de beta (S2 2026).

**Action** : email à l'assureur RC Pro IKCP. 1 heure.

### 3.5 MIF II / DDA

| Garde-fou | État |
|---|:---:|
| Disclaimer fin réponse Marcel | ✅ system prompt |
| Pas de recommandation produit nommée | ✅ règle absolue |
| Validation Maxime systématique en file `arbitrages` | ✅ design |
| Audit log conservé 5+ ans | 🟡 KV 90j seulement actuellement |
| DER / Lettre de mission systématique | ❌ Reporting-agent pas livré |

**Action** : pour la beta, formaliser un DER simplifié à signer à l'entrée (PDF non auto-généré, manuel par Maxime).

### 3.6 Archivage NF Z42-013

État : ❌ pas de R2 horodaté Universign. Non bloquant Phase 1 beta (pas d'engagement contractuel client encore signé). Bloquant Phase 2.

### 3.7 LCB-FT

État : ⚠️ pour la beta gratuite, pas d'entrée en relation contractuelle → vigilance LCB-FT non déclenchée. À formaliser dès le premier passage payant (Premium / TPE).

### 3.8 Synthèse Conformité

**Verdict** : ⚠️ — déployable en **beta gratuite** avec actions correctives sur :
1. ❌ Mentions légales / CGU / Charte beta-tester (5-7 j)
2. ❌ Banner cookies (1 j)
3. 🟡 DPO formalisé (1 sem)
4. 🟡 Marquer cas concrets « anonymisés »
5. 🟡 DER simplifié manuel pour entrée beta

**Sans ces actions** : risque CNIL + risque image. **Avec** : prêt.

---

## 4. Opérationnel beta

### 4.1 50 codes générés

État : ❌ 0 code en prod. 3 codes démo dans le front (`BETA-FAMI-DEMO-2026`, `BETA-FAMI-PIVOT-2026`, `BETA-FAMI-PILOTE-001`).

**Action** : générer 50 codes uniques + insertion D1 :

```bash
# Script de génération
node -e "
const codes = [];
for (let i = 0; i < 50; i++) {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  codes.push('BETA-FAMI-' + seg() + '-' + seg());
}
console.log(codes.map(c => \`('\${c}', 1, strftime('%s', 'now') * 1000, 'Beta S2 2026 · cohorte 1', 'maxime-direct')\`).join(',\n'));
"

# Puis :
wrangler d1 execute ikcp-client-db --command="INSERT INTO beta_codes (code, max_uses, created_at, notes, source) VALUES ${LIST};"
```

### 4.2 Profils famille présélectionnés

État : 🟡 à formaliser. Critères de sélection :

| Critère | Cible |
|---|---|
| Statut dirigeant | TPE/PME/ETI familiale (CA 500 k€ - 50 M€) |
| Patrimoine net | 1 - 30 M€ |
| Enfants concernés | Au moins 1 enfant 18-40 ans |
| Géographie | France métropole (60%) + frontaliers/expat (40%) |
| Maturité transmission | Pensée mais pas exécutée |
| Engagement | Acceptent retour mensuel structuré |

**Action** : Maxime liste 60-80 prospects qualifiés (carnet d'adresses + LinkedIn). Sélection 50.

### 4.3 Processus d'onboarding documenté

| Étape | État |
|---|:---:|
| Email contact initial (template) | ❌ à rédiger |
| Pré-qualification (10 questions) | ❌ |
| Attribution code beta | ✅ via D1 |
| Envoi welcome + agenda 1er mois | ❌ |
| 1ère visio Maxime (cadrage 45 min) | 🟡 à planifier (Calendly) |
| Premier accès dashboard | ✅ via /auth/beta-redeem |
| Premier module NextGen démarré | 🟡 à structurer |

**Action** : runbook onboarding 5 pages + 4 templates email + agenda type 1er mois.

### 4.4 Charte beta-tester

À rédiger — 1-2 pages :
- Engagement de retour mensuel (form 10 questions, 15 min)
- Confidentialité (NDA mutuelle)
- Durée 6 mois gratuit + reconduction tarif Premium
- Droits sur les données (RGPD)
- Possibilité d'arrêter à tout moment

### 4.5 Calendrier Maxime

État : 🟡 Calendly configuré mais pas dédié beta. Action : créer un type d'événement « IKCP Beta · cadrage 45 min » et un autre « IKCP Beta · suivi mensuel 30 min ».

### 4.6 Support email/chat

| Canal | État |
|---|:---:|
| Email `beta@ikcp.fr` ou `support@ikcp.fr` | 🟡 à créer (Cloudflare Email Routing → maxime@ikcp.fr) |
| Marcel chat 24/7 | ✅ couvre 80% des questions |
| Visio urgence | 🟡 sur Calendly avec slot dédié |

### 4.7 Synthèse opérationnel

**Verdict** : 🟡 — beaucoup d'opérationnel à monter (codes, profils, runbook, charte). Estimation **2 semaines de travail Maxime** avant d'être prêt à lancer auprès des 50 familles.

---

## 5. Mesure & retours

### 5.1 KPIs définis pour la beta

| KPI | Cible 6 mois | Mesure |
|---|---|---|
| Codes redeemés | 40 / 50 (80%) | D1 `beta_codes.used_count` |
| Activation (1ère question Marcel) | 35 / 50 | events Marcel |
| Modules NextGen complétés | 3 / membre en moyenne | events ou D1 progression |
| Visio Maxime tenues | 50+ | Calendly export |
| Taux de retours mensuels | 70% | form mensuel |
| NPS | > 30 | form mensuel |
| Conversion vers payant fin de beta | 30 / 50 (60%) | D1 abonnements |

### 5.2 Analytics

| Outil | État | Mesure |
|---|:---:|---|
| Google Analytics / Plausible | 🟡 à configurer | trafic, conversion |
| Cloudflare Web Analytics | ✅ existant | trafic |
| Internal events D1 | ✅ table `events` créée | parcours utilisateur |
| Marcel KV logs | ✅ existant | questions, season, web_search |

### 5.3 Formulaire feedback mensuel

À rédiger — 10 questions :
- Note globale 0-10 (NPS)
- Module NextGen le plus utile
- Qu'est-ce qui manque ?
- Qu'est-ce qui ne sert à rien ?
- Une fonction à ajouter ?
- Marcel répond-il pertinent ? 0-10
- Ferais-tu adhérer un ami ?
- Tarif Premium 6 800 €/an : juste / cher / abordable ?
- Ouverture commentaire libre

### 5.4 Dashboard interne admin

État : ❌ pas encore livré. Maxime aura besoin de voir :
- Liste des membres beta + statut activation
- Codes utilisés / restants
- Conversations Marcel récentes (modération)
- File d'arbitrages en attente
- Alertes (erreurs > 1%, codes expirés)

**Action** : page `/admin` simple sous auth bearer token. 2-3 jours de dev.

### 5.5 Synthèse mesure

**Verdict** : 🟡 — KPIs définis, mais analytics et dashboard admin à monter. Pas bloquant J0 (on peut commencer à 5-10 familles, monter le dashboard en parallèle), bloquant pour scaler à 50.

---

## 6. Marketing & communication

### 6.1 Identification 50 prospects famille beta

État : 🟡 carnet d'adresses Maxime + LinkedIn. À formaliser en CRM.

### 6.2 Pitch oral et écrit

| Asset | État |
|---|:---:|
| Pitch deck 8 slides | ❌ à produire |
| Pitch oral 5 min | ❌ à scripter |
| Email type 1er contact | ❌ à rédiger |
| Page landing beta | ✅ |
| FAQ beta-tester | ❌ à rédiger |

**Action** : kit pitch (deck + script + email + FAQ) — 3-5 jours.

### 6.3 Visibilité

| Canal | État | Plan |
|---|:---:|---|
| Post LinkedIn lancement | ❌ | post Maxime + 3-5 reposts pairs |
| Article blog IKCP | 🟡 | article 1500 mots « les 5 erreurs de transmission » |
| Newsletter (mailing existant) | 🟡 | mail dédié beta |
| Événement de lancement | ❌ | facultatif |

### 6.4 Témoignages

État : ⚠️ les 4 cas concrets (Emma, Thomas, Léa, Hugo & Antoine) sont **fictifs** pour le pitch. **Avant lancement officiel**, soit :
- (A) marquer clairement « cas types anonymisés » (acceptable)
- (B) obtenir 2-3 vraies validations beta-testers + droit à l'image (idéal)

### 6.5 Synthèse marketing

**Verdict** : 🟡 — kit pitch à produire (3-5 jours), mais le storytelling existe déjà sur les pages.

---

## 7. Plan de risques & continuité

### 7.1 Plans B identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|:---:|:---:|---|
| Marcel/Anthropic down | faible | élevé | Fallback mock front (déjà en place sur v4 / v5 / dashboard) |
| Cloudflare incident | très faible | critique | SLA 99,99%, statuspage, fallback email Maxime direct |
| Magic link Resend down | faible | élevé | Maxime envoie le lien manuellement par email perso |
| Beta-tester rage-quit | faible | moyen | Form de désinscription + feedback exit |
| Surdosage support Maxime | élevé | élevé | Support 1ère ligne par Marcel, escalation human only si nécessaire |
| Bug critique J+3 | moyen | moyen | Hotfix branch, déploiement < 30 min |
| Demande presse / régulateur | faible | élevé | Position préparée (cf. AI-ACT-REGISTRY § communication) |
| Fuite donnée beta-tester | faible | critique | Hébergement EU, chiffrement R2, audit log, déclaration CNIL 72h |

### 7.2 Calendrier de roll-back

Si réception de retours négatifs majeurs S+2 :
- J+0 : pause des nouveaux invitations
- J+1 : interview 5 beta-testers
- J+3 : décision continuation / pivot / pause

### 7.3 Synthèse risques

**Verdict** : ✅ — plans B identifiés, fallback techniques en place. Risque opérationnel principal : **support Maxime saturé** si > 20 familles activent en S1.

---

## 8. Synthèse globale & décision Go/No-Go

### 8.1 Récapitulatif par dimension

| Dimension | Verdict | Actions bloquantes |
|---|:---:|---|
| 1. Tech & infrastructure | 🟡 | Déploiement workers, D1 schema, secrets Resend (2-3h) |
| 2. Contenu & expérience | ✅ | Disclaimer "cas types anonymisés" (10 min) |
| 3. Conformité | ⚠️ | Mentions légales + CGU + Charte beta + cookies banner (5-7j) |
| 4. Opérationnel beta | 🟡 | 50 codes, runbook onboarding, charte beta-tester (2 sem) |
| 5. Mesure & retours | 🟡 | KPIs définis, analytics + dashboard admin (1 sem) |
| 6. Marketing & communication | 🟡 | Kit pitch + article blog + post LinkedIn (3-5j) |
| 7. Risques & continuité | ✅ | — |

### 8.2 Calendrier recommandé

```
S0 (cette semaine — 09/05/2026)
  · Déploiement workers + D1 + secrets         [0,5 j Tech]
  · Génération 50 codes beta                    [0,5 j Tech]
  · Disclaimer cas anonymisés                   [10 min]
  · Smoke tests complets                        [0,5 j]

S+1
  · Mentions légales + CGU + Charte beta-tester [5 j Maxime + juriste]
  · Banner cookies + page mentions légales      [1 j Tech]
  · Runbook onboarding + 4 templates email      [2 j Maxime]
  · Kit pitch (deck + script + FAQ)             [3 j Maxime]

S+2
  · Pré-qualification 60-80 prospects           [2 j Maxime]
  · Sélection finale 50 familles                [1 j]
  · Analytics + dashboard admin v0              [3 j Tech]
  · Charte famille apprenante (cf. §15 audit)  [2 j Maxime]

S+3 — LANCEMENT BETA
  · Envoi codes aux 5 premières familles (cohorte 1)
  · Suivi serré J+1, J+3, J+7
  · Itération sur retours
  · Cohorte 2 (10 familles) à S+5
  · Cohorte 3 (35 familles) à S+8
```

### 8.3 Décision Go/No-Go recommandée

**🟡 Go partiel** sous **3 conditions bloquantes** :

1. **Tech** : déploiement complet workers + D1 + secrets + 50 codes + smoke tests (S0, ~1 jour)
2. **Conformité** : mentions légales + CGU + charte beta-tester + banner cookies (S+1, ~6 jours)
3. **Opérationnel** : runbook onboarding + 4 templates email (S+1, ~2 jours)

**Lancement avec une cohorte 1 de 5 familles à S+3** plutôt que les 50 d'un coup, pour valider l'opérationnel avant scaling.

**Risque résiduel principal** : saturation support Maxime. Mitigation : Marcel en première ligne, dashboard admin pour suivre.

### 8.4 Critères de succès à 90 jours

Pour décider de poursuivre beta vers commercial Premium / TPE en S2 :

| KPI | Seuil minimum | Cible |
|---|---|---|
| Familles activées (au moins 1 question Marcel) | 30 / 50 | 45 / 50 |
| Modules NextGen complétés | 1,5 / membre moyenne | 3 / membre |
| Visio Maxime tenues | 30+ | 50+ |
| NPS | > 20 | > 40 |
| Témoignages convertibles en cas d'usage public | 5+ | 10+ |
| Bugs critiques signalés | < 5 | 0-2 |
| Famille passant en payant fin de beta | > 20% | > 50% |

Si critères atteints à 90 j → ouverture beta cohorte 4 (50 familles supplémentaires) ou bascule commerciale.

---

*Document opérationnel — révisé hebdomadairement durant la beta.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
