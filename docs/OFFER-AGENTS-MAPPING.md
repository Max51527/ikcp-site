# Mapping offre payante × Agents IA × Voix

> Comment l'offre commerciale IKCP (Freemium / Augmenté 6 800 € / Bespoke)
> se traduit en accès produit concret : Marcel chat, agents Managed,
> intégration vocale, app mobile. Avec la démo « impressionnant » qui
> permet de tester en 90 secondes.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## 1. Vue d'ensemble — qu'est-ce qu'on vend, qu'est-ce qu'on livre

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  OFFRE PAYANTE                  EXPÉRIENCE PRODUIT                       │
│                                                                          │
│  ┌──────────┐                   ┌───────────────────────────────────┐    │
│  │ Freemium │  ◀────────────▶   │ Marcel chat 10 q/mois + 8 univers │    │
│  │ 0 €      │                   │ lifestyle freemium                │    │
│  └──────────┘                   └───────────────────────────────────┘    │
│                                                                          │
│  ┌──────────┐                   ┌───────────────────────────────────┐    │
│  │ Augmenté │  ◀────────────▶   │ Marcel chat ∞ + 4 agents Managed: │    │
│  │ 6 800€/an│                   │  • documents (OCR)                │    │
│  └──────────┘                   │  • suivi (planning trimestriel)   │    │
│                                 │  • patrimoine (analyse 360°)      │    │
│                                 │  • reporting (DER trimestriel)    │    │
│                                 │ + voix Marcel TTS/STT             │    │
│                                 │ + app mobile native iOS/Android   │    │
│                                 │ + sign électronique eIDAS         │    │
│                                 └───────────────────────────────────┘    │
│                                                                          │
│  ┌──────────┐                   ┌───────────────────────────────────┐    │
│  │ Bespoke  │  ◀────────────▶   │ Tout d'Augmenté + 3 agents       │    │
│  │ sur devis│                   │ premium:                          │    │
│  └──────────┘                   │  • fortune (HNW 10-500 M€)        │    │
│                                 │  • gouvernance (charte familiale) │    │
│                                 │  • editorial (newsletter perso)   │    │
│                                 │ + Maxime joignable direct         │    │
│                                 │ + co-construction d'agents dédiés │    │
│                                 │ + intégration partenaires (notaire,│    │
│                                 │   avocat, EC) via MCP             │    │
│                                 └───────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. Matrice détaillée par feature

| Feature | Freemium | Augmenté | Bespoke |
|---|---|---|---|
| **Marcel chat sync** | 10 q/mois | ∞ | ∞ |
| **9 calculateurs fiscaux JS** | ✓ | ✓ | ✓ |
| **25 contextes thématiques** | 8 univers | tous | tous |
| **Voix Marcel (TTS)** | ❌ | ✓ | ✓ |
| **Voix Marcel (STT — parler à Marcel)** | ❌ | ✓ | ✓ |
| **Agent `documents`** OCR + extraction | ❌ | ✓ | ✓ |
| **Agent `suivi`** planning J+90 + arbitrages | ❌ | ✓ | ✓ |
| **Agent `patrimoine`** 360° 1-10 M€ | ❌ | ✓ | ✓ |
| **Agent `reporting`** DER trimestriel | ❌ | ✓ | ✓ |
| **Agent `fortune`** HNW/UHNW 10-500 M€ | ❌ | ❌ | ✓ |
| **Agent `gouvernance`** charte familiale | ❌ | ❌ | ✓ |
| **Agent `editorial`** newsletter perso | ❌ | ❌ | ✓ |
| **App mobile native iOS/Android** | PWA | ✓ + push | ✓ + push |
| **Biométrie (Face ID/Touch ID)** | ❌ | ✓ | ✓ |
| **Lettre de mission eIDAS** | ❌ | ✓ | ✓ |
| **DPA + RGPD + AI Act registre** | ✓ | ✓ | ✓ |
| **Co-construction d'agents dédiés** | ❌ | ❌ | ✓ |
| **Intégration MCP partenaires** | ❌ | ❌ | ✓ |
| **Réponse Maxime** | mail 48h | mail 24h | direct + SLA |

## 3. Implémentation technique du gating

Le tier est attaché à l'utilisateur en D1 (table `users.tier`).
Le worker `ikcp-agents` vérifie l'entitlement avant chaque
`sessions.create()` :

