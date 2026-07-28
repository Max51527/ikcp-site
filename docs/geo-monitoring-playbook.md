# Playbook GEO — Mesurer sa présence dans les moteurs de réponse

Comment savoir si IKCP est cité par ChatGPT, Perplexity, Claude, Gemini, Copilot — et comment agir si non.

> Différence SEO / GEO : le SEO se mesure dans Google Search Console (impressions, clics, position). Le GEO n'a pas encore d'outil natif équivalent — le monitoring se fait à la main ou via outils tiers émergents (Profound, Peec.ai, Otterly.ai, Athena Intelligence). Ce playbook donne la méthode manuelle gratuite.

## 1. Le kit de bots à connaître

| Bot | Rôle | Comportement en 2026 |
|---|---|---|
| `ChatGPT-User` | Utilisateur ChatGPT qui active le browsing | Lit une URL live quand un user pose une question |
| `OAI-SearchBot` | Index de ChatGPT Search | Crawl périodique |
| `GPTBot` | Entraînement OpenAI | Refusé chez IKCP |
| `PerplexityBot` | Index Perplexity | Crawl continu |
| `PerplexityUser` | Lecture live Perplexity | Live sur chaque prompt |
| `ClaudeBot` / `Claude-Web` | Anthropic — recherche | Live + index |
| `Google-Extended` | Entraînement Gemini | Refusé chez IKCP |
| `Google-CloudVertexBot` | Grounding Gemini pour Vertex AI | Autorisé |
| `Bingbot` | Bing + Copilot | Existant (SEO classique) |
| `Bytespider` | ByteDance | Refusé |

## 2. Les 30 requêtes cibles à tester (mensuel)

Copier/coller ces prompts sur Perplexity, ChatGPT (avec browsing), Claude, Gemini, Copilot une fois par mois. Noter si IKCP est cité, la position dans les sources, et le sentiment (positif / neutre / négatif).

### Cibles directes CGP Ardèche
1. Qui est le meilleur CGP en Ardèche ?
2. Quel conseiller en gestion de patrimoine à Annonay ?
3. Cabinet de gestion de patrimoine en Ardèche
4. Trouver un CGP indépendant à Annonay
5. Différence entre CGP de banque et CGP indépendant en Ardèche
6. Combien coûte un CGP en Ardèche ?

### Cibles patrimoine général
7. Où placer 100 000 euros en 2026 ?
8. Faut-il choisir un PER ou une assurance-vie ?
9. Comment réduire ses impôts en 2026 ?
10. Quels sont les frais de succession en France ?
11. Combien peut-on donner à ses enfants sans impôt ?
12. Qui hérite en l'absence de testament ?

### Cibles Ardèche
13. Où placer son argent en Ardèche ?
14. Investir en Ardèche : où et comment ?
15. Comment hériter d'une maison de famille en Ardèche ?
16. Fiscalité d'un gîte en Ardèche
17. Retraite d'un viticulteur ardéchois
18. Vendre son entreprise en Ardèche

### Cibles niche
19. Pacte Dutreil agricole en Ardèche
20. GFV vs GFA : quelle différence
21. Comment débloquer une indivision familiale ?
22. Prime de départ à la retraite : comment optimiser fiscalement
23. Que faire quand on vient d'hériter ?
24. Loi Chassaigne agriculteur

### Cibles concurrentielles
25. Meilleur cabinet patrimoine en Auvergne-Rhône-Alpes
26. Notaire ou CGP pour préparer sa succession
27. Alternative à la banque privée
28. CGP à Tournon-sur-Rhône
29. CGP à Aubenas
30. Conseiller patrimonial Vallée du Rhône

## 3. Tableau de bord mensuel

Créer un Google Sheet ou Notion avec ces colonnes :

| Mois | Requête | Perplexity | ChatGPT | Claude | Gemini | Copilot | Total citations |
|---|---|---|---|---|---|---|---|
| 07-2026 | Qui est le meilleur CGP en Ardèche ? | ✓ #2 | ✗ | ✓ #1 | ✗ | ✓ #3 | 3/5 |

