/**
 * Modules stubs — marches qui demandent partenariat / API payante
 *
 * Pour chaque marche, on indique :
 *  - source officielle gratuite (le cas echeant)
 *  - source partenariat (B2B accreditation)
 *  - statut MVP : 'live' | 'stub' | 'manual'
 *
 * Tous restent en STUB tant qu'on est en bêta gratuite. On retourne
 * une structure consistante pour que la page admin puisse afficher
 * 'Module non encore brancht' sans casser.
 */

export const MODULES_STUBS = {
  chrono24: {
    id: 'chrono24',
    name: 'Chrono24',
    category: 'montre',
    free_url_public: 'https://www.chrono24.fr/search/index.htm?query=<query>',
    affiliate_api: 'B2B accreditation Chrono24 Affiliate Program (gratuit avec validation CGP/courtier)',
    rgpd: 'DE (UE)',
    mvp_status: 'manual', // visiter le lien et ajouter manuellement
    note: 'A activer Sprint 3+ : demander accreditation Chrono24 Affiliate (gratuite). En attendant, le watch est visite manuellement.',
  },
  watchcharts: {
    id: 'watchcharts',
    name: 'WatchCharts',
    category: 'montre',
    free_url_public: 'https://watchcharts.com/watches/<slug>',
    affiliate_api: 'API pro ~200 USD/mois',
    rgpd: 'US',
    mvp_status: 'manual',
  },
  phillips: {
    id: 'phillips',
    name: 'Phillips (montres + art)',
    category: 'montre,art',
    free_url_public: 'https://www.phillips.com/auctions',
    affiliate_api: 'Pas d\'API. Scraping calendrier ventes',
    rgpd: 'UK (UE adequat)',
    mvp_status: 'manual',
  },
  classic: {
    id: 'classic',
    name: 'Classic.com',
    category: 'voiture',
    free_url_public: 'https://classic.com/m/<modele>',
    affiliate_api: 'API freemium ~50 USD/mois',
    rgpd: 'US',
    mvp_status: 'manual',
  },
  hagerty: {
    id: 'hagerty',
    name: 'Hagerty Valuation',
    category: 'voiture',
    free_url_public: 'https://www.hagerty.com/valuationtools',
    affiliate_api: 'Subscription pro',
    rgpd: 'US',
    mvp_status: 'manual',
  },
  histovec: {
    id: 'histovec',
    name: 'Histovec',
    category: 'voiture',
    free_url_public: 'https://histovec.interieur.gouv.fr',
    affiliate_api: 'Aucune (verif individuelle)',
    rgpd: 'FR souverain',
    mvp_status: 'live', // outil officiel gratuit
  },
  stockx: {
    id: 'stockx',
    name: 'StockX',
    category: 'sneaker',
    free_url_public: 'https://stockx.com/search?s=<query>',
    affiliate_api: 'API privee (partenariat)',
    rgpd: 'US',
    mvp_status: 'manual',
  },
  goat: {
    id: 'goat',
    name: 'GOAT',
    category: 'sneaker',
    free_url_public: 'https://www.goat.com/search?query=<query>',
    affiliate_api: 'API privee',
    rgpd: 'US',
    mvp_status: 'manual',
  },
  idealwine: {
    id: 'idealwine',
    name: 'iDealwine',
    category: 'vin',
    free_url_public: 'https://www.idealwine.com/fr/recherche',
    affiliate_api: 'B2B partner (gratuit)',
    rgpd: 'FR souverain',
    mvp_status: 'manual',
    note: 'A activer Sprint 4 : demander acces API partenaire iDealwine.',
  },
  wine_searcher: {
    id: 'wine_searcher',
    name: 'Wine-Searcher',
    category: 'vin',
    free_url_public: 'https://www.wine-searcher.com/find/<slug>',
    affiliate_api: 'API pro ~500 EUR/mois',
    rgpd: 'NZ tech, EU OK',
    mvp_status: 'manual',
  },
  artprice: {
    id: 'artprice',
    name: 'Artprice',
    category: 'art',
    free_url_public: 'https://www.artprice.com',
    affiliate_api: 'API pro ~3000 EUR/an',
    rgpd: 'FR souverain',
    mvp_status: 'manual',
  },
  drouot: {
    id: 'drouot',
    name: 'Drouot',
    category: 'art',
    free_url_public: 'https://www.drouot.com/recherche',
    affiliate_api: 'B2B partner',
    rgpd: 'FR souverain',
    mvp_status: 'manual',
  },
  yachtworld: {
    id: 'yachtworld',
    name: 'YachtWorld',
    category: 'yacht',
    free_url_public: 'https://www.yachtworld.com',
    affiliate_api: 'B2B partner (Boats Group)',
    rgpd: 'US',
    mvp_status: 'manual',
  },
  marinetraffic: {
    id: 'marinetraffic',
    name: 'MarineTraffic',
    category: 'yacht',
    free_url_public: 'https://www.marinetraffic.com/en/ais/details/ships/<mmsi>',
    affiliate_api: 'API freemium 100 req/jour',
    rgpd: 'GR (UE)',
    mvp_status: 'live-freemium', // a brancher si Max donne un MMSI
  },
};

export const MODULES_STUBS_LIST = Object.values(MODULES_STUBS);

export function getModuleStub(id) {
  return MODULES_STUBS[id] || null;
}
