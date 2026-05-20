# 🧩 Catalogue widgets Family Office Marcel

> Document interne ops — 2026-05-16
> Pour intégration dashboard espace client `/app/dashboard`

---

## 🎯 Logique d'usage

Chaque widget = 1 composant autonome (HTML/CSS/JS vanilla, pas de framework lourd).
Affiché dans le dashboard utilisateur après auth magic link.
Données issues du worker `ikcp-client` (D1 Paris) + workers spécialistes.

Tier d'accès :
- 🟢 **Découverte** : widgets de base (Marcel, cartographie, 1 alerte)
- 🟠 **Premium Essentiel** : 8 widgets
- 🔴 **Premium Family Office** : 15 widgets + veille augmentée

---

## 📦 Les 15 widgets prioritaires

### 1. 🎼 Marcel-Live *(toujours visible, top dashboard)*

Champ de saisie sticky + dernière conversation. Click → étend en mode chat plein écran.

- **Dimensions** : 100% largeur, hauteur 120 px (replié) / 100vh (déplié)
- **Données** : `messages` D1 (dernière conv) + `usage_daily` (quota tier)
- **API** : POST ikcp-chat avec session token

```
┌──────────────────────────────────────────────────┐
│  Marcel  ● EN ÉCOUTE     Reprendre · Patek 5711 →│
│  [ Posez votre question…                    →  ] │
│  Quota Découverte · 7/10 questions ce mois       │
└──────────────────────────────────────────────────┘
```

---

### 2. 🏛 Cartographie Société *(SIREN principal)*

Vue claire de la société rattachée : forme, capital, ancienneté, ratio capitalisation, points d'attention.

- **Données** : `user_sirens` + appel Pappers
- **Bouton CTA** : *"Demander à Bâtisseur d'approfondir"*
- **Refresh** : 30 jours rolling (cache Pappers)

```
┌──────────────────────────────────────────────────┐
│  ◆ VOTRE SOCIÉTÉ PRINCIPALE                       │
│                                                   │
│  IKIGAI CONSEIL PATRIMONIAL                       │
│  EURL · Saint-Marcel-lès-Annonay · NAF 66.19B     │
│                                                   │
│  Capital social      5 000 €     ⚠ faible        │
│  Date création       2023-01-06  · 3 ans         │
│  Dirigeants          1                            │
│  Bénéficiaires éco.  0           ✅ déclaré       │
│                                                   │
│  → Approfondir avec Bâtisseur                     │
└──────────────────────────────────────────────────┘
```

---

### 3. 📊 Patrimoine consolidé *(donut chart)*

Vue 360° pro + perso. Répartition par classe d'actifs. Tier Premium uniquement.

- **Données** : agrégation `user_sirens` + biens immobiliers + actifs déclarés
- **Visuel** : donut SVG sans dépendance (D3 = trop lourd)
- **Drill-down** : click sur classe → détail

```
┌──────────────────────────────────────────────────┐
│  ◆ PATRIMOINE CONSOLIDÉ                Total      │
│                                       8,4 M€      │
│      ╭─────────╮      ─                          │
│     ╱  Société  ╲    ● Société     54%  4,5 M€   │
│    │   ━━━━━     │   ● Immobilier  28%  2,4 M€   │
│    │    Immo     │   ● Financier   14%  1,2 M€   │
│     ╲   ━━━━    ╱    ● Lifestyle    4%  0,3 M€   │
│      ╰─────────╯                                 │
└──────────────────────────────────────────────────┘
```

---

### 4. ⚖ IFI Tracker *(jauge seuil 1,3 M€)*

Position vis-à-vis du seuil IFI + simulation impact réforme.

- **Données** : biens immobiliers user_sirens.cached_json + déclarations user
- **Tier** : Premium
- **Refresh** : à chaque ajout/modif bien immobilier

```
┌──────────────────────────────────────────────────┐
│  ◆ IFI 2026 · seuil 1 300 000 €                   │
│                                                   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  85%          │
│       Patrimoine immobilier net : 2 100 000 €     │
│  Impôt estimé 2026                    7 240 €     │
│  Abattement RP appliqué              -30% sur RP  │
│                                                   │
│  → Optimiser avec Architecte                      │
└──────────────────────────────────────────────────┘
```

---

### 5. 📅 Calendrier fiscal & notarial

Échéances critiques 3 prochains mois (déclarations, signatures, AG société).

