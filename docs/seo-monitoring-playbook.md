# Playbook de monitoring SEO — IKCP Ardèche

Comment piloter ta visibilité organique sous 90 jours, après le merge des PR SEO.

## 1. Stack de monitoring (gratuit)

| Outil | Utilité | Cadence |
|---|---|---|
| **Google Search Console** | Position, impressions, CTR, indexation, erreurs | Quotidien |
| **Google Analytics 4** | Trafic, sources, conversions, comportement | Hebdo |
| **Microsoft Clarity** (déjà en place : `wk8zwtijmf`) | Heatmaps, replays, points de friction | Hebdo |
| **Google Business Profile Insights** | Vues fiche, appels, clics direction, recherches | Hebdo |
| **Bing Webmaster Tools** | Indexation Bing/DuckDuckGo (souvent oublié) | Mensuel |

À configurer **immédiatement après merge** :
- Soumettre les 2 sitemaps (`sitemap.xml` + `sitemap-images.xml`) dans GSC et BWT
- Activer les alertes par mail (Couverture, Performance, Améliorations)

## 2. Les 30 requêtes cibles à suivre

Créer dans GSC un **groupe de requêtes** "Cibles IKCP" pour les surveiller en bloc.

### Tier 1 — Priorité maximale (top 3 visé sous 90 j)
1. cgp ardèche
2. cgp annonay
3. conseil gestion patrimoine ardèche
4. cabinet patrimoine ardèche
5. conseiller patrimonial annonay
6. gestion de patrimoine ardèche
7. cgp indépendant ardèche
8. conseiller patrimoine annonay

### Tier 2 — Volume (top 5 visé)
9. où placer son argent en ardèche
10. placer 100000 euros
11. investir en ardèche
12. préparer sa retraite ardèche
13. réduire ses impôts ardèche
14. hériter en ardèche
15. succession ardèche
16. donation ardèche

### Tier 3 — Longue traîne (top 3 quasi-certain car niche)
17. vendre vignoble ardèche
18. transmettre cabinet médical ardèche
19. indivision bloquée ardèche
20. céder gîte ardèche
21. reprise exploitation familiale ardèche

### Tier 4 — Comparatifs (top 5 visé)
22. per ou assurance vie
23. cgp ou notaire
24. banque privée ou cgp indépendant

### Tier 5 — Que faire si…
25. je viens d'hériter que faire
26. je vends ma maison que faire
27. je touche une prime de départ
28. je divorce patrimoine
29. je paye trop d'impôts
30. mon conjoint est décédé

## 3. KPI hebdomadaires

À surveiller tous les lundis matin :

| Indicateur | Source | Seuil d'alerte |
|---|---|---|
| Impressions GSC totales | GSC > Performances | < +10 % semaine/semaine |
| Position moyenne "cgp ardèche" | GSC | Stable ou recule |
| Pages indexées | GSC > Couverture | Baisse > 5 % |
| Trafic organique GA4 | GA4 > Acquisition | < +10 % semaine/semaine |
| Avis Google (note moyenne) | GBP | Note < 4.7 |
| Nouveaux backlinks | Outil tiers (Ahrefs free, Ubersuggest) | 0 nouveau backlink/mois |

## 4. Routine mensuelle (60 min)

Le 1er du mois :

1. **Rapport GSC** — Exporter les 90 dernières journées, comparer aux 90 précédentes (% impressions, % clics, position moyenne)
2. **Rapport GA4** — Sessions organiques par page de destination, top 20 pages, taux d'engagement
3. **Pages à booster** — Identifier les pages positionnées #4 à #10 (effort/impact optimal pour gagner du #1-#3)
4. **Audit technique** — GSC > Améliorations (Core Web Vitals, ergonomie mobile, expérience page)
5. **Backlinks** — Lister les nouveaux backlinks reçus, les remercier si pertinent
6. **Concurrence** — Top 3 actuel sur "cgp ardèche" : nouveaux contenus ? Évolutions ?

## 5. Que faire si la position stagne

Diagnostic en cascade :

**Si l'impression est faible (< 50 impressions/jour sur "cgp ardèche")** :
- Indexation : vérifier dans GSC > Inspection URL
- Pertinence : le contenu de la homepage répond-il à l'intent ?
- Autorité : combien de backlinks pointent vers la home ?

