# Marcel — 25 contextes thématiques

> Marcel adapte son comportement à un **contexte thématique** envoyé par
> le frontend (`{ theme: 'fiscal' }`). Le contexte est injecté dans le
> system prompt pour focaliser la réponse.

---

## Comment ça marche

Le frontend envoie :
```js
fetch(MARCEL_URL, {
  method: 'POST',
  body: JSON.stringify({
    message: "Donation 200k€ à mon fils ?",
    theme: 'fiscal',  // ← clé du contexte
  })
});
```

Marcel ajoute alors le `THEME_CONTEXTS['fiscal']` au system prompt avant
d'appeler Anthropic. Cela focalise la réponse sur la fiscalité avec les
règles spécifiques (tools systématiques, citations CGI obligatoires).

Si le `theme` envoyé n'existe pas, Marcel fonctionne en mode général
(tous les contextes accessibles via détection automatique).

---

## Liste des 25 contextes

### A. 10 expertises patrimoniales françaises

| Clé | Focus | Exemples de prompts |
|---|---|---|
| `fiscal` | Calculs IR/IFI/DMTG/donation/PV — usage systématique des tools déterministes | "Donation 200k€ à mon fils — antériorité ?" |
| `juridique` | Lecture actes, clauses bénéficiaires, pactes Dutreil, jurisprudence Cass. com. récente | "Pacte Dutreil + donation : conditions 2026" |
| `immo` | Estimations DVF, fiscalité (CGI 964 IFI, CGI 150 U PV, CGI 31 régime réel) | "Estimer un appart 80 m² Paris 16e" |
| `transmission` | 4 schémas comparés (cession 100% / donation-cession / holding apport / Dutreil familial) | "Comparer cession vs Dutreil sur 8 M€" |
| `pe` | CGI 150-0 B ter (apport-cession), 199 terdecies (IR-PME), 219 I a quinquies (PV holding) | "Apport-cession 150-0 B ter : 3 ans + 60% ?" |
| `financement` | Lombard (OAT + spread), hypothécaire, dette privée, déductibilité intérêts CGI 31 | "Crédit Lombard sur 2 M€ AV — taux marché ?" |
| `philanthropie` | Fonds dotation / fondation abritée / FRUP, fiscalité IR 66% (CGI 200), IFI 75% (CGI 978), IS 60% (CGI 238 bis) | "Fonds de dotation 500k€ — fiscalité" |
| `art` | Comparables Artprice/Christie's, exclusion IFI (CGI 885 I), taxation cession 6,5% (CGI 150 V bis) | "L'art entre-t-il dans l'IFI ?" |
| `markets` | Cadrage multiples + fiscalité par enveloppe (PEA, AV, CTO, PER), pas de produit nommé | "LVMH : tearsheet + sentiment 7 jours" |
| `admin` | Calendrier fiscal trimestre + courrier sensible + conciergerie via white-label John Paul | "Mes prochaines échéances fiscales" |

### B. 8 univers lifestyle (page freemium)

| Clé | Focus | Exemples de prompts |
|---|---|---|
| `voyages` | Jet privé (NetJets, VistaJet) vs first class · charters yacht · résidences premium · CGI 39 si voyage mixte société | "Jet privé vs first class Paris-NYC pour 4" |
| `voitures` | Hagerty Valuation Tool · Artcurial Motorcars · états #1 à #4 · CGI 150 V bis cession · TVA si société | "Estimer Porsche 911 2.7 RS 1973 état #2" |
| `art_collection` | Comparables Artprice/Artnet · Christie's/Sotheby's · CGI 885 I exclu IFI · CGI 150 V bis | "Soulages 1959 — comparables 5 ans" |
| `vins` | Liv-ex (USD/€) · iDealwine (FR) · primeurs Bordeaux · entrepôt sous douane · CGI 150 V bis | "Pétrus 2009 — cote actuelle marché secondaire" |
| `montres` | Chrono24 + WatchCharts · Phillips/Antiquorum vintage · marché 2024-2026 stabilisé Q3 2025 · CGI 150 V bis | "Patek 5711 vs AP RO 15500 — décote 2024-2026" |
| `yachts` | Achat vs charter (NCB ~12-18%) · TCO complet · pavillons (Malte EU, Caïmans offshore, France DAFN) · TVA leasing maltais | "Ferretti 720 vs Princess Y72 — TCO 5 ans" |
| `immo_prestige` | Off-market notaires + Sotheby's Realty / Knight Frank · DVF + BIEN · CGI 964 IFI · CGI 150 U PV | "Combloux ou Megève — valorisation 5 ans" |
| `chevaux` | Yearlings Arqana Deauville · Goffs France · Tattersalls UK · pension Chantilly/Compiègne 3-4,5 k€/mois · SCEA d'élevage BIC agricole | "Acheter un yearling à Deauville — budget 200 k€" |

