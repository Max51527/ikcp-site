/**
 * notion-sync.js — Notion est la source unique des fiches patrimoniales.
 *
 * Maxime écrit dans la base Notion « Fiches patrimoniales IKCP ». Ce module
 * tire les pages marquées « Publié », les traduit dans la forme attendue par
 * le site, et les écrit dans la table D1 `fiches`. Le site ne lit jamais
 * Notion en direct : il lit D1, qui reste en France et répond en 10 ms.
 *
 * Sens unique, volontairement. Notion écrit, le site lit. Rien ne remonte.
 *
 * Contrat de rédaction : les titres de niveau 2 de la page Notion sont les
 * clés. Voir la page MODÈLE dans la base. Un titre inconnu est ignoré sans
 * bruit ; une section absente donne un champ vide, jamais une erreur.
 *
 * Secrets attendus sur le worker :
 *   NOTION_TOKEN        — jeton d'intégration Notion (interne)
 *   NOTION_FICHES_DB    — identifiant de la base Notion des fiches
 *   NOTION_TEXTES_DB    — identifiant de la base Notion des textes du site
 *
 * Auteur : IKCP · dernière révision : 2026-08-04
 */

const NOTION_VERSION = '2022-06-28';

/** Les titres de niveau 2 acceptés, et le champ de fiche qu'ils alimentent. */
const SECTIONS = {
  'sous-titre':              { champ: 'sousTitre',         forme: 'texte' },
  'résumé exécutif':         { champ: 'resumeExecutif',    forme: 'liste' },
  'profil cible':            { champ: 'profilCible',       forme: 'liste' },
  'le problème':             { champ: 'probleme',          forme: 'texte' },
  "la question qu'on se pose":{ champ: 'questionType',     forme: 'texte' },
  'quand éviter':            { champ: 'quandEviter',       forme: 'liste' },
  'explication claire':      { champ: 'explicationClaire', forme: 'texte' },
  'à retenir':               { champ: 'aRetenir',          forme: 'texte' },
  'les étapes':              { champ: 'schemaEtapes',      forme: 'liste' },
  'prérequis':               { champ: 'prerequis',         forme: 'liste' },
  'mise en œuvre':           { champ: 'miseEnOeuvre',      forme: 'liste' },
  'bénéfices':               { champ: 'benefices',         forme: 'liste' },
  'risques':                 { champ: 'risques',           forme: 'liste' },
  'impacts 360':             { champ: 'impacts360',        forme: 'liste' },
  'questions pour marcel':   { champ: 'questionsMarcel',   forme: 'liste' },
  'checklist':               { champ: 'checklist',         forme: 'liste' },
  'documents à réunir':      { champ: 'documents',         forme: 'liste' },
  'cas pratique':            { champ: 'casPratique',       forme: 'liste' },
  'questions fréquentes':    { champ: 'faq',               forme: 'liste' },
  'sources':                 { champ: 'sources',           forme: 'liste' },
  'avertissement':           { champ: 'avertissement',     forme: 'texte' },
};

/** Normalise un titre de section : casse, accents parasites, espaces. */
function cle(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[:：]$/, '');
}

/** Concatène les fragments de texte enrichi d'un bloc Notion. */
function texteDe(richText) {
  return (richText || []).map(t => t.plain_text || '').join('').trim();
}

async function notion(env, chemin, init) {
  const res = await fetch('https://api.notion.com/v1' + chemin, {
    ...(init || {}),
    headers: {
      'Authorization': 'Bearer ' + env.NOTION_TOKEN,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...((init && init.headers) || {}),
    },
  });
  if (!res.ok) {
    const corps = await res.text();
    throw new Error('Notion ' + res.status + ' sur ' + chemin + ' — ' + corps.slice(0, 300));
  }
  return await res.json();
}

