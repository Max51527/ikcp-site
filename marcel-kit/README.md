# Marcel — Kit de déploiement

> **Marcel** est un agent IA orchestrateur patrimonial développé par
> IKCP — IKIGAÏ Conseil Patrimonial. Ce kit contient tout le nécessaire
> pour déployer une instance Marcel sur Cloudflare Workers en moins de
> 30 minutes.
>
> **Version** : 1.0 · 09/05/2026
> **Auteur** : Maxime Juveneton · IKCP · ORIAS 23001568
> **Licence** : propriétaire IKCP (CPI L111-1, L113-9, L122-4) · diffusion limitée

---

## 0. Ce que vous obtenez

| Composant | Description |
|---|---|
| **Marcel orchestrateur** | Agent IA conversationnel patrimonial · 24/7 · 9 tools déterministes · web search natif Anthropic |
| **9 calculateurs déterministes** | IR · succession · donation · IFI · plus-value immo · démembrement · exit tax · holding compare · forfait Suisse |
| **25 contextes thématiques** | 10 expertises FR (fiscal, juridique, immo, transmission, PE, financement, philanthropie, art, marchés, admin) + 8 univers lifestyle (voyages, voitures, art, vins, montres, yachts, immo prestige, chevaux) + 7 international (droit affaires, droit sociétés, Lux, CH, UK, USA, OCDE) |
| **Conformité MIF II / DDA** | Disclaimers automatiques · pas de recommandation produit · règles strictes |
| **Prompt caching** | Réduction ~70 % du coût input via cache_control ephemeral Anthropic |
| **Web search natif** | Anthropic web_search_20250305 · 2 recherches max par requête |
| **Logs KV** | Conservation 90 jours pour analyse récurrence questions |
| **Rate limit anti-scraping** | 30 q/h par IP+UA fingerprint SHA-256 |

---

## 1. Pré-requis

| Dépendance | Lien |
|---|---|
| Compte **Cloudflare** (free tier suffit) | https://dash.cloudflare.com |
| Compte **Anthropic** + clé API | https://console.anthropic.com |
| Node.js 18+ et **npm** | https://nodejs.org |
| **wrangler CLI** | `npm install -g wrangler` |

---

## 2. Déploiement en 30 minutes

### 2.1 Cloner et installer

```bash
# Si vous avez ce kit en archive, dézipper d'abord
cd marcel-kit/

# Installer wrangler si pas déjà fait
npm install -g wrangler

# Login Cloudflare (ouvre le navigateur)
wrangler login
```

### 2.2 Personnaliser le branding

Éditer `worker.js` aux lignes marquées `[BRAND]` :
- Nom du cabinet (par défaut : `IKCP — IKIGAÏ Conseil Patrimonial`)
- Nom du CGP (par défaut : `Maxime Juveneton`)
- ORIAS, statuts, adresse
- Email de contact

Éditer `system-prompt.md` aux mêmes endroits si vous voulez modifier la
personnalité de Marcel (ton, structure pédagogique, public cible).

### 2.3 Créer le KV namespace pour les logs

```bash
wrangler kv:namespace create MARCEL_LOGS
# → noter l'id retourné
```

Coller l'`id` dans `wrangler.toml` :
```toml
[[kv_namespaces]]
binding = "MARCEL_LOGS"
id = "VOTRE_ID_ICI"
```

### 2.4 Configurer la clé Anthropic

```bash
wrangler secret put ANTHROPICAPIKEY
# coller : sk-ant-api03-...
```

### 2.5 Déployer

```bash
wrangler deploy
# → Marcel est en ligne sur https://votre-marcel.votre-username.workers.dev
```

### 2.6 Tester

```bash
curl https://votre-marcel.votre-username.workers.dev/ \
  -X POST \
  -H "Origin: https://votre-domaine.com" \
  -H "Content-Type: application/json" \
  -d '{"message":"Combien donner à mon enfant sans payer de droits ?"}'
```

Réponse attendue : objet JSON avec `reply` détaillé citant CGI 779 I,
790 G, etc.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (votre site)                                       │
│  · widget chat embarqué (chatbot-widget.js inclus)           │
└────────────────────┬─────────────────────────────────────────┘
                     │ POST { message, history?, theme? }
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  Marcel Worker (Cloudflare Workers)                          │
│                                                               │
│  · System prompt MIF II + 25 contextes thématiques           │
│  · Loop tool_use max 4 itérations                            │
│  · 9 tools déterministes (calc_*) côté Worker                │
│  · Web search natif Anthropic                                │
│  · Prompt caching ephemeral                                  │
│  · Rate limit IP+UA fingerprint                              │
│  · KV logs anonymisés 90j                                    │
│                                                               │
└────────────────────┬─────────────────────────────────────────┘
                     │ POST messages.create
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  Anthropic API (Claude Sonnet 4)                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Personnalisation avancée

### 4.1 Ajouter un tool déterministe

Dans `worker.js`, dupliquer un calculateur existant et l'ajouter à `TOOLS_FISCAL`
puis à `executeTool()` et au `Set CLIENT_TOOLS`. Exemple :

```js
{
  name: 'calc_my_tool',
  description: "Calcule X selon Y...",
  input_schema: {
    type: 'object',
    properties: { param1: { type: 'number' } },
    required: ['param1'],
  },
}

// dans executeTool() :
if (name === 'calc_my_tool') return calcMyTool(+input.param1 || 0);

// fonction :
function calcMyTool(param) {
  // logique déterministe JS — pas de LLM
  return { result: param * 2, sources: 'votre source' };
}
```

