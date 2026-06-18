# Marcel — Documentation des 9 tools déterministes

> Tous les tools sont implémentés en **JavaScript pur côté Worker** —
> aucun LLM dans la boucle de calcul. Marcel les **appelle** via
> `tool_use` mais le calcul est exact, sourcé, opposable.

---

## 1. `calc_impot_revenu`

**Calcule l'impôt sur le revenu (IR) 2026 selon le barème progressif officiel.**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `revenu_imposable` | number | Revenu net imposable annuel (en euros) |
| `parts` | number | Nombre de parts fiscales (1 célibataire, 2 couple, +0.5/enfant) |

### Output
```json
{
  "impot_estime": 18450,
  "revenu_imposable": 95000,
  "parts": 2,
  "quotient_familial": 47500,
  "tranche_marginale_pct": 30,
  "taux_effectif_pct": 19.42,
  "source": "Barème IR 2026 — LF 2026 art. 2"
}
```

### Sources
- LF 2026 art. 2 (barème IR · revenus 2025)
- Barème : 0-11 600€ (0%) / 11 601-29 579€ (11%) / 29 580-84 577€ (30%) / 84 578-181 917€ (41%) / >181 917€ (45%)

---

## 2. `calc_droits_succession`

**Calcule les droits de succession ligne directe (enfants) avec abattement et exonération AV.**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `patrimoine_net` | number | Patrimoine net transmissible (après dettes) en euros |
| `nb_enfants` | number | Nombre d'enfants héritiers (ligne directe) |
| `assurance_vie` | number | Montant AV versée avant 70 ans (0 si aucune) |

### Output
```json
{
  "droits_total": 18195,
  "droits_par_enfant": 9098,
  "patrimoine_net": 500000,
  "abattement_total": 200000,
  "assurance_vie_exoneree": 0,
  "base_taxable": 300000,
  "sources": "art. 779 I CGI · art. 990 I CGI · art. 777 CGI"
}
```

### Sources
- CGI 779 I (abattement 100k€/enfant)
- CGI 990 I (AV avant 70 ans, exo 152 500€/bénéficiaire)
- CGI 777 (barème DMTG progressif 5-45%)

---

## 3. `calc_donation`

**Calcule les droits de donation parent → enfant avec antériorité 15 ans et don familial.**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `montant` | number | Montant de la donation envisagée |
| `donation_anterieure` | number | Montant déjà donné dans 15 dernières années |
| `don_familial_31865` | boolean | Cumuler le don familial CGI 790 G (parent <80 ans, enfant majeur) |

### Output
```json
{
  "droits_dus": 18195,
  "montant_donation": 200000,
  "abattement_applique": 100000,
  "abattement_consomme_15ans": 0,
  "don_familial_cumule": 0,
  "base_taxable": 100000,
  "montant_net_recu": 181805,
  "sources": "art. 779 I CGI · art. 790 G CGI · art. 777 CGI"
}
```

### Sources
- CGI 779 I (abattement 100 000€/enfant/15 ans)
- CGI 790 G (don familial 31 865€)
- CGI 777 (barème DMTG)

---

## 4. `calc_ifi`

**Calcule l'IFI 2026 avec abattement résidence principale 30% et décote.**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `patrimoine_immo_brut` | number | Patrimoine immo brut (RP + secondaires + locatif + SCI) |
| `residence_principale` | number | Valeur RP avant abattement 30% |
| `dettes_immo` | number | Dettes immo en cours (crédits restant dus) |

### Output
```json
{
  "ifi_du": 4250,
  "assiette_nette": 1700000,
  "residence_principale_apres_abattement": 700000,
  "abattement_rp_30pct_applique": 300000,
  "dettes_deduites": 200000,
  "sources": "art. 964 CGI · art. 968 CGI · art. 977 CGI · art. 977-bis CGI"
}
```

### Sources
- CGI 964 (seuil 1,3 M€)
- CGI 968 (RP -30%)
- CGI 977 (barème 0,5% - 1,5%)
- CGI 977-bis (décote entre 1,3 M€ et 1,4 M€)

---

## 5. `calc_plus_value_immo`

**Calcule la plus-value immobilière de cession avec abattements durée détention + surtaxe PV élevée.**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `prix_acquisition` | number | Prix d'acquisition initial |
| `prix_cession` | number | Prix de cession |
| `annees_detention` | number | Années de détention complètes |
| `residence_principale` | boolean | Si RP (exonération totale CGI 150 U II 1°) |
| `travaux_justifies` | number | Travaux réalisés et justifiés |

### Output
```json
{
  "pv_brute": 280000,
  "pv_apres_abattement_ir": 168000,
  "pv_apres_abattement_ps": 196840,
  "abattement_ir_pct": 40,
  "abattement_ps_pct": 30,
  "impot_ir_19pct": 31920,
  "prelevements_sociaux_172pct": 33856,
  "surtaxe_pv_elevee": 5040,
  "impot_du": 70816,
  "annees_detention": 12,
  "sources": "art. 150 U CGI · art. 150 V C CGI · art. 1609 nonies G CGI"
}
```

### Sources
- CGI 150 U (PV régime général)
- CGI 150 V C (abattements pour durée : 6%/an de 6 à 21 ans, 4% à 22 ans → exo IR 22 ans)
- CGI 1609 nonies G (surtaxe PV > 50 k€)

---

## 6. `calc_demembrement`

