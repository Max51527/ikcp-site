/**
 * IKCP Collector Worker — Cloudflare Worker
 *
 * Agent automatise qui scrute les marches "profil collectionneur" :
 * montres / voitures / sneakers / lego / vins / art / yachts / etc.
 *
 * Architecture :
 *  - Storage : D1 Paris (table user_profile, market_watches, alerts)
 *  - Modules : /modules/<source>.js (live ou stub selon dispo gratuite)
 *  - Cron Trigger Cloudflare : execute dailyScan() chaque jour 7h Paris
 *  - Frontend : page admin protegee par token (lit alerts + watches)
 *
 * Endpoints HTTP (admin token requis sauf /health) :
 *   GET  /health                    - statut + modules disponibles
 *   GET  /profile?user_id=max       - profil utilisateur (passions, wishlist)
 *   POST /profile                   - { user_id, passions_json } upsert profil
 *   GET  /watches?user_id=max       - liste des watches actifs
 *   POST /watches                   - { user_id, market, category, query, target_price? } ajout watch
 *   DEL  /watches/:id               - desactive un watch
 *   GET  /alerts?user_id=max&unread=1 - liste alertes
 *   POST /scan                      - declenche un scan manuel (sinon cron quotidien)
 *   GET  /lookup?market=bricklink&q=10497-1 - lookup direct un item
 *
 * Cron : declenche /scan en interne chaque jour 7h Paris (cf wrangler.toml).
 *
 * Bindings :
 *   IKCP_COLLECTOR_DB (D1) - schema dans schema.sql
 *   ADMIN_TOKEN (secret)   - token pour endpoints admin
 *   REBRICKABLE_API_KEY (secret optionnel) - module Lego live
 *
 * Author : Maxime Juveneton · IKCP · 2026
 */

