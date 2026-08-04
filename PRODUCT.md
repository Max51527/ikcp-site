# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Deux portes d'entrée, un seul produit** (confirmé le 4 août 2026).

- **Le particulier** entre par le **bilan patrimonial**. Il n'a pas nécessairement de société. C'est la porte grand public.
- **Le dirigeant** (chef d'entreprise, TNS, profession libérale) entre par son **SIREN**, qui déclenche une cartographie de sa société. C'est la porte historique, et celle que le code sert le mieux aujourd'hui.

Les deux parcours alimentent le même moteur d'analyse. Le SIREN n'est donc **pas** un prérequis d'entrée dans le produit — il enrichit le dossier quand il existe.

> **Historique :** le virage grand public a été acté le 1ᵉʳ août 2026 (segments par domaine sur l'accueil, « tout part du bilan patrimonial », la verticale entrepreneurs restant sur `/marcel`). La réponse du 4 août précise la forme définitive : deux portes, un seul moteur.
>
> **Conséquence à ne pas sous-estimer :** le bilan patrimonial doit fonctionner de bout en bout **sans société**, ce que l'implémentation actuelle ne garantit pas encore. Les pages d'univers par domaine ne sont pas construites — les segments de l'accueil sont aujourd'hui du texte, pas des liens.

Le cabinet de conseil humain n'est **pas** la cible du produit : il est fermé aux nouveaux clients sauf recommandation renforcée.

## Product Purpose

Donner à chacun les moyens de piloter son patrimoine lui-même, avec une intelligence patrimoniale disponible en continu, là où l'accès au conseil patrimonial est historiquement réservé, cher et intermédié.

Le succès se mesure à l'autonomie réelle de l'utilisateur : il comprend sa situation, il voit des pistes qu'il n'aurait pas identifiées seul, et il décide. Le produit ne décide jamais à sa place.

## Positioning

Trois choses qu'un produit voisin ne pourrait pas revendiquer honnêtement :

1. **Souveraineté technique réelle**, pas déclarative — hébergement et base de données en France (Cloudflare WEUR, D1 Paris), moteur de langage européen activable, aucun service américain dans le pipeline sensible.
2. **Adossement à un cabinet réglementé en exercice** — CIF enregistré ORIAS 23001568, membre CNCEF Patrimoine, également courtier en assurance (COA). Le produit est écrit par un praticien, pas par un éditeur logiciel.
3. **Doctrine propriétaire indexée** — un corpus de fiches patrimoniales rédigées en interne, interrogeable par l'IA, qu'un modèle généraliste ne connaît pas.

## Operating Context

- **Production** : https://ikcp.eu, hébergé sur Cloudflare Pages, déploiement continu depuis GitHub (`Max51527/ikcp-site`).
- **Domaine secondaire** : ikcp.fr, redirection 301 vers .eu **non encore en place** — il capte toujours une part du référencement de marque.
- **Espace membre** : `/app/`, installable en application (PWA), avec un emballage Android publiable sur le Play Store.
- **Surface d'édition** : `/app/redaction` permet de créer et modifier fiches, simulateurs et 22 zones de texte du site sans passer par le code, avec stockage en base D1.
- **Clone de travail unique** : `C:\Users\juven\ikcp-site`. Un incident du 22 mai 2026 (travail écrasé depuis un second clone désynchronisé) impose de synchroniser avant toute modification.

## Capabilities and Constraints

**Ce qui fonctionne réellement aujourd'hui**

- Connexion par lien envoyé par courriel (sans mot de passe), session d'environ 30 jours.
- Bilan patrimonial, simulateurs à barèmes fiscaux 2026 vérifiés, cartographie de société par SIREN.
- Marcel et ses agents spécialisés, avec un corpus documentaire interne interrogeable.
- Édition en direct du contenu du site et des fiches depuis l'espace membre.

**Contraintes techniques durables**

- HTML plat, sans étape de compilation, sans framework. Toute contribution doit tenir dans cette contrainte.
- Le contenu textuel existe en double : dans le HTML **et** dans les fichiers de données. Modifier l'un sans l'autre fait réapparaître l'ancien texte.
- Une mémoire tampon de 60 secondes retarde l'affichage des modifications de contenu.
- Le responsive mobile est une exigence, pas une option.

**Contraintes réglementaires — non négociables**

- Aucune recommandation personnalisée sans lettre de mission (art. L.541-1 du Code monétaire et financier). Les outils et l'IA livrent de l'information, des scénarios neutres et des **pistes de réflexion**, et se terminent par une question — jamais par un verdict.
- Mention obligatoire ORIAS 23001568 et du statut CIF en pied de page.
- Le produit ne fait jamais de comptabilité (monopole de l'Ordre des experts-comptables).
- Tout le contenu public doit être littéralement vrai (art. L.121-2 du Code de la consommation) : ce qui est en projet est affiché comme tel, jamais comme livré.

**Faits explicitement non arbitrés**

- Le bilan patrimonial pour un utilisateur sans société : parcours à concevoir.
- L'agrégation bancaire (Powens) est configurée mais volontairement inactive. Trois emplacements l'attendent dans l'interface. Ne rien y activer sans demande explicite.
- La signature électronique conforme eIDAS est en pause.

## Brand Commitments

- **Nom** : IKCP — IKIGAÏ Conseil Patrimonial. **Marcel** est le nom de l'intelligence patrimoniale, pas celui de l'entreprise.
- **Typographies** : Playfair Display (titres) et Outfit (corps). JetBrains Mono pour les données.
- **Palette** : navy `#1B2A4A`, navy profond `#0E1729`, crème `#FAF8F4`, or `#C9A96E`, or clair `#E2C896`, or profond `#8B6F3F`, encre `#221E18`.
- **Symbole** : la montgolfière tricolore à panier doré. Clin d'œil au premier vol humain (Annonay, 1783) — évocation d'un héritage, jamais une revendication de filiation.
- **Voix** : vouvoiement systématique, français professionnel sans anglicismes inutiles, pédagogique sans condescendance. Formulations inclusives.
- **Interdits de nommage côté public** : ne jamais nommer les fournisseurs techniques (moteurs de langage, sources de données, agrégateur), ni « Claude ». Dire « intelligence patrimoniale souveraine ».
- **Interdit de vocabulaire** : la « méthode 3R » est un cadre de travail interne. Elle n'apparaît jamais dans ce qui est livré au client.

## Evidence on Hand

**Réel et utilisable**

- Cabinet en exercice : ORIAS 23001568, SIREN 947 972 436, CIF et COA. Lyon, Annonay, Megève.
- Environ 70 pages publiques de référencement local (Ardèche, Annonay, Aubenas…), confirmées le 4 août 2026 comme **actif durable à préserver et entretenir**. Tout travail futur doit les respecter.
- Mesure de référencement sur 28 jours : 391 impressions, 8 clics, taux de clic 2 %. Meilleure opportunité identifiée : « simulateur succession famille recomposée » (161 impressions, 2 clics).
- Corpus de fiches patrimoniales indexé et interrogeable par l'IA.
- Un concurrent identifié en Ardèche (Forsis Family), ce qui impose de qualifier toute revendication d'antériorité.

**Absences à ne jamais combler par invention**

- **Aucun témoignage client, aucune étude de cas, aucune mention de presse.**
- **Aucun client payant à ce jour** — l'encaissement n'est pas ouvert.
- Aucun chiffre d'usage, aucun nombre d'utilisateurs, aucun montant d'encours à afficher.

## Product Principles

1. **La souveraineté du client prime.** Il pilote, il décide. Le produit n'engage jamais de démarche non sollicitée.
2. **Livrer de l'exclusif, pas du généraliste.** Chaque piste doit apporter ce qu'une IA grand public ne sait pas : un chiffrage avant/après, un outil maison, une doctrine interne. Sinon elle ne mérite pas d'être affichée.
3. **Informer, ne jamais prescrire.** La frontière réglementaire n'est pas une contrainte subie, c'est la forme même du produit : information, scénarios, question ouverte.
4. **Le vrai avant le flatteur.** Ce qui est en projet est affiché comme projet. Aucune capacité n'est annoncée avant d'exister.
5. **Expliquer chaque terme technique.** L'utilisateur apprend en se servant du produit. Un mot de métier non expliqué est un défaut.

## Accessibility & Inclusion

Aucune norme d'accessibilité formelle n'a été arrêtée à ce stade. Deux exigences produit confirmées tiennent lieu de socle : le responsive mobile complet, et l'explication systématique du vocabulaire technique — le produit s'adresse à des gens compétents dans leur métier, pas dans le patrimoine.
