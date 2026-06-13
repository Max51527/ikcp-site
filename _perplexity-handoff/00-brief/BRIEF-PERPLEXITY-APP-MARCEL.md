# 📱 Brief développement application Marcel — pour Perplexity Pro

> À copier-coller dans la session Perplexity comme contexte initial.
> Date : 2026-05-16 · Cabinet IKCP · ORIAS 23001568

---

## Réponses aux 4 questions de cadrage

### 1. Quel type d'application voulez-vous créer ?

**Progressive Web App (PWA) installable** iOS / Android / desktop.

- **Pas d'app native** (évite App Store / Play Store, distribution privée bêta, RGPD plus simple, mises à jour instantanées)
- **Stack** : HTML/CSS/JS vanilla + Service Worker + Web App Manifest
- **Backend** : workers serverless Cloudflare existants en région Paris (souveraineté France)
- **Installation** : "Ajouter à l'écran d'accueil" iOS/Android, "Installer" sur Chrome/Edge desktop
- **Hors-ligne** : cache des dernières conversations + alertes
- **Push notifications** : alertes de veille nocturne (PWA push API)
- **URL cible** : `app.ikcp.eu` (sous-domaine de la marque IKCP)

### 2. Quel problème principal cette application doit-elle résoudre ?

**Démocratiser le Family Office** pour les patrimoines de 500 k€ à 30 M€ — segment orphelin entre CGP classique et Single Family Office (SFO à 500 k€/an).

Aujourd'hui, un dirigeant à 5 M€ de patrimoine n'a pas accès aux 5 fonctions Family Office classiques (reporting consolidé, veille proactive, coordination multi-experts, gouvernance familiale, accès deal-flow). L'application offre ces 5 fonctions par une interface unique (Marcel) avec 12 spécialistes derrière, en mode **freemium + premium**.

Promesse : *« Vous avez un Family Office. Il travaille pendant que vous dormez. »*

### 3. Quelles fonctionnalités comptent le plus pour le prototype ?

Top 7 (par ordre de priorité) :

1. **Marcel chat live** avec 12 spécialistes (orchestration intelligente)
2. **Cartographie société en 30 s** depuis le numéro SIREN
3. **Dashboard** avec 15 widgets patrimoine consolidé
4. **Veille nocturne** (alertes datées chaque matin avec sources cliquables)
5. **Carnet de contacts privé** chiffré (notaires, avocats, conciergerie...)
6. **Documents signés eIDAS** (DER, Lettre de Mission, rapports PDF)
7. **PWA hors-ligne** + push notifications

### 4. Qui utilisera l'application et dans quel contexte concret ?

**Utilisateurs cible** :
- Dirigeants TNS, professions libérales, chefs d'entreprise
- Patrimoine net 500 k€ à 30 M€
- 35-65 ans, cultivés, pressés
- France métropolitaine + diaspora francophone (Suisse, Belgique, Luxembourg)

**Contextes d'usage typiques** :
- **Matinée** : lecture des alertes de veille nocturne (15 min), arbitrage rapide
- **Trajet pro** : question rapide à Marcel sur mobile ("Pacte Dutreil sur ma holding ?")
- **Soirée** : approfondissement avec un spécialiste (Codex pour fiscal, Hermès pour transmission)
- **Avant rendez-vous notaire/avocat** : préparation cartographie + scénarios chiffrés
- **Voyage / weekend** : consultation conciergerie (chalets, palaces, jets, yachts)
- **Annuel** : revue patrimoniale, signature DER + LM avec Maxime

**Modèle commercial** :
- 🟢 **Découverte** : 0 €/mois — Marcel + 1 sphère lifestyle 3 questions/jour
- 🟠 **Premium Essentiel** : 49 €/mois — 4 spécialistes + carnet 50 contacts
- 🔴 **Premium Family Office** : 149 €/mois — 12 spécialistes illimités + veille nocturne + documents signés
- 💎 **Sur-mesure IKCP** : 5 000 €+/mois — lettre de mission cabinet, patrimoine > 5 M€

**Bêta privée** : 50 familles fondatrices · accès Premium FO offert 6 mois.

---

## 🏗 Architecture technique — site ↔ Family Office ↔ application