import * as BrickLink from './modules/bricklink.js';
import { MODULES_STUBS_LIST, getModuleStub } from './modules/stubs.js';

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://admin.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev',
  'http://localhost:3000', 'http://localhost:5500', 'http://localhost:8765',
  'http://127.0.0.1:5500', 'http://127.0.0.1:3000',
  'null', '',
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin)
    || (origin?.endsWith('.ikcp.eu'))
    || (origin?.endsWith('.workers.dev'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status = 200, origin = '') {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  return !!(m && env.ADMIN_TOKEN && m[1] === env.ADMIN_TOKEN);
}

const MODULES_LIVE = {
  bricklink: BrickLink,
};

// ──────────────────────────────────────────────────────────────
// Cron handler : scan quotidien des watches
// ──────────────────────────────────────────────────────────────
async function dailyScan(env) {
  const db = env.IKCP_COLLECTOR_DB;
  if (!db) return { error: 'D1 binding missing' };
  const startedAt = new Date().toISOString();
  const stats = { scanned: 0, alerts_created: 0, modules: {}, errors: [] };

  // Recupere tous les watches actifs
  const watchesRes = await db.prepare(
    'SELECT * FROM market_watches WHERE active = 1 ORDER BY last_check_at ASC LIMIT 50'
  ).all();
  const watches = watchesRes.results || [];

  // Group par marche
  const byMarket = {};
  for (const w of watches) {
    (byMarket[w.market] = byMarket[w.market] || []).push(w);
  }

  // Pour chaque module LIVE, declencher le scan
  for (const [marketId, mod] of Object.entries(MODULES_LIVE)) {
    const wlist = byMarket[marketId] || [];
    if (wlist.length === 0) continue;
    try {
      const results = await mod.dailyScan(env, db, wlist);
      stats.scanned += results.length;
      stats.modules[marketId] = { count: results.length };

      // Update last_check_at
      for (const r of results) {
        await db.prepare(
          'UPDATE market_watches SET last_check_at = ?, payload_json = ? WHERE id = ?'
        ).bind(startedAt, JSON.stringify(r.info || r.error || {}), r.watch_id).run();
      }
    } catch (e) {
      stats.errors.push({ module: marketId, error: e.message });
    }
  }

  // Pour les marches stubs : on ne fait rien automatiquement, juste log.
  for (const stub of MODULES_STUBS_LIST) {
    const wlist = byMarket[stub.id] || [];
    if (wlist.length > 0) {
      stats.modules[stub.id] = { count: wlist.length, status: 'stub-manual' };
    }
  }

  return { ok: true, started_at: startedAt, ...stats };
}

// ──────────────────────────────────────────────────────────────
// HTTP handler
// ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const db = env.IKCP_COLLECTOR_DB;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // ── /health (public)
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'ikcp-collector',
        version: '0.1.0',
        modules_live: Object.keys(MODULES_LIVE),
        modules_stub: MODULES_STUBS_LIST.map(m => ({ id: m.id, name: m.name, category: m.category, status: m.mvp_status })),
        configured: {
          db: !!db,
          admin_token: !!env.ADMIN_TOKEN,
          rebrickable_key: !!env.REBRICKABLE_API_KEY,
        },
      }, 200, origin);
    }

    // ── /lookup (public, sans token, juste pour tests)
    if (url.pathname === '/lookup') {
      const market = url.searchParams.get('market');
      const q = url.searchParams.get('q');
      if (!market || !q) return jsonResponse({ error: 'market and q required' }, 400, origin);
      const mod = MODULES_LIVE[market];
      if (!mod) {
        const stub = getModuleStub(market);
        return jsonResponse({ stub: true, market: stub }, 200, origin);
      }
      const r = await mod.lookupSet(q, env);
      return jsonResponse({ market, query: q, result: r }, 200, origin);
    }

    // ── Endpoints admin ci-dessous (token Bearer requis)
    if (!isAdmin(request, env)) {
      return jsonResponse({ error: 'unauthorized', hint: 'Header Authorization: Bearer <ADMIN_TOKEN>' }, 401, origin);
    }
    if (!db) return jsonResponse({ error: 'D1 binding missing' }, 500, origin);

    // ── /profile GET / POST
    if (url.pathname === '/profile') {
      if (request.method === 'GET') {
        const userId = url.searchParams.get('user_id') || 'max';
        const row = await db.prepare('SELECT * FROM user_profile WHERE user_id = ?').bind(userId).first();
        return jsonResponse({ profile: row || null }, 200, origin);
      }
      if (request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.user_id || !body?.passions_json) {
          return jsonResponse({ error: 'user_id et passions_json requis' }, 400, origin);
        }
        await db.prepare(`
          INSERT INTO user_profile (user_id, display_name, passions_json, updated_at, notes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            display_name = excluded.display_name,
            passions_json = excluded.passions_json,
            updated_at = excluded.updated_at,
            notes = excluded.notes
        `).bind(
          body.user_id,
          body.display_name || null,
          typeof body.passions_json === 'string' ? body.passions_json : JSON.stringify(body.passions_json),
          new Date().toISOString(),
          body.notes || null
        ).run();
        return jsonResponse({ ok: true }, 200, origin);
      }
    }

    // ── /watches GET / POST / DEL
    if (url.pathname === '/watches' || url.pathname.startsWith('/watches/')) {
      if (request.method === 'GET') {
        const userId = url.searchParams.get('user_id') || 'max';
        const rows = await db.prepare(
          'SELECT * FROM market_watches WHERE user_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 200'
        ).bind(userId).all();
        return jsonResponse({ watches: rows.results || [] }, 200, origin);
      }
      if (request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.user_id || !body?.market || !body?.category || !body?.query) {
          return jsonResponse({ error: 'user_id, market, category, query requis' }, 400, origin);
        }
        const result = await db.prepare(`
          INSERT INTO market_watches (user_id, market, category, query, target_price, last_check_at, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(
          body.user_id,
          body.market,
          body.category,
          body.query,
          body.target_price || null,
          new Date().toISOString(),
          new Date().toISOString()
        ).run();
        return jsonResponse({ ok: true, id: result.meta?.last_row_id }, 200, origin);
      }
      if (request.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        await db.prepare('UPDATE market_watches SET active = 0 WHERE id = ?').bind(id).run();
        return jsonResponse({ ok: true }, 200, origin);
      }
    }

    // ── /alerts
    if (url.pathname === '/alerts') {
      const userId = url.searchParams.get('user_id') || 'max';
      const unread = url.searchParams.get('unread') === '1';
      const sql = unread
        ? 'SELECT * FROM alerts WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC LIMIT 100'
        : 'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100';
      const rows = await db.prepare(sql).bind(userId).all();
      return jsonResponse({ alerts: rows.results || [] }, 200, origin);
    }

    // ── /scan POST (manuel)
    if (url.pathname === '/scan' && request.method === 'POST') {
      const result = await dailyScan(env);
      return jsonResponse(result, 200, origin);
    }

    return jsonResponse({ error: 'not_found', path: url.pathname }, 404, origin);
  },

  // ── Cron Trigger (configure dans wrangler.toml)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dailyScan(env));
  },
};
