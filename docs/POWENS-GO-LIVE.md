# Powens — passer en LIVE (checklist Maxime)

> But : faire passer l'agrégation Powens de 🟠 (gated) à 🟢 (live).
> Webhooks : ✅ déjà configurés (USER_CREATED, ACCOUNTS_FETCHED, CONNECTION_SYNCED + email alerte).
> Reste : **2 secrets + 1 base D1**. Tout se fait **dans le navigateur** (pas de terminal obligatoire).
>
> 🔒 RÈGLE D'OR : **ne colle JAMAIS le CLIENT_SECRET dans le chat** (ni nulle part de public). Le *Database ID* D1, lui, n'est pas un secret → tu peux me le donner.

---

## A. Récupérer CLIENT_ID + CLIENT_SECRET (console Powens)

1. [console.powens.com](https://console.powens.com) → domaine **marcel-ia-sandbox**.
2. Menu gauche → **Applications**.
3. Ouvre ton application (**id 27040630**).
4. Onglet **Settings / Réglages** → tu vois :
   - **Client ID** (une suite de chiffres)
   - **Client Secret** (clique « Révéler » / « Show » ; s'il n'a jamais été affiché, « Regénérer »)
5. Copie les deux quelque part **en sécurité** (gestionnaire de mots de passe). On s'en sert à l'étape B.

## B. Poser les 2 secrets côté Cloudflare (navigateur, zéro terminal)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **ikcp-powens**.
2. **Settings** → **Variables and Secrets** (Variables et secrets).
3. **+ Add** :
   - Type = **Secret** · Name = `POWENS_CLIENT_ID` · Value = *colle ton Client ID* → **Save**
   - **+ Add** encore : Type = **Secret** · Name = `POWENS_CLIENT_SECRET` · Value = *colle ton Client Secret* → **Save**
4. (`POWENS_DOMAIN` = `marcel-ia-sandbox` est déjà réglé dans le code — rien à faire.)

## C. Créer la base D1 (navigateur)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Storage & Databases** → **D1 SQL Database** → **Create**.
2. Nom : **`ikcp-powens-db`** · Location : **Western Europe (WEUR)** si proposé.
3. Base créée → onglet **Console** (ou « Query »).
4. Ouvre le fichier `workers/ikcp-powens/schema.sql`, **copie tout son contenu**, colle-le dans la console D1 → **Run**.
   *(Ça crée les tables `powens_tokens` et `powens_events`.)*
5. Sur la page de la base, copie le **Database ID** (format `xxxxxxxx-xxxx-…`). **Ce n'est pas un secret.**

## D. Brancher la D1 au worker

**Le plus simple : donne-moi le Database ID** → je remplis le binding `POWENS_DB` dans `wrangler.toml` + je commit → le CI redéploie → c'est branché et ça le reste.

*(Alternative manuelle : Workers → ikcp-powens → Settings → Bindings → Add → D1 → variable `POWENS_DB` → base `ikcp-powens-db`. Mais via le code, c'est plus durable — ça survit aux redéploiements.)*

## E. Vérifier que c'est live

Ouvre dans le navigateur :
```
https://ikcp-powens.maxime-ead.workers.dev/health
```
Tu dois voir **`"configured": true`** (avant c'était `false`). 🟢 Powens est live.

---

### Si tu préfères le terminal (optionnel, plus rapide)
```bash
cd workers/ikcp-powens
npx wrangler secret put POWENS_CLIENT_ID        # colle la valeur quand demandé
npx wrangler secret put POWENS_CLIENT_SECRET    # idem
npx wrangler d1 create ikcp-powens-db --location weur   # note le database_id renvoyé
npx wrangler d1 execute ikcp-powens-db --remote --file=schema.sql
# puis colle le database_id dans wrangler.toml (bloc [[d1_databases]]) + redéploie
```