**Calcule la valeur usufruit / nue-propriété selon barème art. 669 CGI (âge usufruitier).**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `valeur_pleine_propriete` | number | Valeur du bien en PP |
| `age_usufruitier` | number | Âge de l'usufruitier (années révolues) |

### Output
```json
{
  "valeur_pleine_propriete": 1000000,
  "age_usufruitier": 65,
  "valeur_usufruit": 400000,
  "valeur_nue_propriete": 600000,
  "usufruit_pct": 40,
  "nue_propriete_pct": 60,
  "note": "À 65 ans, l'usufruit vaut 40% et la NP 60% (barème fiscal)...",
  "sources": "art. 669 CGI · art. 1133 CGI"
}
```

### Sources
- CGI 669 (barème usufruit selon âge)
- CGI 1133 (extinction usufruit gratuite au décès)

---

## 7. `calc_exit_tax`

**Calcule l'exit tax CGI 167 bis pour transfert domicile fiscal hors France.**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `valeur_titres` | number | Valeur des titres au moment du départ |
| `prix_acquisition` | number | Prix d'acquisition (apport ou achat) |
| `pays_destination` | string | Pays de destination (UE/EEE = sursis automatique 6 ans) |
| `controle_majoritaire` | boolean | Contrôle > 50% société (active CGI 167 bis sans plafond) |

### Output
```json
{
  "exit_tax_due": 117000,
  "plus_value_latente": 390000,
  "ir_12_8_pct": 49920,
  "prelevements_sociaux_17_2_pct": 67080,
  "sursis": {
    "automatique": true,
    "duree": "6 ans (sursis automatique UE/EEE — CGI 167 bis II.1)",
    "extinction": "PV purgée si conservation > 6 ans après le départ + retour FR"
  },
  "sous_seuil_800k": false,
  "sources": "art. 167 bis CGI · BOFIP-RPPM-PVBMI-50"
}
```

### Sources
- CGI 167 bis (exit tax)
- BOFIP-RPPM-PVBMI-50

---

## 8. `compare_holding_jurisdictions`

**Compare la fiscalité d'une holding selon 4 juridictions (FR / Lux SOPARFI / CH / NL).**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `type_actif` | string | participations_op · pe_funds · immo · ip_marques |
| `valeur_participation` | number | Valeur (en euros) |
| `actionnaire_resident_fr` | boolean | Actionnaire résident FR (impact remontée) |

### Output
```json
{
  "type_actif": "participations_op",
  "valeur_participation": 5000000,
  "juridictions": {
    "france": { "label": "France SAS/SARL holding", "is_dividendes_recus": "0% (CGI 145 mère-fille...)", "..." },
    "luxembourg": { "label": "Luxembourg SOPARFI", "is_dividendes_recus": "0% (LIR 166...)", "..." },
    "suisse": { "label": "Suisse SA / Sàrl", "is_dividendes_recus": "95% exonération (...)", "..." },
    "pays_bas": { "label": "Pays-Bas BV", "is_dividendes_recus": "0% (PE...)", "..." }
  },
  "recommandation": "Pour > 5 M€ de participations opérationnelles, privilégier France (simple) ou Luxembourg (si réseau international)...",
  "avertissement": "Validation par juriste fiscaliste obligatoire (BEPS / ATAD / GAAR)",
  "sources": "CGI 145, 219 I a quinquies (FR) · LIR 166 (LUX) · LIFD 69 (CH) · Wet Vpb (NL)"
}
```

### Sources
- CGI 145, 219 I a quinquies (FR)
- LIR 166 (LUX)
- LIFD 69 (CH)
- Wet Vpb (NL)
- Modèle OCDE

---

## 9. `calc_forfait_suisse`

**Calcule l'imposition d'après la dépense (forfait fiscal suisse) selon canton.**

### Inputs
| Paramètre | Type | Description |
|---|---|---|
| `loyer_ou_valeur_locative` | number | Loyer annuel ou valeur locative en CHF |
| `canton` | string | Canton (vd, vs, ge, fr, ti, ne, ju, be) — détermine taux |

### Output
```json
{
  "eligible": true,
  "canton": "Vaud",
  "base_imposable_chf": 415000,
  "methode_calcul": "7 × loyer/valeur locative (350 000 CHF) ou plancher cantonal (415 000 CHF) — le plus élevé",
  "impot_total_estime_chf": 132800,
  "taux_effectif_estime_pct": 32,
  "conditions": "Non actif en Suisse · non-résident CH 5 ans précédents · ressortissant non-suisse",
  "sources": "LFID 2014 · LIFD 14 · pratique cantonale Vaud"
}
```

### Sources
- LFID 2014 (Loi sur l'imposition d'après la dépense)
- LIFD 14 (Loi fédérale sur l'impôt fédéral direct)
- Pratique cantonale (Vaud, Valais, Genève, Fribourg, Tessin, Neuchâtel, Jura, Berne)

---

## Comment Marcel utilise ces tools

Marcel **détecte** automatiquement quand un tool est pertinent à partir
de la question utilisateur, et l'**appelle** via le `tool_use` Anthropic.
Le résultat (déterministe, exact) est **inséré dans la réponse** avec
ses sources juridiques. Aucune hallucination possible sur les chiffres.

Loop tool_use max 4 itérations dans Marcel pour permettre des
calculs en chaîne (ex: calculer IR + IFI + DMTG sur le même client).

---

*Documentation des tools v1.0 · IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568*
