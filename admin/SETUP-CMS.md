# IKCP Admin — Guide d'activation en 5 minutes

> Une seule fois. Ensuite tu édites le site depuis ikcp.eu/admin/ sans toucher au code.

---

## ÉTAPE 1 — Créer un compte Netlify gratuit (2 min)

1. Aller sur **netlify.com** → Sign up (gratuit, pas besoin de carte)
2. "Add new site" → "Deploy manually" → glisser **n'importe quel fichier** (ex: un PNG)
3. Note l'URL Netlify de ton site : `ton-site.netlify.app`

---

## ÉTAPE 2 — Activer l'authentification GitHub sur Netlify (2 min)

1. Dans le dashboard Netlify, aller dans ton site → **Site settings → Identity**
2. Cliquer **Enable Identity**
3. Aller dans **Registration → Invite only** (sécurité)
4. Aller dans **External providers → GitHub → Enable**
5. Cliquer **Invite users** → taper `maxime@ikcp.fr` → Invite

---

## ÉTAPE 3 — Mettre à jour la config CMS (30 sec)

Ouvrir `admin/config.yml` et remplacer cette ligne :

```yaml
# site_domain: votre-site.netlify.app
```

Par :

```yaml
site_domain: ton-site.netlify.app   # ← ton URL Netlify réelle
```

Commit → push → le deploy FTP se lance automatiquement.

---

## ÉTAPE 4 — Configurer les secrets FTP GitHub (1 min)

1. Aller sur **github.com/Max51527/ikcp-site → Settings → Secrets → Actions**
2. Ajouter ces 4 secrets (infos dans hPanel Hostinger → Files → FTP Accounts) :

| Secret | Valeur |
|--------|--------|
| `FTP_SERVER` | `ftp.ikcp.eu` (ou l'host affiché dans hPanel) |
| `FTP_USERNAME` | ton identifiant FTP Hostinger |
| `FTP_PASSWORD` | ton mot de passe FTP Hostinger |
| `FTP_PATH` | `/public_html/` (avec les slashes) |

---

## ÉTAPE 5 — Premier test (30 sec)

1. Aller sur **ikcp.eu/admin/**
2. Cliquer "Login with GitHub"
3. Accepter l'autorisation Netlify → GitHub
4. Tu vois l'interface CMS avec 4 collections :
   - 🏛️ Page Family Office
   - 🏠 Page d'accueil
   - ⚙️ Paramètres globaux
   - 📬 Newsletter UPPERCUT

**C'est prêt.** Modifie un texte → "Publish" → le site se met à jour automatiquement en ~30s.

---

## Comment ça marche

```
Tu modifies dans /admin/
        ↓
Decap CMS commit dans GitHub (branche main)
        ↓
GitHub Actions déclenche le déploiement FTP
        ↓
Hostinger reçoit les fichiers mis à jour (~30 secondes)
        ↓
ikcp.eu affiche le nouveau contenu
```

---

## Ce que tu peux modifier sans code

✅ Tous les textes des pages Family Office et Accueil  
✅ Les FAQ (ajouter, modifier, supprimer des questions)  
✅ Les titres, sous-titres, accroche hero  
✅ Les CTAs (textes des boutons)  
✅ Les meta SEO (title + description Google)  
✅ Les paramètres newsletter (titre, sous-titre, CTA)  
✅ Les paramètres globaux (email, slogan, baseline)

❌ Ce qui nécessite toujours du code :  
- Layout / design (couleurs, polices, espacements)  
- Nouveaux Workers / agents IA  
- Nouvelles fonctionnalités applicatives

---

*IKCP · ORIAS 23001568 · maxime@ikcp.fr*