```
                  ┌─────────────────────────────────────┐
                  │       SITE VITRINE ikcp.eu          │
                  │  (Cloudflare Pages · static HTML)   │
                  │                                     │
                  │  • Hero + Marcel V4 (démo public)   │
                  │  • Inscription bêta · DER signé    │
                  │  • CTA "Activer mon Family Office" │
                  └────────────────┬────────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────────┐
                  │   AUTH MAGIC LINK (worker ikcp-client)│
                  │  • POST /auth/request {email}       │
                  │  • Email Brevo magic link 15 min    │
                  │  • GET /auth/verify?token → cookie  │
                  └────────────────┬────────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────────┐
                  │     APPLICATION app.ikcp.eu         │
                  │  (PWA · Cloudflare Pages)           │
                  │                                     │
                  │  • Dashboard 15 widgets             │
                  │  • Marcel chat live                 │
                  │  • Carnet contacts                  │
                  │  • Veille alertes                   │
                  │  • Documents signés                 │
                  └────────────────┬────────────────────┘
                                   │
       ┌───────────────────────────┼────────────────────────────┐
       │                           │                            │
       ▼                           ▼                            ▼
┌──────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ IKCP-CHAT    │         │ IKCP-CLIENT      │         │ IKCP-VEILLE      │
│ Marcel       │         │ Auth + D1 user   │         │ Veille augmentée │
│ + 12 agents  │         │ + conversations  │         │ + sources web    │
│ (workers)    │         │ + carnet         │         │ (Premium)        │
└──────────────┘         └──────────────────┘         └──────────────────┘
       │                           │                            │
       ├─ ikcp-codex (fiscalité)    │                            │
       ├─ ikcp-hermes (transmission)│                            │
       ├─ ikcp-lifestyle (concierge)│                            │
       ├─ ikcp-pappers (SIREN)      │                            │
       └─ ikcp-temoin (audit eIDAS) │                            │
                                    ▼                            ▼
                          ┌──────────────────┐         ┌──────────────────┐
                          │  D1 Paris (RGPD) │         │  KV cache 24h    │
                          │  • users · tier  │         │  R2 EU documents │
                          │  • conversations │         │                  │
                          │  • contacts      │         │                  │
                          │  • watches       │         │                  │
                          │  • alerts        │         │                  │
                          │  • documents     │         │                  │
                          └──────────────────┘         └──────────────────┘
```

---

## 🗂 Fichiers à créer par Perplexity (PWA app.ikcp.eu)

| Fichier | Rôle |
|---|---|
| `app/index.html` | Login magic-link · entry point |
| `app/dashboard.html` | Dashboard 15 widgets |
| `app/marcel.html` | Vue chat plein écran |
| `app/carnet.html` | Carnet contacts privé |
| `app/veille.html` | Liste alertes datées |
| `app/documents.html` | Documents signés eIDAS |
| `app/profil.html` | Profil utilisateur · tier · SIREN |
| `app/manifest.json` | Manifest PWA (icônes, couleurs, name) |
| `app/sw.js` | Service Worker (cache offline) |
| `app/css/marcel.css` | Design system Marcel (terra/cream/ink) |
| `app/js/api.js` | Wrapper unifié pour tous les workers |
| `app/js/auth.js` | Gestion session magic link |
| `app/js/widgets/*.js` | 15 widgets autonomes |

---

## 🎨 Design system à respecter — Marcel charte officielle

```css
:root{
  /* Palette */
  --bg:#FAF7F0;
  --bg-2:#F5EFE0;
  --ink:#1A1814;
  --mute:#6B655A;
  --accent:#C24722;      /* terra (marque Marcel) */
  --gold:#C9A96E;        /* premium / charte IKCP */
  --line:rgba(26,24,20,0.10);
  --success:#3F7A3F;
  --warn:#B8801F;
  --bad:#B91C1C;

  /* Navy (sections premium) */
  --navy:#1B2A4A;
  --navy-deep:#0E1729;
  --cream:#FAFAF8;
}

/* Typographie */
font-family-serif: 'Fraunces', serif (titres, emphase italique);
font-family-sans: 'Inter', sans-serif (corps, UI);
font-family-mono: 'JetBrains Mono', monospace (data, code);

/* Composants */
- Cards : rounded 14px, border 1px line, padding 22-28px
- Hover : translateY(-2px) + shadow renforcée + border accent
- Marcel sphère : gradient radial terra (E8A88E → C24722 → 8B2F18)
- Badges : pill rounded 999px, font 9.5px letterspaced 0.24em
- Modal : backdrop blur 8px, card max-width 560px
```

---

## 🔌 Endpoints workers existants à brancher

