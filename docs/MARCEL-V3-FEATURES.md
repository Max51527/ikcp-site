# Marcel v3 — Améliorations livrées (Phase A + B + APIs gratuites)

## Frontend (chatbot-widget.js v=16)

### Phase A — Quick wins

| # | Feature | Status |
|---|---|---|
| **A1** | **Persistance conversation** | ✅ Sauvegarde dans `localStorage` (clé `ikcp_marcel_conv_v1`), reprise auto si dernière visite < 7 jours. Banner "↩️ Conversation précédente reprise · Nouvelle discussion". |
| **A2** | **Envoyer la conversation à Maxime** | ✅ Bouton ✉️ dans le header. Ouvre le client mail du visiteur (mailto) avec sujet pré-rempli + transcript complet + profil + envoie aussi un POST au webhook `ikcp-prospect` pour créer la fiche prospect côté Notion. |
| **A3** | **Schémas inline** | ✅ Le SVG du schéma associé est désormais **injecté directement** dans la réponse Marcel (vs juste un lien à cliquer). Click pour zoomer. Plus immersif, plus pédagogue. |
| **A4** | **Mini-quiz profil patrimonial** | ✅ Fonction `window._ikcpStartQuiz()` qui pose 5 questions visuelles (situation familiale, âge, statut pro, patrimoine, enjeu principal). Profil stocké dans `localStorage` + envoyé à Marcel pour réponse personnalisée. |
| **A5** | **Mode hors-ligne (FAQ pré-chargées)** | ✅ 4 questions ultra-fréquentes (donation, IFI, barème IR, AV avant 70 ans) répondues **instantanément sans appel API** quand détectées. Badge "⚡ Réponse instantanée". |

### Phase B — Moyennes