### C. 7 international (droit des affaires + droit des sociétés + 5 juridictions)

| Clé | Focus | Exemples de prompts |
|---|---|---|
| `droit_affaires` | Contrats commerciaux, distribution (CGI L134), PI (CPI L113), restructuring (Code com. L611+) | "Procédure collective : mandat ad hoc vs conciliation" |
| `droit_societes` | Forme sociale, gouvernance, pactes (drag-along, tag-along, anti-dilution), M&A, transmission Dutreil | "Pacte d'actionnaires : clauses essentielles avant entrée VC" |
| `international_lux` | SOPARFI (LIR 166 exo div + PV) · RAIF (PE) · SCA · Family Wealth · convention FR-LUX 1958/2018 | "SOPARFI vs holding française pour 5 M€ PE" |
| `international_ch` | Forfait fiscal LFID 2014 · Sàrl/SA · Pillar 3a · convention FR-CH 1966/2014 | "Forfait fiscal Vaud vs Valais — comparaison 2026" |
| `international_uk` | Non-dom status (15 ans deemed dom) · Family Investment Company · Trust UK · convention FR-UK 2008 | "Non-dom vs FIC pour patrimoine 8 M€" |
| `international_us` | LLC Delaware · FATCA · Estate tax (40% > 60k$ non-résident) · Exit tax IRC 877A · convention FR-USA 1994/2018 | "LLC Delaware pour immo USA 2 M$ — fiscalité" |
| `convention_fiscale` | Modèle OCDE (art. 4, 7, 10, 11, 12, 13, 23) · MLI BEPS 2017 · tie-breaker rules · 130+ conventions FR | "Tie-breaker FR-CH : conditions résidence dual" |

---

## Garde-fous communs à tous les contextes

Chaque contexte hérite des règles globales du system prompt :

1. **Sources obligatoires** : tout chiffre cite l'article CGI / BOFIP / convention bilatérale
2. **Pas de produit nommé** (MIF II / DDA)
3. **Disclaimer pédagogique** en fin de réponse à enjeu : *« Ces informations sont pédagogiques et ne constituent pas un conseil en investissement au sens de la réglementation MIF II. Pour une analyse de votre situation, [VOTRE CGP] peut vous accompagner. »*
4. **Pas de "vous devriez"** — ton informatif, pas prescriptif
5. **Vouvoiement** systématique
6. **Calculateurs déterministes** appelés systématiquement (pas de calcul mental Marcel)

Pour les contextes internationaux : avertissement supplémentaire
*« Toute structuration internationale doit être validée par un juriste
fiscaliste, audit substance économique BEPS / ATAD systématique. »*

---

## Comment ajouter un contexte

Dans `worker.js`, ajouter une clé dans l'objet `THEME_CONTEXTS` :

```js
const THEME_CONTEXTS = {
  // ... contextes existants
  ma_thematique:
    "FOCUS THÉMATIQUE — MA THÉMATIQUE. Tu réponds avec : (1) cadre " +
    "applicable (cite la source), (2) chiffrage indicatif si tu as un " +
    "tool, (3) recommandation à valider par [VOTRE CGP]. Cite tes sources.",
};
```

Le frontend peut désormais envoyer `{ theme: 'ma_thematique' }`.

---

*Documentation des contextes v1.0 · IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