### Worker `ikcp-chat` (Marcel + 12 agents)
```
POST https://ikcp-chat.maxime-ead.workers.dev
Body: {message, history, document_pdf}
Response: {reply, follow_ups, usage}
```

### Worker `ikcp-pappers` (cartographie SIREN)
```
GET https://ikcp-pappers.maxime-ead.workers.dev/entreprise/{siren}/short
Response: {siren, nom, forme_juridique, capital, date_creation, siege, code_naf, libelle_code_naf}
```

### Worker `ikcp-codex` (fiscalité experte)
```
POST https://ikcp-codex.maxime-ead.workers.dev
Body: {question, context}
Response: {reply, agent: "Codex", usage}
```

### Worker `ikcp-hermes` (transmission)
```
POST https://ikcp-hermes.maxime-ead.workers.dev
Body: {question, context}
Response: {reply, agent: "Hermès", usage}
```

### Worker `ikcp-lifestyle` (sub-agents lifestyle)
```
POST https://ikcp-lifestyle.maxime-ead.workers.dev
Body: {agent: "iris|emile|leon|josephine|helene|olympe|auguste|augustin", question, context}
Response: {reply, agent, usage}
```

### Worker `ikcp-veille` (veille augmentée — Premium)
```
POST https://ikcp-veille.maxime-ead.workers.dev/search
Body: {query, mode: "quick|deep", user_id, tier}
Response: {summary, sources, mode, cached, remaining}
```

### Worker `ikcp-temoin` (audit MIF II)
```
POST https://ikcp-temoin.maxime-ead.workers.dev/log
Body: {family_id, question, response, model}
Response: {ok, hash, timestamp, r2_key, eidas_qualified}
```

### Worker `ikcp-client` (auth + données utilisateur — À CRÉER)
```
POST /auth/request {email}                    → envoie magic link
GET  /auth/verify?token=...                   → valide, set cookie session
GET  /me                                      → profil + tier + sirens + watches
POST /me/sirens {siren}                       → ajouter société (auto-cartographie)
GET  /me/conversations                        → liste convos
GET  /me/contacts                             → carnet contacts
POST /me/contacts {category, nom, email, ...} → ajouter contact
GET  /me/alerts?unread=1                      → alertes non lues
GET  /me/documents                            → documents signés
DELETE /me                                    → droit à l'oubli RGPD
```

---

## 💾 Schema D1 cible (région WEUR Paris)

10 tables prêtes :
- `users` (id, email, tier, beta_fondateur, stripe_*, subscription_until, rgpd_consent)
- `auth_tokens` (token_hash, email, expires_at)
- `user_sirens` (user_id, siren, nom_societe, cached_json)
- `conversations` (user_id, title, sphere, agent_principal, tokens_total)
- `messages` (conversation_id, role, content, agent, tokens_in/out, feedback)
- `user_contacts` (user_id, category, nom, email, notes, is_favorite)
- `alerts` (user_id, sphere, source, title, body, url, importance, read_at)
- `user_documents` (user_id, type, title, r2_key, hash_eidas, signed_at)
- `user_watches` (user_id, market, category, query, target_price, last_value)
- `usage_daily` (user_id, day, agent, requests_count, tokens_total, cost_estimate_eur)

Source schema complet : `workers/ikcp-client/schema-v2.sql`

---

## ⚖ Contraintes critiques NON NÉGOCIABLES

### Conformité MIF II
- Aucune recommandation produit personnalisée sans Lettre de Mission
- Marcel termine TOUJOURS par une question d'orientation
- Disclaimer obligatoire en fin de chaque réponse : *"Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier."*
- Refus systématique sur "dois-je acheter X ?" → scénarios neutres + 3 questions

