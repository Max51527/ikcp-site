# Audit APIs · Family Office IKCP

> Cartographie exhaustive des APIs disponibles pour brancher la plateforme à l'écosystème réel.
> Mise à jour : 12 mai 2026 · auteur : Maxime Juveneton · usage interne.

---

## 📌 Légende de lecture

| Symbole | Sens |
|---|---|
| 🟢 | API publique, gratuite ou freemium accessible immédiatement |
| 🟡 | API B2B accessible avec accréditation (CGP, agence de voyage, courtier) ou abonnement professionnel |
| 🔴 | API fermée, accès sur partenariat individuel négocié |
| 🇫🇷 | Source officielle française ou hébergement souverain UE |
| 🇪🇺 | Hébergement UE compatible RGPD |
| 🇺🇸 | Service US (clauses RGPD à valider, à éviter pour données sensibles) |

---

## 🌍 1. VOYAGES & HOSPITALITY

Univers Concierge · pour réservations hôtels, jets, villas, expériences.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Booking.com Affiliate Partner** 🟡 | B2B hôtellerie mass + premium | 0 € (commission 25 % sur marge) | 🇪🇺 | ⭐⭐⭐ Brancher Sprint 2 — base couvre 90 % des demandes |
| **Expedia Partner Solutions** 🟡 | B2B vol + hôtel + auto + croisière | 0 € (commission) | 🇺🇸 | ⭐⭐ Alternative à Booking, US-based |
| **HotelBeds** 🟡 | B2B wholesaler · 250 000+ hôtels | 0 € (commission) + volume requis | 🇪🇺 | ⭐⭐ Si volume justifie |
| **Amadeus Self-Service** 🟡 | GDS · flight + hotel + cars · pro | ~500-2 000 €/mois selon usage | 🇪🇺 | ⭐⭐⭐ Indispensable pour vol pro/jet |
| **Sabre Dev Studio** 🟡 | GDS concurrent Amadeus | similaire | 🇺🇸 | ⭐⭐ Plan B |
| **Kiwi.com Tequila** 🟢 | Aggrégateur vols open API | freemium, ~0,01 €/req | 🇪🇺 | ⭐⭐ Backup vols |
| **Mr & Mrs Smith API** 🟡 | Boutique hôtels premium | Smith Travel Network B2B (gratuit avec accréditation) | 🇪🇺 | ⭐⭐⭐ Cœur de cible HNW |
| **Tablet Hotels (Michelin)** 🟡 | Hôtels Plus Michelin | API B2B sur partenariat | 🇪🇺 | ⭐⭐⭐ Très Family Office |
| **Five Star Alliance** 🟡 | 1 500 hôtels 5★ | Affiliate B2B | 🇺🇸 | ⭐⭐ |
| **Relais & Châteaux** 🔴 | Maisons d'exception | Partner program · sur invitation | 🇪🇺 | ⭐⭐⭐ Prestige max |
| **Virtuoso Network** 🔴 | Conseillers voyage luxe (invitation) | Membership ~5 000 €/an | 🇺🇸 | ⭐⭐⭐ Sur-mesure uniquement |
| **Onefinestay (Accor)** 🟡 | Villas luxe + service hôtel | B2B partner Accor | 🇪🇺 | ⭐⭐ |
| **Stratajet / Victor Aviation** 🟡 | Vols privés à la demande | API B2B partner | 🇪🇺 | ⭐⭐⭐ Cœur de cible |
| **PrivateFly** 🟡 | Charter jet · Directional Aviation | API B2B | 🇪🇺 | ⭐⭐ |
| **NetJets** 🔴 | Membership jet · Berkshire | Partenariat individuel | 🇺🇸 | ⭐⭐⭐ Top tier |
| **OAG** 🟡 | Données aériennes monde · status, schedules | abo pro | 🇪🇺 | ⭐ Utile vraiment pour app interne |

**Recommandation Sprint 2** : commencer par **Booking Affiliate** (90 % des demandes) + **Mr & Mrs Smith** (cœur Family Office) + **Amadeus** (pour vols/jets). Total : 1-2 j de dev par API + accréditations à faire en parallèle (Mr & Mrs Smith requiert numéro SIRET cabinet voyage ou CGP avec dérogation).

---

## 🍽 2. GASTRONOMIE & RESTAURANTS

