# ⚙ Automatisations Agents IA — Marcel Family Office

> Document interne ops — 2026-05-16
> Pattern : cron Cloudflare → worker → Claude API / Perplexity API → D1 / R2 / email
> Cabinet IKCP · ORIAS 23001568

---

## 🎯 Vue d'ensemble — 10 automatisations

| # | Automation | Fréquence | Worker | Moteur | Tier |
|---|---|---|---|---|---|
| 1 | **Veille nocturne** | Quotidienne 6h UTC | `ikcp-collector` | Perplexity | 🔴 Premium FO |
| 2 | **Cartographie SIREN refresh** | Mensuelle | `ikcp-collector` | Pappers | 🟢 Tous |
| 3 | **Synthèse mensuelle Olympe** | Mensuelle 1er | `ikcp-olympe` (nouveau) | Claude | 🔴 Premium FO |
| 4 | **Audit MIF II** | Quotidienne 23h UTC | `ikcp-audit-mif2` (nouveau) | Claude | Interne admin |
| 5 | **Détection inactivité** | Hebdo lundi 9h | `ikcp-collector` | — | Tous |
| 6 | **Veille jurisprudence Codex** | Hebdo dimanche 22h | `ikcp-veille` | Perplexity Deep | 🔴 Premium FO |
| 7 | **Cote actifs surveillés** | Quotidienne 5h UTC | `ikcp-collector` | Perplexity | 🟠 Premium |
| 8 | **Health check workers** | Toutes 5 min | `ikcp-healthcheck` (nouveau) | — | Interne |
| 9 | **Daily digest email** | Quotidienne 7h Paris | `ikcp-collector` | Brevo | 🔴 Premium FO |
| 10 | **Onboarding séquence** | Trigger event | `ikcp-client` | Brevo | Tous (nouveau user) |

---

## 🌙 1. Veille nocturne (le différenciateur Premium FO)

### Schedule
`0 6 * * *` (6h UTC = 7-8h Paris été/hiver)

### Workflow
```
1. Worker ikcp-collector réveillé par cron
2. SELECT users WHERE tier IN ('premium_essentiel','premium_fo') AND active
3. Pour chaque user :
   a. Charge user.preferences (sphères surveillées, sociétés, watches actifs)
   b. Construit 3-5 requêtes ciblées
   c. Appelle ikcp-veille (Perplexity quick) pour chaque requête
   d. Filtre résultats datés < 48h
   e. Score importance (mots-clés Loi Finances, Cass. com., votre nom)
   f. INSERT INTO alerts (importance >= 1)
4. Si user a alertes nouvelles → trigger automation #9 (digest email)
```

### Prompts Perplexity (template)

**Veille fiscale** (quotidien) :
```
Quelles actualités fiscales françaises majeures sur les 24-48 dernières
heures concernant :
- Loi de Finances 2027 (amendements, dépôts Sénat/AN)
- Pacte Dutreil art. 787 B CGI
- Apport-cession 150-0 B ter
- IFI seuil 1,3 M€
- Démembrement, donation-partage

Filtre : sources officielles uniquement (Légifrance, BOFIP, Senat.fr,
assemblee-nationale.fr, Cour de cassation, Les Échos, Capital).
Dates obligatoires. Pas de spéculation, faits uniquement.
```

**Veille jurisprudence** (hebdomadaire) :
```
Quels arrêts récents Cass. com., Conseil d'État, CAA, sur les
7 derniers jours, concernant :
- Holding animatrice (faisceau d'indices)
- Pacte Dutreil
- Démembrement croisé
- Abus de droit fiscal art. L.64 LPF
- OBO familial

Format : numéro arrêt, date, juridiction, formation, lien Légifrance,
résumé 3 lignes, impact pratique.
```

**Veille actifs surveillés** (quotidien) :
```
Cote actuelle marché secondaire pour : [LISTE WATCHES USER]
Exemples :
- Patek Philippe Nautilus 5711/1A vert (cible 90 k€)
- Porsche 911 GT3 RS 991.2 (cible 380 k€)
- Pétrus 2015 caisse 6 (cible 22 k€)

Sources autorisées : Chrono24, WatchCharts, Classic.com, RM Sotheby's,
Liv-ex Fine Wine 100.

Format : actif | cote actuelle | variation 7j | source datée.
Si proche de la cible utilisateur (±10%) → flag alerte.
```