### RGPD souverain France
- Hébergement Cloudflare Workers WEUR (Paris/Frankfurt)
- D1 SQLite Paris (CDG)
- R2 EU jurisdiction
- Aucun service US dans le pipeline sensible
- Bandeau RGPD obligatoire
- Endpoint `DELETE /me` cascade (droit à l'oubli)
- Export `GET /me/export` zip RGPD complet

### Marque & confidentialité
- Marque produit publique : **Marcel** (jamais "Cassius")
- Marque cabinet juridique : **IKCP IKIGAÏ Conseil Patrimonial** · ORIAS 23001568
- **JAMAIS** mentionner publiquement les fournisseurs IA (Anthropic, Claude, Sonnet, Opus, Perplexity, OpenAI)
- Vocabulaire neutre : *intelligence souveraine*, *veille augmentée*, *cartographie société*

---

## 🎼 Les 12 spécialistes Marcel (charte officielle)

| Nom | Univers | Statut bêta |
|---|---|---|
| 🏛 **Bâtisseur** | Patrimoine (cartographie société) | 🟢 LIVE |
| 🏠 **Architecte** | Immobilier (LMNP, SCI, IFI, démembrement) | 🟢 LIVE |
| 📜 **Codex** | Fiscalité 2026 (Pacte Dutreil, 150-0 B ter, jurisprudence) | 🟢 LIVE |
| 🌳 **Hermès** | Transmission (OBO, donation-partage, démembrement) | 🟢 LIVE |
| 📈 **Stratège** | Marchés financiers | 🟡 Q3 2026 |
| 🎨 **Curateur** | Art & Collections | 🟡 Q3 2026 |
| 💎 **Concierge** | Voyage & Passions (chalets, palaces, yachts, jets) | 🟡 Q3 2026 |
| 🌱 **Mécène** | Philanthropie (fonds dotation, FRUP, art. 200/238 bis CGI) | 🟡 Q3 2026 |
| 🌿 **Capital** | Private Equity (deal flow, club deals) | ⚪ Q4 2026 |
| 🎓 **Pédagogue** | Formation NextGen (Aspen, Wise, FBN) | ⚪ Q4 2026 |
| 📋 **Camille** | Administration (calendrier, mail, signature eIDAS) | ⚪ Q4 2026 |
| 📊 **Olympe** | Reporting (synthèse mensuelle PDF J+1) | ⚪ Q4 2026 |

---

## 🚀 Roadmap prototype Perplexity — 5 jours

| Jour | Livrable |
|---|---|
| **J1** | Auth magic link + PWA manifest + Service Worker + design system |
| **J2** | Dashboard layout + 5 widgets (Marcel-Live, Cartographie, Patrimoine, IFI, Calendrier) |
| **J3** | 5 widgets (Veille, Watches, Carnet, Allocation, Transmission) |
| **J4** | 5 widgets (Documents, Famille, Voyages, Mécénat, Synthèse mensuelle) |
| **J5** | Tests intégration · push notifications · bandeau RGPD · mentions légales |

---

## 📦 Code de glue site ↔ app (déjà prêt)

### Sur ikcp.eu → CTA "Ouvrir Marcel"

```html
<a href="https://app.ikcp.eu/" class="btn-marcel">
  Ouvrir Marcel — votre Family Office
</a>
```

### Sur app.ikcp.eu → header back to site

```html
<nav class="app-nav">
  <a href="https://ikcp.eu/" class="brand">IKCP.</a>
  <span class="agent-pill">Marcel · ● en ligne</span>
  <button onclick="logout()">Déconnexion</button>
</nav>
```

### Session cross-domain (cookie `*.ikcp.eu`)

```js
// Lors de l'auth magic link, le worker set le cookie avec Domain=.ikcp.eu
// Cookie: ikcp_session=<jwt>; Domain=.ikcp.eu; Secure; HttpOnly; SameSite=Lax
// → Le site et l'app partagent la session
```

---

## 🧪 Critères de succès du prototype

- [ ] PWA installable sur iPhone (Safari) et Android (Chrome) avec icône Marcel
- [ ] Login magic link < 30 s end-to-end
- [ ] Marcel répond à une question fiscale en < 8 s
- [ ] Cartographie SIREN affichée en < 5 s
- [ ] Dashboard charge < 2 s sur 4G
- [ ] Push notification fonctionnelle (alerte test)
- [ ] Hors-ligne : 2 dernières conversations consultables
- [ ] Bandeau RGPD + CGU + Mentions légales accessibles
- [ ] Pas une seule mention publique d'Anthropic, Claude, Perplexity, Pappers

---

## ✅ Garde-fous Perplexity

Quand tu codes ce prototype, tu :
1. **Respectes la marque Marcel** — jamais "Cassius" en façade publique
2. **Caches les fournisseurs IA** — vocabulaire neutre uniquement
3. **Respectes la conformité MIF II** — disclaimer + question d'orientation
4. **Réutilises les workers existants** — pas de réinvention API
5. **Restes en stack légère** — vanilla HTML/CSS/JS, pas de React/Next.js (lourdeur + dépendances)
6. **Optimises pour mobile** — 70 % des dirigeants consultent sur smartphone
7. **Respectes la charte graphique** — Fraunces + Inter, terra/cream/ink

---

© 2026 IKCP — Marcel · Family Office augmenté · ORIAS 23001568
