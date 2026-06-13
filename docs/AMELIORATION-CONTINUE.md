# 🔁 Amélioration continue — IKCP Family Office

> Principe (validé Maxime 2026-06-02) : **tout doit être parfait**. Boucle permanente
> critique → correction → déploiement → nouvelle critique. Ce fichier est le backlog
> vivant ; chaque session on dépile par ordre d'impact et on rouvre une critique.

---

## ✅ Fait (session 2026-06-02)

- **Bug critique** : chat Marcel de la home cassé (mauvais worker `ikcp-marcel`) → repointé sur `ikcp-chat`. Vitrine de conversion réparée.
- **Fix cache** : `_headers` no-cache sur les JS → fini le code périmé qui faisait planter Marcel/cartographie après déploiement.
- **Fix CORS** : jeton de session scopé (client+chat) → cartographie SIREN réparée.
- **Veille lisible** : prompt réécrit (français simple, « Concrètement pour vous », zéro jargon/citations/méta) + nettoyage serveur & front.
- **Personnalisation** : section « Vos univers » (dashboard) reliée aux passions ; starters Marcel selon profil ; veille injectée du profil + bouton « Qu'est-ce qui me concerne ? ».
- **Module patrimoine** : `/app/patrimoine.html` (donut, valeur nette, cartes biens + photo, IFI auto, analyse Marcel).
- **Critique externe traitée** : watermark retiré de l'espace membre ; bloc d'activation guidée (% + 4 étapes) contre l'écran vide ; libellé « PE » → « Investissement non coté ».

---

## 🎯 Backlog priorisé (prochaines itérations)

| Prio | Amélioration | Impact | Risque | Note |
|---|---|---|---|---|
| **P0** | **Essai Premium 7 jours** (aha avant paywall) | 🔥 conversion | moyen (backend tier) | **Décision business → GO de Maxime requis** |
| **P1** | **Streaming Marcel** (réponse qui s'écrit, façon ChatGPT) | 🔥 perçu « vivant » | moyen (worker SSE) | Étape 1 : effet machine à écrire (front, 0 risque) ; Étape 2 : vrai SSE |
| **P1** | **Mémoire conversationnelle** (Marcel se souvient entre sessions) | élevé | moyen | persister conversations en D1 (premium 90j / fo ∞ déjà prévu dans TIER_LIMITS) |
| **P2** | **Pappers → patrimoine** : SIREN renseigné auto-crée le bien « société » | élevé | faible | relie cartographie ↔ patrimoine |
| **P2** | **Upload photo réel** (R2) pour les biens | moyen | moyen | aujourd'hui : lien d'image |
| **P2** | **Sync patrimoine en base** (D1) multi-appareils | moyen | moyen | aujourd'hui : localStorage |
| **P3** | **DVF** : estimation auto de la valeur immo | moyen | data instable | proxy worker + cache (pas cquest qui 502) |
| **P3** | **Push notifications PWA** (veille du matin 8h) | élevé mobile | moyen | VAPID + service worker push |
| **P3** | **Tagging du digest** par pertinence profil (client-side) | faible-moyen | faible | badge « pertinent pour vous » |

---

## 🧪 Méthode de critique (à chaque passe)

1. **Parcours réel** : login → dashboard → Marcel → veille → patrimoine (œil neuf, « qu'est-ce qui sonne faux / vide / lent ? »).
2. **Conformité** : MIF II (finit par question), RGPD souverain, ORIAS, zéro « Claude » en surface.
3. **Perf & robustesse** : pas de code périmé (cache), endpoints sains, fallbacks gracieux.
4. **Valeur perçue** : un dirigeant non spécialiste comprend-il en 10 s ? Ressent-il la puissance AVANT le paywall ?
5. On corrige, on déploie, on re-critique.

---

© 2026 IKCP · ORIAS 23001568 · usage interne
