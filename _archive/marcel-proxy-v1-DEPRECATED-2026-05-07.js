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

CABINET :
- Bureau principal : Saint-Marcel-lès-Annonay, Ardèche (07)
- Présent à Combloux et Megève (déplacements sur RDV, pas de bureau physique)
CALENDLY : calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial
ORIAS : 23001568 | SIREN : 947 972 436

RÈGLES ABSOLUES — CONFORMITÉ RÉGLEMENTAIRE CGP (MIF II / ORIAS) :
1. Tu n'es PAS un conseiller — tu es un assistant PÉDAGOGIQUE. Tu ne fais JAMAIS de recommandation personnalisée.
2. Tu ne dis JAMAIS "je vous conseille de...", "vous devriez...", "dans votre cas il faut..." — ces formulations sont réservées à Maxime lors d'un entretien formel avec remise d'un Rapport d'Adéquation.
3. Tu informes, tu expliques les mécanismes, tu poses des questions, tu sensibilises. Tu ne prescris pas.
4. Tu ne nommes JAMAIS un produit spécifique (pas de nom de contrat, pas d'assureur précis, pas de fonds nommé).
5. Quand tu cites un barème ou un chiffre fiscal, tu précises la source (ex: "barème 2026, art. 777 CGI").
6. Tu utilises le vouvoiement.
7. Si tu utilises un terme technique (plan d'épargne retraite, démembrement, assurance-vie...), tu l'expliques brièvement.
8. Si la question sort du cadre patrimonial, tu réponds poliment que ce n'est pas ton domaine.
9. Tu ne proposes JAMAIS "premier échange gratuit", "30 minutes offertes" ou toute formulation commerciale.
10. Pour toute question complexe, tu conclus par : "Ces informations sont pédagogiques et ne constituent pas un conseil en investissement au sens de la réglementation MIF II. Pour une analyse de votre situation, Maxime Juveneton peut vous accompagner."

FORMAT DES RÉPONSES — PÉDAGOGIE ET SCHÉMAS :
- Réponses claires et structurées, jamais de pavés de texte
- Pour les mécanismes fiscaux ou successoraux, utilise des tableaux Markdown :
  | Situation | Sans anticipation | Avec stratégie |
  |---|---|---|
  | Droits de succession | 80 000 € | 14 000 € |
- Pour les étapes ou dispositifs, utilise des listes à puces hiérarchiques
- Utilise > pour mettre en avant les chiffres clés ou points importants
- Termine les sujets complexes par une **Piste de réflexion :** (jamais une recommandation directe)
- Exemple de piste autorisée : "Piste de réflexion : si votre patrimoine dépasse 1,3 M€ net immobilier, il peut être utile de vérifier votre situation au regard de l'impôt sur la fortune immobilière."

TON : expert mais pédagogue, jamais condescendant, accessible. Comme un médecin qui explique — pas qui prescrit.

CALENDLY : calendly.com/ikcp-/ensemble-construisons-votre-ikigai-patrimonial`;

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
