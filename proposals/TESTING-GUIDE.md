# Guide de test — IKCP Family Office Plateforme

> Comment tester chaque brique de la plateforme : Marcel, agents, API, ikcp-mcp, espace client, intégration logiciel-gp.
>
> **Dernière maj** : 2026-05-07 · **Niveau** : du visuel au end-to-end.

---

## Niveau 0 — Test visuel des aperçus (5 min)

**Objectif** : valider les choix de design avant de coder.

| Étape | Commande / action |
|---|---|
| Ouvrir les 3 propositions Family Office | Double-clic sur les 3 fichiers : [proposals/family-office.html](family-office.html) · [proposals/family-office-warm.html](family-office-warm.html) · [proposals/family-office-editorial.html](family-office-editorial.html) |
| Comparer côte à côte | Chrome → 3 onglets, Ctrl + ↑/↓ pour scroller en parallèle |
| Tester mobile | F12 → Toggle device toolbar → iPhone 14 Pro |
| Vérifier la montgolfière BBR | Visuelle (couleurs verticales bleu / blanc / rouge) |
| Vérifier les animations | Scroll : pulses dorés sur la constellation, fadeIn du hero |

**À valider** :
- ✅ Quel style retient ta préférence (cream IKCP / warm Claude / éditorial magazine) ?
- ✅ Les noms d'agents (Joséphine, Auguste, etc.) tiennent-ils la route ?
- ✅ La section espace client donne-t-elle envie ?

---

## Niveau 1 — Marcel en local (15 min)

**Objectif** : faire tourner Marcel sur ton poste avant de déployer.

### Pré-requis

- Node.js 18+ installé
- Compte Cloudflare avec une clé API Anthropic en secret `ANTHROPICAPIKEY`
- Cloner ou être dans `Desktop/A RANGER/UPPERCUT/ikcp-site/`

### Étapes

```powershell
cd "$env:USERPROFILE\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-marcel"
npx wrangler login              # une seule fois
npx wrangler dev                # démarre Marcel en local sur localhost:8787
```

Dans un autre terminal :

```powershell
# Health check
curl http://localhost:8787 -H "Origin: https://ikcp.eu"

# Conversation test (sans tools)
curl -X POST http://localhost:8787 `
  -H "Origin: https://ikcp.eu" `
  -H "Content-Type: application/json" `
  -d '{\"message\":\"Combien je peux donner à mon fils sans payer de droits ?\"}'

# Conversation test avec tool calling (IR + parts)
curl -X POST http://localhost:8787 `
  -H "Origin: https://ikcp.eu" `
  -H "Content-Type: application/json" `
  -d '{\"message\":\"Je gagne 120 000 €, marié, 2 enfants — quel IR 2026 ?\"}'
```

**Attendu** :
- Réponse JSON avec `reply`, `follow_ups`, `web_search_used`, `season`
- Le calcul d'IR doit citer art. 197 CGI / barème LF 2026
- Le `model` retourné doit être `claude-sonnet-4-6` (depuis l'edit récent)

### Logs en direct

```powershell
npx wrangler tail ikcp-chat       # streaming des logs Cloudflare
```

### Dashboard admin (questions anonymes 90j)

1. Configurer un secret `ADMIN_TOKEN` : `npx wrangler secret put ADMIN_TOKEN`
2. Ouvrir : `https://ikcp-chat.maxime-ead.workers.dev/admin?token=<TOKEN>`

---

## Niveau 2 — End-to-end Marcel + agent (mock) (30 min)

**Objectif** : simuler un appel Marcel → agent spécialisé sans encore brancher ikcp-mcp.

Pour l'instant, les 8 sous-agents (Auguste, Joséphine, etc.) sont **conceptuels**. Pour les tester, deux approches :

### Option A — Stub local en JS

Dans le worker `ikcp-chat`, ajouter un faux outil `agent_call` qui retourne un mock :

```js
function executeTool(name, input) {
  // ... existing tools
  if (name === 'agent_call') {
    const mockAgents = {
      'auguste': { result: 'Note Dutreil : exonération 75% sur 60% des parts. Économie estimée 1,48 M€.' },
      'leon': { result: 'Allocation actions US à 28% vs cible 22%. Drawdown -6,2%. Arbitrage proposé.' },
      'josephine': { result: 'Megève fév 2027 : Fermes de Marie (suite spa) ou Four Seasons (chef privé).' },
    };
    return mockAgents[input.agent] || { error: 'Agent inconnu' };
  }
}
```

### Option B — Test via le widget chatbot directement sur ikcp.eu

Ouvrir `https://ikcp.eu`, cliquer sur Marcel (montgolfière), poser :

- *"Combien je paie d'IR à 120 000 €, marié 2 enfants ?"* → doit appeler `calc_impot_revenu`
- *"Si je décède demain, droits de succession sur 2 M€ pour mes 3 enfants ?"* → `calc_droits_succession`
- *"Quel est le seuil IFI 2026 ?"* → réponse FAQ offline (réponse instantanée, badge ⚡)

