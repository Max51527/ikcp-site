# Marcel ↔ ikcp-mcp — Plan d'intégration

> **Objectif** : brancher Marcel (Cloudflare Worker `ikcp-chat`) au serveur MCP fiscal `ikcp-mcp` (Python/FastMCP, Scaleway fr-par) pour que TOUS les calculs fiscaux soient déterministes, RGPD-safe et sourcés.
>
> **Sprint** : 2 semaines · **Statut** : à démarrer · **Auteur** : Maxime + Claude · **Créé** : 2026-05-07

---

## 1. Contexte

### Ce qui existe aujourd'hui

| Brique | État | Tools fiscaux |
|---|---|---|
| `ikcp-chat` (Cloudflare Worker JS) | ✅ Production | 2 tools inline JS : `calc_impot_revenu`, `calc_droits_succession` |
| `ikcp-mcp` (Python FastMCP, Scaleway) | ✅ Code complet, prêt à déployer | 7 tools : IR, IFI, PV immo, succession, Dutreil, 150-0 B ter, PER |

### Le problème

- Marcel ne peut chiffrer **que** l'IR et la succession ligne directe ; pour IFI/PV/Dutreil/150-0 B ter/PER, il calcule de mémoire (LLM) → risque MIF II.
- Double source de vérité fiscale : barèmes hardcodés dans le worker JS **ET** dans `ikcp-mcp/src/tools/`. Risque de divergence à chaque LF.
- `ikcp-mcp` n'est appelé par personne aujourd'hui — actif construit, pas branché.

### La cible

Marcel utilise `ikcp-mcp` comme **source unique** des calculs fiscaux. 7 tools disponibles. Les calculs JS inline restent comme fallback de continuité.

---

## 2. Architecture choisie

```
┌──────────────────────┐   POST /api/v1/calc/*     ┌──────────────────────┐
│ Cloudflare Worker    │   Bearer service token    │  ikcp-mcp HTTP API   │
│ ikcp-chat (JS)       │  ───────────────────────▶ │  Scaleway fr-par     │
│ workers/ikcp-marcel/ │                            │  (FastMCP + Pydantic)│
│   worker.js          │  ◀─────────────────────── │                      │
│                      │   JSON résultats sourcés  │  anti-PII checked    │
└──────────────────────┘                            └──────────────────────┘
        ▲                                                    │
        │ tool_use (Claude API)                              │ logs hash+status
        │                                                    │ (jamais de payload)
        ▼                                                    ▼
   Claude Sonnet 4.6                                    Scaleway logs
```

**Non choix** : OAuth 2.1 + DCR (overkill pour un appel server-to-server interne). On expose un endpoint HTTP **bearer-only** dédié au worker, **séparé** de l'endpoint MCP standard que Claude Desktop utilisera plus tard.

---

## 3. Inventaire des changements

### Côté `ikcp-mcp` (Python)

- Ajouter un module `src/http_api.py` qui expose `/api/v1/calc/<tool>` (POST JSON).
- Mêmes 7 fonctions que les tools MCP, mêmes validators Pydantic, même `assert_no_pii`.
- Auth : `Authorization: Bearer <SERVICE_TOKEN>` lu depuis env `IKCP_SERVICE_TOKEN`.
- Pas de DCR, pas d'IP allowlist (le bearer suffit pour un appel server-to-server).
- Réponses 200/400/401/422/500 standardisées.
- Tests pytest dédiés (`tests/test_http_api.py`).

### Côté `ikcp-chat` (Worker JS)

- Ajouter 5 nouveaux tool definitions dans `TOOLS_FISCAL` :
  - `calc_ifi_2026`
  - `calc_pv_immo`
  - `calc_pacte_dutreil`
  - `calc_150_0_b_ter`
  - `simulate_per_versement`
- Réimplémenter `executeTool` : chaque tool fait un `fetch` HTTP vers `IKCP_MCP_URL/api/v1/calc/<tool>` avec bearer token (env var `IKCP_MCP_TOKEN`).
- Garder les 2 tools JS existants (`calc_impot_revenu`, `calc_droits_succession`) en mode **fallback** : tente HTTP d'abord, retombe sur calcul local si réseau KO.
- Cache KV (`MCP_CACHE` namespace, TTL 1h) sur les résultats — les barèmes ne bougent pas dans la journée.

