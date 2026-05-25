# IKCP Admin — Activation du CMS (Sveltia + GitHub direct)

> Une seule fois. Ensuite tu édites le site depuis **ikcp.eu/admin/** sans toucher au code.
> 100 % Cloudflare — pas de Netlify. Auth via une GitHub OAuth App + le worker `ikcp-cms-auth`.

---

## ÉTAPE 1 — Créer la GitHub OAuth App (2 min)

1. **github.com/settings/developers** → **OAuth Apps** → **New OAuth App**
2. Remplir :
   | Champ | Valeur |
   |---|---|
   | Application name | `IKCP CMS` |
   | Homepage URL | `https://ikcp.eu` |
   | Authorization callback URL | `https://ikcp-cms-auth.maxime-ead.workers.dev/callback` |
3. **Register application** → note le **Client ID** → **Generate a new client secret** → note le **Client Secret**

## ÉTAPE 2 — Pousser les 2 secrets sur le worker (1 min)

```bash
cd workers/ikcp-cms-auth
npx wrangler secret put GITHUB_CLIENT_ID       # colle le Client ID
npx wrangler secret put GITHUB_CLIENT_SECRET   # colle le Client Secret
```
*(Le worker `ikcp-cms-auth` se déploie automatiquement via GitHub Actions au push.)*

## ÉTAPE 3 — Test (30 sec)

1. Va sur **ikcp.eu/admin/** (ou `ikcp-eu.pages.dev/admin/` avant la bascule DNS)
2. **Login with GitHub** → autorise → tu vois les 4 collections :
   🏛️ Family Office · 🏠 Accueil · ⚙️ Global · 📬 Newsletter
3. Modifie un texte → **Publish** → commit Git → Cloudflare Pages publie (~1 min).

---

## Comment ça marche

```
Tu édites dans /admin/ (Sveltia CMS)
        ↓ commit dans GitHub (branche main)
Cloudflare Pages détecte le push → publie (~1 min)
        ↓
Le script cms-hydrate.js lit les _data/*.json et applique le contenu
        ↓
ikcp.eu affiche le nouveau texte
```

## Ce qui est éditable (data-cms câblés)

✅ **Homepage — titre du hero** (preuve câblée : `home.hero.headline_1` / `headline_em`)
🔜 À étendre : sous-titres, CTA, FAQ, prix, paramètres globaux (tagger les éléments `data-cms` page par page)

❌ Toujours du code : layout/design, Workers/agents, nouvelles fonctionnalités.

> **Principe** : chaque texte éditable = un élément HTML tagué `data-cms="prefix.chemin"` + une clé dans `_data/*.json`. Le CMS édite le JSON, `cms-hydrate.js` l'applique. On étend champ par champ selon les besoins.

---

*IKCP · ORIAS 23001568 · maxime@ikcp.fr*