### 4.2 Ajouter un contexte thématique

Dans `THEME_CONTEXTS`, ajouter une clé :

```js
const THEME_CONTEXTS = {
  // ... contextes existants
  ma_thematique:
    "FOCUS THÉMATIQUE — MA THÉMATIQUE. Tu réponds avec : (1) ... " +
    "(2) ... (3) ... Cite tes sources.",
};
```

Le frontend peut alors envoyer `{ theme: 'ma_thematique' }` pour activer ce contexte.

### 4.3 Désactiver le rate limit

Si vous n'avez pas besoin du rate limit anti-scraping, retirer le binding
`RATE_LIMIT` du `wrangler.toml`. Le code s'en passe gracieusement.

### 4.4 Changer le modèle Anthropic

Dans `worker.js`, ligne `model: 'claude-sonnet-4-...'` — remplacer par :
- `claude-opus-4-...` (plus puissant, plus cher)
- `claude-haiku-4-5-...` (plus léger, plus rapide)

---

## 5. Conformité — à NE PAS oublier

### 5.1 MIF II / DDA si conseil financier

Marcel est conçu pour **prépare** des analyses pédagogiques, pas pour
recommander des produits. Toute recommandation produit personnalisée doit
être validée par un humain CGP / conseiller financier.

Le system prompt impose : pas de produit nommé, disclaimers en pied de
réponse, citation des sources juridiques.

### 5.2 RGPD

Si Marcel sert un public européen :
- Mentions légales obligatoires
- Politique cookies (banner CNIL si cookies tracking)
- DPA Anthropic à signer si données client envoyées
- Anthropic conserve 30 jours max et n'utilise pas pour entraînement

### 5.3 AI Act EU 2024/1689

Si système classé "haut risque" (assistance financière notamment),
tenir un **registre IA** documentant : finalité, données traitées, supervision
humaine, gestion des risques, plan de tests. Modèle dans `AI-ACT-REGISTRY.md`.

---

## 6. Coûts mensuels indicatifs

| Volume | Anthropic API | Cloudflare | Total |
|---|---|---|---|
| 100 q/mois | ~5 €/mois | gratuit | ~5 €/mois |
| 1 000 q/mois | ~50 €/mois | gratuit | ~50 €/mois |
| 10 000 q/mois | ~500 €/mois | ~10 €/mois | ~510 €/mois |
| 100 000 q/mois | ~3 000 €/mois (avec cache) | ~50 €/mois | ~3 050 €/mois |

Avec prompt caching activé (cache_control ephemeral), réduction
~70 % des coûts input à partir de la 2e requête identique.

---

## 7. FAQ

**Q. Marcel hallucine-t-il sur les chiffres ?**
R. Non. Les 9 calculateurs (IR, succession, donation, IFI, etc.) sont
des fonctions JS déterministes. Marcel les **appelle** mais ne fait
jamais le calcul lui-même.

**Q. Marcel est-il en français uniquement ?**
R. Oui par défaut. Pour multilingue, traduire le system prompt et les
THEME_CONTEXTS dans la langue cible.

**Q. Combien de temps pour ajouter un calculateur ?**
R. ~1 heure : dupliquer un existant, écrire la fonction JS, ajouter à
`executeTool()`. Test en `wrangler dev` local.

**Q. Marcel peut-il appeler d'autres APIs ?**
R. Oui via le pattern MCP server documenté dans IKCP — chaque sub-agent
externe est un Worker MCP-compatible appelé par tool_use. Voir
`workers/documents-mcp-server` (livré dans le kit complet).

**Q. Puis-je déployer Marcel ailleurs que Cloudflare ?**
R. Le code est compatible workerd / Vercel Edge / Deno Deploy — quelques
adaptations mineures (KV → Redis, secrets via env). Cloudflare Workers
recommandé pour latence + souveraineté EU.

---

## 8. Support et licence

**Licence** : ce kit est propriété d'IKCP — IKIGAÏ Conseil Patrimonial.
Code protégé par le Code de la propriété intellectuelle français
(CPI L111-1, L113-9, L122-4). Diffusion limitée aux partenaires sous
NDA.

**Support** : pour assistance technique de déploiement, formation, ou
adaptation à votre cabinet — contactez Maxime Juveneton :
- Email : `maxime@ikcp.fr`
- DPO RGPD : `dpo@ikcp.eu`

**Création FO sur-mesure** : si vous voulez non pas juste Marcel mais
un **Family Office Digital complet** à votre marque (espace client +
dashboard + sub-agents OCR/Suivi/Reporting + formation NextGen),
voir la formule **Bespoke** sur https://ikcp.eu/espaces (dès 36 k€/an
+ setup forfaitaire 120 k€).

---

## 9. Fichiers du kit

```
marcel-kit/
├── README.md              ← ce fichier
├── worker.js              ← code Marcel orchestrateur (~700 lignes)
├── wrangler.toml          ← config Cloudflare Workers
├── system-prompt.md       ← system prompt MIF II détaillé (édition simplifiée)
├── tools.md               ← documentation des 9 calculateurs déterministes
├── theme-contexts.md      ← documentation des 25 contextes thématiques
├── chatbot-widget.js      ← widget chat embarquable côté frontend (optionnel)
└── deploy.sh              ← script de déploiement automatisé
```

---

*Marcel kit v1.0 · 09/05/2026 · IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