**Si l'impression est haute mais le CTR < 5 %** :
- Title et meta description : trop génériques, pas assez aguicheurs
- Position dans la SERP : si #8-10, optimiser pour gagner 3 places

**Si la position oscille entre 5 et 15** :
- Renforcer le contenu : ajouter 500-1 000 mots, des FAQ, des schémas
- Maillage interne : 5-10 liens depuis d'autres pages vers la home
- Backlinks externes : citations PagesJaunes, CNCEF, partenaires

**Si la position chute brutalement (> 5 places)** :
- Vérifier les algorithmes Google récents (Core Update, Spam Update)
- Vérifier les pénalités manuelles dans GSC > Sécurité et actions manuelles
- Diagnostiquer l'indexation et la performance technique

## 6. Quick wins à activer en parallèle

### Backlinks ciblés Ardèche
- **CCI Ardèche** : demander une fiche dans leur annuaire
- **CNCEF Patrimoine** : annuaire pro (gratuit, autoritaire)
- **PagesJaunes** : fiche pro gratuite
- **Yelp France**, **Hoodspot**, **118000.fr** : citations gratuites
- **Mairie d'Annonay**, **CC Annonay Rhône-Agglo** : partenariats locaux

### Mentions médias locales
- *Le Dauphiné* (édition Ardèche), *L'Hebdo de l'Ardèche*, *France 3 AURA* : sujets sur la transmission familiale, fiscalité agricole, IFI
- Une mention médias = backlink local + autorité = boost SEO durable

### Profils sociaux à compléter
- LinkedIn page entreprise (séparée du perso, à créer si pas fait)
- Instagram (existe déjà : @ikcp.patrimoine) — relayer chaque article
- Facebook (existe) — relayer chaque article

### Avis Google
- **Objectif 90 j** : passer de X à X+15 avis avec note ≥ 4,8
- **Action** : email type post-mission avec lien direct vers la fiche
- **Réponse** : 100 % des avis sous 48h en réutilisant les keywords ("succession en Ardèche", "patrimoine Annonay")

## 7. Tableau de bord recommandé

Créer un Google Sheet ou Notion avec ces colonnes :

| Semaine | Impressions | Clics | Position "cgp ardèche" | Position "où placer argent ardèche" | Nouveaux avis | Backlinks | Actions semaine |
|---|---|---|---|---|---|---|---|

Mise à jour : tous les lundis matin, 10 minutes.

## 8. Calendrier de relance contenu

| Trimestre | Action |
|---|---|
| **T3 2026 (juil-sept)** | 1 article de blog/mois + 8 posts GBP. Cible : vendanges, rentrée fiscale. |
| **T4 2026 (oct-déc)** | 1 article/mois + 8 posts GBP. Cible : fin d'année fiscale, dons aux œuvres, déclaration IFI 2026. |
| **T1 2027 (jan-mars)** | 1 article/mois + 8 posts GBP. Cible : déclaration de revenus, bilan patrimonial annuel. |
| **T2 2027 (avr-juin)** | 1 article/mois + 8 posts GBP. Cible : déclaration IFI, retraite, transmission. |

## 9. Objectifs 90 jours (post-merge)

| Indicateur | Aujourd'hui | J+90 |
|---|---|---|
| Pages indexées | ~75 | 110+ |
| Impressions GSC totales/mois | inconnu | × 3 |
| Position "cgp ardèche" | inconnue | ≤ 3 |
| Position "cgp annonay" | inconnue | 1 |
| Position "où placer son argent en ardèche" | aucune | ≤ 10 |
| Pages avec position ≤ 10 sur cibles | inconnu | 15+ |
| Avis Google | actuel | actuel + 15 |
| Note moyenne Google | actuel | ≥ 4,8 |
| Trafic organique GA4 | actuel | × 2,5 |
| Demandes de RDV depuis le site | actuel | × 2 |

## 10. Quand consulter un expert SEO externe

Garder en tête : avec le travail effectué (schema complet, 30+ pages langage naturel, blog, maillage), tu as déjà un niveau supérieur à 95 % des CGP français. Pas besoin d'agence SEO dans l'immédiat.

À envisager seulement si :
- Après 6 mois, la position "cgp ardèche" n'est pas #1
- Un concurrent national (Indépendant Patrimoine, BoursoBank Wealth) s'implante en Ardèche avec une stratégie SEO agressive
- Volonté d'étendre à Lyon ou au-delà
