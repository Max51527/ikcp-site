# Agents Managed IKCP — règle « Une image vaut mille mots »

> Principe produit appliqué à tous les agents Managed IKCP : aucun
> livrable n'est rendu sans visuels. Le langage visuel est UN
> différenciateur de positionnement face aux concurrents textuels.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## 1. Pourquoi cette règle

Le marché du conseil patrimonial est saturé de PDF longs et
indigestes (50 pages, 0 graphique, jargon partout). Notre
différenciation : **chaque livrable IKCP s'ouvre par un visuel
qui résume tout**. Le client comprend en 5 secondes, puis lit la
narration en détail.

C'est une promesse marketing reformulée en règle technique : chaque
agent system prompt embarque la section « Principe produit #1 »
qui impose un minimum visuel par livrable.

---

## 2. Catalogue des 7 agents Managed (vue d'ensemble)

| Agent YAML | Modèle | Use case | Visuels obligatoires |
|---|---|---|---|
| `marcel-reporting` | claude-fable-5 | DER trimestriel, rapports clients | Donut alloc + Timeline + Performance |
| `marcel-documents` | claude-opus-4-8 | OCR + extraction structurée | JSON normalisé (pas de visuel) |
| `marcel-suivi` | claude-opus-4-8 | Planning trimestriel + arbitrages | Calendrier .ics + heatmap échéances |
| `marcel-patrimoine` | claude-opus-4-8 | Stratégie 360° 1-10 M€ | Donut + Treemap + Pyramide liquidité + Heatmap fiscale + Mermaid structure |
| `marcel-fortune` | claude-opus-4-8 | HNW/UHNW 10-500 M€ | Mermaid structure (×2) + Tableau juridictions + Waterfall transmission + Timeline |
| `marcel-gouvernance` | claude-fable-5 | Charte familiale + NextGen | Génogramme Mermaid + Visuel pédagogique |
| `marcel-editorial` | claude-fable-5 | Newsletter UPPERCUT + articles | Visuel HÉRO + 0-3 in-text |

Le worker `workers/ikcp-agents/worker.js` route les requêtes par
`kind` vers l'agent correspondant via `AGENT_KIND_TO_ENV_VAR`.

---

## 3. Bibliothèque de visuels — palette + style obligatoires

```python
# Style IKCP — à mettre en tête de chaque génération matplotlib
import matplotlib.pyplot as plt
import matplotlib as mpl

IKCP = {
    'gold':       '#c4a273',
    'gold_light': '#e3c08c',
    'gold_dark':  '#8b6f3f',
    'ink':        '#0a0d0b',
    'cream':      '#f4ece1',
    'mute':       '#8c857a',
    'sauge':      '#7fae7d',
    'warn':       '#d4a85a',
    'rouge':      '#b85a5a',
}

# Theme matplotlib IKCP
mpl.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Playfair Display', 'Georgia', 'serif'],
    'figure.facecolor': IKCP['cream'],
    'axes.facecolor': IKCP['cream'],
    'axes.edgecolor': IKCP['gold_dark'],
    'axes.labelcolor': IKCP['ink'],
    'text.color': IKCP['ink'],
    'xtick.color': IKCP['mute'],
    'ytick.color': IKCP['mute'],
    'grid.color': IKCP['mute'],
    'grid.alpha': 0.15,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'figure.dpi': 150,
    'savefig.dpi': 150,
    'savefig.bbox': 'tight',
    'savefig.facecolor': IKCP['cream'],
})
```

Sauvegarde des outputs :
```python
plt.savefig(f'/mnt/session/outputs/charts/{slug}.png', dpi=150)
```

---

## 4. 5 patterns visuels réutilisables (templates Python)

### 4.1 Donut allocation classes d'actifs

```python
fig, ax = plt.subplots(figsize=(8, 8))
ax.pie(values, labels=labels, colors=[IKCP['gold'], IKCP['sauge'],
       IKCP['gold_light'], IKCP['mute'], IKCP['warn']],
       wedgeprops=dict(width=0.4), startangle=90,
       textprops={'fontsize': 11})
ax.set_title('Allocation au 30/06/2026', fontsize=16, pad=20,
             color=IKCP['gold_dark'])
plt.savefig('/mnt/session/outputs/charts/donut-alloc.png')
```

### 4.2 Heatmap fiscale par enveloppe

```python
import numpy as np
import seaborn as sns

envelopes = ['PEA', 'AV', 'CTO', 'PER', 'Immo direct', 'SCI', 'SCPI']
metrics = ['Performance brute', 'IR/PFU', 'Coût annuel', 'Score net']
data = np.array([...])  # 4 lignes × 7 colonnes

fig, ax = plt.subplots(figsize=(12, 5))
sns.heatmap(data, annot=True, fmt='.1f',
            cmap=sns.light_palette(IKCP['gold'], as_cmap=True),
            xticklabels=envelopes, yticklabels=metrics, ax=ax,
            cbar_kws={'label': 'Score'})
ax.set_title('Heatmap fiscale par enveloppe', fontsize=16,
             color=IKCP['gold_dark'])
plt.savefig('/mnt/session/outputs/charts/heatmap-fiscal.png')
```