---

## Niveau 3 — Brancher ikcp-mcp (sprint 2 semaines)

**Objectif** : la fiabilité fiscale via le serveur MCP propriétaire.

Voir le plan détaillé : [MARCEL-IKCP-MCP-INTEGRATION.md](../docs/MARCEL-IKCP-MCP-INTEGRATION.md)

**Tests à faire dans l'ordre** :

1. **Local Python** : `cd Documents\ikcp-mcp ; .venv\Scripts\activate ; pytest` (les 7 calculs doivent passer)
2. **MCP Inspector** : `npx @modelcontextprotocol/inspector python -m src.server` (interactif)
3. **Déployer Scaleway** : `docker build -t ikcp-mcp . ; scw container deploy ...`
4. **Health prod** : `curl https://mcp.ikcp.eu/api/v1/health` → 200 OK
5. **Test PII reject** : `curl ... -d '{"email":"x@y.com"}'` → 400 attendu
6. **Brancher dans Marcel** : remplacer `executeTool` par un fetch HTTP vers `mcp.ikcp.eu/api/v1/calc/<tool>` avec bearer
7. **E2E** : reposer la même question à Marcel — comparer chiffres locaux vs MCP (tolérance < 1 €)

---

## Niveau 4 — Espace client (auth magic link)

**Objectif** : tester le portail client privé.

```powershell
cd "$env:USERPROFILE\Desktop\A RANGER\UPPERCUT\ikcp-site\workers\ikcp-client"
npx wrangler dev
```

Ouvrir `http://localhost:8787` :

1. Saisir un email de test → bouton "Envoyer le lien"
2. Vérifier les logs Cloudflare → récupérer le lien magic
3. Cliquer dessus → redirection vers `/dashboard` (placeholder Phase 2 actuellement)

**Sécurité à vérifier** :
- Cookie `HttpOnly` + `Secure` + `SameSite=Strict`
- Magic link unique (single-use, brûlé après vérif)
- Rate limit 3 envois/email/heure
- Audit log dans table D1 `audit_log`

---

## Niveau 5 — Intégration logiciel-gp (cabinet local)

**Objectif** : connecter ton logiciel de gestion patrimoniale local à la plateforme IKCP.

Voir le plan détaillé : [Documents/logiciel-gp/docs/INTEGRATION-IKCP-PLATFORM.md](../../../../Documents/logiciel-gp/docs/INTEGRATION-IKCP-PLATFORM.md)

**Tests à faire** :

1. **Bearer machine-to-machine** : générer un token côté logiciel-gp, stocker dans variable d'env
2. **Appel test** : depuis logiciel-gp, `fetch('https://api.ikcp.eu/v1/calc/calc_ir_2026', {headers: {Authorization: 'Bearer ...'}})`
3. **Sync prospects** : créer un prospect dans logiciel-gp → vérifier qu'il apparaît dans Notion (DB `47283ea3...`)
4. **Embed Marcel** : iframe ou widget JS dans une vue du logiciel-gp pour appeler Marcel sur un dossier précis
5. **Pull tools** : depuis logiciel-gp, lire les calculs d'Auguste/Léon/etc. via `/v1/agents/<name>`

---

## Outils utiles

| Outil | Usage |
|---|---|
| **Wrangler tail** | `npx wrangler tail ikcp-chat` — logs streaming |
| **MCP Inspector** | `npx @modelcontextprotocol/inspector python -m src.server` — interactif |
| **Postman / Bruno** | Collections d'API à constituer pour `api.ikcp.eu/v1/*` |
| **Microsoft Clarity** | Heatmap + replay sessions sur ikcp.eu (déjà installé `wk8zwtijmf`) |
| **Cloudflare Dashboard** | Logs / metrics / KV / D1 / R2 / secrets |
| **Scaleway Console** | Logs ikcp-mcp · CPU / RAM / requests |

---

## Checklist avant publication Family Office

- [ ] Choix de la version graphique (cream / warm / editorial) verrouillé
- [ ] Téléphone correct dans toute la nav (06 67 53 79 79)
- [ ] Marcel répond correctement aux 5 questions test (donation, succession, IFI, IR, AV après 70 ans)
- [ ] Email Notion fonctionne (un envoi test crée une fiche)
- [ ] PWA fonctionne hors ligne (page chargée puis wifi off → reste utilisable)
- [ ] CSS pass W3C validator
- [ ] Lighthouse score > 90 sur toutes les métriques
- [ ] RGPD : mentions légales + politique cookies à jour pour le segment FO
- [ ] AI Act : registre IA initialisé avec entrées Marcel + 8 agents
- [ ] DPA Anthropic + Cloudflare + Scaleway signés
- [ ] Page retirée du `noindex` quand prêt à publier

---

*Maxime Juveneton — IKCP*
