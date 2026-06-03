/**
 * IKCP Content Loader — hydrate les pages statiques avec le contenu /content/*.json
 * édité via Sveltia CMS.
 *
 * Usage dans une page HTML :
 *   <script type="module" src="/content/loader.js"></script>
 *   <div data-ikcp-tariff="augmente" data-field="price_label"></div>
 *   <ul data-ikcp-list="cases" data-template="case-card"></ul>
 *
 * Convention :
 *   - data-ikcp-text="quotes/items/0/quote"            → injecte le texte
 *   - data-ikcp-attr="quotes/items/0/quote|href"       → injecte dans un attribut
 *   - data-ikcp-list="cases"                           → liste de cas, rendus via <template id="case-card">
 *   - data-ikcp-tariff="augmente"                      → trouve le tier par id et rend ses fields
 *
 * Cache : 5 min (Cloudflare Pages re-deploy après chaque edit Sveltia → invalidation auto).
 *
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const _cache = new Map();

async function fetchContent(name) {
  const cached = _cache.get(name);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const url = name.endsWith('.json') ? `/content/${name}` : `/content/${name}.json`;
  const r = await fetch(url, { cache: 'default' });
  if (!r.ok) throw new Error(`content_load_failed: ${name} (${r.status})`);
  const data = await r.json();
  _cache.set(name, { data, ts: Date.now() });
  return data;
}

// Liste markdown collection (cas, articles) — utilise un index généré ou un walk côté serveur.
// Pour MVP, on liste les cas via un index statique /content/cases/index.json
// (que Sveltia peut maintenir, ou qu'on regénère via GitHub Action après chaque commit).
async function fetchCollection(folder) {
  const idx = await fetch(`/content/${folder}/index.json`);
  if (!idx.ok) return [];
  return await idx.json();
}

function getByPath(obj, path) {
  return path.split('/').reduce((acc, k) => acc?.[isNaN(k) ? k : Number(k)], obj);
}

async function hydrateTextNodes() {
  for (const el of document.querySelectorAll('[data-ikcp-text]')) {
    const [file, ...rest] = el.dataset.ikcpText.split('/');
    try {
      const data = await fetchContent(file);
      el.textContent = getByPath(data, rest.join('/')) ?? '';
    } catch (e) { console.warn('ikcp-text fail:', el.dataset.ikcpText, e); }
  }
}

async function hydrateAttrs() {
  for (const el of document.querySelectorAll('[data-ikcp-attr]')) {
    const [path, attr] = el.dataset.ikcpAttr.split('|');
    const [file, ...rest] = path.split('/');
    try {
      const data = await fetchContent(file);
      const value = getByPath(data, rest.join('/'));
      if (value != null) el.setAttribute(attr, value);
    } catch (e) { console.warn('ikcp-attr fail:', el.dataset.ikcpAttr, e); }
  }
}

async function hydrateTariffs() {
  let tariffs = null;
  for (const el of document.querySelectorAll('[data-ikcp-tariff]')) {
    tariffs = tariffs || await fetchContent('tariffs').catch(() => null);
    if (!tariffs) return;
    const tier = tariffs.tiers.find(t => t.id === el.dataset.ikcpTariff);
    if (!tier) continue;
    const field = el.dataset.field;
    if (field === 'features') {
      el.innerHTML = tier.features.map(f => `<li>${escapeHtml(f)}</li>`).join('');
    } else if (field) {
      el.textContent = tier[field] ?? '';
    }
  }
}

async function hydrateLists() {
  for (const el of document.querySelectorAll('[data-ikcp-list]')) {
    const collection = el.dataset.ikcpList;
    const tplId = el.dataset.template;
    const tpl = tplId ? document.getElementById(tplId) : null;
    if (!tpl) { console.warn('ikcp-list missing template:', tplId); continue; }

    try {
      const items = collection === 'cases'
        ? await fetchCollection('cases')
        : (await fetchContent(collection))?.items || [];
      const sorted = items.filter(it => it.published !== false)
                          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      el.innerHTML = sorted.map(item => renderTemplate(tpl.innerHTML, item)).join('');
    } catch (e) { console.warn('ikcp-list fail:', collection, e); }
  }
}

function renderTemplate(html, data) {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = key.split('.').reduce((acc, k) => acc?.[k], data);
    return value != null ? escapeHtml(String(value)) : '';
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Auto-hydratation au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

async function main() {
  await Promise.all([hydrateTextNodes(), hydrateAttrs(), hydrateTariffs(), hydrateLists()]);
  document.dispatchEvent(new CustomEvent('ikcp:content-ready'));
}

// Export pour usage avancé
window.IKCP = { fetchContent, fetchCollection, getByPath };
