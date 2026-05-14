/**
 * IKCP Lifestyle Specialists Worker — Cloudflare Worker
 *
 * Worker mutualisé pour 8 sous-agents Sonnet 4.6 :
 *   iris, emile, leon, josephine, helene, olympe, auguste, augustin
 *
 * Marcel (ikcp-chat) délègue via POST { agent, question, context? }
 *
 * Endpoints :
 *   GET  /health  — ping + statut configuration
 *   POST /        — { agent, question, context? } → { reply, agent, model, usage }
 *
 * Bindings requis :
 *   ANTHROPICAPIKEY  (secret) — clé API Anthropic sk-ant-...
 */

import { PROMPTS } from './prompts.js';

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://ikcp.fr',
  'https://www.ikcp.fr',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://admin.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev', // Marcel peut appeler
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'null', // file:// test local
  '',     // GET direct sans Origin header
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin)
    || (origin?.endsWith('.ikcp.eu'))
    || (origin?.endsWith('.workers.dev'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const AGENT_LIST = Object.keys(PROMPTS); // ['iris','emile','leon',...]

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // ─── /health ───
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'ikcp-lifestyle',
        agents: AGENT_LIST.map(k => ({
          id: k,
          name: PROMPTS[k].name,
          role: PROMPTS[k].role,
          model: PROMPTS[k].model,
        })),
        configured: { api_key: !!env.ANTHROPICAPIKEY },
        version: '1.0.0',
      }, { headers: corsHeaders(origin) });
    }

    // ─── POST / ───
    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, {
        status: 405, headers: corsHeaders(origin)
      });
    }

    if (!env.ANTHROPICAPIKEY) {
      return Response.json({ error: 'api_key_missing' }, {
        status: 500, headers: corsHeaders(origin)
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return Response.json({ error: 'invalid_json' }, {
        status: 400, headers: corsHeaders(origin)
      });
    }

    const { agent, question, context } = body || {};
    if (!agent || !PROMPTS[agent]) {
      return Response.json({
        error: 'unknown_agent',
        available_agents: AGENT_LIST,
      }, { status: 400, headers: corsHeaders(origin) });
    }
    if (!question || typeof question !== 'string' || question.trim().length < 3) {
      return Response.json({ error: 'invalid_question' }, {
        status: 400, headers: corsHeaders(origin)
      });
    }

    const spec = PROMPTS[agent];
    const userContent = context
      ? `CONTEXTE FOURNI PAR MARCEL :\n${context}\n\nQUESTION CLIENT :\n${question}`
      : question;

    // ─── Anthropic API call avec prompt caching sur le system ───
    let anthropicResp;
    try {
      anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPICAPIKEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: spec.model,
          max_tokens: 2048,
          // Prompt caching : le system prompt long est mis en cache (-80% coût)
          system: [
            {
              type: 'text',
              text: spec.system,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userContent }],
        }),
      });
    } catch (e) {
      return Response.json({
        error: 'anthropic_fetch_failed',
        detail: e.message,
      }, { status: 502, headers: corsHeaders(origin) });
    }

    if (!anthropicResp.ok) {
      const errTxt = await anthropicResp.text().catch(() => '');
      return Response.json({
        error: 'anthropic_upstream',
        status: anthropicResp.status,
        detail: errTxt.slice(0, 500),
      }, { status: 502, headers: corsHeaders(origin) });
    }

    const data = await anthropicResp.json();
    const reply = data.content?.[0]?.text || '';

    return Response.json({
      reply,
      agent: spec.name,
      agent_id: agent,
      role: spec.role,
      model: data.model,
      usage: data.usage,
      delegated_by: context ? 'Marcel' : 'direct',
    }, { headers: corsHeaders(origin) });
  },
};