Univers Concierge / Table.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **TheFork (TripAdvisor)** 🟢 | Resto FR + EU · ~80 000 restaurants | API B2B gratuite avec partenariat | 🇪🇺 | ⭐⭐⭐ Indispensable pour la France |
| **OpenTable API** 🟡 | Mondial · ~50 000 restaurants | Affiliate B2B partner | 🇺🇸 | ⭐⭐ Bon pour vols internationaux |
| **SevenRooms** 🟡 | CRM resto haut de gamme | API B2B sur partenariat | 🇪🇺 | ⭐ Plus pour les restaurants eux-mêmes |
| **Tock** 🟡 | Resto fine dining + pré-paiement | API B2B sur partenariat | 🇺🇸 | ⭐⭐ Bon pour 3★ |
| **La Liste API** 🟡 | Top 1 000 restos monde · classement FR | API B2B | 🇫🇷 | ⭐⭐⭐ Bel angle "made in FR" |
| **Michelin Guide API** 🔴 | Étoiles, sélection · API limitée pros | Partenariat | 🇫🇷 | ⭐⭐ Si négocié |
| **Gault & Millau** 🟡 | Notation FR | API B2B abo | 🇫🇷 | ⭐⭐ |
| **World's 50 Best** 🟢 | Classement annuel + events | Données scrapables + API events | 🇪🇺 | ⭐⭐ Pour cartographier les ambitions clients |

**Sprint 2** : TheFork (FR) + OpenTable (international) suffisent pour 95 % des cas.

---

## 🚗 3. AUTOMOBILES DE COLLECTION

Univers Curateur (mais on peut créer un sous-agent "Garagiste" si volume).

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Classic.com** 🟢 | Données enchères + ventes US/UK/EU | API freemium · ~50 €/mois pro | 🇺🇸 | ⭐⭐⭐ Base marché classique |
| **Hagerty Valuation Tools** 🟡 | Cotation cars de collection US-centric | Subscription + API | 🇺🇸 | ⭐⭐ Excellent pour US, OK EU |
| **The Market by Bonhams** 🟡 | Enchères classiques online | API B2B | 🇪🇺 | ⭐⭐ |
| **RM Sotheby's** 🔴 | Enchères automobiles haut de gamme | Calendrier scraping · pas d'API publique | 🇪🇺 | ⭐⭐⭐ Pour info, scraping |
| **Gooding & Company** 🔴 | Enchères haut de gamme US | Idem | 🇺🇸 | ⭐⭐ |
| **AutoScout24 API** 🟢 | Listings EU · véhicules usagés inclus collection | API B2B gratuite | 🇪🇺 | ⭐⭐ |
| **DuPont REGISTRY** 🔴 | High-end vehicles US | Affiliate | 🇺🇸 | ⭐ |
| **Histovec** 🟢 | FR · historique véhicule officiel | Gratuit gouv.fr | 🇫🇷 | ⭐⭐⭐ Indispensable côté FR |
| **Classic Driver** 🟢 | Éditorial + listings | API limitée | 🇪🇺 | ⭐⭐ |

**Sprint 3+** : Classic.com + Histovec (FR) en MVP. Pour vraiment professionnel, partenariat RM Sotheby's à négocier (statut "buyer agent").

---

## ⌚ 4. HORLOGERIE

Univers Curateur.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Chrono24** 🟡 | LE marketplace référence montres | API Affiliate B2B | 🇪🇺 (Allemagne) | ⭐⭐⭐ Indispensable |
| **WatchCharts** 🟡 | Cotation + tendances marché | API pro · ~200 €/mois | 🇺🇸 | ⭐⭐ Pour data fine |
| **Watchfinder & Co.** 🟡 | Pre-owned Richemont | Affiliate B2B | 🇪🇺 | ⭐⭐ |
| **Phillips Watches** 🔴 | Enchères haut de gamme | Calendrier scraping | 🇪🇺 | ⭐⭐⭐ Scraping calendrier |
| **Sotheby's / Christie's Watches** 🔴 | Enchères Genève / NYC | Idem | 🇪🇺 | ⭐⭐⭐ |
| **Antiquorum** 🟡 | Genève · enchères vintage | API B2B sur partenariat | 🇪🇺 | ⭐⭐ |
| **WatchPro** 🟢 | News horlogerie pro | RSS + scraping | 🇪🇺 | ⭐ Veille |