### 4.3 Waterfall transmission

```python
fig, ax = plt.subplots(figsize=(12, 6))
scenarios = ['Cession brute', 'Donation-cession', 'Holding apport', 'Dutreil familial']
nets = [12.5, 16.2, 18.4, 21.7]  # M€ nets héritiers

bars = ax.bar(scenarios, nets, color=[IKCP['mute'], IKCP['gold'],
              IKCP['gold_light'], IKCP['sauge']])
for bar, n in zip(bars, nets):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
            f'{n} M€', ha='center', fontsize=13,
            color=IKCP['ink'], weight='bold')

ax.set_ylabel('Net héritiers (M€)', fontsize=12)
ax.set_title('Transmission 25 M€ — 4 scénarios comparés',
             fontsize=16, color=IKCP['gold_dark'])
plt.savefig('/mnt/session/outputs/charts/waterfall-transmission.png')
```

### 4.4 Génogramme Mermaid

```markdown
%% Mermaid — Génogramme famille D.
graph TD
    P1[Pierre D.<br/>62 ans<br/>Fondateur SARL] --- P2[Sophie D.<br/>58 ans<br/>DG SCI]
    P1 --> E1[Emma D.<br/>32 ans<br/>NextGen]
    P1 --> E2[Thomas D.<br/>28 ans]
    P2 --> E1
    P2 --> E2
    E1 --> N1[Léa<br/>3 ans]
    E1 --> N2[Hugo<br/>1 an]

    classDef parent fill:#c4a273,stroke:#8b6f3f,color:#0a0d0b
    classDef nextgen fill:#e3c08c,stroke:#8b6f3f,color:#0a0d0b
    classDef petit fill:#f4ece1,stroke:#c4a273,color:#0a0d0b
    class P1,P2 parent
    class E1,E2 nextgen
    class N1,N2 petit
```

Rendu via `mmdc` (mermaid-cli) que l'agent installe par bash :
```sh
npm i -g @mermaid-js/mermaid-cli
mmdc -i genogramme.mmd -o /mnt/session/outputs/genogramme.png \
     -t neutral -b transparent -w 1200 -H 800
```

### 4.5 Schéma structure patrimoniale Mermaid

```markdown
graph LR
    PP[Pierre<br/>personne physique] -- 60% --> H[Holding SAS]
    SS[Sophie<br/>personne physique] -- 40% --> H
    H -- 100% --> SE[SARL d'exploitation]
    H -- 75% --> SCI[SCI Familiale]
    PP -- 25% NP --> SCI
    SCI --> B1[Immeuble Paris 16e]
    SCI --> B2[Maison Megève]

    classDef holding fill:#c4a273
    classDef expl fill:#7fae7d
    classDef sci fill:#e3c08c
    class H holding
    class SE expl
    class SCI sci
```

---

## 5. Checklist de qualité visuelle (par agent)

Chaque agent doit auto-valider en fin de génération :

- [ ] Au moins N visuels selon le YAML (3 pour reporting, 5 pour patrimoine, 2 pour gouvernance/editorial)
- [ ] Palette IKCP respectée (gold/cream/ink — pas de violet, pas de Powerpoint)
- [ ] Résolution ≥ 150 dpi
- [ ] Tous les chiffres affichés sont issus de calculs Python documentés
- [ ] Pas de nom de produit financier nommé dans les visuels
- [ ] Pas de PII identifiable (nom client, IBAN, n° SIREN exposés)
- [ ] Disclaimer présent au pied du livrable embedding les visuels
- [ ] Visuels embedded dans le .docx/.pdf final (pas juste collés à côté)

---

## 6. Cas concret — flow utilisateur

```
Client Maxime dans dashboard app mobile
    │
    ▼
Tap "Générer mon DER Q3"
    │
    ▼
POST /api/agents/task { kind: "reporting", task: "DER Q3 famille D." }
    │
    ▼
ikcp-agents Worker → sessions.create({agent: marcel-reporting})
    │
    ▼
Agent Managed (Fable 5) :
  1. fetch_patrimoine_snapshot → JSON D1
  2. génère 3 visuels matplotlib (donut + timeline + perf) →
     /mnt/session/outputs/charts/
  3. compose narration .docx avec embedded images (skill docx)
  4. auto-review contre rubric (3 visuels présents ?)
  5. persist_output → R2 + magic-link Resend
    │
    ▼
Webhook session.status_idled → ikcp-agents
    │
    ▼
Push notification iOS / Android (Capacitor + APNs/FCM)
"📊 Votre DER Q3 est prêt — 3 visuels + 8 pages"
    │
    ▼
Client tap notification → app mobile → client.ikcp.eu/dashboard?task=...
    → preview embedded → download .docx
```

---

*Visual-First Guidelines v1.0 · 2026-06 · © IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