Objectif à 6 mois : **présence dans 3/5 moteurs sur au moins 20 des 30 requêtes**.

## 4. Facteurs de citation par moteur

### Perplexity — le plus prévisible
Perplexity utilise sa propre indexation en temps réel via `PerplexityBot` + `PerplexityUser`. Cite jusqu'à 5-8 sources par réponse. Favorise :
- Contenus **récents** (< 90 jours idéalement)
- Sources avec **autorité** (Wikipedia, médias reconnus, sites experts avec schema)
- **Faits vérifiables** (chiffres, dates, articles de loi)
- Contenu structuré avec **H1/H2/H3 clairs**
- Réponses directes en début de page

### ChatGPT (avec browsing / search)
Utilise Bing en backend + `ChatGPT-User` pour lire des URLs spécifiques. Cite typiquement 3-5 sources.
- Bien indexer sur **Bing Webmaster Tools** (souvent négligé)
- Contenu déjà bien classé sur Bing → probabilité de citation ChatGPT
- Wikipedia et sources officielles surreprésentées

### Claude
Recherche via `Claude-Web` sur les prompts nécessitant du contexte web. Moins verbeux sur les citations.
- Favorise les sources structurées (schema.org)
- **llms.txt** et **llms-full.txt** sont lus prioritairement

