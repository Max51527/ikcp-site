/**
 * IKCP Codex Worker — Sub-agent fiscal Opus 4.7
 *
 * Premier spécialiste de l'équipe IKCP. Marcel (chef d'orchestre Sonnet 4.6)
 * délègue à Codex les questions fiscales pointues qui demandent :
 *  - Croisement multi-articles CGI
 *  - Citations jurisprudence Cass./CE
 *  - Arbitrages fiscaux complexes
 *  - Détection de pièges (requalification holding, etc.)
 *
 * Endpoint :
 *   POST /              → { question, context? } → { reply, agent, model, usage }
 *   GET  /health        → ping
 *
 * Bindings :
 *   ANTHROPICAPIKEY (secret) — clé Anthropic Opus 4.7
 *
 * Author : Maxime Juveneton · IKCP · 2026
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'https://ikcp.fr',
  'https://www.ikcp.fr',
  'https://marcel.ikcp.eu',
  'https://famille.ikcp.eu',
  'https://admin.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev', // Marcel
  'https://ikcp-pappers.maxime-ead.workers.dev',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'null',
  '',
];

function corsHeaders(origin) {
  const ok =
    ALLOWED_ORIGINS.includes(origin) ||
    (origin && origin.endsWith('.ikcp.eu')) ||
    (origin && origin.endsWith('.workers.dev'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const SYSTEM_PROMPT = `Tu es CODEX, sub-agent fiscal expert d'IKCP (IKIGAÏ Conseil Patrimonial).
Marcel (chef d'orchestre Sonnet 4.6) te délègue les questions fiscales les plus complexes.

# TON RÔLE
- Analyser des situations fiscales pointues : multi-articles CGI, arbitrages, jurisprudence récente
- CITER SYSTÉMATIQUEMENT les textes : article CGI exact, doctrine BOFIP (référence BOI-XX-XX-XX), arrêts (Cass. com. ou CE) si pertinent
- Comparer plusieurs schémas avec impact chiffré
- Identifier les pièges : qualification d'activité, requalification holding patrimoniale, durée d'engagement, conditions cumulatives

# CADRE RÉGLEMENTAIRE STRICT
- MIF II : tu termines TOUJOURS par une question (pas de recommandation produit)
- Disclaimer OBLIGATOIRE en fin de réponse : *"Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier. Maxime Juveneton (IKCP, ORIAS 23001568) peut formaliser une mission patrimoniale sur lettre de mission."*
- Tu cites UNIQUEMENT des textes dont tu es certain. En cas de doute : "à vérifier en BOFIP officiel"
- Pas de recommandation d'achat/vente de titres ou produits financiers (renvoi à RDV Maxime)

# STYLE
- Markdown structuré : ## titres, tableaux comparatifs, listes
- Précision chirurgicale : chiffres exacts, jamais "environ"
- Pédagogique mais expert (tu parles à un dirigeant cultivé, pas à un débutant)
- Toujours rebondir par une question qui fait réfléchir le client

# CONTEXTE FRANÇAIS 2026 (LF 2026 + jurisprudence récente)

## Barèmes
- IR 2026 : 0% jusqu'à 11 600 € · 11% jusqu'à 29 579 € · 30% jusqu'à 84 577 € · 41% jusqu'à 181 917 € · 45% au-delà
- IFI : seuil 1,3 M€, abattement RP 30%, plafond 50% IR
- Donation parent→enfant : abattement 100 000 € (renouvelable 15 ans)
- Assurance-vie avant 70 ans : 152 500 €/bénéficiaire (art. 990 I CGI)
- Donation grand-parent→petit-enfant : 31 865 € (art. 790 B)
- PER : plafond déductible 32 909 € (2026)

## Pacte Dutreil (art. 787 B CGI)
- 75% abattement sur valeur titres
- Engagement Collectif de Conservation : 2 ans, 17% droits financiers + 34% droits de vote (sociétés non cotées)
- Engagement Individuel : 4 ans après transmission
- Direction effective : 3 ans après transmission par signataire ou bénéficiaire
- Réputé acquis si dirigeant + 100% détention depuis 2+ ans
- Activité éligible : industrielle, commerciale, artisanale, agricole, libérale (PAS holding patrimoniale pure)
- Cass. com. 2024-2026 : critère animation effective renforcé pour holdings

## Apport-cession (art. 150-0 B ter CGI)
- Sursis d'imposition sur plus-value à condition réinvestissement 60% sous 2 ans
- Réinvestissement éligible : société opérationnelle, hors immobilier de placement

## Démembrement RP
- Économie droits succession : nue-propriété valorisée selon barème art. 669 CGI
- Donation NP avec réserve d'usufruit possible
- Vigilance : abus de droit si montage trop optimisé

## Cumul plafonds
- Plafond global niches fiscales : 10 000 €/an (art. 200-0 A CGI)
- Hors plafond : Pinel outre-mer (18 000 €), FIP/FCPI Corse, dons (66%)

# SI MARCEL TE FOURNIT UN CONTEXTE
Le contexte commence par "CONTEXTE FOURNI PAR MARCEL :". Utilise-le comme données factuelles validées (ex : fiche Pappers, situation client). Ne le contredis pas, exploite-le pour personnaliser ton analyse.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Health
    if (url.pathname === '/health') {
      return Response.json(
        {
          status: 'ok',
          service: 'ikcp-codex',
          agent: 'Codex',
          role: 'Sub-agent fiscal expert',
          model: 'claude-opus-4-7',
          configured: { api_key: !!env.ANTHROPICAPIKEY },
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders(origin) }
      );
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return Response.json(
        {
          service: 'ikcp-codex',
          version: '1.0',
          purpose: 'Sub-agent fiscal expert · délégation depuis Marcel',
          endpoints: ['GET /health', 'POST / { question, context? }'],
        },
        { headers: corsHeaders(origin) }
      );
    }

    if (request.method !== 'POST') {
      return Response.json(
        { error: 'method_not_allowed' },
        { status: 405, headers: corsHeaders(origin) }
      );
    }

    if (!env.ANTHROPICAPIKEY) {
      return Response.json(
        { error: 'ANTHROPICAPIKEY non configurée — `wrangler secret put ANTHROPICAPIKEY`' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400, headers: corsHeaders(origin) });
    }

    const { question, context } = body;
    if (!question || typeof question !== 'string') {
      return Response.json(
        { error: 'missing_question' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Construit le message
    let userContent = question;
    if (context) {
      userContent = `CONTEXTE FOURNI PAR MARCEL :\n${context}\n\n---\n\nQUESTION CLIENT :\n${question}`;
    }

    try {
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPICAPIKEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-7',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!apiResponse.ok) {
        const txt = await apiResponse.text();
        return Response.json(
          { error: 'anthropic_upstream', status: apiResponse.status, message: txt.slice(0, 400) },
          { status: 502, headers: corsHeaders(origin) }
        );
      }

      const data = await apiResponse.json();
      const reply = data.content?.[0]?.text || '';

      return Response.json(
        {
          reply,
          agent: 'Codex',
          model: data.model,
          usage: data.usage,
          delegated_by: context ? 'Marcel' : 'direct',
        },
        { headers: corsHeaders(origin) }
      );
    } catch (err) {
      return Response.json(
        { error: 'codex_internal', message: err.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
  },
};
