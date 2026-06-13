# 🛠️ Gabarit — créer un outil Family Office sur-mesure

> But : transformer une idée d'outil patrimonial en page live, vite et proprement,
> sans repartir de zéro. Tu décris → c'est généré sur ce modèle.

---

## La méthode (1 phrase → outil live)

1. **Tu décris l'outil** à Claude Code (en français) :
   > « Crée un simulateur d'apport-cession 150-0 B ter : champs prix de cession, quote-part réinvestie, durée ; sortie = report d'imposition estimé + question MIF II. »
2. Claude génère une page sur le **squelette ci-dessous** (charte + conformité incluses).
3. Push → Cloudflare déploie → l'outil est live à `/<nom>.html` ou `/app/<nom>.html`.

## Règles d'or d'un outil IKCP (non négociables)
| Règle | Pourquoi |
|---|---|
| Finit par une **question**, jamais une reco produit | MIF II (art. L.541-1) |
| **Disclaimer** en pied | conformité |
| **Barèmes datés** (millésime 2026) | crédibilité |
| Charte (Fraunces + Inter, navy/or/terracotta) | cohérence |
| Lien **« Approfondir avec Marcel »** (`?q=`) | tout ramène à l'orchestrateur |
| Bouton qui passe le calcul à Marcel | l'IA enrichit le résultat |

## Squelette minimal (calculateur)
```html
<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>[Nom outil] — IKCP</title>
<link rel="stylesheet" href="/app/css/marcel.css"> <!-- charte partagée -->
</head><body>
<main style="max-width:720px;margin:0 auto;padding:32px 22px">
  <div class="section-label">Outil patrimonial</div>
  <h1 class="app-h1">[Titre] <em>[accent]</em></h1>
  <p class="app-lead">[Une phrase : ce que l'outil éclaire.]</p>

  <!-- ENTRÉES -->
  <div class="card">
    <label>[Champ 1]</label><input id="in1" type="number">
    <label>[Champ 2]</label><input id="in2" type="number">
    <button class="btn" onclick="calc()">Calculer →</button>
  </div>

  <!-- RÉSULTAT -->
  <div class="card" id="out" style="display:none"></div>

  <p class="disclaimer">Cette simulation ne constitue pas un conseil personnalisé
   au sens de l'art. L.541-1 du Code monétaire et financier.</p>
</main>
<script>
function calc(){
  const a=+in1.value, b=+in2.value;
  const res = /* … logique, barèmes 2026 … */ a+b;
  const q = encodeURIComponent(`Voici mon calcul [outil] : résultat ${res}. Quels leviers / pièges ?`);
  out.style.display='block';
  out.innerHTML = `<h3>Résultat estimé</h3><div class="num">${res}</div>
    <a class="btn" href="/app/marcel.html?q=${q}">Approfondir avec Marcel →</a>`;
}
</script></body></html>
```

## Outils déjà construits sur ce modèle (à copier)
| Outil | Fichier |
|---|---|
| Score patrimonial | `score.html` |
| Transmission | `transmission.html` |
| Rémunération dirigeant | `remuneration.html` |
| Épargne salariale | `epargne-salariale.html` |
| Mon patrimoine (donut) | `app/patrimoine.html` |

## Idées d'outils à forte valeur (backlog)
- Apport-cession 150-0 B ter · Pacte Dutreil (exonération 75 %) · Démembrement (barème 669)
- Salaire vs dividende selon forme sociale · PER (effet de levier fiscal) · Assurance-vie 990 I

---

*Le meilleur « outil pour créer des outils » = Claude Code sur ce gabarit. IKCP · ORIAS 23001568.*