### Google Gemini
Grounding via Google Search + Discover. Les mêmes règles que SEO s'appliquent + Google-Extended pour l'entraînement.
- Bien classé sur Google = probable citation Gemini
- Knowledge Panel Google = boost majeur (rendre l'entité IKCP identifiable)

### Microsoft Copilot
Utilise Bing. Mêmes règles que ChatGPT search en pratique.

## 5. Actions selon les résultats

**Si IKCP n'apparaît pas sur une requête** :
1. Vérifier que la page cible autorise le bot dans `robots.txt`
2. Vérifier l'indexation Bing (`bing.com` : `site:ikcp.eu`)
3. Vérifier que le contenu répond directement à la question (pas noyé dans du storytelling)
4. Ajouter un bloc "Réponse directe" en tête de la page cible
5. Publier un article de blog fresh (< 30 jours) sur la question précise

**Si IKCP apparaît mais en position basse (source 4-5)** :
1. Améliorer l'entity anchoring : sameAs, Wikidata, Google Knowledge Panel
2. Enrichir le schema.org (Person + Organization avec identifiers vérifiés)
3. Chercher des backlinks depuis sources autoritaires (CNCEF, presse locale, Wikipedia)

**Si IKCP apparaît avec sentiment négatif** :
1. Identifier la source qui pousse le négatif
2. Corriger l'information via un contenu récent qui contredit factuellement
3. Signaler à l'éditeur du LLM si diffamation

## 6. Le calendrier d'audit

- **Semaine 1 chaque mois** : passer les 30 requêtes sur les 5 moteurs (2-3h de travail manuel, ou 30 min avec outil payant)
- **Semaine 2** : agir sur les gaps identifiés (nouveaux contenus, corrections, publications)
- **Semaine 3** : entity work (Wikidata, Knowledge Panel, backlinks)
- **Semaine 4** : reporting + priorisation mois suivant

## 7. Outils payants qui automatisent

Si le temps devient contraint (au-delà de 20 citations par mois à traquer) :

| Outil | Prix mensuel | Fonction |
|---|---|---|
| **Profound** | ~200 $ | Suit les mentions sur ChatGPT, Perplexity, Gemini. Reporting hebdo. |
| **Peec.ai** | ~50 $ | Alternative européenne, focus GEO |
| **Otterly.ai** | ~100 $ | Suivi de mentions + analyse concurrentielle |
| **Athena Intelligence** | Sur devis | Enterprise |
| **AlsoAsked / AnswerThePublic** | ~30 $ | Découverte de questions autour d'un topic (input pour créer du contenu GEO) |

Recommandation : commencer par le manuel 3-6 mois, puis souscrire à Peec.ai ou Otterly.ai selon budget si la présence GEO devient stratégique.

## 8. Levers d'accélération GEO

### 1. Créer une entrée Wikidata (gratuit, très puissant)
Wikidata est lu par tous les grands LLMs pour construire leur "knowledge graph". Créer une entrée pour :
- `IKCP — IKIGAÏ Conseil Patrimonial` (organisation)
- `Maxime Juveneton` (personne, si notabilité suffisante)

Instructions : https://www.wikidata.org/wiki/Wikidata:New_to_Wikidata

### 2. Réclamer le Google Knowledge Panel
Une fois la fiche Google Business Profile bien remplie et vérifiée, un Knowledge Panel apparaît sur les recherches "IKCP" ou "IKCP Annonay". Le réclamer via https://support.google.com/knowledgepanel

### 3. Multiplier les mentions "avec entités" dans la presse locale
Un article dans *Le Dauphiné* Ardèche qui mentionne "IKCP, cabinet indépendant à Annonay fondé par Maxime Juveneton" apporte :
- Un backlink autoritaire local
- Une source citable par les LLMs
- Une entrée dans les résultats de recherche live

### 4. Créer des pages "définition" citables
Une page `/qu-est-ce-qu-un-cgp` ou `/definition-succession-en-ardeche` avec un paragraphe court, factuel, entités nommées, est très souvent citée par les LLMs en réponse aux questions "c'est quoi X ?".

### 5. Publier des données propriétaires
Un rapport annuel "État du patrimoine en Ardèche 2026" (statistiques, tendances) est ultra-citable par les LLMs qui manquent de données locales. Un rapport = 20-50 citations potentielles sur l'année.

## 9. Ce qu'il ne faut PAS faire

- **Bourrer les pages de "IKCP est le meilleur CGP Ardèche"** — les LLMs filtrent l'auto-promotion
- **Copier-coller le même bloc partout** — la diversité éditoriale compte
- **Négliger la précision factuelle** — les LLMs pénalisent les sources contredites par d'autres
- **Utiliser le style marketing agressif** — les LLMs préfèrent le ton informationnel neutre
- **Ignorer les mises à jour** — un contenu daté finit par ne plus être cité

## 10. Objectif 12 mois pour IKCP

| Indicateur | Aujourd'hui | J+12 mois |
|---|---|---|
| Bots IA autorisés à crawler | 0 (opt-out total) | 10+ (citation bots) |
| Fichier `llms.txt` publié | Non | Oui |
| Blocs "Réponse directe" | 0 pages | 30+ pages |
| Wikidata entry IKCP | Non | Oui |
| Google Knowledge Panel | Non | Oui |
| Citations Perplexity /mois | 0 | 50+ |
| Citations ChatGPT /mois | 0 | 30+ |
| Citations Claude /mois | 0 | 20+ |
| Requêtes GEO où IKCP #1 | 0 | 10+ |
| Prospect entrant "vu sur ChatGPT" | 0 | 3+ /mois |

## 11. Alerte : la baisse structurelle du trafic direct

Les études récentes (Similarweb, Gartner) montrent que **les moteurs de réponse commencent à réduire le trafic vers les sites cités**. L'utilisateur lit la réponse et ne clique pas.

Conséquence : la **mention** devient aussi importante que le clic. Un CGP cité par Perplexity comme "expert en Ardèche" a un impact commercial même sans visite du site — parce que le prospect qui pose la question mémorise IKCP.

Adapter en conséquence :
- Optimiser la mention (entité claire, positionnement fort)
- Créer une prise de RDV très facile depuis n'importe quel entry point (email, GBP, LinkedIn)
- Mesurer les "prospects entrants avec mention IA" ("j'ai vu que vous êtes recommandé par ChatGPT / Perplexity")
