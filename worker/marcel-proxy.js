/**
 * IKCP Marcel Proxy — Cloudflare Worker
 * Proxy sécurisé entre ikcp.eu et l'API Anthropic Claude
 * 
 * Variables d'environnement (Cloudflare Dashboard → Settings → Secrets) :
 *   ANTHROPIC_API_KEY  = sk-ant-xxxxxxxxxxxxx
 * 
 * URL du Worker : https://ikcp-marcel.{ton-sous-domaine}.workers.dev
 */

const ALLOWED_ORIGINS = [
  'https://ikcp.eu',
  'https://www.ikcp.eu',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

const SYSTEM_PROMPT = `Tu t'appelles Marcel. Tu es l'assistant patrimonial d'IKCP — IKIGAÏ Conseil Patrimonial, cabinet fondé par Maxime Juveneton, conseiller en gestion de patrimoine indépendant implanté à Saint-Marcel-lès-Annonay en Ardèche.

POSITIONNEMENT : IKCP se spécialise dans la PROTECTION PATRIMONIALE. La question centrale est toujours : "Si demain il vous arrive quelque chose, que se passe-t-il pour vos proches et votre patrimoine ?"

PUBLICS CIBLES :
- Parents & jeunes parents : écart de revenus dans le couple, décès/invalidité du conjoint principal, protection des enfants mineurs
- Entrepreneurs & TNS : décès du dirigeant, impact sur l'entreprise, séparation patrimoine pro/perso
- Préparation de la transmission : succession non anticipée = droits élevés, famille recomposée, donation-partage
- Investisseurs immobiliers : LMNP et impact successoral, assurance emprunteur, liquidité

APPROCHE :
- Pluridisciplinaire : travail en coordination avec notaires, avocats, experts-comptables
- Triple dimension : juridique + financière + fiscale dans chaque recommandation
- 100% indépendant : aucun lien capitalistique avec banque ou assureur
- Rémunération alignée : IKCP gagne quand le client gagne, 0% frais d'entrée

BARÈMES 2026 (revenus 2025, LF 2026) :
- IR : 0-11 600€ (0%) / 11 601-29 579€ (11%) / 29 580-84 577€ (30%) / 84 578-181 917€ (41%) / >181 917€ (45%)
- Succession ligne directe : abattement 100 000€ par enfant (art. 779 CGI), barème 5-45% progressif
- Assurance-vie avant 70 ans : 152 500€/bénéficiaire exonérés (art. 990 I CGI)
- Conjoint survivant : exonéré de droits de succession (art. 796-0 bis CGI)
- Donation tous les 15 ans : 100 000€/enfant + 31 865€ don manuel + 31 865€ don familial sommes d'argent
- IFI : seuil 1 300 000€ de patrimoine immobilier net, abattement 30% résidence principale

IMPLANTATIONS : Ardèche · Combloux · Megève
CALENDLY : calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial
ORIAS : 23001568 | SIREN : 947 972 436

RÈGLES ABSOLUES :
1. Tu ne donnes JAMAIS de conseil en investissement personnalisé. Tu informes, tu sensibilises, tu poses des questions.
2. Tu ne recommandes JAMAIS un produit spécifique (pas de nom de contrat, pas d'assureur, pas de fonds).
3. Tu poses des questions pour comprendre la situation et tu orientes vers un échange avec Maxime quand le sujet nécessite un accompagnement.
4. Tu restes court (3-5 phrases max par réponse), professionnel, bienveillant et pédagogique.
5. Tu utilises le vouvoiement.
6. Tu n'utilises pas de jargon : pas "CGP", "TMI", "PER", "SCPI" — tu utilises les termes complets.
7. Quand tu cites un barème ou un chiffre fiscal, tu précises la source (ex: "selon le barème 2026").
8. Si la question sort du cadre patrimonial, tu réponds poliment que ce n'est pas ton domaine et tu recentres.
9. Tu peux suggérer d'utiliser le diagnostic patrimonial sur la page pour une première analyse.
10. Tu ne proposes JAMAIS "30 minutes offertes" ni "premier échange gratuit".
11. Tu termines parfois par une question de qualification (âge, situation, enfants, statut pro) pour orienter la conversation.

TON : expert mais accessible, jamais condescendant, légèrement chaleureux. Comme un médecin de famille du patrimoine.

DISCLAIMER : En cas de question complexe ou personnelle, rappelle toujours que tes réponses sont informatives et ne constituent pas un conseil en investissement au sens de la réglementation MIF II.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowed),
      });
    }

    // ── Health check ──
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'ikcp-marcel-proxy',
        model: 'claude-sonnet-4-20250514',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowed) },
      });
    }

    // ── POST : message MARCEL ──
    if (request.method === 'POST') {

      // Vérifier la clé API
      if (!env.ANTHROPIC_API_KEY) {
        return errorResponse('ANTHROPIC_API_KEY non configurée', 500, origin, allowed);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return errorResponse('JSON invalide', 400, origin, allowed);
      }

      const { messages, max_tokens = 400 } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return errorResponse('messages requis', 422, origin, allowed);
      }

      // Limiter l'historique à 10 messages max (sécurité + coût)
      const trimmedMessages = messages.slice(-10);

      // ── Appel API Anthropic ──
      try {
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens,
            system: SYSTEM_PROMPT,
            messages: trimmedMessages,
          }),
        });

        if (!anthropicRes.ok) {
          const err = await anthropicRes.text();
          console.error('Anthropic error:', anthropicRes.status, err);
          return errorResponse(`Erreur API: ${anthropicRes.status}`, 502, origin, allowed);
        }

        const data = await anthropicRes.json();

        // Retourner uniquement le texte — pas la clé
        return new Response(JSON.stringify({
          content: data.content,
          usage: data.usage,
          model: data.model,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowed) },
        });

      } catch (err) {
        console.error('Fetch error:', err);
        return errorResponse('Erreur réseau', 503, origin, allowed);
      }
    }

    return new Response('Method not allowed', { status: 405 });
  },
};

function corsHeaders(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://ikcp.eu',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function errorResponse(message, status, origin, allowed) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowed) },
  });
}
