-- ikcp-collector — D1 Paris (WEUR)
-- Stocke : profil collectionneur de l'utilisateur + veille marche + alertes generees
-- Schema permanent : profil = 1 row, watches = items watchlist, alerts = histo alertes

CREATE TABLE IF NOT EXISTS user_profile (
  user_id        TEXT PRIMARY KEY,           -- 'max' par defaut (multi-user plus tard)
  display_name   TEXT,
  passions_json  TEXT NOT NULL,              -- JSON profil complet (montres, voitures, etc.)
  updated_at     TEXT NOT NULL,
  notes          TEXT
);

CREATE TABLE IF NOT EXISTS market_watches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  market         TEXT NOT NULL,              -- 'chrono24' | 'bricklink' | 'classic' | 'idealwine' | 'stockx' | etc.
  category       TEXT NOT NULL,              -- 'montre' | 'voiture' | 'lego' | 'vin' | 'sneaker' | etc.
  query          TEXT NOT NULL,              -- chaine de recherche (ex : 'Patek 5711', 'Porsche 964')
  target_price   REAL,                       -- prix cible (declenche alerte si <)
  current_price  REAL,                       -- dernier prix detecte
  cote_ref       REAL,                       -- cote de reference
  variation_pct  REAL,                       -- variation depuis last check
  url            TEXT,                       -- URL de la listing
  payload_json   TEXT,                       -- payload brut fournisseur (debug)
  last_check_at  TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1, -- 0/1
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_watches_user_market ON market_watches (user_id, market);
CREATE INDEX IF NOT EXISTS idx_watches_active ON market_watches (active);

CREATE TABLE IF NOT EXISTS alerts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  watch_id       INTEGER REFERENCES market_watches(id),
  kind           TEXT NOT NULL,              -- 'price_drop' | 'new_listing' | 'auction_close' | 'wishlist_match'
  severity       TEXT NOT NULL,              -- 'info' | 'opportunite' | 'urgent'
  title          TEXT NOT NULL,
  description    TEXT,
  url            TEXT,
  data_json      TEXT,
  created_at     TEXT NOT NULL,
  read_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts (user_id, read_at);