```js
// Pseudo-code dans workers/ikcp-agents/worker.js
const TIER_AGENTS = {
  freemium:  [],
  augmente:  ['documents', 'suivi', 'patrimoine', 'reporting'],
  bespoke:   ['documents', 'suivi', 'patrimoine', 'reporting',
              'fortune', 'gouvernance', 'editorial'],
};

async function startTask(req, env, ctx, userId, cors) {
  const { kind } = await req.json();
  const tier = (await env.DB.prepare(
    `SELECT tier FROM users WHERE id=?`
  ).bind(userId).first())?.tier || 'freemium';

  if (!TIER_AGENTS[tier].includes(kind)) {
    return json({
      error: 'tier_not_eligible',
      tier, kind,
      upgrade_url: '/proposals/espaces-fo.html',
    }, 403, cors);
  }
  // …suite création session
}
```

Côté front, le dashboard cache/grise les boutons selon le tier
(GET `/api/me/entitlements` retourne la liste accessible).

## 4. Voix Marcel — détail technique

### Fournisseurs

| Couche | Provider | Coût | Souverain ? |
|---|---|---|---|
| TTS (Marcel parle) | VoxCPM2 OpenBMB, self-hosted Modal.run | $0.001/min | 🟢 Apache 2.0, hébergé EU possible |
| STT (Marcel écoute) | Mistral Voxtral via `api.mistral.ai` | $0.04/min | 🟢 EU FR |
| Cache TTS | Cloudflare KV (clé = sha256 texte+voix) | inclus | 🟢 EU |
| Rate limit | KV fenêtre 1h, 100 req/IP non-auth | inclus | 🟢 EU |

### 3 voix disponibles

| Voix | Cas d'usage |
|---|---|
| `default` | Marcel par défaut, neutre, posé — pour Q&A standard |
| `marcel_fr` | Marcel version conseil patrimonial — ton chaud |
| `pedagogue` | Voix pour la formation NextGen (rythme posé, pédagogique) |

### Endpoints `ikcp-voice` (voice.ikcp.eu)

| Endpoint | Méthode | Input | Output |
|---|---|---|---|
| `/tts` | POST | `{text, voice?, format?}` | `audio/wav` (ou mp3/ogg) |
| `/stt` | POST | `multipart/form-data {file}` ou `{audio_b64, language}` | `{text, language, provider}` |
| `/voices` | GET | — | Liste des voix |
| `/health` | GET | — | Ping |

### Intégration UI — Web component

Un seul tag à insérer sur n'importe quelle page :

```html
<script src="/assets/marcel-voice.js" type="module"></script>
<marcel-voice tts-url="https://voice.ikcp.eu/tts"
              stt-url="https://voice.ikcp.eu/stt"></marcel-voice>
```

API JS :
```js
const voice = document.querySelector('marcel-voice');
await voice.speak("Bonjour, je suis Marcel.");
voice.addEventListener('transcript', e => {
  console.log("L'user a dit :", e.detail.text);
  // → router vers Marcel chat puis voice.speak(reply)
});
```

## 5. La démo « impressionnant » — `/proposals/demo-agents-voix.html`

Une page autonome où **n'importe qui peut tester en 90 secondes**
sans avoir de code beta :

- 4 cartes (1 par agent visuel : reporting / patrimoine / fortune / gouvernance)
- Bouton "Lancer la démo" → POST `/api/agents/demo` (sandbox)
- Stream SSE temps réel : on voit Marcel réfléchir, appeler les tools,
  composer les visuels
- À la fin → bouton "🔊 Faire parler Marcel" qui synthétise un
  résumé vocal et le lit dans le browser
- **Rate limit** : 1 démo / IP / jour (sinon prospects scrappent)
- Composant `<marcel-voice>` au-dessus pour parler/écouter en continu

### Flow de démo pour un prospect

```
Prospect arrive sur la page → 1 minute lecture de l'intro
  → Choisit "Patrimoine 360° famille Durand"
  → Tap "▶ Lancer la démo (≈ 120s)"
  → Console live affiche :
       [Marcel] Analyse en cours…
       [tool] patrimoine.fetch_snapshot(…)
       [Marcel réfléchit…]
       [tool] python: génération donut allocation
       [Marcel] J'ai identifié 3 points d'attention…
       [grader] satisfied — itération 0
       ▸ Démo terminée. Cliquez pour entendre Marcel résumer.
  → Tap "🔊 Faire parler Marcel"
  → Audio joue : "Bonjour, j'ai analysé le patrimoine de la famille
     Durand. Cinq visuels ont été produits : un donut d'allocation…"
  → Prospect impressed → CTA "Demander un code beta"
```

### Anti-abus

