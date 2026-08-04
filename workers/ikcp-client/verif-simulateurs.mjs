/* Compare chaque simulateur déclaratif à la version codée en dur du site.
   Aucune confiance accordée à la relecture : on exécute les deux et on
   compare les nombres. */
import fs from 'fs';

const R = 'C:/Users/juven/ikcp-site/';
const win = {};
new Function('window', fs.readFileSync(R + 'app/js/formule.js', 'utf8'))(win);
const F = win.IKCPFormule;
const SEED = JSON.parse(fs.readFileSync(R + 'workers/ikcp-client/simulateurs-seed.json', 'utf8'));

/* ── Les versions de référence, recopiées telles quelles du site ──────── */
const BAR_DON = [[8072, .05], [12109, .10], [15932, .15], [552324, .20],
                 [902838, .30], [1805677, .40], [Infinity, .45]];
const BAR_IFI = [[800000, 0], [1300000, .005], [2570000, .007],
                 [5000000, .01], [10000000, .0125], [Infinity, .015]];
const prog = (base, b) => { let t = 0, p = 0; for (const [pl, tx] of b) { if (base > p) { t += (Math.min(base, pl) - p) * tx; p = pl; } else break; } return t; };
const droitsDonation = a => prog(Math.max(a, 0), BAR_DON);
const droitsIFI = a => prog(Math.max(a, 0), BAR_IFI);

const REF = {
  'transmission-donation': v => {
    const nb = Math.max(v.enfants, 1);
    const part = v.donne / nb;
    const taxable = Math.max(part - v.abattement, 0);
    return { droits: droitsDonation(taxable) * nb, abattements: nb * v.abattement,
             assiette: taxable * nb, net: v.donne - droitsDonation(taxable) * nb };
  },
  'ifi': v => {
    const ifiBrut = v.patrimoine < 1300000 ? 0 : droitsIFI(v.patrimoine);
    const decote = (v.patrimoine >= 1300000 && v.patrimoine < 1400000) ? (17500 - 0.0125 * v.patrimoine) : 0;
    return { ifiBrut, decote, ifi: Math.max(ifiBrut - decote, 0) };
  },
  'dividendes-vs-salaire': v => {
    const budget = v.resultat * v.partSalaire;
    const brut = v.resultat - budget;
    const salaireNet = budget / (1 + v.coutSalaire);
    const dividendeNet = brut * (1 - v.flatTax);
    return { salaireNet, dividendeNet, total: salaireNet + dividendeNet };
  },
  'versement-per': v => {
    const m = (v.rendement / 100) / 12, n = v.annees * 12;
    const mensuel = m === 0 ? v.cible / n : v.cible * m / (Math.pow(1 + m, n) - 1);
    return { mensuel, annuel: mensuel * 12, verseTotal: mensuel * n,
             gains: Math.max(v.cible - mensuel * n, 0) };
  },
};

/* ── Jeux d'essai : les valeurs par défaut, plus des cas limites ──────── */
const CAS = {
  'transmission-donation': [{}, { donne: 150000 }, { enfants: 0 }, { donne: 3000000, enfants: 3 }],
  'ifi': [{}, { patrimoine: 1200000 }, { patrimoine: 1350000 }, { patrimoine: 1400000 }, { patrimoine: 6000000 }],
  'dividendes-vs-salaire': [{}, { partSalaire: 0 }, { partSalaire: 1 }, { resultat: 250000, flatTax: 0.3 }],
  'versement-per': [{}, { annees: 5 }, { rendement: 0 }, { cible: 1000000, annees: 30, rendement: 6 }],
};

let ok = 0, ko = 0;
for (const simu of SEED.simulateurs) {
  console.log('\n══ ' + simu.id + ' — ' + simu.titre + ' ══');
  const defauts = {};
  simu.champs.forEach(c => { defauts[c.cle] = c.defaut; });

  for (const variante of CAS[simu.id]) {
    const saisies = { ...defauts, ...variante };
    const decl = F.calculer(simu, saisies).valeurs;
    const ref = REF[simu.id](saisies);
    const etiquette = Object.keys(variante).length
      ? Object.entries(variante).map(([k, v]) => k + '=' + v).join(' ')
      : 'valeurs par défaut';

    let bon = true, detail = [];
    for (const [cle, attendu] of Object.entries(ref)) {
      const obtenu = decl[cle];
      const ecart = Math.abs((obtenu || 0) - attendu);
      if (ecart > 0.02) { bon = false; detail.push(cle + ' : ' + (obtenu || 0).toFixed(2) + ' ≠ ' + attendu.toFixed(2)); }
    }
    console.log((bon ? '  ✔ ' : '  ✘ ') + etiquette.padEnd(42) + (bon ? '' : detail.join(' · ')));
    bon ? ok++ : ko++;
  }
}
console.log('\n' + (ko === 0
  ? '✔ ' + ok + ' cas comparés, tous identiques à la version du site'
  : '✘ ' + ko + ' écart(s) sur ' + (ok + ko) + ' cas'));
process.exit(ko === 0 ? 0 : 1);