**Sprint 3+** : Chrono24 = priorité absolue (base de prix marché). WatchCharts en complément.

---

## 🍷 5. VINS & SPIRITUEUX

Univers Curateur / Cave.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Liv-ex** 🟡 | LE référent pro fine wine pricing | API B2B · ~2 000-10 000 €/an selon tier | 🇪🇺 (UK) | ⭐⭐⭐ Indispensable Sur-mesure |
| **Wine-Searcher** 🟡 | Comparateur prix mondial | API B2B · ~500 €/mois pro | 🇪🇺 (NZ tech, EU compliant) | ⭐⭐⭐ Premium |
| **Vinous (Galloni)** 🟡 | Notes de dégustation pro | Subscription + API | 🇺🇸 | ⭐⭐ |
| **Wine Advocate (Parker)** 🟡 | Notation Parker | Subscription + API | 🇺🇸 | ⭐⭐ |
| **Decanter** 🟡 | Notation + actu | API B2B | 🇪🇺 | ⭐⭐ |
| **CellarTracker** 🟢 | Gestion cave personnelle communautaire | API gratuite | 🇺🇸 | ⭐⭐ Pour gestion cave perso |
| **iDealwine** 🟡 | Enchères vins FR | API B2B partner · vente | 🇫🇷 | ⭐⭐⭐ Made in FR · indispensable |
| **Christie's / Sotheby's Wine** 🔴 | Enchères Hong Kong / NYC | Scraping calendrier | 🇪🇺 | ⭐⭐ |
| **Berry Bros & Rudd** 🟡 | UK · achat fine wine pro | B2B account | 🇪🇺 (UK) | ⭐⭐ |
| **Millésima** 🟡 | Bordeaux primeurs | API B2B | 🇫🇷 | ⭐⭐⭐ Made in FR |

**Sprint 3+** : iDealwine (FR) + Wine-Searcher (international) en MVP. Liv-ex uniquement si client Sur-mesure avec cave > 50 k€.

---

## ⛵ 6. YACHTING & NAUTIQUE

Univers Concierge / Curateur.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **YachtWorld API** 🟡 | Plus gros listing yachts mondial (Boats Group) | B2B partner program | 🇺🇸 | ⭐⭐⭐ Base marché |
| **YachtCharterFleet** 🟡 | Charter luxe API | B2B partner | 🇪🇺 (UK) | ⭐⭐ |
| **CharterWorld** 🟡 | Charter premium | B2B | 🇪🇺 (UK) | ⭐⭐ |
| **MarineTraffic** 🟢 | AIS tracking temps réel · 700 000 navires | API freemium · pro ~100-500 €/mois | 🇪🇺 (Grèce) | ⭐⭐⭐ Bel effet "wow" |
| **VesselFinder** 🟢 | Idem MarineTraffic | API freemium | 🇪🇺 | ⭐⭐ Alternative |
| **Boat International** 🟡 | Top 200 super-yachts data | API editor + scraping | 🇪🇺 (UK) | ⭐⭐ |
| **Burgess** 🔴 | Broker luxe | Partenariat individuel | 🇪🇺 | ⭐⭐⭐ Top tier |
| **Camper & Nicholsons** 🔴 | Idem Burgess | Partenariat | 🇪🇺 | ⭐⭐⭐ |

**Sprint 4** : MarineTraffic (tracking yacht client) + YachtWorld (achat/vente). Partenariats brokers en parallèle (relations humaines).

---

## 🎨 7. ART, COLLECTIONS, MÉCÉNAT