### Côté infrastructure

- Variables Cloudflare Worker à créer : `IKCP_MCP_URL`, `IKCP_MCP_TOKEN` (secret).
- Variable Scaleway à créer : `IKCP_SERVICE_TOKEN` (secret, généré via `openssl rand -hex 32`).
- Domaine custom Scaleway : `mcp.ikcp.eu` (CNAME → conteneur Scaleway).
- DPA Scaleway signé (cf [docs/DPA-CHECKLIST.md](../../ikcp-mcp/docs/DPA-CHECKLIST.md) du repo `ikcp-mcp`).

---

## 4. Sprint 2 semaines

### Semaine 1 — Backend & déploiement

| Jour | Tâche | Livrable | Vérif |
|---|---|---|---|
| **J1** | `ikcp-mcp` : créer `src/http_api.py` avec endpoint `/api/v1/calc/calc_ir_2026` | code + test | `pytest tests/test_http_api.py::test_ir_2026 -v` |
| **J2** | `ikcp-mcp` : ajouter les 6 autres tools en HTTP, factoriser l'auth bearer, finaliser tests | 7 endpoints HTTP testés | `pytest` 100% |
| **J3** | `ikcp-mcp` : déployer Scaleway fr-par, configurer `mcp.ikcp.eu`, vérifier TLS | URL prod | `curl https://mcp.ikcp.eu/api/v1/health` |
| **J4** | `ikcp-chat` : créer secret `IKCP_MCP_TOKEN`, ajouter 5 tool definitions, brancher `executeTool` HTTP-first | Worker compile | `npx wrangler deploy --dry-run` |
| **J5** | `ikcp-chat` : ajouter cache KV `MCP_CACHE`, tests d'intégration manuels via dashboard `/admin` | E2E vert | 3 conversations test passent |

### Semaine 2 — Migration & robustesse

| Jour | Tâche | Livrable | Vérif |
|---|---|---|---|
| **J6** | Migrer les 2 tools existants (IR, succession) vers HTTP-first avec fallback JS | Single source of truth | Comparaison 20 cas : delta < 1 € |
| **J7** | Ajouter rate limit côté worker (KV compteurs, 30 req/min/IP sur les tools fiscaux) | Anti-abuse | Test charge `ab -n 100` → 429 attendus |
| **J8** | Monitoring : alerting si `mcp.ikcp.eu` répond 5xx > 1% sur 5 min (cron worker) | Alerte mail Resend | Simulation panne : alerte reçue |
| **J9** | Documentation : update [MARCEL-V3-FEATURES.md](MARCEL-V3-FEATURES.md), inventaire des 7 tools dans le system prompt | Marcel cite les bons outils | Conversation test |
| **J10** | Rollback drill : commit de bascule, vérification que `wrangler rollback` restaure l'état pré-intégration | Plan testé | Rollback < 2 min |

---

## 5. Checklist conformité

### MIF II / AMF

- [ ] Chaque réponse Marcel contenant un chiffre fiscal cite `art. XXX CGI` ou source législative
- [ ] Le tool `executeTool` log l'appel HTTP (hash + status) dans `MARCEL_LOGS` pour audit
- [ ] Les barèmes utilisés sont datés (LF 2026 → barèmes 2026 explicitement)
- [ ] Le calcul reste déterministe (Pydantic + barème en code, pas LLM)

### RGPD

- [ ] Aucun nom/email/IBAN ne transite vers `ikcp-mcp` (assert_no_pii côté serveur)
- [ ] Logs Cloudflare Worker : seuls `tool_name`, `status`, `latency_ms` enregistrés (pas les inputs)
- [ ] DPA Scaleway signé avant la mise en production
- [ ] Bearer token rotaté tous les trimestres

### AI Act

