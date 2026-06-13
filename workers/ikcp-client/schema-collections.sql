-- ┌────────────────────────────────────────────────────────────┐
-- │  CASSIUS / MARCEL — Schema "Vos collections"               │
-- │  Région : D1 Paris (RGPD souverain)                        │
-- │  Date : 2026-05-17                                          │
-- └────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS user_collection_items (
  id TEXT PRIMARY KEY,                       -- UUID
  user_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,                    -- horlogerie | automobile | vins | art | joaillerie | rare

  -- Identification de la pièce
  brand TEXT,                                -- Patek Philippe, Porsche, Château Pétrus, Soulages…
  model TEXT,                                -- Nautilus 5711/1A-014, 911 GT3 RS 992, 2015, Peinture noire 1992…
  reference TEXT,                            -- numéro de série, ref. constructeur
  year_made INTEGER,                         -- année de fabrication / millésime
  quantity INTEGER DEFAULT 1,                -- nombre d'unités (caisses vin, lots)

  -- Provenance & acquisition
  acquired_at TEXT,                          -- ISO date acquisition
  acquired_from TEXT,                        -- vendeur (Phillips, RM Sotheby's, caviste…)
  acquired_price REAL,                       -- prix achat €
  acquired_currency TEXT DEFAULT 'EUR',

  -- Valorisation actuelle
  current_value REAL,                        -- cote estimée €
  current_value_at INTEGER,                  -- timestamp dernière estimation
  current_value_source TEXT,                 -- WatchCharts | Chrono24 | RM Sotheby's | Liv-ex | …

  -- Documents R2 EU (clés chiffrées)
  photo_r2_key TEXT,
  certificate_r2_key TEXT,                   -- certificat d'authenticité
  invoice_r2_key TEXT,                       -- facture d'achat

  -- Métadonnées
  notes TEXT,                                -- notes perso (anecdotes, références héritage)
  tags_json TEXT,                            -- tags ['héritage_père','wishlist_vente']
  status TEXT DEFAULT 'in_collection',       -- in_collection | for_sale | sold | gifted
  surveillance_active INTEGER DEFAULT 1,     -- 1 = alertes auto sur marché secondaire

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collection_user_cat ON user_collection_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_collection_status ON user_collection_items(user_id, status);

-- Carnet d'entretien (révisions, polissages, services)
CREATE TABLE IF NOT EXISTS collection_maintenance (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES user_collection_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,                  -- révision | polissage | restauration | expertise | photo_pro
  event_date TEXT NOT NULL,                  -- ISO date
  provider TEXT,                             -- nom prestataire
  cost REAL,
  notes TEXT,
  document_r2_key TEXT,                      -- facture / rapport PDF
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maint_item ON collection_maintenance(item_id, event_date DESC);

-- Historique valorisations (pour graphique évolution cote)
CREATE TABLE IF NOT EXISTS collection_valuation_history (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES user_collection_items(id) ON DELETE CASCADE,
  value REAL NOT NULL,
  source TEXT,                               -- source du prix
  recorded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_valuation_item_date ON collection_valuation_history(item_id, recorded_at DESC);

-- Vue agrégée par catégorie (utilisée par dashboard)
-- (D1 ne supporte pas CREATE VIEW persistante, donc requête à inline dans worker)