Univers Curateur + Mécène.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Artprice** 🟡 | Référence pro marché art · 32M+ résultats | API pro · ~3 000-5 000 €/an | 🇫🇷 | ⭐⭐⭐ Indispensable Premium |
| **Artnet** 🟡 | Concurrent direct Artprice | API pro · ~2 500 €/an | 🇺🇸 | ⭐⭐ Alternative |
| **MutualArt** 🟡 | Aggrégateur · subscription pro | ~500 €/an | 🇺🇸 | ⭐⭐ |
| **Sotheby's** 🟡 | Calendrier ventes + résultats (limité) | API B2B sur partenariat (Sotheby's Advisors) | 🇪🇺 | ⭐⭐⭐ Si statut conseiller |
| **Christie's** 🟡 | Idem Sotheby's | Idem | 🇪🇺 | ⭐⭐⭐ |
| **Phillips** 🔴 | Calendrier | Scraping | 🇪🇺 | ⭐⭐ |
| **Drouot** 🟡 | FR · enchères généralistes | API B2B partner | 🇫🇷 | ⭐⭐⭐ Made in FR |
| **Artsy** 🟢 | API pro pour galeries (publique) | Freemium | 🇺🇸 | ⭐⭐ |
| **Europeana** 🟢 | 50M œuvres museés EU · API ouverte gratuite | gratuit | 🇪🇺 | ⭐⭐⭐ Pour culture / contexte historique |
| **Met Museum API** 🟢 | Collections Met NYC | gratuit | 🇺🇸 | ⭐ |
| **Rijksmuseum API** 🟢 | Collections Rijksmuseum NL | gratuit | 🇪🇺 | ⭐ |
| **RMN-GP (FR)** 🟢 | Musées nationaux FR | gratuit officiel | 🇫🇷 | ⭐⭐ |
| **Artsper** 🟡 | Achat contemporain FR | API B2B | 🇫🇷 | ⭐⭐ |

**Sprint 3+** : Artprice (Premium) + Drouot (FR) en MVP. Statut "Sotheby's Preferred Partner" à négocier pour Sur-mesure (relation, pas API).

---

## ⛳ 8. GOLF

Univers Curateur / Concierge.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **GolfNow API (NBC)** 🟡 | Tee time booking | B2B partner | 🇺🇸 | ⭐⭐ Useful US |
| **PGA Tour Data API** 🟡 | Stats + live scores | API B2B | 🇺🇸 | ⭐ Pour passionné |
| **R&A Open Championship** 🔴 | Scraping calendrier | — | 🇪🇺 | ⭐ |
| **Top 100 Golf Courses** 🟢 | Éditorial ranking | Scraping | 🇪🇺 | ⭐⭐ |
| **Cypress Point / Augusta** 🔴 | Pas d'API · invitations | Réseau perso | — | ⭐⭐⭐ Relations |

**Sprint 4+** : Low priority. Plus relationnel qu'API.

---

## 🐎 9. ÉQUESTRE

