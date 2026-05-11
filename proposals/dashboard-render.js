/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé · CPI L111-1, L113-9, L122-4
 *
 * IKCP Dashboard — rendu côté client.
 *
 * Lit `window.IKCP_DASHBOARD` (mock pour la démo, à remplacer par
 * fetch('/api/dashboard/me') une fois le Worker `ikcp-client` enrichi)
 * et injecte chaque section.
 *
 * Le modal "Marcel privé" appelle le Worker Marcel
 * (ikcp-chat.maxime-ead.workers.dev) avec un préambule "FAMILY OFFICE
 * PRIVÉ — Famille Dupont" pour personnaliser. Fallback mock si offline.
 */

const MARCEL_URL = 'https://ikcp-chat.maxime-ead.workers.dev';
const D = window.IKCP_DASHBOARD;
const fmtEur = n => (n == null) ? '—' : n.toLocaleString('fr-FR') + ' €';
const fmtEurShort = n => {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 2) + ' M€';
  if (n >= 1000) return (n / 1000).toFixed(0) + ' k€';
  return n + ' €';
};
const fmtDate = (iso, opts) => {
  const d = (iso instanceof Date) ? iso : new Date(iso);
  return d.toLocaleDateString('fr-FR', opts || { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtDateMono = iso => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
};
const fmtRelative = iso => {
  const now = D.NOW;
  const t = new Date(iso);
  const diffH = Math.round((now - t) / 3600000);
  if (diffH < 1) return 'à l\'instant';
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffJ = Math.round(diffH / 24);
  if (diffJ < 30) return `il y a ${diffJ} j`;
  return fmtDate(iso, { day: 'numeric', month: 'short' });
};
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─────────────────────────────────────────────────────────────────────────────
// HEADER + HERO

function renderHeader() {
  const principal = D.client.members.find(m => m.role === 'principal');
  const co = D.client.members.find(m => m.role === 'co-titulaire');
  const names = `${principal.first} & ${co ? co.first : ''}`.trim();
  document.getElementById('user-chip-name').textContent = names;
  document.getElementById('user-chip-since').textContent = fmtDate(D.client.member_since, { month: 'short', year: 'numeric' });
  document.getElementById('hero-firstnames').textContent = names;
  document.getElementById('hero-cgp').textContent = D.client.cgp;
  document.getElementById('hero-tier').innerHTML = `🎯 <strong>${escape(D.client.tier)}</strong>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALUE SCORECARD

function renderScorecard() {
  const s = D.value_scorecard;
  document.getElementById('score-period').textContent = s.periode_label;
  const cells = [
    { num: s.questions_traitees, label: 'Questions Marcel traitées' },
    { num: s.documents_classes_auto, label: 'Documents classés automatiquement' },
    { num: s.arbitrages_prepares, label: 'Arbitrages prêts pour Maxime' },
    { num: fmtEurShort(s.optimisations_identifiees_eur), label: 'Optimisations identifiées', flag: true },
    { num: `J<small>−${s.next_deadline_days}</small>`, label: 'Prochaine échéance', flag: false },
  ];
  document.getElementById('score-strip').innerHTML = cells.map(c => `
    <div class="score-cell ${c.flag ? 'flag' : ''}">
      <div class="score-num">${c.num}</div>
      <div class="score-label">${escape(c.label)}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// PATRIMOINE 360°

function renderPatrimoine() {
  const p = D.patrimoine;
  document.getElementById('pat-asof').textContent = fmtDate(D.NOW);
  document.getElementById('pat-net-value').textContent = p.net_worth.toLocaleString('fr-FR');
  document.getElementById('pat-deltas').innerHTML = `
    <span class="pat-delta ${p.variation_trimestre_pct >= 0 ? 'pos' : 'neg'}">
      ${p.variation_trimestre_pct >= 0 ? '+' : ''}${p.variation_trimestre_pct}% trimestre
    </span>
    <span class="pat-delta ${p.variation_an_pct >= 0 ? 'pos' : 'neg'}">
      ${p.variation_an_pct >= 0 ? '+' : ''}${p.variation_an_pct}% sur 12 mois
    </span>
  `;
  const driftLabel = {
    none: 'aucun drift',
    moderate: 'drift modéré',
    high: 'drift élevé',
  }[p.drift_severity] || 'drift';
  document.getElementById('pat-drift').innerHTML = `
    <span class="pat-drift-tag ${p.drift_severity}">${driftLabel}</span>
    Écart maximal classe d'actif vs cible : <strong style="color:var(--ink);">${p.drift_max_pct} pts</strong>.
    L'agent Suivi propose un rebalance — voir <a href="#arbitrages" style="color:var(--gold);">arbitrages en attente</a>.
  `;

  // Allocation rows avec drift par classe
  const rows = p.classes.map(c => {
    const target = p.allocation_cible[c.key] || 0;
    const drift = c.pct - target;
    const driftSign = drift > 0 ? '+' : '';
    const driftClass = drift > 1 ? 'drift-pos' : (drift < -1 ? 'drift-neg' : '');
    const driftStr = Math.abs(drift) < 0.5 ? '— cible' : `${driftSign}${drift.toFixed(0)} pt vs cible`;
    return `
      <div class="alloc-row">
        <div class="alloc-class">${escape(c.label)}</div>
        <div class="alloc-bar-wrap">
          <div class="alloc-bar" style="width:${c.pct}%; background:${c.color};"></div>
        </div>
        <div class="alloc-pct">${c.pct}%</div>
        <div class="alloc-eur">${fmtEurShort(c.valeur_nette)}</div>
        <div class="alloc-target ${driftClass}">${driftStr}</div>
      </div>
    `;
  }).join('');
  document.getElementById('alloc-rows').innerHTML = rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCHÉANCES

const STATUS_LABELS = {
  a_venir: 'À venir',
  preparé_par_marcel: 'Préparé par Marcel',
  a_preparer: 'À préparer',
  sous_traite_expert_comptable: 'Expert-comptable',
  preleve_auto: 'Prélèvement auto',
  analyse_en_cours: 'Analyse en cours',
};

function renderTimeline() {
  document.getElementById('timeline').innerHTML = D.echeances.map(e => {
    const d = new Date(e.date);
    const monthYear = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    const day = d.getDate();
    return `
      <div class="timeline-row ${e.urgent ? 'urgent' : ''}">
        <div class="timeline-date">
          <strong>${day}</strong> ${monthYear.split(' ')[0]}<br>
          <small>${monthYear.split(' ')[1]}</small>
        </div>
        <div class="timeline-label">
          ${escape(e.label)}
          <small>${escape(e.source || '')}</small>
        </div>
        <div class="timeline-amount">${e.montant ? fmtEur(e.montant) : '—'}</div>
        <div class="timeline-status status-${e.status}">${STATUS_LABELS[e.status] || e.status}</div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// ARBITRAGES

const ARB_STATUS_LABELS = {
  en_attente: 'En attente Maxime',
  en_discussion: 'En discussion',
  valide: 'Validé',
  refuse: 'Refusé',
};

function renderArbitrages() {
  document.getElementById('arbitrages-grid').innerHTML = D.arbitrages.map(a => {
    const sources = a.sources.map(s => `<span class="source-chip-mini">${escape(s)}</span>`).join('');
    const gain = a.gain_estime > 0
      ? `<div class="arb-gain"><strong>+${fmtEurShort(a.gain_estime)}</strong> <small>gain estimé</small></div>`
      : (a.gain_qualitatif ? `<div class="arb-gain"><strong>${escape(a.gain_qualitatif)}</strong></div>` : '<div class="arb-gain"></div>');
    return `
      <div class="arb-card">
        <div class="arb-status-row">
          <span class="arb-status ${a.status}">${ARB_STATUS_LABELS[a.status]}</span>
          <span class="arb-prepared">préparé ${fmtDate(a.preparé_le, { day: 'numeric', month: 'short' })}</span>
        </div>
        <div class="arb-title">${escape(a.titre)}</div>
        <div class="arb-context">${escape(a.contexte)}</div>
        <div class="arb-reco">${escape(a.reco_marcel)}</div>
        <div class="arb-sources">${sources}</div>
        <div class="arb-foot">
          ${gain}
          <div class="arb-actions">
            <button class="btn-mini" onclick="openMarcelOnArbitrage('${a.id}')">Approfondir</button>
            <a class="btn-mini primary" href="mailto:maxime@ikcp.fr?subject=${encodeURIComponent('Arbitrage IKCP — ' + a.titre)}">Discuter</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS

const CONV_STATUS_LABELS = {
  cloturee: 'Clôturée',
  en_attente_arbitrage_maxime: 'En attente Maxime',
  arbitrage_valide_maxime: 'Validé',
};

function renderConversations() {
  document.getElementById('conv-list').innerHTML = D.conversations.map(c => `
    <div class="conv-row" onclick="openMarcelOnTheme('${c.theme}', '${escape(c.last_question)}')">
      <div><span class="conv-theme">${escape(c.theme_label)}</span></div>
      <div class="conv-content">
        <div class="conv-title">${escape(c.title)}</div>
        <div class="conv-last">${escape(c.last_message)}</div>
      </div>
      <div class="conv-agents">
        ${c.agents.map(a => `<div>· ${escape(a)}</div>`).join('')}
        <div style="color:var(--ink-faint); margin-top:4px;">${fmtDate(c.date, { day:'numeric', month:'short' })}</div>
      </div>
      <div><span class="conv-status-tag ${c.status}">${CONV_STATUS_LABELS[c.status]}</span></div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS

const DOC_TYPE_LABELS = {
  avis_ir: 'Avis IR', kbis: 'K-bis', statuts: 'Statuts', acte: 'Acte notarié',
  av_contrat: 'Contrat AV', releve_pea: 'Relevé PEA', compromis: 'Compromis',
  attestation: 'Attestation', rapport: 'Rapport IKCP',
};

function renderDocuments() {
  document.getElementById('docs-grid').innerHTML = D.documents.map(d => `
    <div class="doc-card">
      <div class="doc-type">
        ${escape(DOC_TYPE_LABELS[d.type] || d.type)}
        ${d.generated ? '<span class="doc-tag-generated">GÉNÉRÉ IA</span>' : ''}
      </div>
      <div class="doc-label">${escape(d.label)}</div>
      <div class="doc-meta">
        ${d.pages ? d.pages + ' p · ' : ''}reçu ${fmtDate(d.date_recu, { day:'numeric', month:'short', year:'2-digit' })}
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVRABLES

function renderLivrables() {
  document.getElementById('liv-list').innerHTML = D.livrables.map(l => {
    const action = l.requires_signature
      ? `<a class="liv-action requires_signature" href="#">Signer →</a>`
      : (l.signed ? `<a class="liv-action signed" href="#">✓ Télécharger</a>` : `<a class="liv-action" href="#">Télécharger</a>`);
    return `
      <div class="liv-row">
        <div class="liv-label">
          ${escape(l.label)}
          <small>type : ${escape(l.type)}</small>
        </div>
        <div class="liv-date">${fmtDate(l.date)}</div>
        <div class="liv-pages">${l.pages || '—'} pages</div>
        <div>${action}</div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERS PERSO

function renderUniversPerso() {
  const root = document.getElementById('univers-perso-grid');
  if (!root || !D.univers_perso) return;
  root.innerHTML = D.univers_perso.map(u => {
    const items = u.items.map(it => {
      let trendClass = 'flat';
      let trendArrow = '·';
      if (it.tendance) {
        if (it.tendance.startsWith('+')) { trendClass = ''; trendArrow = '↗'; }
        else if (it.tendance.startsWith('-')) { trendClass = 'neg'; trendArrow = '↘'; }
      }
      const valeur = it.valeur_estimee ? fmtEurShort(it.valeur_estimee) : (it.etat || '');
      return `
        <div class="up-item">
          <div class="up-item-titre">${escape(it.titre)}</div>
          <div class="up-item-meta">
            <span>${escape(it.etat || '')}${it.valeur_estimee ? ' · ' + escape(it.source) : ''}</span>
            <span>
              ${it.valeur_estimee ? `<strong style="color:var(--ink);">${valeur}</strong>` : ''}
              ${it.tendance ? `<span class="up-item-tendance ${trendClass}">${trendArrow} ${escape(it.tendance)}</span>` : ''}
            </span>
          </div>
        </div>
      `;
    }).join('');
    return `
      <div class="univers-perso-card" onclick="openMarcelOnUnivers('${u.key}', '${escape(u.label)}')">
        <div class="up-head">
          <span class="up-icon">${u.icon}</span>
          <span class="up-label">${escape(u.label)}</span>
          <span class="up-total">${fmtEurShort(u.total_estime)}</span>
        </div>
        <div class="up-items">${items}</div>
        ${u.derniere_alerte ? `<div class="up-alerte">${escape(u.derniere_alerte)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function openMarcelOnUnivers(univKey, univLabel) {
  openMarcelModal({
    title: univLabel,
    theme: univKey,
    prompts: [
      'Reprendre le suivi marché de cet univers',
      'Détecter les opportunités à venir',
      'Comparer avec d\'autres pistes',
    ],
    prefill: '',
  });
}
window.openMarcelOnUnivers = openMarcelOnUnivers;

// ─────────────────────────────────────────────────────────────────────────────
// DÉNICHEUR D'OFFRES

function renderOpportunites() {
  const root = document.getElementById('opp-grid');
  if (!root || !D.opportunites) return;
  root.innerHTML = D.opportunites.map(o => {
    const fitClass = o.fit_score >= 85 ? 'high' : (o.fit_score >= 70 ? '' : 'med');
    const ticket = o.ticket_min ? (o.ticket_min === o.ticket_max ? fmtEurShort(o.ticket_min) : `${fmtEurShort(o.ticket_min)} – ${fmtEurShort(o.ticket_max)}`) : null;
    const deadline = o.deadline ? `Avant le ${fmtDate(o.deadline)}` : '';
    const reasons = o.fit_reasons.map(r => `· ${escape(r)}`).join('<br>');
    return `
      <div class="opp-card">
        <div class="opp-head">
          <span class="opp-cat">${escape(o.categorie)}</span>
          <span class="opp-fit ${fitClass}" title="Adéquation au profil">
            <span class="opp-fit-bar"><span style="width:${o.fit_score}%"></span></span>
            <span class="opp-fit-pct">${o.fit_score}/100</span>
          </span>
        </div>
        <div class="opp-title">${escape(o.titre)}</div>
        <div class="opp-pitch">${escape(o.pitch)}</div>
        ${ticket ? `<div class="opp-tickets">Ticket : ${ticket}<small>${o.ticket_min === o.ticket_max ? 'unique' : 'min – max'}</small></div>` : ''}
        ${deadline ? `<div class="opp-deadline">⏱ ${escape(deadline)}</div>` : ''}
        <div class="opp-source">${escape(o.source)}</div>
        <div class="opp-fit-detail"><strong>Pourquoi vous</strong><br>${reasons}</div>
        <div class="opp-cta-row">
          <button class="btn-mini" onclick="openMarcelOnOpportunite('${o.id}')">${escape(o.cta || 'Approfondir avec Marcel')}</button>
          <a class="btn-mini primary" href="mailto:maxime@ikcp.fr?subject=${encodeURIComponent('IKCP — opportunité : ' + o.titre)}">Discuter</a>
        </div>
      </div>
    `;
  }).join('');
}

function openMarcelOnOpportunite(oppId) {
  const o = D.opportunites.find(x => x.id === oppId);
  if (!o) return;
  openMarcelModal({
    title: o.titre,
    theme: null,
    prompts: [
      'Quels sont les risques principaux ?',
      'Calcule l\'impact fiscal si je participe',
      'Compare avec mes alternatives actuelles',
    ],
    prefill: `Que penses-tu de l'opportunité "${o.titre}" pour notre famille ? Notre profil et notre patrimoine te sont connus.`,
  });
}
window.openMarcelOnOpportunite = openMarcelOnOpportunite;

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES PREMIUM

const PREM_STATUS_LABELS = {
  actif: 'Actif',
  permanent: 'Permanent',
  realise_q1_2026: 'Réalisé Q1 2026',
  audit_planifie_juin: 'Planifié juin',
  inscription_proposee: 'À ouvrir',
  a_initier: 'À initier',
};

function renderServicesPremium() {
  const root = document.getElementById('serv-prem-grid');
  if (!root || !D.services_premium) return;
  root.innerHTML = D.services_premium.map(s => `
    <div class="serv-prem-card">
      <span class="serv-prem-status ${s.status}">${escape(PREM_STATUS_LABELS[s.status] || s.status)}</span>
      <div class="serv-prem-label">${escape(s.label)}</div>
      <div class="serv-prem-pitch">${escape(s.pitch)}</div>
      <div class="serv-prem-detail">${escape(s.detail)}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES

function renderServices() {
  const s = D.services;
  const rdv = s.rdv_prochain;
  const trips = s.voyages_planifies;
  const partns = s.partenaires;

  const rdvDate = new Date(rdv.date);
  const rdvLabel = rdvDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const rdvHour = rdvDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  document.getElementById('serv-wrap').innerHTML = `
    <div class="serv-block">
      <div class="serv-block-label">— Prochain rendez-vous</div>
      <div class="serv-rdv-date">${escape(rdvLabel)}</div>
      <div class="serv-rdv-meta"><strong>${escape(rdvHour)}</strong> · ${escape(rdv.type)} · avec ${escape(rdv.avec)}</div>
      <div class="serv-rdv-sub">Sujet : <em>${escape(rdv.sujet)}</em></div>
      <div style="margin-top:14px;">
        <a class="liv-action" href="#" style="display:inline-block;">Reporter / annuler</a>
      </div>
    </div>

    <div class="serv-block">
      <div class="serv-block-label">— Voyages planifiés</div>
      ${trips.map(t => `
        <div class="serv-trip">
          <strong>${escape(t.destination)}</strong><br>
          ${escape(t.dates)}<br>
          via ${escape(t.via)}
          <span class="serv-trip-status">${escape(t.status)}</span>
        </div>
      `).join('')}
      ${trips.length === 0 ? '<div style="color:var(--ink-faint); font-size:12.5px;">Aucun voyage planifié</div>' : ''}
    </div>

    <div class="serv-block">
      <div class="serv-block-label">— Partenaires whitelistés</div>
      <div class="partn-list">
        ${partns.map(p => `
          <div class="partn-row">
            <div class="partn-role">${escape(p.role)}</div>
            <div class="partn-name">${escape(p.nom)} · ${escape(p.ville)}</div>
            <div class="partn-meta">Dernier contact ${fmtDate(p.last_contact, { day:'numeric', month:'short', year:'2-digit' })} · ${escape(p.sujet)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKTEST

function renderBacktest() {
  const bt = D.backtest_12m;
  document.getElementById('bt-period').textContent = bt.periode_label;
  document.getElementById('bt-metrics').innerHTML = bt.metrics.map(m => `
    <div class="bt-metric">
      <div class="bt-value">${escape(m.value)}</div>
      <div class="bt-label">${escape(m.label)}</div>
      <div class="bt-detail">${escape(m.detail)}</div>
    </div>
  `).join('');
  const vs = bt.vs_family_office_classique;
  document.getElementById('bt-vs').innerHTML = `
    <div><strong>IKCP Family Office augmenté</strong><br><em>${escape(vs.cout_annuel)}</em></div>
    <div><strong>Family Office classique</strong><br><em>${escape(vs.cout_classique)}</em></div>
    <div><strong>Délai préparation dossier</strong><br><em>${escape(vs.delta_temps_traitement)}</em></div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY FEED

function renderActivity() {
  document.getElementById('activity-feed').innerHTML = D.activity.map(a => `
    <div class="act-row">
      <div class="act-ts">${fmtRelative(a.ts)}</div>
      <div class="act-who">${escape(a.who)}</div>
      <div class="act-what">${escape(a.what)}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// MARCEL EMBED MODAL

const overlay = () => document.getElementById('marcel-overlay');
const modalTitle = () => document.getElementById('marcel-modal-title');
const modalInput = () => document.getElementById('marcel-input');
const modalPrompts = () => document.getElementById('marcel-prompts');
const modalLoader = () => document.getElementById('marcel-loader');
const modalResp = () => document.getElementById('marcel-response');

let currentMarcelTheme = null;

function openMarcelModal({ title, theme, prompts, prefill }) {
  currentMarcelTheme = theme || null;
  modalTitle().textContent = title || 'Posez votre question';
  modalPrompts().innerHTML = (prompts || []).map(p => `<button class="marcel-prompt-chip">${escape(p)}</button>`).join('');
  modalPrompts().querySelectorAll('.marcel-prompt-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      modalInput().value = btn.textContent;
      submitMarcel();
    });
  });
  modalInput().value = prefill || '';
  modalResp().style.display = 'none';
  modalResp().textContent = '';
  modalLoader().style.display = 'none';
  overlay().classList.add('visible');
  setTimeout(() => modalInput().focus(), 250);
}

function closeMarcelModal() {
  overlay().classList.remove('visible');
}

function openMarcelOnTheme(theme, prefill) {
  const themeLabels = {
    transmission: "Transmission d'entreprise",
    fiscal: 'Ingénierie fiscale',
    art: "Marché de l'art",
    immo: 'Actifs immobiliers',
    markets: 'Marchés financiers',
    juridique: 'Juridique & succession',
    pe: 'Private Equity',
    financement: 'Financement',
    philanthropie: 'Philanthropie',
    admin: 'Conciergerie & admin',
  };
  openMarcelModal({
    title: themeLabels[theme] || 'Marcel',
    theme,
    prompts: [
      'Reprendre la dernière analyse',
      'Quelle est la prochaine étape ?',
      'Préparer le mémo pour Maxime',
    ],
    prefill,
  });
}
window.openMarcelOnTheme = openMarcelOnTheme;

function openMarcelOnArbitrage(arbId) {
  const arb = D.arbitrages.find(a => a.id === arbId);
  if (!arb) return;
  const conv = D.conversations.find(c => c.id === arb.conv_id);
  const theme = conv ? conv.theme : 'transmission';
  openMarcelModal({
    title: arb.titre,
    theme,
    prompts: [
      'Quelles conditions pour valider cet arbitrage ?',
      'Risques et points d\'attention ?',
      'Étapes opérationnelles + planning',
    ],
    prefill: '',
  });
}
window.openMarcelOnArbitrage = openMarcelOnArbitrage;

async function submitMarcel() {
  const q = modalInput().value.trim();
  if (!q) { modalInput().focus(); return; }
  modalLoader().style.display = 'flex';
  modalResp().style.display = 'none';
  modalResp().textContent = '';

  // Préambule "famille office privé" pour personnaliser la réponse
  const principal = D.client.members.find(m => m.role === 'principal');
  const co = D.client.members.find(m => m.role === 'co-titulaire');
  const preamble = `[Espace privé · ${D.client.family_name}] Vous parlez à ${principal.first} & ${co ? co.first : ''}. ` +
    `Membre depuis ${fmtDate(D.client.member_since, { month: 'long', year: 'numeric' })}. ` +
    `Patrimoine net consolidé ${fmtEurShort(D.patrimoine.net_worth)}.`;

  let result;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(MARCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `${preamble}\n\nQuestion : ${q}`,
        history: [],
        theme: currentMarcelTheme,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json.reply) throw new Error('reply vide');
    result = json.reply;
  } catch (err) {
    console.warn('[IKCP] Marcel indisponible, mock', err);
    result =
      `*Mode démo — Marcel inatteignable depuis ce prototype.*\n\n` +
      `Votre question : ${q}\n\n` +
      `Une fois le Worker \`ikcp-chat\` accessible (ou la page hébergée sur ikcp.eu pour passer le CORS), Marcel répondra ici avec :\n` +
      `- une analyse sourcée (CGI, BOFIP, APIs partenaires)\n` +
      `- le contexte famille (patrimoine ${fmtEurShort(D.patrimoine.net_worth)}, structure DupSoft, allocation)\n` +
      `- une proposition d'arbitrage prête pour Maxime`;
  }

  modalLoader().style.display = 'none';
  modalResp().style.display = 'block';
  modalResp().innerHTML = mdLite(result);
  modalResp().scrollTop = 0;
}

function mdLite(text) {
  const html = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/<!--[\s\S]*?-->/g, '');  // strip follow-ups HTML comment
  return (typeof window !== 'undefined' && window.IKCP_linkify) ? window.IKCP_linkify(html) : html;
}

// ─────────────────────────────────────────────────────────────────────────────
// PWA — installable mobile + desktop
//
// Pattern : on capture `beforeinstallprompt` (Chrome/Android), on stocke
// l'event, et au clic sur "Installer" on appelle `prompt()`. Sur iOS Safari
// (qui n'a pas l'event), on affiche un message contextuel "Partager →
// Sur l'écran d'accueil".

let deferredPrompt = null;
const DISMISSED_KEY = 'ikcp_install_dismissed_until';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function shouldShowBanner() {
  if (isStandalone()) return false;
  const dismissed = +localStorage.getItem(DISMISSED_KEY) || 0;
  if (dismissed > Date.now()) return false;
  return true;
}

function setupPwaInstall() {
  // Service worker — réutilise le sw.js du site
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  }

  const banner = document.getElementById('install-banner');
  const btn = document.getElementById('install-btn');
  const dismiss = document.getElementById('install-dismiss');
  if (!banner || !btn || !dismiss) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (shouldShowBanner()) banner.classList.add('show');
  });

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.classList.remove('show');
    } else if (isIos()) {
      alert("Sur iPhone : touchez le bouton Partager (carré avec flèche) puis « Sur l'écran d'accueil ».");
    } else {
      alert("Pour installer : utilisez le menu de votre navigateur → Installer l'application.");
    }
  });

  dismiss.addEventListener('click', () => {
    banner.classList.remove('show');
    // Re-proposer dans 7 jours
    localStorage.setItem(DISMISSED_KEY, Date.now() + 7 * 86400000);
  });

  // Sur iOS (pas d'event natif) — on affiche après 3 s si la fenêtre n'est pas standalone
  if (isIos() && shouldShowBanner()) {
    setTimeout(() => banner.classList.add('show'), 3000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderScorecard();
  renderPatrimoine();
  renderTimeline();
  renderArbitrages();
  renderConversations();
  renderDocuments();
  renderUniversPerso();
  renderLivrables();
  renderOpportunites();
  renderServicesPremium();
  renderServices();
  renderBacktest();
  renderActivity();
  setupPwaInstall();

  // Modal Marcel — bind close + send + Enter
  document.getElementById('marcel-close').addEventListener('click', closeMarcelModal);
  document.getElementById('marcel-send').addEventListener('click', submitMarcel);
  document.getElementById('marcel-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitMarcel();
  });
  document.getElementById('marcel-overlay').addEventListener('click', e => {
    if (e.target.id === 'marcel-overlay') closeMarcelModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay().classList.contains('visible')) closeMarcelModal();
  });

  // Bouton "Exporter mes données" — déclenche le download d'un JSON démo
  document.getElementById('export-data-btn')?.addEventListener('click', e => {
    e.preventDefault();
    const payload = {
      export_meta: {
        version: '1.0-demo',
        generated_at: new Date().toISOString(),
        service: 'ikcp-client (preview)',
        legal_basis: 'RGPD art. 20 — droit à la portabilité',
        note: 'Export démo depuis le dashboard backtesté. En production, ce JSON est généré côté Worker ikcp-client via GET /api/export/me.',
      },
      family: D.client,
      patrimoine: D.patrimoine,
      univers_perso: D.univers_perso,
      conversations: D.conversations,
      arbitrages: D.arbitrages,
      documents: D.documents,
      livrables: D.livrables,
      activity: D.activity,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ikcp-export-famille-dupont-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  });

  // Bouton "+ nouvelle question"
  document.getElementById('new-marcel').addEventListener('click', e => {
    e.preventDefault();
    openMarcelModal({
      title: 'Nouvelle question',
      theme: null,
      prompts: [
        'Bilan rapide du trimestre',
        'Quelles optimisations 2026 reste-t-il ?',
        'Préparer un point avec Maxime',
      ],
    });
  });
});