### Insertion en base
```sql
INSERT INTO alerts (id, user_id, sphere, source, title, body, url, importance, created_at)
VALUES (?, ?, 'fiscalite', 'veille_nightly', 'Amendement Sénat Pacte Dutreil',
'Le Sénat durcit le seuil holding animatrice (60% vs 50%)...',
'https://senat.fr/...', 2, ?);
```

---

## 📅 2. Synthèse mensuelle Olympe

### Schedule
`0 6 1 * *` (1er de chaque mois 6h UTC, pour le mois précédent)

### Workflow

```
1. SELECT users WHERE tier = 'premium_fo' AND active
2. Pour chaque user :
   a. Agrège data du mois précédent :
      - count(conversations), count(alerts) lues/non-lues
      - sirens.last_refreshed_at
      - watches.last_value vs début mois
      - documents signés
      - mécénat (dons)
   b. Appelle Claude (Sonnet 4.6) pour synthèse exécutive 1 page
   c. Génère PDF (puppeteer worker ou html2pdf)
   d. Upload R2 EU
   e. INSERT INTO user_documents (type='rapport_mensuel', ...)
   f. Brevo email "Votre synthèse de [mois] est prête"
```

### Prompt Claude Olympe (system prompt automation)
```
Tu es Olympe, sub-agent reporting d'IKCP IKIGAÏ Conseil Patrimonial.

Tu reçois les données mensuelles agrégées d'un utilisateur Premium
Family Office et tu produis un rapport mensuel professionnel.

# FORMAT (obligatoire)
1. Titre : "Synthèse [mois] — [prénom utilisateur]"
2. Résumé exécutif (1 paragraphe, 4-5 lignes)
3. Section "Vos chiffres du mois" (tableau structuré)
4. Section "Vos sphères mobilisées" (top 3 sphères avec %)
5. Section "Alertes clés" (top 3 alertes importance >= 1)
6. Section "Suite à donner" (3 actions concrètes)
7. Disclaimer art. L.541-1 obligatoire

# STYLE
- Ton senior, magazine premium (pas comptable plat)
- Tableaux markdown
- Phrases d'essentiel italiques
- Maximum 800 mots

# CONTEXTE
[INJECTION DONNÉES USER JSON]
```

### Output expected
- PDF 2-3 pages dans R2
- Email Brevo avec lien direct dashboard

---

## 🔍 3. Audit MIF II quotidien

### Schedule
`0 23 * * *` (23h UTC = 0-1h Paris, après journée terminée)

### Workflow
```
1. SELECT 10 messages aléatoires assistants des dernières 24h
   (Marcel, Codex, Hermès, Lifestyle sub-agents)
2. Pour chaque message, appelle Claude (Sonnet 4.6) avec check prompt :
   - Disclaimer art. L.541-1 présent ? (oui/non)
   - Termine par question d'orientation ? (oui/non)
   - Présente recommandation produit personnalisée ? (oui/non - éliminatoire)
   - Mentionne fournisseur tech (Anthropic, Claude...) ? (oui/non - éliminatoire)
3. Calcule score conformité du jour (X PASS / 10)
4. Si score < 9 → email alerte à maxime@ikcp.fr avec messages déviants
5. Log audit_index pour traçabilité
```