Univers Curateur.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **France Galop** 🟢 | Courses · calendrier · résultats | API gratuite | 🇫🇷 | ⭐⭐⭐ FR ref |
| **PMU** 🟢 | Paris · cotes | API limited B2B | 🇫🇷 | ⭐ (mass market, à éviter Family Office) |
| **FEI (Fédération Equestre Int'l)** 🟢 | Events monde · jumping/dressage | API events | 🇪🇺 | ⭐⭐ |
| **Equibase** 🟡 | US racing data | API pro | 🇺🇸 | ⭐ |
| **Goffs / Tattersalls** 🔴 | Auctions chevaux pur-sang | Pas d'API · scraping | 🇪🇺 | ⭐⭐ Sur-mesure |
| **British Showjumping** 🟢 | UK events | API | 🇪🇺 | ⭐ |
| **Polo+10** 🟡 | Pro polo network | Subscription | 🇪🇺 | ⭐⭐ |

**Sprint 4+** : Low priority, mais France Galop + FEI suffisent.

---

## 📊 10. DONNÉES MARCHÉS FINANCIERS

Univers Stratège.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **CoinGecko** 🟢 | Crypto + or | Freemium · 30 req/min | 🇪🇺 (Singapour, RGPD-compliant) | ⭐⭐⭐ Live · déjà branché |
| **Frankfurter (BCE)** 🟢 | Forex EUR/USD/GBP/CHF/JPY | gratuit illimité | 🇪🇺 | ⭐⭐⭐ Live · déjà branché |
| **Stooq** 🟢 | Indices boursiers · données EOD | gratuit · CORS via worker | 🇪🇺 (Pologne) | ⭐⭐⭐ Pour CAC 40, DAX, S&P |
| **Yahoo Finance (via proxy)** 🟢 | Stocks · cotation temps réel | gratuit (rate-limit) | 🇺🇸 | ⭐⭐ Via worker proxy EU |
| **Twelve Data** 🟡 | Stocks + crypto + forex pro | Free 800/jour · pro ~30 €/mois | 🇺🇸 | ⭐⭐ Plan B |
| **Alpha Vantage** 🟡 | Idem | 25 req/jour gratuit · 50 €/mois pro | 🇺🇸 | ⭐⭐ Plan B |
| **Financial Modeling Prep** 🟡 | Données fondamentales sociétés cotées | 250 req/jour gratuit · 30 €/mois pro | 🇺🇸 | ⭐⭐ |
| **Bloomberg Terminal API** 🔴 | THE référence pro | ~2 000 €/mois | 🇺🇸 | ⭐⭐⭐ Sur-mesure uniquement |
| **Refinitiv (Reuters)** 🔴 | Concurrent Bloomberg | similaire | 🇪🇺 | ⭐⭐ Plan B Bloomberg |

**Sprint 1-2** : CoinGecko + Frankfurter + Stooq via worker EU. Suffit pour 95 % des cas.

---

## 🏠 11. IMMOBILIER

Univers Architecte.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **DVF data.gouv.fr** 🟢 | Demandes Valeurs Foncières · officiel | gratuit | 🇫🇷 | ⭐⭐⭐ Déjà branché |
| **Etalab API DVF** 🟢 | Idem, accès structuré | gratuit | 🇫🇷 | ⭐⭐⭐ |
| **Cadastre.data.gouv.fr** 🟢 | Cadastre officiel | gratuit | 🇫🇷 | ⭐⭐⭐ |
| **GéoPortail Urbanisme** 🟢 | PLU, zones | gratuit | 🇫🇷 | ⭐⭐ |
| **MeilleursAgents API** 🔴 | Estimation immobilier · 13M biens | Partenariat (Habiteo / SeLoger) | 🇫🇷 | ⭐⭐⭐ Si négocié |
| **SeLoger / Logic-Immo** 🔴 | Idem | Partenariat | 🇫🇷 | ⭐⭐ |
| **PAP.fr** 🟢 | Annonces particuliers | Scraping API | 🇫🇷 | ⭐ |
| **Notaires de France** 🟡 | Statistiques officielles + base | API B2B partner | 🇫🇷 | ⭐⭐⭐ Made in FR |
| **Estimer-immo.gouv.fr** 🟢 | Outil officiel d'estimation | API gratuite | 🇫🇷 | ⭐⭐⭐ |

**Sprint 1** : DVF + Cadastre + Estimer-immo gouv.fr. MeilleursAgents en option Sprint 3.

---

## 🏛 12. JURIDIQUE & FISCAL (déjà discuté)

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Légifrance API** 🟢 | Tous textes officiels FR | gratuit gouv.fr | 🇫🇷 | ⭐⭐⭐ Indispensable Codex |
| **BOFIP impots.gouv.fr** 🟢 | Doctrine fiscale officielle | gratuit (scraping/RSS) | 🇫🇷 | ⭐⭐⭐ Indispensable |
| **AMF** 🟢 | News officielles | RSS gratuit | 🇫🇷 | ⭐⭐⭐ Veille |
| **Doctrine.fr** 🟡 | Jurisprudence + doctrine | ~150-800 €/mois | 🇫🇷 | ⭐⭐ Sur-mesure |
| **Lefebvre Dalloz** 🔴 | Référence pro | abo cabinet | 🇫🇷 | ⭐⭐ Si on a déjà |
| **Lexbase** 🔴 | Idem | abo | 🇫🇷 | ⭐⭐ |

---

## 💼 13. ENTREPRISES & STRUCTURATION (déjà discuté)

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **RNE (INPI)** 🟢 | Registre National des Entreprises | gratuit officiel | 🇫🇷 | ⭐⭐⭐ Indispensable |
| **Pappers API** 🟡 | Wrapper RNE/INPI · pratique | Free 100 req/mois · 30 €/mois illimité | 🇫🇷 | ⭐⭐⭐ Déjà commencé |
| **Société.com** 🟡 | Alternative Pappers | Subscription | 🇫🇷 | ⭐⭐ |
| **INSEE Sirene** 🟢 | Base officielle SIRET | gratuit | 🇫🇷 | ⭐⭐⭐ |
| **BODACC** 🟢 | Annonces commerciales officielles | gratuit | 🇫🇷 | ⭐⭐⭐ Pour détecter changements société |

---

## 🤲 14. PHILANTHROPIE & ESUS

Univers Mécène.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Fondation de France** 🟡 | Recherche fondations agréées | API B2B partner | 🇫🇷 | ⭐⭐⭐ Pour Premium |
| **ESUS (gouv.fr)** 🟢 | Entreprises Solidarité Util. Sociale | Liste officielle | 🇫🇷 | ⭐⭐⭐ Pour conseil don IFI |
| **HelloAsso** 🟢 | Plateforme associations FR | API B2B | 🇫🇷 | ⭐⭐ |
| **DataESS data.gouv.fr** 🟢 | Données ESS | gratuit | 🇫🇷 | ⭐⭐ |

---

## 🏦 15. AGRÉGATION BANCAIRE (DSP2)

Pour le tier Sur-mesure : connecter directement les comptes bancaires.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Budget Insight / Powens** 🟡 | DSP2 · 90 banques FR | ~0,50-2 €/utilisateur/mois | 🇫🇷 | ⭐⭐⭐ Leader FR |
| **Bridge (Bankin')** 🟡 | DSP2 · alternative FR | Subscription | 🇫🇷 | ⭐⭐⭐ Alternative |
| **Tink (Visa)** 🟡 | DSP2 EU | Subscription | 🇪🇺 | ⭐⭐ |
| **Plaid** 🟡 | DSP2 US-dominant | Subscription | 🇺🇸 | 🚫 Pas EU |

**Sprint 4+** (Sur-mesure uniquement) : Budget Insight/Powens. Permet l'agrégation 100 % automatique des comptes.

---

## 📝 16. SIGNATURE & DOCUMENTS

Univers Hermès / Camille.

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **YouSign** 🟡 | Signature eIDAS qualifiée FR | ~1 €/signature | 🇫🇷 | ⭐⭐⭐ Made in FR |
| **DocuSign** 🟡 | Idem · monopole monde | ~1,50 €/sign | 🇺🇸 | ⭐ Pas EU pour RGPD critique |
| **Universign (DhimyotisX)** 🟡 | Concurrent FR | ~0,80 €/sign | 🇫🇷 | ⭐⭐⭐ Alt YouSign |
| **Lex Persona** 🟡 | Spécialiste légal FR | similaire | 🇫🇷 | ⭐⭐ |

**Sprint 2** : YouSign pour eIDAS qualifié. Universign en fallback.

---

## 📧 17. COMMUNICATION CLIENT

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **Resend** 🟡 | Email transactionnel · dev-friendly | $20/mois 50k emails | 🇪🇺 (basé US mais EU region) | ⭐⭐⭐ Déjà prévu |
| **Postmark** 🟡 | Alternative | similaire | 🇺🇸 | ⭐⭐ |
| **Brevo (ex-Sendinblue)** 🟡 | Made in FR | freemium | 🇫🇷 | ⭐⭐⭐ Alt Resend FR |
| **Twilio** 🟡 | SMS + WhatsApp | $0,04/SMS | 🇺🇸 | ⭐⭐ Si besoin SMS |
| **OVHcloud Mailcloud Pro** 🟡 | Mail FR souverain | abo | 🇫🇷 | ⭐⭐⭐ Pour adresse cabinet |

---

## 🛎 18. CONCIERGERIE GLOBALE (white-label)

Si vous voulez sous-traiter la conciergerie "tout faire".

| API | Type | Coût indicatif | RGPD | Recommandation IKCP |
|---|---|---|---|---|
| **John Paul** (FR) 🔴 | Conciergerie B2B/B2C FR · Accor | Partenariat custom · ~30-150 €/membre/mois | 🇫🇷 | ⭐⭐⭐ Solution turnkey FR |
| **Quintessentially** 🔴 | Conciergerie mondiale | Membership ~3 000-50 000 €/an | 🇪🇺 (UK) | ⭐⭐⭐ Prestige |
| **Ten Lifestyle Group** 🔴 | B2B pour banques privées · UBS, JPM | Partenariat custom | 🇪🇺 (UK) | ⭐⭐⭐ Le standard du secteur |
| **Aspire Lifestyles** 🔴 | Idem | Partenariat | 🇪🇺 | ⭐⭐ |
| **Knightsbridge Circle** 🔴 | Ultra-premium · 50 membres max | Membership ~25 000 £/an | 🇪🇺 (UK) | ⭐⭐⭐ Inspiration positionnement |

**Sprint 5+** : Partenariat John Paul (FR) à négocier pour Sur-mesure, vous facturez 1 500-3 000 €/mois marge confortable.

---

## 🗓 ROADMAP D'INTÉGRATION RECOMMANDÉE

### Sprint 1 (✓ déjà fait ou en cours)
- RNE / INPI · Pappers (déjà commencé)
- DVF · Cadastre · Estimer-immo (gratuit)
- Légifrance · BOFIP (gratuit)
- CoinGecko · Frankfurter (gratuit)
- Stooq via worker EU (indices boursiers)

**Coût : 0 €/mois** · Couvre tous les univers Patrimoine, Immobilier, Fiscalité, Marchés.

### Sprint 2 (Conciergerie + admin)
- Booking Affiliate
- TheFork
- YouSign eIDAS qualifié
- Brevo (emails)
- Resend (transactionnel)

**Coût : ~50-100 €/mois.** Couvre Voyage, Gastronomie, Administration.

### Sprint 3 (Curateur & Premium)
- Mr & Mrs Smith (accréditation à demander)
- Amadeus Self-Service
- Chrono24 Affiliate (montres)
- Artprice (abo 3 000 €/an)
- Classic.com (auto collection)

**Coût : ~300-500 €/mois.** Débloque l'univers Passions complet.

### Sprint 4 (Sur-mesure uniquement)
- Budget Insight / Powens (agrégation bancaire DSP2)
- Liv-ex (vins fine wine)
- MarineTraffic + YachtWorld
- Partenariat John Paul (white-label conciergerie)

**Coût : ~500-1 000 €/mois.** Refacturé aux clients Sur-mesure (5 000 €+/mois).

### Sprint 5+ (Selon traction)
- Partenariats Sotheby's / Christie's (statut conseiller)
- Bloomberg Terminal (si client > 50 M€ patrimoine)
- Relais & Châteaux affiliate
- Stratajet / NetJets partenariats

---

## 🇫🇷 PRIORISATION RGPD

**À privilégier systématiquement (label "Made in FR / EU") :**
- Pappers (FR), iDealwine (FR), Drouot (FR), Artprice (FR), Brevo (FR), YouSign (FR), Universign (FR), Powens (FR), John Paul (FR), La Liste (FR), Notaires de France (FR), Histovec (FR), TheFork (EU)
- Frankfurter (EU), CoinGecko (Singapour mais EU-compliant), Stooq (EU), MarineTraffic (EU), Chrono24 (EU), Burgess (EU), Tablet (EU)

**À éviter pour données sensibles client :**
- Plaid (US, agrégation), DocuSign (US, signature), Bloomberg (US, marchés), Plaid (US, banking), Artnet (US), Wine Advocate (US)

**À utiliser uniquement avec consentement explicite RGPD :**
- Booking, Amadeus, Hagerty, Twelve Data, OpenTable, GolfNow (US ou hybrides)

---

## 💰 BUDGET INTÉGRATION TOTAL

| Tier client | APIs activées | Coût mensuel infrastructure | Marge brute |
|---|---|---|---|
| **Freemium** | RNE, DVF, Légifrance, CoinGecko, Frankfurter | **0 €/mois** | N/A (gratuit pour vous) |
| **Premium (290 €/mois)** | + Booking, TheFork, YouSign, Brevo, Stooq | **~5-15 €/client/mois** | **95-98 %** |
| **Sur-mesure (5 000 €+/mois)** | + Chrono24, Artprice, Liv-ex, Powens, John Paul | **~150-300 €/client/mois** | **94-97 %** |

---

## ⚖ NOTES JURIDIQUES IMPORTANTES

1. **Statut "réservation pour compte d'autrui"** : pour réserver hôtels/jets/restaurants au nom du client, il faut soit (a) une **immatriculation IM agence de voyage** (Atout France), soit (b) un **mandat ad hoc** signé eIDAS par client. Sur-mesure : opter pour (b).

2. **Délégation bancaire (DSP2)** : Powens/Bridge gèrent l'accréditation ACPR. Vous restez "service de gestion de comptes agrégés" — pas besoin d'agrément complet.

3. **Conseil financier réglementé** : les APIs marchés/PE ne déclenchent JAMAIS de recommandation produit sans lettre de mission CIF (MIF II règle d'or).

4. **RGPD agent-IA** : chaque appel API doit être loggué avec consentement client horodaté. C'est exactement le rôle de l'agent `temoin` (Haiku 4.5) dans l'architecture.

---

**Document maintenu par Maxime Juveneton · révision trimestrielle ·** ©2026 IKCP
