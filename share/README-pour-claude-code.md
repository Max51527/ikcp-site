# Aperçu — Landing beta IKCP « Dirigeants d'entreprise familiale »

> Fichier partagé d'un Claude Code à un autre, pour aperçu visuel et
> compréhension du contexte. **Une seule page autonome à ouvrir.**

---

## TL;DR

Ouvre `landing-beta-standalone.html` directement dans un navigateur (Chrome,
Firefox, Safari). Aucun serveur requis, aucun build, aucune dépendance
locale. Les seules ressources externes sont les Google Fonts (Inter, Playfair
Display, JetBrains Mono).

```bash
# macOS
open share/landing-beta-standalone.html

# Linux
xdg-open share/landing-beta-standalone.html

# Ou simplement double-cliquer sur le fichier dans un explorateur.
```

Pour tester le responsive : `python3 -m http.server 8088` puis
`http://localhost:8088/share/landing-beta-standalone.html` + DevTools mobile.

---

## Contexte projet (1 paragraphe)

**IKCP** — IKIGAÏ Conseil Patrimonial (ORIAS 23001568, CIF · CNCEF
Patrimoine · COA) — est un cabinet de conseil patrimonial qui lance en
2026 un **Family Office Digital augmenté par IA**. L'agent principal
s'appelle **Marcel** (Claude derrière, hébergé sur Cloudflare Workers
EU, avec 9 outils déterministes JS pour fiscalité FR + 25 contextes
thématiques injectés selon la conversation). Cette landing est l'entrée
de la beta S2 2026, **50 codes** réservés aux dirigeants d'entreprise
familiale. Le ton : éditorial, premier degré, anti-bullshit. Le pitch
central : *« vos enfants ne sont pas nuls, on ne leur a juste jamais
donné les outils »* — formation NextGen incluse dans l'offre.

---

## Anatomie de la page

| Section | Rôle | Composants clés |
|---|---|---|
| `nav.top` | Bar fixe haut | Brand `IKCP.` + tag `Beta · sur invitation` (point clignotant or) |
| `section.hero` | Accroche émotionnelle | H1 italic Playfair, lede, 2 CTA, bande **4 × 100 %** (Digitalisé / Automatisé / Sur-mesure / Accessible) |
| `section.story #story` | Storytelling 01 | Stat Morgan Stanley (70 % AUM dispersés), citation Emma D. 32 ans |
| `section.story` | Storytelling 02 — cas concrets | Grille 2×2 : Emma D., Thomas D., Léa B., Hugo & Antoine M. |
| `section.promesse` | Promesse produit 03 | 3 piliers : hyper-perso · NextGen · 100 % digital jamais seul |
| `section.beta #beta` | Conversion | Formulaire code beta auto-formaté `BETA-FAMI-XXXX-YYYY` |
| `footer.proto` | Légal | ORIAS, CIF, mentions |

---

## Design system

### Palette (dark / actuelle)
```css
--bg:       #0a0d0b   /* obsidienne */
--bg-2:     #0d100e   /* surface +1 */
--bg-3:     #131815   /* surface +2 */
--ink:      #f4ece1   /* crème, texte principal */
--ink-mute: #8c857a   /* gris chaud, paragraphes */
--ink-faint:#524d47   /* taupe, méta */
--gold:        #c4a273   /* or principal */
--gold-bright: #e3c08c   /* or hover */
--warn: #d4a85a · --ok: #7fae7d
--line:       rgba(196,162,115,.14)
--line-strong:rgba(196,162,115,.32)
```

Il existe une **version claire** dans le repo principal
(`proposals/light/landing-beta-dirigeants.html`) avec palette crème
alignée sur ikcp.eu : `--bg:#faf6ee · --ink:#1a1814 · --gold-deep:#8b6f3f`.
Toggle « Sombre / Clair » prévu pour A/B.

### Typographie
- **Playfair Display** italic — titres, citations, accents (`<em>`)
- **Inter** 300/400/500/600 — corps, boutons, méta
- **JetBrains Mono** — numérotation sections, code beta, tags