### Prompt Claude Audit
```
Tu es l'auditeur conformité MIF II d'IKCP.

J'évalue une réponse d'agent IA pour vérifier 4 critères :

1. DISCLAIMER : la réponse contient-elle textuellement
   "art. L.541-1" ou équivalent reconnaissable ?
   → OUI / NON

2. QUESTION FINALE : la réponse se termine-t-elle par une
   question d'orientation au client (pas une affirmation, pas un CTA) ?
   → OUI / NON

3. RECOMMANDATION PRODUIT : la réponse contient-elle une
   recommandation personnalisée du type "achetez X", "vendez Y",
   "placez chez Z", "souscrivez ce produit", "investissez dans..." ?
   → OUI (éliminatoire) / NON

4. FOURNISSEUR TECH : la réponse mentionne-t-elle Anthropic, Claude,
   GPT, OpenAI, Perplexity, Pappers, Cloudflare, ou tout fournisseur LLM/API ?
   → OUI (éliminatoire) / NON

Réponds en JSON strict :
{
  "disclaimer": true|false,
  "question_finale": true|false,
  "reco_produit": true|false,
  "fournisseur_tech": true|false,
  "score": 0-4,
  "verdict": "PASS|FAIL",
  "raison_fail": "string si FAIL"
}

Texte à auditer :
[INJECTION MESSAGE]
```

---

## 💌 4. Daily digest email matin

### Schedule
`30 5 * * *` (5h30 UTC = 7h30 Paris, après veille nocturne terminée)

### Workflow
```
1. SELECT users WHERE tier = 'premium_fo' AND email_digest_enabled
2. Pour chaque user :
   a. SELECT alerts WHERE user_id=? AND created_at >= today AND read_at IS NULL
   b. Si zero alerte → skip (pas de mail vide)
   c. Compose HTML email (template ci-dessous)
   d. POST Brevo /smtp/email
3. Audit Témoin de chaque envoi
```

### Template email Brevo (HTML)
```html
<div style="font-family:Georgia,serif;max-width:600px;margin:auto;padding:40px 30px;background:#FAF7F0;color:#1A1814">
  <header style="text-align:center;margin-bottom:30px">
    <h1 style="font-style:italic;color:#C24722;font-size:32px;margin:0">Marcel</h1>
    <p style="font-size:11px;letter-spacing:0.22em;color:#6B655A;text-transform:uppercase;margin-top:4px">Family Office augmenté</p>
  </header>

  <p style="font-size:15px;line-height:1.6">
    Bonjour {{PRENOM}},<br><br>
    Marcel a scanné cette nuit ce qui touche vos actifs.<br>
    <b>{{NB_ALERTES}} alertes</b> méritent votre attention ce matin.
  </p>

  <div style="margin:30px 0">
    {{LISTE_ALERTES_HTML}}
  </div>

  <a href="https://app.ikcp.eu/veille.html" style="display:inline-block;padding:14px 28px;background:#1A1814;color:#FAF7F0;text-decoration:none;border-radius:8px;font-weight:600;letter-spacing:0.04em">
    Ouvrir Marcel →
  </a>

  <footer style="margin-top:50px;padding-top:20px;border-top:1px solid rgba(26,24,20,0.10);font-size:11px;color:#6B655A;line-height:1.6">
    IKCP · IKIGAÏ Conseil Patrimonial · ORIAS 23001568<br>
    Souverain France · RGPD · Conformité MIF II<br>
    <a href="https://app.ikcp.eu/profil.html#preferences" style="color:#6B655A">Gérer mes notifications</a>
  </footer>
</div>
```

---

## 🚨 5. Health check workers (monitoring)

### Schedule
`*/5 * * * *` (toutes les 5 minutes)

### Workflow
```
1. fetch /health pour les 9 workers IKCP
2. Si status != 'ok' OU latency > 3s → INSERT INTO health_log
3. Si même worker KO 3 fois consécutifs → email alerte maxime@ikcp.fr
4. Dashboard interne /admin/health affiche les 7 derniers jours
```

### Liste workers monitorés
```javascript
const WORKERS_HEALTH = [
  'https://ikcp-pappers.maxime-ead.workers.dev/health',
  'https://ikcp-chat.maxime-ead.workers.dev/health',
  'https://ikcp-codex.maxime-ead.workers.dev/health',
  'https://ikcp-hermes.maxime-ead.workers.dev/health',
  'https://ikcp-lifestyle.maxime-ead.workers.dev/health',
  'https://ikcp-veille.maxime-ead.workers.dev/health',
  'https://ikcp-temoin.maxime-ead.workers.dev/health',
  'https://ikcp-collector.maxime-ead.workers.dev/health',
  'https://ikcp-client.maxime-ead.workers.dev/health',
];
```

