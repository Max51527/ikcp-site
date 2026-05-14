# Migration future — Managed Agents (platform.claude.com)

> Document prospectif. Pas d'action immédiate.
> Décision Max 2026-05-14 : on garde Cloudflare Workers tant que :
>   1) la région data EU Managed Agents n'est pas officiellement disponible,
>   2) les clauses RGPD permettant un sous-traitant non-EU ne sont pas signées par les clients (DER/LM).

---

## Pourquoi cette doc existe

Anthropic a lancé `platform.claude.com` en 2026 avec une offre de **Managed Agents** (agents IA hébergés chez Anthropic, sessions persistantes, memory natif, vaults, files API). Cette offre simplifie radicalement l'architecture (plus de wrangler, plus de workers à maintenir) mais introduit **3 risques pour IKCP** :

1. **Souveraineté FR** : pas de garantie région data EU à ce jour (à vérifier régulièrement).
2. **Lock-in** : remplacer 11 workers Cloudflare par 11 agents managés Anthropic = forte dépendance.
3. **Audit MIF II** : la chaîne d'audit (Témoin D1 Paris) doit pouvoir s'insérer dans le flux Managed Agents (webhooks).

---

## Quand migrer ?

**Critères cumulatifs** (toutes les cases doivent être cochées) :

- [ ] Anthropic propose officiellement une **région data EU** (Frankfurt ou Paris) pour Managed Agents.
- [ ] DER + LM IKCP mentionnent Anthropic comme sous-traitant avec clauses RGPD adaptées (SCC + Schrems II compliance).
- [ ] Webhook Managed Agents → `ikcp-temoin` D1 audit log fonctionne (chaîne MIF II préservée).
- [ ] Coût total Managed Agents (sessions + memory + vaults + tokens) ≤ Workers actuels (à 50 clients).
- [ ] Validation conformité juridique IKCP (Maxime + avocat AMF).

---

## Plan de migration progressif (quand les critères sont OK)

### Phase 1 — Pilote sur 1 agent non-critique (1 semaine)
- Migrer **Hélène** (Mode/Bien-être) — domaine non PII patrimonial sensible.
- Mesurer : qualité réponse, latence, coût, UX, traces audit.
- Si OK → Phase 2.

### Phase 2 — Migration des 8 agents lifestyle (2 semaines)
- Migrer le worker mutualisé `ikcp-lifestyle` (Iris, Émile, Léon, Joséphine, Hélène, Olympe, Auguste, Augustin) en 8 Managed Agents.
- Marcel garde son tool `delegate_to_specialist` mais pointe désormais vers les URLs Managed Agents.
- Validation 50 questions test par agent.

### Phase 3 — Migration des agents experts (2 semaines)
- Migrer `ikcp-codex` (Opus 4.7) en Managed Agent.
- Migrer `ikcp-hermes` (Opus 4.7) en Managed Agent.
- Validation des 5 tests qualité fiscaux (cf. AGENTS-STRATEGY.md).

### Phase 4 — Migration de Marcel (1 semaine)
- Marcel devient un Managed Agent racine avec Memory Store activé (mémoire client multi-session).
- Migration des tools fiscaux locaux (calc_*) en fonctions managées.
- Bascule frontend : POST `family-office-v4.html` pointe vers la nouvelle URL Marcel.

### Phase 5 — Décommissionnement Workers (1 jour)
- Désactivation graceful : Workers Cloudflare répondent encore 30 jours pour transition, puis suppression.
- Conservation D1 Témoin (Paris) pour archive audit MIF II 10 ans.

---

## Ce qui RESTE sur Cloudflare même après migration

- **D1 Paris ikcp_temoin_db** : audit log MIF II (souveraineté FR non négociable).
- **Worker ikcp-pappers** : cartographie SIREN (pas de raison de migrer, marche bien et utilise cache KV).
- **Cloudflare Pages** : hébergement ikcp.eu (site statique).
- **DNS et zone ikcp.eu** : Cloudflare.

→ **Architecture hybride finale** : Managed Agents pour les conversations IA, Cloudflare pour l'infrastructure + audit + données patrimoniales.

---

## Coûts à comparer (à projeter quand les tarifs Managed Agents seront publics)

| Item | Workers actuels | Managed Agents (à valider) |
|---|---|---|
| Anthropic tokens (50 clients) | ~7 €/mois | ~ idem |
| Cloudflare Workers + KV + D1 | 0 € (Free tier) | 0 € (D1 conservé) |
| Sessions persistantes | DIY KV | Inclus Managed Agents ? |
| Memory client multi-session | DIY KV/D1 | Inclus Memory Stores ? |
| Vaults (secrets) | wrangler secret (gratuit) | Probablement payant |
| Files API (RAG) | À développer | Inclus ? |
| **Total estimé** | **7 €/mois** | **à valider** |

---

## Bénéfices attendus de la migration

1. Moins de code à maintenir (suppression de 4+ workers).
2. Memory natif = continuité conversation client (ex : "comme la dernière fois...").
3. Files API natif = client uploade son avis d'imposition / RIB / bilan société.
4. Observabilité native (logs unifiés Anthropic).
5. Architecture multi-agent plus déclarative (moins de plomberie fetch).

---

## Risques résiduels même après migration

- Anthropic baisse de qualité d'un modèle → impact direct production.
- Anthropic change la tarification → risque budget.
- Anthropic discontinue une feature (ex : Memory) → migration forcée.

→ Mitigation : **garder Marcel orchestrateur capable de fallback** vers un autre modèle (Sonnet 4.6 actuel → 4.7, 5.0, etc.) sans changer la logique métier.

---

## Calendrier indicatif

| Période | Action |
|---|---|
| **Q2-Q3 2026** | Surveiller annonces Anthropic région EU |
| **Q4 2026** | Si EU dispo : pilote Hélène |
| **Q1 2027** | Si pilote OK : migration phases 2-3 |
| **Q2 2027** | Migration Marcel + décommissionnement |

---

© 2026 IKCP · Document prospectif · à réviser tous les trimestres
