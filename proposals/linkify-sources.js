/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 * Code protégé par le Code de la propriété intellectuelle français
 * (CPI L111-1, L113-9, L122-4). Reproduction interdite sans autorisation.
 *
 * IKCP — Linkify sources juridiques
 *
 * Convertit les mentions de sources réglementaires (CGI, BOFIP, Code civil,
 * Code de commerce, CMF) en liens cliquables vers les bases publiques :
 *  - Légifrance (legifrance.gouv.fr) pour CGI / Code civil / CMF / CSS
 *  - BOFIP (bofip.impots.gouv.fr) pour la doctrine fiscale
 *
 * Usage :
 *   import { linkifySources } from './linkify-sources.js';
 *   element.innerHTML = linkifySources(htmlText);
 *
 * Ou en attach global :
 *   window.IKCP_linkify = linkifySources;
 *
 * Conçu pour être idempotent — on n'altère pas les liens déjà présents.
 */

const LEGIFRANCE_CGI = 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI';
const LEGIFRANCE_BASE = 'https://www.legifrance.gouv.fr/search/code';
const BOFIP_BASE = 'https://bofip.impots.gouv.fr';

// Patterns ordonnés du plus spécifique au plus générique.
// Chaque pattern : regex + builder d'URL.
const PATTERNS = [
  // CGI 150-0 B ter, CGI 787 B, art. 779 I CGI, art. 990 I CGI, etc.
  // Syntaxes acceptées :
  //  - "CGI 779 I" / "CGI 787 B" / "CGI 150-0 B ter" / "art. 779 I CGI"
  //  - "article 200 CGI" / "CGI art. 31"
  {
    name: 'cgi',
    regex: /\b(?:art\.?\s*|article\s+)?(?:CGI\s+|CGI\s+art\.?\s*)?((?:\d+(?:[-\s]\d+)?(?:\s*[A-Z](?:\s*(?:bis|ter|quater|quinquies|sexies))?)?(?:\s*[IVX]+)?))\s*CGI\b/gi,
    fallback: /\bCGI\s+(?:art\.?\s*)?(\d+(?:[-\s]\d+)?(?:\s*[A-Z](?:\s*(?:bis|ter|quater|quinquies|sexies))?)?(?:\s*[IVX]+)?)\b/gi,
    label: m => `CGI ${m[1].trim().replace(/\s+/g, ' ')}`,
    href: m => {
      const article = m[1].trim().replace(/\s+/g, '-');
      return `${LEGIFRANCE_BASE}?tab_selection=code&searchField=ALL&query=${encodeURIComponent('CGI ' + article)}&searchType=ALL&typePagination=DEFAULT&sortValue=PERTINENCE&pageSize=10&page=1&tab_selection=code#code`;
    },
  },
  // BOFIP — ex: BOFIP-ENR-DMTG-10-50, BOFIP-IFI-VAL-30, BOFIP-RPPM-PVBMI-30-10-60
  {
    name: 'bofip',
    regex: /\bBOFIP[-\s]([A-Z]+(?:[-\s][A-Z\d]+)+)\b/gi,
    label: m => `BOFIP-${m[1].toUpperCase().replace(/\s+/g, '-')}`,
    href: m => {
      const ref = m[1].toUpperCase().replace(/\s+/g, '-');
      // Le BOFIP n'a pas de deep-link stable par référence ; on renvoie la
      // recherche fédérée qui mène directement au document dans 99 % des cas.
      return `${BOFIP_BASE}/recherche?q=${encodeURIComponent('BOFIP-' + ref)}`;
    },
  },
  // Code civil — "art. 757 Code civil", "Code civil 1133"
  {
    name: 'code_civil',
    regex: /\b(?:art\.?\s*|article\s+)?(\d+(?:[-\s]\d+)?(?:\s*[A-Z](?:\s*(?:bis|ter|quater))?)?)\s*(?:du\s+)?Code\s+civil\b/gi,
    label: m => `Code civil art. ${m[1].trim().replace(/\s+/g, ' ')}`,
    href: m => {
      const article = m[1].trim().replace(/\s+/g, '-');
      return `${LEGIFRANCE_BASE}?tab_selection=code&searchField=ALL&query=${encodeURIComponent('Code civil ' + article)}&searchType=ALL`;
    },
  },
  // CMF (Code monétaire et financier) — "CMF L533-1", "art. L533-13 CMF"
  {
    name: 'cmf',
    regex: /\b(?:art\.?\s*|article\s+)?([LR]\d+(?:[-\s]\d+)+)\s*CMF\b|\bCMF\s+(?:art\.?\s*|article\s+)?([LR]\d+(?:[-\s]\d+)+)\b/gi,
    label: m => `CMF ${(m[1] || m[2]).trim().replace(/\s+/g, '-')}`,
    href: m => {
      const article = (m[1] || m[2]).trim().replace(/\s+/g, '-');
      return `${LEGIFRANCE_BASE}?tab_selection=code&searchField=ALL&query=${encodeURIComponent('CMF ' + article)}&searchType=ALL`;
    },
  },
  // Code de commerce — "art. L233-3 Code de commerce"
  {
    name: 'code_commerce',
    regex: /\b(?:art\.?\s*|article\s+)?([LR]\d+(?:[-\s]\d+)+)\s*(?:du\s+)?Code\s+de\s+commerce\b/gi,
    label: m => `Code commerce art. ${m[1].trim().replace(/\s+/g, '-')}`,
    href: m => {
      const article = m[1].trim().replace(/\s+/g, '-');
      return `${LEGIFRANCE_BASE}?tab_selection=code&searchField=ALL&query=${encodeURIComponent('Code de commerce ' + article)}&searchType=ALL`;
    },
  },
  // Loi de finances — "LF 2026", "loi de finances 2026"
  {
    name: 'lf',
    regex: /\b(?:LF|loi\s+de\s+finances)\s+(\d{4})\b/gi,
    label: m => `LF ${m[1]}`,
    href: m => `${LEGIFRANCE_BASE}?tab_selection=lawarticledecree&searchField=ALL&query=${encodeURIComponent('loi finances ' + m[1])}&searchType=ALL`,
  },
  // Luxembourg — "LIR art. 166", "LIR 168bis"
  {
    name: 'lux_lir',
    regex: /\bLIR\s+(?:art\.?\s*|article\s+)?(\d+(?:\s*(?:bis|ter|quater))?)\b/gi,
    label: m => `LIR Luxembourg art. ${m[1].trim()}`,
    href: m => `https://legilux.public.lu/eli/etat/leg/code/impot_revenu/jo`,
  },
  // Suisse — "LIFD 14", "LIFD art. 69", "LFID 2014"
  {
    name: 'ch_lifd',
    regex: /\bLIFD\s+(?:art\.?\s*|article\s+)?(\d+(?:\s*(?:bis|ter))?)\b/gi,
    label: m => `LIFD Suisse art. ${m[1].trim()}`,
    href: m => `https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/fr`,
  },
  // OCDE — "modèle OCDE art. 4", "convention OCDE 13"
  {
    name: 'ocde',
    regex: /\b(?:mod[èe]le\s+)?OCDE\s+(?:art\.?\s*|article\s+)?(\d+(?:\s*(?:bis|ter))?)\b/gi,
    label: m => `Modèle OCDE art. ${m[1].trim()}`,
    href: m => `https://www.oecd.org/fr/fiscalite/conventions/`,
  },
  // Convention bilatérale — "convention FR-CH 1966", "FR-LUX 1958", "FR-USA 1994"
  {
    name: 'convention_bilat',
    regex: /\b(?:convention\s+)?FR-([A-Z]{2,3})\s+(\d{4})\b/g,
    label: m => `Convention FR-${m[1]} ${m[2]}`,
    href: m => `https://www.impots.gouv.fr/portail/les-conventions-fiscales-internationales`,
  },
  // BOFIP-INT (international) - "BOFIP-INT-CVB-LUX"
  {
    name: 'bofip_int',
    regex: /\bBOFIP[-\s]INT[-\s]([A-Z\d\-]+)\b/gi,
    label: m => `BOFIP-INT-${m[1].toUpperCase()}`,
    href: m => `${BOFIP_BASE}/recherche?q=${encodeURIComponent('BOFIP-INT-' + m[1].toUpperCase())}`,
  },
];