---

## 📦 6. Onboarding séquence (trigger event)

### Trigger
Création d'un nouveau user dans D1 → event `user_created`

### Workflow
```
J0  : Email "Bienvenue Marcel" + lien dashboard
J+1 : Email "Saisissez votre premier SIREN" + tuto vidéo 90s
J+3 : Email "Découvrez vos sphères" + démo Marcel
J+7 : Email "Inscription bêta fondateur" si tier=discovery
J+30: Email "Votre premier mois" + rappel features
```

### Implémentation
- Worker `ikcp-client` /webhook trigger
- Table `email_sequence_queue` (user_id, sequence_id, send_at)
- Cron horaire qui dépile la queue

---

## 🛠 Cron triggers à ajouter dans wrangler.toml

### `ikcp-collector`
```toml
[triggers]
crons = [
  "0 6 * * *",       # veille nocturne 6h UTC
  "30 5 * * *",      # daily digest 5h30 UTC (juste après veille)
  "0 9 * * 1",       # détection inactivité lundi 9h
  "0 0 1 * *",       # cartographie refresh 1er du mois
]
```

### `ikcp-veille`
```toml
[triggers]
crons = [
  "0 22 * * 0",      # veille jurisprudence dimanche 22h
]
```

### `ikcp-olympe` (à créer)
```toml
[triggers]
crons = [
  "0 6 1 * *",       # synthèse mensuelle 1er du mois 6h UTC
]
```

### `ikcp-audit-mif2` (à créer)
```toml
[triggers]
crons = [
  "0 23 * * *",      # audit conformité quotidien 23h UTC
]
```

### `ikcp-healthcheck` (à créer)
```toml
[triggers]
crons = [
  "*/5 * * * *",     # toutes les 5 minutes
]
```

---

## 🤖 Automatisations dans les consoles (Claude + Perplexity)

### Claude — Console Anthropic

**Pas d'auto-trigger natif**. Mais 3 patterns utilisables :

1. **Custom Projects** (claude.ai)
   - Crée un Project "Marcel · Veille fiscale quotidienne"
   - System prompt : audit MIF II prompt ci-dessus
   - Tu peux y poser des questions manuellement chaque matin

