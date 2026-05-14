# ikcp-hermes — Sub-agent Transmission Opus 4.7

Worker dédié à **Hermès**, spécialiste de la transmission patrimoniale (Pacte Dutreil, donation, succession, démembrement, OBO, apport-cession, transmission entreprise familiale).

## Pourquoi un worker dédié et pas mutualisé ?

La transmission est le **domaine le plus critique** du Family Office :
- Erreurs irréversibles (engagement Dutreil rompu = redressement 75 % de la base + intérêts).
- Multi-articles CGI (787 B, 779, 990 I, 757 B, 150-0 B ter) à croiser.
- Jurisprudence évolutive (Conseil d'État durcit régulièrement la holding animatrice).
- Scénarios chiffrés multi-générationnels.

→ **Modèle Opus 4.7** justifié (vs Sonnet 4.6 pour les agents lifestyle).

## Endpoints

### `GET /health`
```json
{
  "status": "ok",
  "service": "ikcp-hermes",
  "agent": "Hermès",
  "role": "Transmission Patrimoniale",
  "model": "claude-opus-4-7",
  "configured": { "api_key": true }
}
```

### `POST /`
**Request**
```json
{
  "question": "Patrimoine 8M€ avec société Dutreil-éligible et 3 enfants : stratégie en 3 étapes pour minimiser les droits ?",
  "context": "(optionnel) Contexte fourni par Marcel après cartographie Pappers + bilan société"
}
```

**Response**
```json
{
  "reply": "...",
  "agent": "Hermès",
  "agent_id": "hermes",
  "role": "Transmission Patrimoniale",
  "model": "claude-opus-4-7",
  "usage": { "input_tokens": ..., "output_tokens": ... },
  "delegated_by": "Marcel"
}
```

## Déploiement

```bash
cd workers/ikcp-hermes
npx wrangler secret put ANTHROPICAPIKEY   # coller sk-ant-...
npx wrangler deploy
```

URL : `https://ikcp-hermes.maxime-ead.workers.dev`

## Coût indicatif

Opus 4.7 : 15 $ in / 75 $ out par M tokens. **Avec prompt caching activé** (system marqué `cache_control: ephemeral`), -80 % sur le system prompt long dès le 2e appel sous 5 min.

Estimation : **~0,10-0,15 €** par question complexe (3-5k tokens out).

## Conformité MIF II

Hermès termine toujours par une question, jamais par une recommandation produit. Disclaimer obligatoire automatique : *"Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier."*

## Tests rapides

```bash
# Test 1 : Dutreil basique
curl -X POST https://ikcp-hermes.maxime-ead.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"question":"Conditions Pacte Dutreil 2026 ?"}'

# Test 2 : Scénario multi-dispositifs
curl -X POST https://ikcp-hermes.maxime-ead.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"question":"Combinaison Dutreil + donation-partage avec demembrement croise sur 3 enfants ?"}'

# Test 3 : Cession entreprise
curl -X POST https://ikcp-hermes.maxime-ead.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"question":"Cession entreprise 12M EUR : strategie apport-cession 150-0 B ter + reinvestissement ?"}'
```

© 2026 IKCP · Sub-agent Transmission Opus 4.7