/**
 * Linkifie un fragment HTML (ou texte) en transformant les mentions de
 * sources réglementaires en `<a class="src-link">`.
 * Préserve les balises HTML existantes — n'opère que sur les nœuds texte.
 *
 * @param {string} html  Fragment HTML (peut contenir <strong>, <em>, <br>, etc.)
 * @returns {string} HTML enrichi avec liens
 */
export function linkifySources(html) {
  if (!html) return html;
  // Découpe sur les balises HTML pour ne traiter que les portions texte.
  // Pas un parser DOM complet — suffit pour notre rendu mdLite.
  const parts = html.split(/(<[^>]+>)/g);
  return parts.map(part => {
    if (part.startsWith('<')) return part; // balise — laisser tel quel
    return applyPatterns(part);
  }).join('');
}

function applyPatterns(text) {
  let out = text;
  for (const p of PATTERNS) {
    out = out.replace(p.regex, (full, ...groups) => {
      const m = [full, ...groups];
      const label = p.label(m);
      const href = p.href(m);
      return `<a href="${href}" target="_blank" rel="noopener" class="src-link" title="Ouvrir ${label} sur Légifrance / BOFIP">${escapeHtml(label)}</a>`;
    });
    if (p.fallback) {
      out = out.replace(p.fallback, (full, ...groups) => {
        const m = [full, ...groups];
        const label = p.label(m);
        const href = p.href(m);
        return `<a href="${href}" target="_blank" rel="noopener" class="src-link" title="Ouvrir ${label}">${escapeHtml(label)}</a>`;
      });
    }
  }
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Attach global pour les pages qui n'utilisent pas les modules
if (typeof window !== 'undefined') {
  window.IKCP_linkify = linkifySources;
}