| # | Feature | Status |
|---|---|---|
| **B1** | **Voice output (TTS)** | ✅ Bouton 🔊 dans le header active la lecture vocale automatique des réponses Marcel. Web Speech API native (gratuit, navigateur). Voix adaptée à la langue choisie (fr/en/de). |
| **B2** | **Multilingue FR/EN/DE** | ✅ Toggle `FR EN DE` dans le header. Persisté dans `localStorage`. Adapte les placeholders, labels, voix TTS. *(Note : Marcel répond toujours dans la langue d'envoi du visiteur — le SYSTEM_PROMPT côté Worker gère la détection)*. |
| **B3** | **Mini-widget calculateur** | ⚠️ Déjà couvert par le **tool calling** côté Worker (`calc_impot_revenu`, `calc_droits_succession`). Marcel renvoie les chiffres exacts inline via le parser Markdown. |
| **B4** | **Export PDF récap** | ✅ Bouton 📥 export existant. Génère un PDF stylé avec toute la conversation + profil mémorisé + CTA Maxime + disclaimer MIF II. |
| **B5** | **Compare-vous aux autres** | ✅ Marcel affiche automatiquement une statistique anonyme pertinente sur les sujets sensibles (donation/IFI/PER/conjoint). Ex: *"Sur 100 visiteurs, 73 se posent la question de la transmission avant 50 ans."* |

---

## Worker `ikcp-api` (workers/ikcp-api/worker.js)

Nouveau Worker gateway pour les **intégrations API gratuites**.

### Endpoints

| Méthode | Path | Action | Coût |
|---|---|---|---|
| GET | `/v1/health` | Status + endpoints disponibles + état config | 0 |
| POST | `/v1/notion` | Crée une fiche prospect dans Notion | 0 (free tier Notion) |
| POST | `/v1/email` | Envoie un email via Resend | 0 (3000/mois free) |
| GET | `/v1/legifrance?q=...` | Recherche article CGI/Code civil | 0 (api.piste.gouv.fr) |
| GET | `/v1/insee?commune=...` | Données démographiques commune | 0 (api.insee.fr) |

### Variables / secrets à configurer

Dans Cloudflare Dashboard → Worker `ikcp-api` → Settings → Variables and Secrets :

| Type | Nom | Valeur | Où l'obtenir |
|---|---|---|---|
| Secret | `NOTION_TOKEN` | `secret_xxx...` | https://www.notion.so/my-integrations → New integration |
| Variable | `NOTION_DB_ID` | `abc123...` | URL de votre database Notion |
| Secret | `RESEND_API_KEY` | `re_xxx...` | https://resend.com/api-keys |
| Variable | `RESEND_FROM` | `Marcel <marcel@ikcp.eu>` | Domaine vérifié dans Resend |
| Variable | `RESEND_TO` | `maxime@ikcp.fr` | — |
| Secret | `LEGIFRANCE_TOKEN` | `eyJxxx...` | https://piste.gouv.fr (gratuit, optionnel) |
| Secret | `INSEE_KEY` | `xxx-xxx` | https://api.insee.fr (gratuit) |

### Déploiement

**Option 1 — wrangler (CLI)** :
```bash
cd workers/ikcp-api
npx wrangler login
npx wrangler deploy
```

**Option 2 — Dashboard** :
1. Cloudflare Dashboard → Workers & Pages → Create Worker
2. Nom : `ikcp-api`
3. Quick Edit → coller le contenu de `worker.js`
4. Deploy
5. Settings → Variables → ajouter les secrets et variables

### Domaine custom

Pour exposer en `https://api.ikcp.eu` :
1. DNS → CNAME `api` → `ikcp-api.maxime-ead.workers.dev` (proxy Cloudflare ON)
2. Worker → Domains and Routes → Add → `api.ikcp.eu`

Sans domaine custom, l'URL par défaut est :
```
https://ikcp-api.maxime-ead.workers.dev
```

---

## Tests post-déploiement

### Test health
```bash
curl https://ikcp-api.maxime-ead.workers.dev/v1/health
```

Attendu :
```json
{
  "success": true,
  "data": {
    "service": "ikcp-api",
    "version": "1.0.0",
    "endpoints": [...],
    "configured": {
      "notion": false,
      "resend": false,
      "legifrance": false,
      "insee": false
    }
  }
}
```
Une fois les secrets configurés, les `false` passeront en `true`.

### Test Notion (après config)
```bash
curl -X POST https://ikcp-api.maxime-ead.workers.dev/v1/notion \
  -H "Origin: https://ikcp.eu" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {"first_name": "Test", "email": "test@example.com"},
    "source": "Marcel chat",
    "leadScore": 75,
    "page": "https://ikcp.eu",
    "message": "Conversation test"
  }'
```

### Test Resend (après config)
```bash
curl -X POST https://ikcp-api.maxime-ead.workers.dev/v1/email \
  -H "Origin: https://ikcp.eu" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Marcel → Maxime",
    "text": "Conversation de test"
  }'
```

---

## Architecture finale

```
Visiteur ikcp.eu
    │
    ├─→ chatbot-widget.js v=16  ───────────────────┐
    │   (A1-A5, B1-B5, persistance, FAQ offline)   │
    │                                              │
    ├─→ POST chat                                  │
    │   │                                          │
    │   ▼                                          │
    │   Worker ikcp-chat                           │
    │   (Marcel SYSTEM_PROMPT + Anthropic)         │
    │                                              │
    └─→ POST send-to-maxime ───────────────────────┤
        │                                          │
        ▼                                          │
        Worker ikcp-prospect (existant)            │
        Worker ikcp-api ◄──── nouveau gateway ─────┘
        │
        ├─→ POST /v1/notion       → Notion API
        ├─→ POST /v1/email        → Resend API
        ├─→ GET  /v1/legifrance   → Légifrance API
        └─→ GET  /v1/insee        → Insee API
```

---

## Prochaines étapes recommandées

1. **Déployer `ikcp-api` Worker** (Cloudflare dashboard, copier-coller worker.js)
2. **Créer database Notion "Prospects IKCP"** avec colonnes : Name (title), Email (email), Source (select), Score (number), Page (url), Message (rich_text), Date (date)
3. **Créer compte Resend** et vérifier domaine `ikcp.eu`
4. **Configurer les secrets** dans Cloudflare
5. **Tester end-to-end** : visiteur → Marcel → bouton "envoyer à Maxime" → Notion fiche créée + email Maxime envoyé

Une fois ces 5 étapes faites, vous avez une **machine à leads qualifiés** entièrement automatisée. Coût mensuel : 0 €.
