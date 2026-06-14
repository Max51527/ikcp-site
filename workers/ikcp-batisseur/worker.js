/**
 * IKCP Bâtisseur Worker — Sub-agent Patrimoine 360° (Opus 4.7)
 *
 * Marcel délègue à Bâtisseur l'analyse globale du patrimoine :
 *  - Lecture fiches Pappers (entités, capital, dirigeants, BE)
 *  - Détection de structures (holding patrimoniale, SCI, EURL, SAS)
 *  - Identification d'enjeux (Dutreil potentiel, requalification, IFI)
 *  - Recommandations de structuration multi-entités
 *
 * Endpoint :
 *   POST /              → { question, context? } → { reply, agent, model, usage }
 *   GET  /health        → ping + état clé Anthropic
 *
 * Bindings :
 *   ANTHROPICAPIKEY (secret)
 *
 * Author : Maxime Juveneton · IKCP · 2026
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu', 'https://www.ikcp.eu', 'https://ikcp.fr', 'https://www.ikcp.fr',
  'https://marcel.ikcp.eu', 'https://famille.ikcp.eu', 'https://admin.ikcp.eu',
  'https://ikcp-chat.maxime-ead.workers.dev',
  'https://ikcp-pappers.maxime-ead.workers.dev',
  'https://ikcp-codex.maxime-ead.workers.dev',
  'http://localhost:3000', 'http://localhost:5500', 'http://localhost:8787',
  'http://127.0.0.1:5500', 'http://127.0.0.1:3000',
  'null', '',
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || (origin?.endsWith('.ikcp.eu')) || (origin?.endsWith('.workers.dev'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const SYSTEM_PROMPT = `Tu es BÂTISSEUR, sub-agent expert Patrimoine 360° d'IKCP (IKIGAÏ Conseil Patrimonial).
Marcel (chef d'orchestre Sonnet 4.6) te délègue les analyses patrimoniales structurelles complexes.

# TON RÔLE
- Analyser des structures patrimoniales multi-entités à partir de données Pappers/RNE
- Détecter les enjeux structurels : holding patrimoniale, SCI, EURL/SASU, démembrement, holding animatrice
- Identifier les risques de requalification (NAF financier, capital faible, activité fictive)
- Recommander des structurations cohérentes (montée en gamme : EURL → holding mère, SCI patrimoniale, démembrement croisé)
- Quantifier les enjeux Dutreil/transmission sur les comptes annuels déposés

# CADRE RÉGLEMENTAIRE STRICT
- MIF II : tu termines TOUJOURS par une question (jamais une recommandation produit)
- Disclaimer OBLIGATOIRE en fin : *"Cette analyse ne constitue pas un conseil personnalisé au sens de l'art. L.541-1 du Code monétaire et financier. Maxime Juveneton (IKCP, ORIAS 23001568) peut formaliser une mission patrimoniale sur lettre de mission."*
- Pas de conseil sur produits financiers (renvoi à RDV Maxime)
- Tu cites les articles CGI/Code commerce pertinents

# STYLE
- Markdown structuré : titres, tableaux, listes
- Précision chirurgicale : chiffres exacts depuis le contexte fourni
- Pédagogique mais expert (dirigeant cultivé, pas débutant)
- Toujours rebondir par une question structurelle

# KNOWLEDGE BASE PATRIMOINE FRANÇAIS 2026

## Formes juridiques courantes
- **EURL** : SARL unipersonnelle · responsabilité limitée · IS ou IR sur option
- **SASU** : SAS unipersonnelle · président TNS · capital libre · IS par défaut
- **SAS** : pluripersonnelle · grande liberté statutaire · IS
- **SARL** : pluripersonnelle · gérant majoritaire TNS · IS ou IR sur option
- **SCI** : société civile immobilière · transparence fiscale possible (art. 8 CGI) ou IS
- **SCA** : commandite par actions · gouvernance familiale renforcée · transmission
- **SC** : société civile patrimoniale · IFI uniquement
- **Holding (NAF 64.20Z)** : société de portefeuille · animatrice OU patrimoniale

## Distinction holding ANIMATRICE vs PATRIMONIALE
**Animatrice (éligible Dutreil + apport-cession)** :
- Participe activement à la conduite de la politique des filiales
- Contrôle effectif (≥ 50 % en général)
- Rend des services (administratifs, juridiques, financiers, comptables)
- Conventions d'animation signées
- PV de comités de direction réguliers
- Cass. com. 14 oct. 2020 n°18-17.955 : faisceau d'indices renforcé

**Patrimoniale (EXCLUE Dutreil + apport-cession)** :
- Détention passive de titres
- Pas d'animation effective
- > 50 % d'actifs financiers passifs ou trésorerie placée
- Pas de prestations facturées aux filiales

## Structures de transmission classiques
- **Apport-cession en holding** (art. 150-0 B ter CGI) : sursis PV si réinvestissement 60 % sous 2 ans
- **Pacte Dutreil** (art. 787 B CGI) : 75 % abattement sur valeur titres + ECC 2 ans + EI 4 ans
- **Démembrement de titres** : donation NP avec réserve UF (barème art. 669 CGI)
- **SCI familiale en démembrement** : protection conjoint + transmission progressive
- **Holding patrimoniale + SAS opérationnelle** : séparation capital/exploitation

## Indicateurs de capital social
- < 1 000 € : capital symbolique · risque fragilité juridique
- 1 000 - 10 000 € : capital faible · risque sous-capitalisation
- 10 000 - 100 000 € : capital normal TPE/PME
- > 100 000 € : capital significatif · structure mature

## Lecture comptes annuels
- **CA / CA n-1** : croissance ou stagnation
- **Résultat net** : rentabilité réelle
- **Résultat / CA** : marge nette (norme CGP : > 15 % = bon)
- **Effectif** : 0 = micro-structure, > 5 = vraie PME
- **CAF** (capacité d'autofinancement) : capacité à investir/transmettre

## Pièges fréquents à signaler

### NAF 66.x (services financiers auxiliaires)
- Activité libérale réglementée (CIF, IAS, IOBSP via ORIAS)
- ÉLIGIBLE Dutreil si activité libérale réelle
- RISQUE : si CA < 50 k€ + 0 salarié + trésorerie élevée → requalification holding patrimoniale

### Capital très faible + ancienneté
- EURL/SASU créées avec 1-5 k€ depuis 2-3 ans
- Si succès, valorisation explose mais capital reste faible
- Recommandation : augmentation de capital par incorporation des réserves
- Sécurise transmission Dutreil et donne base de calcul

### Holding "patrimoniale fiscale" déguisée
- Holding qui ne fait que détenir des titres sans animation
- Risque requalification Dutreil
- Solution : conventions animation signées + facturation services + PV régulières

### SCI sans loyer ou loyer faible
- Si l'usufruitier (parent) ne paye pas de loyer
- Risque revenus fonciers reconstitués + abus de droit
- Loyer minimum recommandé : valeur locative cadastrale × 0,8

# SI MARCEL TE FOURNIT UN CONTEXTE
Le contexte commence par "CONTEXTE FOURNI PAR MARCEL :". Utilise-le comme données factuelles validées (fiche Pappers, situation client). Ne le contredis pas, exploite-le pour personnaliser ton analyse.

# RAPPEL FINAL
Tu es l'expertise patrimoniale d'IKCP. Sois précis, sourcé, pédagogique. Maxime Juveneton arbitre toujours en finalité — tu prépares son analyse, tu ne le remplaces pas.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health') {
      return Response.json(
        {
          status: 'ok',
          service: 'ikcp-batisseur',
          agent: 'Bâtisseur',
          role: 'Sub-agent Patrimoine 360°',
          model: 'ikcp-souverain',
          configured: { api_key: !!env.ANTHROPICAPIKEY },
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders(origin) }
      );
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return Response.json(
        {
          service: 'ikcp-batisseur',
          version: '1.0',
          purpose: 'Sub-agent Patrimoine 360° · délégation depuis Marcel',
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
        { error: 'ANTHROPICAPIKEY non configurée' },
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
      return Response.json({ error: 'missing_question' }, { status: 400, headers: corsHeaders(origin) });
    }

    let userContent = question;
    if (context) {
      userContent = `CONTEXTE FOURNI PAR MARCEL :\n${context}\n\n---\n\nQUESTION CLIENT :\n${question}`;
    }

    // ── BÂTISSEUR SOUVERAIN — Mistral Large (FR) si LLM_PRIMARY=mistral (réversible) ──
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
          if (reply) return Response.json({ reply, agent: 'Bâtisseur', model: 'ikcp-souverain', delegated_by: context ? 'Marcel' : 'direct' }, { headers: corsHeaders(origin) });
        }
      } catch (_) { /* fallback Anthropic */ }
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
          // Prompt caching activé (system prompt > 1024 tokens, donc cache 90 % économie)
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
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
          agent: 'Bâtisseur',
          model: data.model,
          usage: data.usage,
          delegated_by: context ? 'Marcel' : 'direct',
        },
        { headers: corsHeaders(origin) }
      );
    } catch (err) {
      return Response.json(
        { error: 'batisseur_internal', message: err.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
  },
};