- 1 démo / IP / jour (KV `AGENT_KV`)
- 100 req voix / IP / heure
- Optionnel : `DEMO_BYPASS_TOKEN` (secret) pour Maxime
- Toutes les démos sont avec données fictives — aucun PII réel
- Les sessions démo sont taggées `metadata.source = "demo"` en D1
  → exclusion automatique des stats payantes

## 6. Architecture de bout en bout — voix dans le parcours client

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT iOS — app native (Capacitor)                                 │
│                                                                     │
│ • Push notification iOS reçue :                                     │
│   "📊 Votre DER Q3 est prêt"                                        │
│                                                                     │
│ • Tap → ouvre WebView client.ikcp.eu/dashboard?task=sesn_xxx        │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Dashboard family-office                                             │
│                                                                     │
│ • Affiche preview du livrable (charts + intro narrative)            │
│ • <marcel-voice> en haut de page                                    │
│ • Auto-play : Marcel résume vocalement les 3 points clés (10s)      │
│ • Bouton micro : "Posez-moi une question sur ce DER" → STT → chat   │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend Cloudflare (EU)                                             │
│                                                                     │
│ • ikcp-client (auth, magic-link, tier)                              │
│ • ikcp-agents (orchestrateur Managed Agents)                        │
│ • ikcp-marcel (chat sync Sonnet 4.6 + 9 tools fiscaux JS)           │
│ • ikcp-voice (TTS VoxCPM2 + STT Voxtral)                            │
└────────────────────┬────────────────────────────────────────────────┘
                     │ POST /tts, POST /stt, POST /v1/sessions, …
                     ▼
            🇺🇸 Anthropic (Claude Fable 5 + Opus 4.8 + Managed Agents)
            🇫🇷 Mistral La Plateforme (Voxtral STT)
            🇪🇺 Modal.run (VoxCPM2 hosting)
```

## 7. Tests d'acceptation pour validation interne

Avant d'ouvrir la démo au public, valider ces 7 tests :

- [ ] **Démo reporting** : 90s, .docx généré, 3 charts présents, résumé vocal lisible
- [ ] **Démo patrimoine** : 120s, PDF 5 pages, 5 visuels (donut + treemap + pyramide + heatmap + Mermaid)
- [ ] **Démo fortune** : 180s, mémo + tableaux + waterfall, schémas Mermaid valides
- [ ] **Démo gouvernance** : 120s, charte 8-12 pages, génogramme rendu correctement
- [ ] **Voix STT** : enregistrement micro 5s → transcription FR correcte
- [ ] **Voix TTS** : 600 chars → audio sous 8s, accent FR neutre
- [ ] **Rate limit démo** : 2ᵉ démo depuis même IP même jour → 429

## 8. Coût marginal d'une démo

| Item | Coût |
|---|---|
| Session Managed Agent (Opus 4.8, ~120s) | ~$0.25 |
| TTS résumé 600 chars (~30s audio) | ~$0.0005 |
| STT 1 question 10s | ~$0.007 |
| **Total démo complète** | **~$0.26** |

Avec rate limit 1/IP/jour, plafond mensuel ~30 démos/IP unique × 100
visites uniques jour = 3 000 démos/mois max = **~$780/mois max**.

Plancher de conversion attendu : 5 % des démos → demande code beta.
À 100 visites/jour, ça fait 150 demandes/mois → cohorte beta 50 familles
remplie en 1 mois.

## 9. Prochaines étapes

### Avant ouverture publique (Phase 1)
- [ ] Déployer `ikcp-voice` worker + provisionner `MISTRAL_API_KEY`
- [ ] Lancer un endpoint Modal.run pour VoxCPM2 + récupérer l'URL
- [ ] Provisionner KV `VOICE_CACHE` + `VOICE_RATE` + `AGENT_KV`
- [ ] Créer les 4 agents Managed via `ant` CLI
- [ ] Smoke test 4 démos sur `demo-agents-voix.html` en preview Pages
- [ ] DPA Anthropic Enterprise + ZDR signé

### Phase 2 (montée en charge)
- [ ] Ajouter quota tier en D1 (`users.tier`, `users.quota_remaining`)
- [ ] Brancher Stripe checkout → bump tier auto sur paiement
- [ ] Intégrer marcel-voice dans dashboard client (auto-play résumé)
- [ ] Ajouter biométrie Face ID pour ré-auth app mobile
- [ ] Capacitor publication App Store + Play Store

---

*Mapping Offre × Agents × Voix v1.0 · 2026-06 · © IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
