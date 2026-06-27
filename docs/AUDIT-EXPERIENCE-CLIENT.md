# Audit expérience client — Marcel IA (26 juin 2026)

> Évaluation dans la peau d'un dirigeant cible (1-30 M€) + test live du moteur. Note moyenne parcours : **7,4/10** — bon produit, freiné par des incohérences de parcours.

## Test live (moteur réel)
| Étape | Résultat |
|---|---|
| SIREN → cartographie société (Pappers) | ✅ 200 (IKIGAÏ CONSEIL PATRIMONIAL, EURL) |
| Marcel analyse | ✅ réponse pertinente, sourcée — **mais 38 s (lent)** |
| Moteur pistes `/opportunites` | ⚠️ vide sur chiffres société (attend les *biens* du cockpit) |

## Notes par étape
creer-mon-compte 8,5 · home (mock) 6 · dashboard 6,5 · marcel 8 · simulateurs 7,5 · décryptage 8 · avis 8,5 · cabinet 7,5.

## Top 5 frictions (où un dirigeant décroche)
1. **CTA « Passer en Premium » mène nulle part** (Stripe pas ouvert ; `alert('Démo')` dans home.html).
2. **Deux apps se contredisent** : `home.html` (mock mobile, patrimoine fictif « 2,4 M€ », nomme « Mistral ») vs `dashboard.html` (vrai).
3. **1er login = dashboard à moitié vide** + greeting faux (« veille parcourue cette nuit »).
4. **Freemium frustre** : 8/12 simulateurs 🔒, 5/6 spécialistes 🔒, aucun aperçu de résultat.
5. **Incohérences** : exemple SIREN Danone, liens vers `/app/home` (mock) et `/family-office` (abandonné).

## ✅ Corrigé (commit e7600f1)
- « Mistral » retiré côté client (dashboard) → « moteur d'IA français souverain ».
- Greeting dashboard : plus de « veille cette nuit » faux pour un nouvel inscrit.
- Exemple SIREN Danone → placeholder neutre (cabinet).
- Lien décryptage `/app/home` → `/app/dashboard`.

## ⏳ Décisions / améliorations restantes (priorisé)
1. **home.html (mock à données fictives)** : déprécier (rediriger `/app/home`→`/app/dashboard`) OU le câbler au réel. **Reco : déprécier** (risque véracité L.121-2). — décision Maxime.
2. **CTA Premium** tant que Stripe fermé : remplacer « Passer en Premium » par **« Rejoindre la bêta — 6 mois Premium offerts »** → `beta-invite`. — décision Maxime.
3. **Freemium** : afficher le **résultat flouté** (« ●●● € → Premium ») au lieu d'un mur ; ouvrir 1 simulateur stratégie de plus en gratuit (produit d'appel). — MT.
4. **Marcel 38 s** : optimiser la latence (boucle d'outils + Mistral large). — perf.
5. **Mettre `avis` + cartographie SIREN en héros du dashboard** (les 2 « WOW gratuits » qui prouvent l'IA en 10 s). — conversion.

## Conformité (bon point)
Disclaimer MIF II (L.541-1) présent partout, Marcel finit par une question, ORIAS systématique. Solide.
Vérifié : OCR `avis` = stateless (le document n'est pas persisté) → la promesse « jamais stocké » tient.