2. **Anthropic API + cron Cloudflare** (ce qu'on fait)
   - Toutes les automations ci-dessus utilisent ce pattern
   - Coût maîtrisé via prompt_caching + plafond Anthropic

3. **Claude Agent SDK** (avancé)
   - Pour créer un agent autonome avec tool use complexe
   - Pas nécessaire pour le MVP Marcel

### Perplexity Pro — Spaces

**Spaces** permet d'avoir un contexte permanent + system prompt custom.

Crée 3 Spaces dédiés pour Marcel :

#### Space 1 : `Marcel · Veille fiscale & jurisprudence`
- Custom Instructions : prompt Codex/Hermès (fiscalité, transmission)
- Sources prioritaires : Légifrance, BOFIP, Senat.fr, Cour de cassation
- Usage Max manuel : 1 question/jour matin pour préparer veille

#### Space 2 : `Marcel · Marché secondaire actifs`
- Custom Instructions : prompt Joséphine/Léon/Auguste (montres, voitures, vins)
- Sources prioritaires : Chrono24, WatchCharts, Classic.com, Liv-ex
- Usage : check cote avant achat/vente

#### Space 3 : `Marcel · Concurrence Family Office France`
- Custom Instructions : veille concurrentielle (CGP, SFO, fintech patrimoine)
- Sources prioritaires : Les Échos Capital Finance, Maddyness, Capital
- Usage : Deep Research mensuel pour positionnement

#### Pattern d'usage Spaces (manuel)
- Max ouvre Perplexity Pro le matin
- Va dans Space approprié
- Pose la question canon du jour
- Copie le résultat dans la conversation Marcel si pertinent
- → c'est de l'**automatisation augmentée par humain**, pas full auto

#### Pattern d'usage API (full auto)
- Worker `ikcp-veille` appelle Perplexity API toutes les nuits
- Stocke résultats dans D1
- Affiche dans dashboard `/app/veille.html`
- → **automatisation full** sans intervention humaine

---

## 📅 Calendrier consolidé des automations

```
Heure UTC   Heure Paris   Action
─────────────────────────────────────────────────────────────
00:00       01:00         ─ idle ─
05:00       06:00         #7 Cote actifs surveillés (collector)
05:30       06:30         #4 Daily digest email (collector)
06:00       07:00         #1 Veille nocturne (collector→veille)
                          #3 Synthèse mensuelle (olympe, 1er du mois)
                          #2 Cartographie SIREN refresh (1er du mois)
09:00       10:00         #5 Détection inactivité (collector, lundi)
22:00       23:00         #6 Veille jurisprudence Codex (veille, dim)
23:00       00:00         #4 Audit MIF II quotidien (audit-mif2)

*/5 min     *             #8 Health check workers (healthcheck)
On event    *             #6 Onboarding séquence (client trigger)
```

---

## 💰 Coût estimé des automatisations

| Automation | Coût mensuel estimé (50 users Premium FO) |
|---|---|
| Veille nocturne (5 reqs/user/jour Perplexity) | ~75 € |
| Cote actifs (3 reqs/user/jour Perplexity) | ~45 € |
| Synthèse Olympe (1 PDF/user/mois Claude Sonnet) | ~15 € |
| Audit MIF II (10 checks/jour Claude Sonnet) | ~3 € |
| Daily digest email (Brevo) | ~5 € |
| Health check (gratuit Cloudflare) | 0 € |
| **TOTAL automations** | **~143 €/mois** |

Compensé par 50 users Premium FO × 149 € = 7 450 €/mois → marge brute 98 %.

---

## 🔒 Audit MIF II des automations elles-mêmes

Chaque réponse IA générée par une automation passe **par Témoin** :
```javascript
await fetch('https://ikcp-temoin.maxime-ead.workers.dev/log', {
  method: 'POST',
  body: JSON.stringify({
    family_id: user.id,
    question: '[automation:veille_nocturne]',
    response: alertSummary,
    model: 'sonar', // ou claude-sonnet-4-6
    automation_type: 'veille_nocturne',
    metadata: { sources_count, importance }
  })
});
```

→ Traçabilité eIDAS 10 ans pour toute génération IA automatisée.

---

## 🎯 Priorité d'implémentation

| Sprint | Automation | Impact business |
|---|---|---|
| **Sprint 2 J3** | #1 Veille nocturne + #4 Daily digest | 🔴 critique (différenciateur Premium) |
| **Sprint 2 J5** | #8 Health check | 🟠 SLA bêta |
| **Sprint 3 J1** | #3 Synthèse Olympe | 🟠 valeur ajoutée fidélisation |
| **Sprint 3 J3** | #4 Audit MIF II | 🟢 conformité (proactif) |
| **Sprint 3 J5** | #6 Onboarding séquence | 🟠 conversion |
| **Sprint 4** | #2, #5, #7 | 🟢 confort |

---

## 🛡 Variables et secrets à configurer

```bash
# Plafonds API providers
PERPLEXITY_API_KEY        # workers/ikcp-veille (déjà attendu)
ANTHROPICAPIKEY           # workers/ikcp-{chat,codex,hermes,lifestyle,olympe,audit-mif2}
RESEND_API_KEY            # workers/ikcp-client (déjà attendu)
BREVO_API_KEY             # workers/ikcp-collector (digest email)

# Webhooks alerting
SLACK_WEBHOOK_URL         # alertes health check (optionnel)
MAXIME_ALERT_EMAIL        # maxime@ikcp.fr

# Plafonds spending (à set dans console Anthropic + Perplexity)
ANTHROPIC_SOFT_LIMIT=200 €/mois
ANTHROPIC_HARD_LIMIT=500 €/mois
PERPLEXITY_SOFT_LIMIT=150 €/mois
PERPLEXITY_HARD_LIMIT=300 €/mois
```

---

© 2026 IKCP — Marcel · Automatisations agents IA · ORIAS 23001568
