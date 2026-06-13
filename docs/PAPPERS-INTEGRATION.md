# Pappers — Intégration au Family Office IKCP

> **Pappers comme entry point** : un client donne un SIREN → l'écosystème récupère automatiquement la structure de son entreprise/holding et alimente Théodore (Architecte 360°) pour bâtir la cartographie patrimoniale.
>
> **Statut** : Worker prêt, page de test prête, intégration Marcel à coder.
>
> **Créé** : 2026-05-07

---

## 1. Pourquoi Pappers

Le Family Office IKCP cible des familles avec **plusieurs entreprises et biens immobiliers**. Saisir manuellement chaque société (forme juridique, capital, dirigeants, bénéficiaires effectifs, comptes annuels) prend des heures et est sujet à erreur.

**Avec Pappers** : on saisit un SIREN, on récupère :
- Identité (forme juridique, capital, NAF, siège)
- **Dirigeants & représentants** (qualités, dates de prise de poste)
- **Bénéficiaires effectifs** (% parts, % votes)
- **Finances** (CA, résultat, effectif sur 4 ans)
- Actes & statuts récents

→ Théodore peut bâtir la cartographie en **secondes** au lieu d'heures.

---

## 2. Architecture

```
┌──────────────────────┐
│  Visiteur ikcp.eu    │
│  Page recueil ou     │
│  Espace client       │
└──────────┬───────────┘
           │ SIREN
           ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Worker ikcp-chat    │ ─tool─► │  Worker ikcp-pappers │
│  (Marcel + agents)   │         │  + KV cache 1h       │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                 │
           │                                 ▼
           │                        ┌──────────────────┐
           │                        │  api.pappers.fr  │
           │                        │  (token côté svr)│
           │                        └──────────────────┘
           ▼
┌──────────────────────┐
│  Théodore reçoit     │
│  les données et bâtit│
│  la cartographie 360°│
└──────────────────────┘
```

**Sécurité** : la clé Pappers reste dans `ikcp-pappers` (Cloudflare secret), jamais exposée au navigateur en production.

---

## 3. Installation rapide (5 min)

### Étape 1 — Tester sans rien déployer (mode direct)