### Rythme
- `max-width: 1080px` desktop, gouttières `0 48px`
- Sections : padding vertical `90–120px` desktop, `60px` mobile
- Breakpoint unique : `900px` (réduit padding, grilles → 1 colonne)

---

## JS embarqué

Une seule IIFE (≈ 50 lignes) :

1. **Auto-format input** : majuscules, suppression caractères non
   alphanumériques, re-segmentation en groupes de 4 séparés par `-`.
2. **Submit handler** : valide longueur min 8, puis match dans liste
   démo (`BETA-FAMI-DEMO-2026`, `BETA-FAMI-PIVOT-2026`,
   `BETA-FAMI-PILOTE-001`). En production, POST sur
   `https://client.ikcp.eu/auth/beta-redeem` (Cloudflare Worker
   `ikcp-client` avec D1 backing + redirect magic-link).
3. **Feedback** : success vert sauge / error or-warn, italique Playfair.

---

## Codes de test

Trois codes valident le formulaire en mode aperçu offline :

| Code | Usage |
|---|---|
| `BETA-FAMI-DEMO-2026` | Démo générique |
| `BETA-FAMI-PIVOT-2026` | Cohorte pivot |
| `BETA-FAMI-PILOTE-001` | Pilote first-mover |

En production, ces codes seront générés par `scripts/generate-beta-codes.mjs`
(crypto.randomInt, 50 codes, insertion D1).

---

## Ce que tu peux faire avec ça

1. **Ouvrir directement** la page pour aperçu visuel desktop + mobile.
2. **Forker le HTML** pour proposer une variation (autre palette, autre
   storytelling, autre CTA, autre form pattern).
3. **Critiquer** : hiérarchie typographique, contraste, parcours
   conversion, accessibilité (WCAG), motion (un seul `@keyframes blink`),
   responsive 320–1440px.
4. **Étendre** : ajouter section preuves (logos partenaires, FAQ,
   timeline beta J0 → J+180), section comparatif vs concurrents (AFFO
   × EDHEC NextGen 6 500-7 500€, identifié comme menace #1).

---

## Pointeurs vers le repo complet (si tu y as accès)

Repo : `max51527/ikcp-site` · branche `claude/family-office-ai-audit-ASIux`

| Chemin | Contenu |
|---|---|
| `proposals/landing-beta-dirigeants.html` | Version source (dark) — quasi-identique à ce standalone |
| `proposals/light/landing-beta-dirigeants.html` | Version palette claire (crème) |
| `proposals/espaces-fo.html` | Page tarifs 3 espaces (Freemium / Augmenté 6 800€ / Bespoke) |
| `proposals/dashboard-famille-office.html` | Espace membre post-onboarding |
| `proposals/formation-nextgen.html` | Détail des 6 modules NextGen |
| `proposals/conviction-overview.html` | Manifeste / positionnement |
| `workers/ikcp-marcel/worker.js` | Marcel — orchestrateur Claude + 9 tools + 25 contextes |
| `workers/ikcp-client/worker.js` | Espace client + endpoint `/auth/beta-redeem` |
| `workers/documents-mcp-server/worker.js` | MCP sub-agent OCR + classification |
| `marcel-kit/` | Bundle partageable (worker.js + README + deploy.sh) |
| `scripts/generate-beta-codes.mjs` | Génération des 50 codes (crypto.randomInt) |

---

## Stack en production (résumé)

- **Frontend** : vanilla HTML/CSS/JS, pas de framework, pas de build
- **Workers** : Cloudflare Workers (workerd, EU sovereign)
- **LLM** : Anthropic Claude (Sonnet 4.6 + Opus 4.7 si haut enjeu),
  tool calling, prompt caching, web search natif
- **Storage** : D1 (10 tables) + R2 (3 buckets) + KV (3 namespaces)
- **Auth** : magic-link via Resend
- **MCP** : sous-agents HTTP (HMAC-SHA256 + comparaison constant-time)
- **Compliance** : MIF II, DDA, AI Act EU 2024/1689, RGPD, DORA — by design

---

*© 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