- **Données** : `alerts` + règles fiscales calendaires + RDV `calendar` Camille
- **Visuel** : timeline horizontale + jours restants

```
┌──────────────────────────────────────────────────┐
│  ◆ VOS ÉCHÉANCES                                  │
│                                                   │
│  ━━━━━●━━━━━━━━━━━━━━●━━━━━━━━━●━━━━━━━━━━━━━━━━ │
│       J-12          J-37        J-62             │
│                                                   │
│  J-12 ▶ Déclaration IR 2025                       │
│  J-37 ▶ Déclaration IFI 2026                      │
│  J-62 ▶ AG annuelle holding                       │
│                                                   │
│  → 3 documents à préparer · Camille m'aide        │
└──────────────────────────────────────────────────┘
```

---

### 6. 🌙 Veille du jour *(Premium uniquement)*

Alertes nocturnes de Marcel : Loi Finances, jurisprudence, cote actifs surveillés.

- **Données** : `alerts` où `created_at >= today` + non lues
- **Source** : worker `ikcp-veille` cron quotidien
- **Tier** : Premium (Découverte ne reçoit pas d'alertes)

```
┌──────────────────────────────────────────────────┐
│  ◆ VEILLE DU 16 MAI 2026               3 alertes  │
│                                                   │
│  🔴 Loi Finances 2027 — amendement Dutreil        │
│     Sénat durcit seuil holding animatrice 60%     │
│     Impact : votre cartographie société           │
│     → Approfondir · 2 sources                     │
│                                                   │
│  🟡 Patek Nautilus 5711A vert · cote ↗ +4,2 %    │
│     Marché secondaire 98-115 k€ aujourd'hui       │
│     → Joséphine vérifie · 3 sources               │
│                                                   │
│  ⚪ Cass. com. 4 mai 2026 · holding patrimoniale  │
│     Confirmation arrêt 2022 sur animation         │
│     → Codex décortique · 1 source                 │
└──────────────────────────────────────────────────┘
```

---

### 7. 👁 Mes actifs surveillés *(watches)*

Liste des actifs surveillés (montres, voitures, vins, art) avec cote actuelle + alerte si cible atteinte.

- **Données** : `user_watches`
- **Refresh** : nuit (collector daily 6h UTC)
- **Action** : "+ Ajouter une veille"

```
┌──────────────────────────────────────────────────┐
│  ◆ VOS VEILLES · 6 actifs                         │
│                                                   │
│  ⌚ Patek 5711A vert         105 k€  ↗ +4,2%     │
│     cible 90 k€              ⚠ proche             │
│                                                   │
│  🚗 Porsche 964 RS           380 k€  → stable    │
│     cible 350 k€                                  │
│                                                   │
│  🍷 Pétrus 2015              4 200 € ↘ -1,5%     │
│     cible 3 500 €                                 │
│                                                   │
│  → + Ajouter une veille                           │
└──────────────────────────────────────────────────┘
```

---

### 8. 🔑 Carnet de contacts *(top 5 favoris)*

Accès rapide aux contacts privés du client (avocat, notaire, banquier, concierge).

- **Données** : `user_contacts` where `is_favorite=1`
- **Quota** : 5 max Découverte / illimité Premium
- **Action** : "Demander un brief à mon notaire" → Camille rédige email

```
┌──────────────────────────────────────────────────┐
│  ◆ VOS CONTACTS                                   │
│                                                   │
│  ⚖ Me Dupont       Notaire · Lyon · ⭐           │
│  💼 P. Martin      Avocat fiscal · Paris         │
│  🏦 J. Lambert     Banque privée · Genève        │
│  🛎 SemAlys        Conciergerie · Megève         │
│  👨‍⚕️ Dr Bensimon    Médecine longévité · Paris   │
│                                                   │
│  → + Ajouter un contact (5/5)                     │
└──────────────────────────────────────────────────┘
```

---

### 9. 📈 Allocation marchés *(performance YTD)*

Vue allocation patrimoine financier + drift portefeuille.

- **Données** : actifs financiers déclarés
- **Source** : Stratège (Perplexity sonar marchés temps réel)
- **Tier** : Premium

```
┌──────────────────────────────────────────────────┐
│  ◆ ALLOCATION FINANCIÈRE · YTD 2026   +4,8%      │
│                                                   │
│  Actions Europe  ████████░░  40%   +6,2%         │
│  Actions US      ██████░░░░  30%   +3,1%         │
│  Obligations     ████░░░░░░  20%   +2,8%         │
│  Or              ██░░░░░░░░  10%   +12,4%        │
│                                                   │
│  ⚠ Drift Actions US > +5%                         │
│  → Rebalancer avec Stratège                       │
└──────────────────────────────────────────────────┘
```

---

### 10. 🌳 Transmission *(préparation succession)*

Vue état préparation transmission : pacte Dutreil signé, donation faite, mandat protection future, etc.

- **Données** : checkboxes user_profile + dates
- **Tier** : Premium

```
┌──────────────────────────────────────────────────┐
│  ◆ PRÉPARATION TRANSMISSION                       │
│                                                   │
│  ✅ Cartographie héritiers          J. + P.      │
│  ✅ Engagement Pacte Dutreil        2024-03-15   │
│  ⏳ Donation-partage NP             à planifier   │
│  ❌ Mandat protection future        non signé    │
│  ❌ Conseil de famille              non lancé    │
│                                                   │
│  Risque non-anticipé : élevé                     │
│  → Activer Hermès · 3 priorités                   │
└──────────────────────────────────────────────────┘
```

---

### 11. 🛡 Documents signés *(R2 EU)*

Liste des documents officiels stockés et signés eIDAS.

- **Données** : `user_documents`
- **Action** : "+ Demander un DER / LM"

```
┌──────────────────────────────────────────────────┐
│  ◆ VOS DOCUMENTS                       9 dispo   │
│                                                   │
│  📄 DER bêta 2026-05         signé eIDAS · 18 mai│
│  📄 Lettre de Mission Q2     signé eIDAS · 22 mai│
│  📄 Cartographie société     PDF · 15 mai        │
│  📄 Rapport mensuel mai      PDF Olympe · J+1    │
│  📄 Compte-rendu RDV         PDF · 8 mai         │
│                                                   │
│  → Tout exporter · Demander signature             │
└──────────────────────────────────────────────────┘
```

---

### 12. 🎓 Famille & NextGen

Cartographie famille (enfants, conjoint, ascendants) + parcours éducation/transmission valeurs.

- **Données** : `user_profile.famille_json`
- **Tier** : Premium Family Office

```
┌──────────────────────────────────────────────────┐
│  ◆ VOTRE FAMILLE                                  │
│                                                   │
│  Conjointe       Claire J.    46 ans              │
│  Enfant 1        Théo         18 ans · Le Rosey  │
│  Enfant 2        Léa          15 ans · Aiglon    │
│                                                   │
│  Conseil de famille      ⚪ non actif             │
│  Programme NextGen       ⚪ Aspen 2027 envisagé   │
│                                                   │
│  → Lancer avec Pédagogue                          │
└──────────────────────────────────────────────────┘
```

---

### 13. ✈ Voyage à venir

Prochaines réservations et opportunités calendrier.

- **Données** : `user_alerts` filtré sphere=voyage + `user_documents`
- **Source** : Concierge (Perplexity)

```
┌──────────────────────────────────────────────────┐
│  ◆ VOYAGES PROCHAINS                              │
│                                                   │
│  🏔 Chalet Edelweiss · Megève                     │
│     12-16 juillet 2026 · famille 6 pax            │
│     ✅ Réservé · 2 450 €/nuit                     │
│                                                   │
│  🏖 Yacht Méditerranée · août                     │
│     ⏳ 3 options Concierge en attente             │
│                                                   │
│  ✈ Aviation privée Genève                         │
│     ⚪ Demander à Concierge                       │
└──────────────────────────────────────────────────┘
```

---

### 14. 🤝 Impact philanthropique

Suivi dons + impact fiscal annuel + projets soutenus.

- **Données** : `user_donations` (à créer) + calcul Mécène

```
┌──────────────────────────────────────────────────┐
│  ◆ MÉCÉNAT 2026                                   │
│                                                   │
│  Total dons               180 000 €               │
│  Réduction IR (66%)       -118 800 €              │
│  Réduction IFI (75%)      -50 000 €               │
│                                                   │
│  Causes soutenues :                               │
│  • Fondation patrimoine France                    │
│  • Association Le Rosey scholarship               │
│  • Soutien hôpital pédiatrique Lyon               │
│                                                   │
│  → Structurer en fondation · Mécène               │
└──────────────────────────────────────────────────┘
```

---

### 15. 📊 Synthèse mensuelle Olympe

Rapport agrégé J+1 de tous les autres widgets.

- **Données** : agrégation de tous les widgets
- **Format** : PDF + email (Brevo)
- **Fréquence** : 1er du mois pour le mois précédent

```
┌──────────────────────────────────────────────────┐
│  ◆ SYNTHÈSE MENSUELLE · MAI 2026                  │
│                                                   │
│  ✏ Patrimoine        +120 k€ · +1,4%             │
│  ✏ Échéances        2 traitées · 1 à venir       │
│  ✏ Conversations    12 ce mois (vs 8 en avr)     │
│  ✏ Alertes traitées 7 / 9                        │
│  ✏ Voyages          1 confirmé                    │
│  ✏ Mécénat          +15 k€ vs mois précédent     │
│                                                   │
│  → Télécharger PDF · Recevoir au format magazine  │
└──────────────────────────────────────────────────┘
```

---

## 🎨 Design system commun (cohérent charte Marcel)

```css
--bg:#FAF7F0
--bg-2:#F5EFE0
--ink:#1A1814
--mute:#6B655A
--accent:#C24722   /* terra */
--gold:#C9A96E
--line:rgba(26,24,20,0.10)
--success:#3F7A3F
--warn:#B8801F
--bad:#B91C1C

Card: rounded 14px · border 1px line · padding 22-28px · shadow 0 4px 14px rgba(26,24,20,0.04)
Hover: translateY(-2px) + shadow renforcée + border accent
Header label: 11px letterspaced 0.28em accent uppercase
Title : Fraunces 22-26px italic accent
Status badges : pill rounded 999px · live (vert) / soon (gris-or) / late (transparent)
```

---

## 📐 Layout dashboard suggéré

```
┌──────────────────────────────────────────────────────────────────┐
│  Cassius/Marcel — Maxime · ● 3 alertes nouvelles    [Marcel-Live]│ Header
├──────────────────────────────────────────────────────────────────┤
│  [Patrimoine consolidé donut] [IFI Tracker]   [Veille du jour]   │ Row 1 (3 cols)
├──────────────────────────────────────────────────────────────────┤
│  [Cartographie société]      [Calendrier]      [Mes veilles]     │ Row 2 (3 cols)
├──────────────────────────────────────────────────────────────────┤
│  [Allocation marchés]        [Transmission]    [Carnet contacts] │ Row 3 (3 cols)
├──────────────────────────────────────────────────────────────────┤
│  [Documents signés]          [Voyages]         [Mécénat]         │ Row 4 (3 cols)
├──────────────────────────────────────────────────────────────────┤
│  [Famille NextGen]           [Synthèse mensuelle PDF]            │ Row 5 (2 cols)
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Plan d'implémentation Sprint 2

| Sprint Day | Widgets à coder |
|---|---|
| **J3** | 1. Marcel-Live · 2. Cartographie société · 3. Patrimoine consolidé donut |
| **J4** | 4. IFI Tracker · 5. Calendrier · 6. Veille du jour |
| **J5** | 7. Mes veilles · 8. Carnet contacts · 9. Allocation marchés |
| **J6** | 10. Transmission · 11. Documents · 12. Famille NextGen |
| **J7** | 13. Voyages · 14. Mécénat · 15. Synthèse mensuelle |

Chaque widget = ~50-100 lignes HTML/CSS/JS vanilla, fetch données depuis worker `ikcp-client` ou worker spécialiste.

---

## ⚡ Cas d'usage cross-widget

**Scenario 1 — Le matin** : alertes du jour (widget 6) > clic alerte > Marcel-Live ouvert avec contexte > approfondit avec Codex.

**Scenario 2 — Avant RDV** : cartographie (2) + IFI (4) + Transmission (10) > export PDF Olympe (15) > envoyer notaire via Camille email.

**Scenario 3 — Veille collection** : alerte cote Patek (7) > Joséphine via Marcel-Live > décision achat > document attestation valeur (11).

---

## 🔒 Confidentialité

- Aucun widget ne révèle la stack tech (Anthropic, Perplexity, Pappers, Cloudflare)
- Tous les libellés sont en vocabulaire neutre Marcel
- Mentions sources : seulement sources publiques (Sotheby's, RNE, Légifrance) — pas les outils internes

---

© 2026 IKCP — Marcel · Family Office augmenté · ORIAS 23001568