/** Toutes les pages « Publié » de la base, pagination comprise. */
async function pagesPubliees(env) {
  const out = [];
  let cursor;
  do {
    const body = {
      filter: { property: 'Statut', select: { equals: 'Publié' } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const r = await notion(env, '/databases/' + env.NOTION_FICHES_DB + '/query', {
      method: 'POST', body: JSON.stringify(body),
    });
    out.push(...(r.results || []));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

/** Tous les blocs de premier niveau d'une page, pagination comprise. */
async function blocsDe(env, pageId) {
  const out = [];
  let cursor;
  do {
    const q = '/blocks/' + pageId + '/children?page_size=100' + (cursor ? '&start_cursor=' + cursor : '');
    const r = await notion(env, q);
    out.push(...(r.results || []));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

/** Découpe les blocs en sections, selon les titres de niveau 2. */
function decouper(blocs) {
  const sections = {};
  let courante = null;
  for (const b of blocs) {
    if (b.type === 'heading_2') {
      const k = cle(texteDe(b.heading_2.rich_text));
      courante = SECTIONS[k] ? k : null;
      if (courante && !sections[courante]) sections[courante] = [];
      continue;
    }
    if (!courante) continue; // avant le premier titre : notes de rédaction, ignorées
    const t = b.type;
    let txt = '';
    if (t === 'paragraph') txt = texteDe(b.paragraph.rich_text);
    else if (t === 'bulleted_list_item') txt = texteDe(b.bulleted_list_item.rich_text);
    else if (t === 'numbered_list_item') txt = texteDe(b.numbered_list_item.rich_text);
    else if (t === 'to_do') txt = texteDe(b.to_do.rich_text);
    else if (t === 'quote') txt = texteDe(b.quote.rich_text);
    else if (t === 'callout') txt = texteDe(b.callout.rich_text);
    else if (t === 'heading_3') txt = texteDe(b.heading_3.rich_text);
    if (txt) sections[courante].push(txt);
  }
  return sections;
}

/** Une page Notion devient une fiche du site. */
function versFiche(page, sections) {
  const p = page.properties || {};
  const sel = n => (p[n] && p[n].select && p[n].select.name) || '';
  const txt = n => texteDe((p[n] && (p[n].rich_text || p[n].title)) || []);
  const coche = n => !!(p[n] && p[n].checkbox);
  const date = n => (p[n] && p[n].date && p[n].date.start) || '';

  const fiche = {
    slug: txt('slug'),
    titre: txt('Titre'),
    categorie: sel('Catégorie'),
    complexite: sel('Complexité'),
    horizonMiseEnOeuvre: txt('Horizon de mise en oeuvre'),
    requiresHumanValidation: coche('Validation humaine requise'),
    simulateurId: sel('Simulateur rattaché') === 'aucun' ? '' : sel('Simulateur rattaché'),
    version: txt('Version') || '1.0',
    dateRevue: date('Date de révision'),
    auteur: txt('Auteur') || 'IKCP',
    _source: 'notion',
    _notionId: page.id,
  };

  for (const [k, def] of Object.entries(SECTIONS)) {
    const lignes = sections[k] || [];
    fiche[def.champ] = def.forme === 'texte' ? lignes.join('\n\n') : lignes;
  }

  // Garde-fou éditorial : une fiche sans avertissement en reçoit un.
  if (!fiche.avertissement) {
    fiche.avertissement = 'Cette fiche a une vocation pédagogique et informative. ' +
      'Elle ne constitue pas une recommandation personnalisée au sens de l\'art. L.541-1 ' +
      'du Code monétaire et financier.';
  }
  return fiche;
}

/**
 * Tire Notion et écrit dans D1. Ne supprime rien : une fiche retirée de
 * Notion doit être dépubliée à la main, pour qu'une fausse manœuvre là-bas
 * ne vide pas le site ici.
 */
export async function syncNotionToD1(env) {
  if (!env.NOTION_TOKEN || !env.NOTION_FICHES_DB) {
    return { ok: false, error: 'NOTION_TOKEN ou NOTION_FICHES_DB absent du worker' };
  }
  const pages = await pagesPubliees(env);
  const rapport = { ok: true, lues: pages.length, ecrites: 0, ignorees: [], erreurs: [] };

  for (const page of pages) {
    try {
      const sections = decouper(await blocsDe(env, page.id));
      const fiche = versFiche(page, sections);

      if (!fiche.slug || fiche.slug === 'modele-ne-pas-publier') {
        rapport.ignorees.push(fiche.slug || '(sans slug)');
        continue;
      }
      await env.D1.prepare(
        'INSERT INTO fiches (slug, data, statut, updated_at) VALUES (?,?,?,?) ' +
        'ON CONFLICT(slug) DO UPDATE SET data=excluded.data, statut=excluded.statut, updated_at=excluded.updated_at'
      ).bind(
        fiche.slug,
        JSON.stringify(fiche).slice(0, 400000),
        'publie',
        new Date().toISOString()
      ).run();
      rapport.ecrites++;
    } catch (e) {
      rapport.erreurs.push({ page: page.id, message: String(e.message || e).slice(0, 240) });
    }
  }
  rapport.ok = rapport.erreurs.length === 0;
  return rapport;
}

/* ══════════════════════════════════════════════════════════════════════
   Les textes du site — la seconde base Notion.

   Même principe que les fiches : Notion écrit, le site lit. Chaque ligne
   porte une clé (home.hero.headline_1, tarifs.o2.prix…) qui dit au site où
   poser le texte. La clé ne se modifie jamais ; le texte, si.

   Ces valeurs atterrissent dans la table `contenu`, que cms-hydrate.js
   applique sur les balises data-cms au chargement de la page. Une zone
   absente de Notion garde simplement le texte écrit dans le HTML : rien ne
   peut disparaître par oubli.
   ══════════════════════════════════════════════════════════════════════ */

async function textesPublies(env) {
  const out = [];
  let cursor;
  do {
    const body = {
      filter: { property: 'Statut', select: { equals: 'Publié' } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const r = await notion(env, '/databases/' + env.NOTION_TEXTES_DB + '/query', {
      method: 'POST', body: JSON.stringify(body),
    });
    out.push(...(r.results || []));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

export async function syncTextesToD1(env) {
  if (!env.NOTION_TOKEN || !env.NOTION_TEXTES_DB) {
    return { ok: false, error: 'NOTION_TOKEN ou NOTION_TEXTES_DB absent du worker' };
  }
  const pages = await textesPublies(env);
  const rapport = { ok: true, lues: pages.length, ecrites: 0, ignorees: [], erreurs: [] };

  for (const page of pages) {
    try {
      const p = page.properties || {};
      const cle = texteDe((p['Clé'] && p['Clé'].rich_text) || []);
      const valeur = texteDe((p['Texte'] && p['Texte'].rich_text) || []);

      // Une clé vide n'a pas d'adresse sur le site ; un texte vide effacerait
      // la zone sans qu'on l'ait voulu. Les deux sont écartés, et signalés.
      if (!cle) { rapport.ignorees.push('(ligne sans clé)'); continue; }
      if (!valeur) { rapport.ignorees.push(cle + ' (texte vide)'); continue; }

      await env.D1.prepare(
        'INSERT INTO contenu (cle, valeur) VALUES (?,?) ' +
        'ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur'
      ).bind(cle, valeur.slice(0, 8000)).run();
      rapport.ecrites++;
    } catch (e) {
      rapport.erreurs.push({ page: page.id, message: String(e.message || e).slice(0, 240) });
    }
  }
  rapport.ok = rapport.erreurs.length === 0;
  return rapport;
}

/** Les deux bases en un seul geste — c'est ce que déclenche le bouton. */
export async function syncNotionComplet(env) {
  const fiches = await syncNotionToD1(env).catch(e => ({ ok: false, error: String(e.message || e) }));
  const textes = await syncTextesToD1(env).catch(e => ({ ok: false, error: String(e.message || e) }));
  return { ok: !!(fiches.ok && textes.ok), fiches, textes };
}