1. Inscription gratuite Pappers : <https://www.pappers.fr/api/inscription> (100 req/mois suffit)
2. Ouvrir [`proposals/test-pappers.html`](../proposals/test-pappers.html) dans le navigateur (double-clic ou file://)
3. Mode "🔓 Direct" coché par défaut
4. Coller votre clé Pappers
5. Saisir un SIREN ou un nom (`947972436`, `Hermès International`…)
6. → Cartographie complète instantanée

⚠️ Mode direct = clé visible côté navigateur. Pour test uniquement.

### Étape 2 — Déployer le Worker (production)

```powershell
cd "$env:USERPROFILE\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-pappers"
npx wrangler login                           # une fois
npx wrangler kv namespace create PAPPERS_CACHE
# → copier l'ID retourné dans wrangler.toml
npx wrangler secret put PAPPERS_API_KEY      # coller la clé Pappers
npx wrangler deploy
```

Tester :
```powershell
curl https://ikcp-pappers.<sous-domaine>.workers.dev/health
curl "https://ikcp-pappers.<sous-domaine>.workers.dev/entreprise/947972436"
```

### Étape 3 — Tester via Worker dans la page

1. Ouvrir `test-pappers.html`
2. Mode "🛡️ Via Worker (prod)"
3. Coller l'URL du Worker
4. Lancer une recherche → la clé reste côté serveur

---

## 4. Endpoints Worker

| Méthode | Path | Description | Cache |
|---|---|---|---|
| `GET` | `/health` | Status + bindings | non |
| `GET` | `/search?q=<query>` | Recherche par nom (10 résultats) | 1h |
| `GET` | `/entreprise/:siren` | Fiche complète | 1h |
| `GET` | `/entreprise/:siren/short` | Fiche résumée (pour Marcel) | 1h |

Header `X-IKCP-Cache: HIT|MISS` indique l'état du cache.

---

## 5. Brancher Marcel sur Pappers (à faire)

### 5.1 Tool definition

À ajouter dans [`workers/ikcp-marcel/worker.js`](../workers/ikcp-marcel/worker.js), dans `TOOLS_FISCAL` (renommer en `TOOLS` ou créer un nouveau registre):

```js
const TOOL_PAPPERS_LOOKUP = {
  name: 'pappers_lookup',
  description:
    "Récupère la fiche d'une entreprise française à partir de son SIREN (9 chiffres) " +
    "ou de son nom. Utiliser dès que le visiteur mentionne une société (sa propre entreprise, " +
    "une holding, une cible d'acquisition, un partenaire). Retourne forme juridique, capital, " +
    "dirigeants, bénéficiaires effectifs, finances. Ne JAMAIS communiquer le SIREN aux " +
    "calculateurs fiscaux (qui sont anti-PII).",
  input_schema: {
    type: 'object',
    properties: {
      siren: { type: 'string', description: 'SIREN à 9 chiffres (ex: "947972436")', pattern: '^\\d{9}$' },
      query: { type: 'string', description: "Nom d'entreprise (ex: 'IKIGAI Conseil Patrimonial')" },
    },
  },
};
```

Et `executeTool` :

```js
if (name === 'pappers_lookup') {
  const url = input.siren
    ? `${env.IKCP_PAPPERS_URL}/entreprise/${input.siren}/short`
    : `${env.IKCP_PAPPERS_URL}/search?q=${encodeURIComponent(input.query || '')}`;
  const res = await fetch(url);
  if (!res.ok) return { error: `Pappers ${res.status}` };
  return await res.json();
}
```

Variable d'env Worker : `IKCP_PAPPERS_URL=https://ikcp-pappers.<sous-domaine>.workers.dev`

### 5.2 System prompt — extension

Ajouter dans le system prompt de Marcel :

```
PAPPERS — UTILISATION
Tu as accès au tool `pappers_lookup` pour récupérer la fiche d'une entreprise française.
Utilise-le SYSTÉMATIQUEMENT dès que le visiteur mentionne :
- Sa propre entreprise / holding / SCI
- Une société cible (acquisition, cession, transmission)
- Un partenaire ou un fournisseur
Demande uniquement le SIREN (ou nom). Ne JAMAIS demander de données déjà publiques (capital, dirigeants…).
```

### 5.3 Routing vers Théodore

Quand `pappers_lookup` retourne une fiche → router vers Théodore (l'agent Architecte 360°) qui bâtit la cartographie. Pour l'instant : Marcel résume directement la fiche dans sa réponse.

Phase 2 : Théodore comme agent Claude séparé qui prend la fiche Pappers + d'autres sources et produit le tableau de bord.

---

## 6. Conformité

| Aspect | Statut |
|---|---|
| **RGPD** — données publiques (SIREN, dirigeants au RCS) | ✅ Pas de PII sensible |
| **Cache 1h** — minimise les appels Pappers, économise le quota | ✅ |
| **CORS strict** — `ikcp.eu` + `localhost` + `file://` | ✅ |
| **Clé serveur uniquement** (mode worker) | ✅ |
| **Logs sans payload** — seuls SIREN et `q` (publics) loggés | ✅ |

⚠️ **Mode direct** (test) : la clé Pappers transite par le navigateur. À ne JAMAIS utiliser en production.

---

## 7. Limites & quota

| Plan Pappers | Coût | Quota |
|---|---|---|
| Free | 0 € | 100 req/mois |
| Standard | 99 €/mois | 1 500 req/mois |
| Pro | 299 €/mois | 5 000 req/mois |
| Entreprise | sur devis | illimité |

Avec le **cache 1h**, une lookup d'IKCP par 100 visiteurs en 1 heure = **1 seule requête Pappers**. Le free tier suffit largement pour la phase de test.

---

## 8. Prochaines étapes

- [ ] Déployer `ikcp-pappers` Worker (Étape 2 ci-dessus)
- [ ] Tester via [test-pappers.html](../proposals/test-pappers.html) en mode direct (immédiat)
- [ ] Ajouter le tool `pappers_lookup` dans `ikcp-chat` Worker (15 min)
- [ ] Étendre le system prompt Marcel pour usage automatique (5 min)
- [ ] Ajouter une étape "Pappers" dans le recueil patrimonial PWA (préfill auto patrimoine pro)
- [ ] Phase 2 : agent Théodore dédié qui consomme Pappers + DVF + Notion → cartographie 360°

---

## 9. Annexe — exemple de payload Pappers (résumé)

```json
{
  "siren": "947972436",
  "nom": "IKIGAI CONSEIL PATRIMONIAL",
  "forme_juridique": "Société par actions simplifiée à associé unique",
  "capital": 1000,
  "date_creation": "2023-04-21",
  "siege": {
    "adresse_ligne_1": "...",
    "code_postal": "07100",
    "ville": "ANNONAY"
  },
  "code_naf": "70.22Z",
  "libelle_code_naf": "Conseil pour les affaires et autres conseils de gestion",
  "tranche_effectif": "0 salarié",
  "representants": [
    {
      "nom": "Maxime JUVENETON",
      "qualite": "Président"
    }
  ],
  "beneficiaires_effectifs": [
    {
      "nom": "Maxime JUVENETON",
      "pourcentage_parts": 100
    }
  ]
}
```

---

*Maxime Juveneton — IKCP*
