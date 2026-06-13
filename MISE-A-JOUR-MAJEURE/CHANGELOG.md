# MISE À JOUR MAJEURE — Changelog Sprint 1 → Sprint 2

> Session : 19 mai 2026  
> Auteur : Maxime Juveneton — IKCP · ORIAS 23001568  
> Repo : https://github.com/Max51527/ikcp-site

---

## ✅ LIVRÉ — Sprint 1.5 (mai 2026)

### 1. Widget Marcel Chat — page publique family-office.html
- FAB flottant (coin bas-droit, fond navy + ✦ gold)
- Panel chat 380 × 580 px, scroll auto, input with envoi Enter
- Branchement réel `ikcp-chat.maxime-ead.workers.dev/chat`
- Bouton d'envoi : montgolfière SVG Annonay 1783 (remplace paperclip)
- Filigrane constellation 11 agents IA (orbites SVG animées CSS)
- Disclaimer MIF II art. L.541-1 en fin de chaque réponse Marcel

### 2. Application mobile → "En cours de développement"
- `family-office.html` : section hero + section app
- `proposals/family-office-D-epure.html`
- `proposals/family-office-v4.html`
- Partout : badge 🔨 · "Application disponible Q4 2026"

### 3. Suppression claims marketing trompeurs (conformité MIF II)
- Supprimé : "Une cave Pétrus devient un actif IFI déclaré. Un yacht devient une SCI fiscalisée. Une collection auto devient un levier de transmission."
- Supprimé : "Marcel vous aide à vivre ces passions — et à les structurer."
- Remplacé dans `family-office.html` : copie descriptive neutre, sans promesse fiscal/juridique
- Corrigé dans `app/collections.html` : suggestion proactive SCI → question neutre à Marcel
- Fichiers traités : `family-office.html`, `app/collections.html`, `proposals/family-office-D-epure.html`, `proposals/family-office-v4.html`

### 4. Espace Membre — Vue "Mes biens" enrichie
- Upload photo custom (FileReader API, 100% client-side, RGPD compliant)
- Filigrane IA sur chaque bien immobilier : valeur estimée + tendance + δ annuel
- Graphiques Chart.js 4.4.0 : projection valeur sur 5 ans (historique gold + projeté dashed)
  - Paris 16e, Ardèche, Lyon Presqu'île
- Bloc financement : capital restant dû, mensualité, taux, LTV bar
- Layout immo-card : 2 colonnes (photo 260px | détails), 5 vignettes actif

### 5. Constellation agents IA — filigrane chat
- SVG animé 600×480, 11 agents sur 2 anneaux orbitaux
  - Inner ring (90s CW) : Codex, Hermès, Athéna, Auguste, Léon
  - Outer ring (140s CCW) : Noé, Neptune, Clio, Sirius, Écho, Zéphyr
- Marcel au centre (cercle 52px, gold gradient)
- Opacity : 0.07 au repos → 0.12 au hover panel

### 6. Bouton envoi : montgolfière SVG
- Remplace le bouton flèche/paperclip
- SVG inline 20×26 : enveloppe principale, séparation centrale, filets latéraux, cordes, nacelle
- Couleur : currentColor (adapte au thème clair/sombre)

### 7. SIREN retiré des zones client-facing
- `proposals/ikcp-eu-onglet-family-office.html` : placeholder `"Votre SIREN — 9 chiffres"` (sans `947 972 436`)
- Note : SIREN conservé dans footer légal (obligation ORIAS/réglementaire)

### 8. 9 univers Lifestyle — espace membre
- Section dédiée dans `view-univers` avec grille 3×3
- 9 cards colorées : Auto, Horlogerie, Vins, Yachting, Équestre, Golf, Arts, Voyages, Gastronomie
- Chaque card : `onclick="askMarcel('...')"` avec prompt pré-rempli contextualisé
- Accès direct depuis sidebar + vue-univers

---

## 🔜 ROADMAP — Sprint 2 (juin-juillet 2026)

### Priorité 1 — DNS & Déploiement
- [ ] Mettre à jour DNS Hostinger → pointer vers `ikcp-eu.pages.dev`
- [ ] Vérifier que ikcp.eu reflète la version GitHub (actuellement vieux Hostinger)

### Priorité 2 — Authentification espace membre
- [ ] Magic link email (Worker `ikcp-client`)
- [ ] Session KV Cloudflare (TTL 7j)
- [ ] Route protégée `/espace-membre`

### Priorité 3 — Marcel niveau 2 AMF (aligné lignes directrices avril 2026)
- [ ] Délégation automatique Marcel → Codex (questions fiscales)
- [ ] Délégation Marcel → Hermès (questions patrimoniales)
- [ ] Branchement `ikcp-codex` dans pipeline Marcel

### Priorité 4 — Funnel SIREN enrichi
- [ ] Cartographie Pappers → affichage interactif dans membre
- [ ] Scoring qualification bêta (cap 10k€, 5 ans, dirigeant BE)
- [ ] Email de confirmation post-inscription bêta

### Priorité 5 — Application mobile PWA (Q4 2026)
- [ ] Service Worker + manifest.json
- [ ] Push notifications patrimoine
- [ ] Offline mode tableau de bord

### Priorité 6 — SaaS B2B white-label CGP (Sprint 5-6 après 3 familles fondatrices)
- [ ] Multi-tenant architecture Workers
- [ ] Interface CGP (branding personnalisable)
- [ ] Cible : 100 cabinets × 500 €/mois

---

## 📋 Règles projet non-négociables (rappel)

1. **Jamais "Claude"** côté client → "intelligence souveraine", "agents IA souverains"
2. **Marcel termine par une question**, jamais par une recommandation produit (MIF II)
3. **SIREN 947972436** ne s'affiche PAS dans les mockups client-facing
4. **Secrets via `wrangler secret put`** uniquement, jamais dans le code
5. **Données en WEUR** (Paris/Frankfurt) — aucun service US dans pipeline sensible

---

*© 2026 IKCP · Maxime Juveneton · ORIAS 23001568 · Tous droits réservés*
