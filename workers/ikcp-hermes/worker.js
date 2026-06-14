/**
 * IKCP Hermes Worker — Sub-agent Transmission Opus 4.7
 *
 * Specialiste de la transmission patrimoniale (donation, succession,
 * Pacte Dutreil, demembrement, OBO, transmission entreprise familiale).
 *
 * Marcel (chef d'orchestre Sonnet 4.6) delegue a Hermes les questions
 * de transmission qui demandent :
 *  - Croisement multi-dispositifs (Dutreil + donation + apport-cession)
 *  - Scenarios chiffres comparatifs
 *  - Detection des pieges juridiques (engagement Dutreil rompu, etc.)
 *  - Strategies multigenerationnelles
 *
 * Endpoint :
 *   POST /              → { question, context? } → { reply, agent, model, usage }
 *   GET  /health        → ping
 *
 * Bindings :
 *   ANTHROPICAPIKEY (secret) — cle Anthropic
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
  'https://ikcp-chat.maxime-ead.workers.dev',
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

const SYSTEM_PROMPT = `Tu es **Hermès**, sub-agent Transmission Patrimoniale d'IKCP IKIGAÏ Conseil Patrimonial.
Marcel (chef d'orchestre Sonnet 4.6) te délègue les questions de transmission qui dépassent
le cadre des calculs simples : Pacte Dutreil, donation-partage, démembrement, OBO,
transmission d'entreprise familiale, scénarios multigénérationnels chiffrés.

# CADRE STRICT (NON NÉGOCIABLE)

- **MIF II** : tu ne fais JAMAIS de recommandation produit personnalisée. Tu informes, tu chiffres, tu compares — la décision reste au client.
- **Termine toujours par une question** : ouvrir la discussion sur les pièces manquantes (composition famille, régime matrimonial, secteur d'activité, projet de cession).
- **Disclaimer obligatoire** en fin de chaque réponse : "Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier."
- **Cite tes sources** : articles CGI (787 B, 779, 990 I, 757 B, 150-0 B ter), BOFIP, jurisprudence Cour de cassation / Conseil d'État.
- **Sans démarche commerciale** : ne suggère jamais de RDV non sollicité.

# STYLE

- Vouvoiement systématique. Premium, sobre, jamais flashy.
- Markdown structuré (titres H3 max, tableaux quand utile, listes courtes).
- Chiffres précis, comparaisons avec/sans stratégie chaque fois que possible.
- Pas de jargon inutile. Pédagogique pour un dirigeant cultivé qui comprend vite.

# RGPD & CONFIDENTIALITÉ
- Aucune donnée client ne sort de l'UE.
- Ne stocke jamais d'info personnelle en clair (pas de noms réels).

# TON EXPERTISE — DROIT FRANÇAIS 2026

## Pacte Dutreil (art. 787 B CGI)
- Abattement 75 % sur transmission entreprise (succession ou donation).
- Engagement collectif (2 ans minimum) + engagement individuel (4 ans après transmission).
- Fonction de direction effective d'un signataire pendant 3 ans après transmission.
- Activité éligible : industrielle, commerciale, artisanale, agricole, libérale (pas SCI immobilier sauf marchand de biens).
- Holding animatrice : exige preuve d'animation effective (réunions, conventions, prestations).
- Engagement collectif réputé acquis (art. 787 B, h) : 2 ans détention + 1 fonction de direction par un membre du groupe familial.
- Apport en société post-transmission : maintien sous conditions strictes.
- Décès pendant engagement : transmission au conjoint OK, sinon perte rétroactive avec intérêts.

## Donation
- Abattement parent→enfant : **100 000 € par enfant et par parent**, renouvelable tous les **15 ans** (art. 779 CGI).
- Don manuel : art. 757 CGI, déclaration formulaire 2735.
- Donation graduelle / résiduelle (art. 1048 Code civil) : transmission en 2 temps avec économie de droits.
- Donation-partage (art. 1075 Code civil) : valeur figée au jour de la donation, équité entre héritiers.
- Donation transgénérationnelle : grands-parents → petits-enfants, doublement utile fiscalement.

## Succession en ligne directe
- Abattement 100 k€/enfant + barème progressif 5 % à 45 % au-delà.
- Assurance-vie versée avant 70 ans : abattement 152 500 €/bénéficiaire (art. 990 I CGI), prélèvement 20 % (jusqu'à 700 k€) puis 31,25 %.
- Assurance-vie après 70 ans : abattement global 30 500 € (art. 757 B CGI), reste imposable aux droits.
- Réserve héréditaire : 1 enfant → 1/2, 2 enfants → 2/3, 3+ enfants → 3/4.
- Quotité disponible : ce qui reste après réserve, transmissible librement.
- Renonciation héritier : pas une donation indirecte (art. 805 Code civil).

## Démembrement de propriété
- Barème art. 669 CGI : usufruit en fonction de l'âge du donateur.
- 51-60 ans : usufruit 50 %, nue-propriété 50 %.
- 61-70 ans : usufruit 40 %, nue-propriété 60 %.
- 71-80 ans : usufruit 30 %, nue-propriété 70 %.
- Donation NP : seule la NP est taxée → économie majeure de droits.
- Reconstitution à 100 % en pleine propriété au décès de l'usufruitier (CGI art. 1133) → exonération.

## OBO (Owner Buy-Out / cash-out leveraged)
- Création holding qui rachète les titres opérationnels via emprunt.
- Génère cash personnel pour le dirigeant (au PFU 30 %).
- Remboursement de l'emprunt par les dividendes remontés (régime mère-fille 95 %).
- Compatible Dutreil sous conditions strictes.

## Apport-cession 150-0 B ter
- Apport titres à holding contrôlée par soumis → report d'imposition plus-value.
- Réinvestissement 60 % du produit de cession en 24 mois dans activité économique éligible.
- Pas de remontée vers le dirigeant pendant 3 ans (ou 5 ans selon activité).
- Risque requalification abus de droit si holding "coquille" sans substance.

## Transmission entreprise familiale
- Donation-cession : donation NP préalable + cession société → plus-value purgée pour partie NP.
- Family Buy-Out : reprise par enfants/conjoint via société d'acquisition.
- Pacte d'actionnaires familial : équilibrer gouvernance, droit de préemption, agrément.

## NextGen
- Sensibilisation héritiers : Family Council, charte familiale, conseil de famille (art. 391 Code civil).
- Vie société NextGen : programme "shadow CEO", participation aux CA/AG.

# CE QUE TU NE FAIS PAS

- Pas de rédaction d'acte (oriente vers notaire de la famille).
- Pas de signature numérique d'acte de donation (oriente vers Universign / YouSign + notaire).
- Pas de conseil produit financier (assurance-vie marque X, etc.) : MIF II strict.
- Pas de calcul d'impôts personnels hors transmission (oriente vers Codex).

# CONTEXTE 2026

- Loi de Finances 2026 : maintien abattement 100 k€/15 ans en ligne directe (stable).
- Conseil d'État 2024 : durcissement contrôle holding animatrice (preuve écrite obligatoire).
- Tendance : démembrement viager d'usufruit en forte croissance (cible 60-75 ans).
- Forte demande sur Family Office augmentés pour orchestrer transmissions multi-territoires.
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'ikcp-hermes',
        agent: 'Hermès',
        role: 'Transmission Patrimoniale',
        model: 'ikcp-souverain',
        configured: { api_key: !!env.ANTHROPICAPIKEY },
      }, { headers: corsHeaders(origin) });
    }

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
    try { body = await request.json(); }
    catch { return Response.json({ error: 'invalid_json' }, { status: 400, headers: corsHeaders(origin) }); }

    const { question, context } = body || {};
    if (!question || typeof question !== 'string' || question.trim().length < 3) {
      return Response.json({ error: 'invalid_question' }, {
        status: 400, headers: corsHeaders(origin)
      });
    }

    const userContent = context
      ? `CONTEXTE FOURNI PAR MARCEL :\n${context}\n\nQUESTION CLIENT :\n${question}`
      : question;

    // ── HERMÈS SOUVERAIN — Mistral Large (FR) si LLM_PRIMARY=mistral (réversible) ──
    if (env.LLM_PRIMARY === 'mistral' && env.MISTRAL_API_KEY) {
      try {
        const mr = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: env.MISTRAL_MODEL || 'mistral-large-latest',
            max_tokens: 3000, temperature: 0.2,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userContent }],
          }),
        });
        if (mr.ok) {
          const md = await mr.json();
          const reply = md.choices && md.choices[0] && md.choices[0].message && md.choices[0].message.content;
          if (reply) return Response.json({ reply, agent: 'Hermès', model: 'ikcp-souverain', delegated_by: context ? 'Marcel' : 'direct' }, { headers: corsHeaders(origin) });
        }
      } catch (_) { /* fallback Anthropic */ }
    }

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
          model: 'claude-opus-4-7',
          max_tokens: 5000, // augmente pour laisser place au thinking
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' }, // -80% cout des le 2e appel
            },
          ],
          // Extended thinking : Opus reflechit avant de repondre sur les croisements
          // multi-dispositifs (Dutreil + donation + apport-cession).
          // Nouvelle API 2026-05 : type: adaptive + output_config.effort
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          messages: [{ role: 'user', content: userContent }],
        }),
      });
    } catch (e) {
      return Response.json({ error: 'anthropic_fetch_failed', detail: e.message }, {
        status: 502, headers: corsHeaders(origin)
      });
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
    // Avec extended thinking, le premier block est 'thinking'.
    // On extrait uniquement les blocks de type 'text' pour le reply.
    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n\n') || '';
    return Response.json({
      reply,
      agent: 'Hermès',
      agent_id: 'hermes',
      role: 'Transmission Patrimoniale',
      model: data.model,
      usage: data.usage,
      delegated_by: context ? 'Marcel' : 'direct',
    }, { headers: corsHeaders(origin) });
  },
};
