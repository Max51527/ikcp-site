# ikcp-patrimoine — Base patrimoniale unifiée + moteur de stratégies

> Le **socle du « OS patrimonial »** (blueprint MARCEL §5.1, §8, §9, §14).
> Souverain FR : D1 Paris/WEUR, jamais hors UE. Contient des **données client** (la
> base réelle, pas ce dépôt) → le `.sql`/`.json` ici = structure + référentiel seuls.

## Pièces

| Fichier | Rôle | Blueprint |
|---|---|---|
| `schema.sql` | Modèle objet patrimonial (personnes, sociétés, actifs, dettes, bénéficiaires, documents, objectifs, recommandations, événements) | §14 |
| `strategies.json` | Référentiel des stratégies (fiches §10) + règles d'éligibilité | §8 / §10 |
| `worker.js` *(à venir)* | API : CRUD patrimoine + moteur d'opportunités + alimentation Marcel | §9 / §13 |

## La chaîne de valeur (comment tout s'enchaîne)

```
SIREN (Pappers) ─┐
Powens /wealth ──┼─► base patrimoniale unifiée (D1)
saisie guidée ───┘            │
                             ▼
              MOTEUR D'OPPORTUNITÉS (§9)
   matche strategies.json[].score_eligibilite.regles
                             │
                             ▼
            strategies_eligibles (score + déclencheur)
                             │
                             ▼
        MARCEL explique l'hypothèse (Mistral souverain)
        → information / simulation, JAMAIS reco sans validation humaine
        → disclaimer MIF II L.541-1, finit par une question
                             │
                             ▼
        recommandations (statut: brouillon → revue_humaine → validée par CIF)
```

## Moteur d'opportunités — logique (§9)

Pour chaque membre, on évalue les `regles` de chaque fiche sur ses données :
- concentration sur société d'exploitation → `holding_patrimoniale`
- dirigeant + société IS → `arbitrage_remuneration_dividendes`
- enfants + actifs significatifs (ou clause bénéf. obsolète) → `donation_demembrement`

Chaque match crée une ligne `strategies_eligibles` (score pondéré + règle déclencheuse).
**Jamais de conseil automatique** : le moteur produit des *hypothèses argumentées*,
Marcel les *explique*, un humain CIF (ORIAS 23001568) les *valide* avant transmission.

## Garde-fous (gravés)

- 3 niveaux distincts : **information / simulation / recommandation** (champ `recommandations.niveau`).
- Toute reco passe par `statut: revue_humaine` avant `validée` — audit trail natif.
- Source + fraîcheur de chaque donnée visibles (`source_donnee`, `date_actualisation`).
- Données sensibles classées (`sensibilite` 1-3) pour la gouvernance IA (minimisation des prompts).

## Déploiement (quand le worker sera prêt)

```bash
wrangler d1 create ikcp-patrimoine-db
wrangler d1 execute ikcp-patrimoine-db --file=schema.sql
# bind PATRIMOINE_DB dans wrangler.toml, puis wrangler deploy
```