- [ ] Registre IA : entrée pour Marcel + 7 tools fiscaux
- [ ] Documentation : version du barème, date de calcul, traçabilité de la source
- [ ] Supervision humaine : tableau de bord `/admin` consulté hebdo (intégrer dans routine Maxime)

### Sécurité

- [ ] Bearer token Cloudflare ↔ Scaleway 32+ chars, généré crypto random
- [ ] HTTPS-only (TLS 1.3 minimum)
- [ ] CORS strict côté `ikcp-mcp` HTTP API : autoriser uniquement les ranges Cloudflare Workers
- [ ] Rate limit global et par IP sur les endpoints HTTP

---

## 6. Décisions à valider avant J1

| # | Décision | Options | Reco |
|---|---|---|---|
| 1 | Domaine `ikcp-mcp` | `mcp.ikcp.eu` / `api.ikcp.eu/mcp` | **mcp.ikcp.eu** (séparation claire MCP vs API gateway future) |
| 2 | Hébergement | Scaleway fr-par confirmé / OVH alt | **Scaleway** (conforme registre `ikcp-mcp/scaleway.toml`) |
| 3 | Stratégie cache | KV TTL 1h / pas de cache | **KV TTL 1h** (économie + résilience aux 5xx) |
| 4 | Fallback JS | Garder en cas de panne MCP / supprimer | **Garder** (continuité de service Marcel) |
| 5 | Tool naming | `calc_ifi_2026` versionné / `calc_ifi` stable | **Versionné par millésime** (cohérence avec doctrine "millésime explicite") |

---

## 7. Risques & mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Latence Scaleway → Cloudflare > 500 ms | Moyen | Moyen | Cache KV + fallback JS sur les 2 tools courants |
| Panne `ikcp-mcp` | Faible | Élevé | Cron worker + alerting + fallback JS |
| Divergence barème JS vs Python | Faible | Élevé (MIF II) | Tests croisés en J6, suppression des dupliqués JS dès J10 si stable |
| Coût Anthropic explose (tool calling boucle) | Faible | Moyen | `MAX_ITER=4` déjà en place + rate limit |
| Bearer token leak | Faible | Critique | Rotation trimestrielle + scope limité + monitoring usage anormal |

---

## 8. Definition of Done

Le sprint est terminé quand :

- ✅ Les 7 tools `ikcp-mcp` répondent en < 300 ms (p95) en HTTP depuis Cloudflare
- ✅ Marcel utilise systématiquement le tool HTTP pour tout chiffre fiscal (verified via 20 conversations test)
- ✅ Cache KV hit rate > 60% sur les 7 tools
- ✅ Aucun PII dans les logs Cloudflare ni Scaleway (audit manuel)
- ✅ Rollback testé et documenté
- ✅ Registre IA Act créé et complété pour les 7 tools
- ✅ DPA Scaleway signé
- ✅ Documentation à jour ([MARCEL-V3-FEATURES.md](MARCEL-V3-FEATURES.md), README workers/ikcp-marcel)

---

## 9. Annexes — schéma type d'appel HTTP

### Requête Cloudflare → ikcp-mcp

```http
POST https://mcp.ikcp.eu/api/v1/calc/calc_ifi_2026
Authorization: Bearer <IKCP_MCP_TOKEN>
Content-Type: application/json
X-Request-ID: 8f4c3a1b-...

{
  "patrimoine_immobilier_net": 1850000,
  "residence_principale_value": 600000,
  "annee": 2026
}
```

### Réponse

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-ID: 8f4c3a1b-...

{
  "ifi_du": 4250,
  "tranche_marginale_pct": 0.7,
  "abattement_rp": 180000,
  "base_taxable": 1670000,
  "tranches_appliquees": [...],
  "sources": "art. 964 CGI · barème art. 977 CGI · LF 2026",
  "calculated_at": "2026-05-07T15:42:00Z"
}
```

### Erreur PII détecté

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "pii_detected",
  "field": "patrimoine_immobilier_net",
  "message": "Le payload contient un motif identifiant (IBAN/email/SIREN). Envoyer uniquement des paramètres numériques."
}
```

---

*Document vivant — mis à jour à chaque jalon atteint.*
*Maxime Juveneton — IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
