-- ════════════════════════════════════════════════════════════════════════════
-- ikcp-patrimoine — Base patrimoniale UNIFIÉE (D1 Paris/WEUR) · SOUVERAIN FR
-- ────────────────────────────────────────────────────────────────────────────
-- LE SOCLE du « OS patrimonial » (blueprint MARCEL §5.1 / §14).
-- Transforme la donnée éparse (SIREN, Powens, saisie) en modèle patrimonial
-- exploitable par les moteurs (stratégies §8, opportunités §9) et le reporting §15.
--
-- RGPD : cette base contient des DONNÉES CLIENT → reste à Paris (D1 WEUR), jamais
-- exportée hors UE. Ce fichier .sql = STRUCTURE seule (aucune donnée), commitable.
-- Métadonnées clés sur chaque actif : source, statut de vérification, sensibilité,
-- fraîcheur (date_actualisation) — exigence §14.2 + §20 (source + fraîcheur visibles).
--
-- Convention : id texte (uuid applicatif), montants en CENTIMES d'euro (entier,
-- pas de flottant pour l'argent), dates ISO-8601. member_id = clé du membre IKCP.
-- ════════════════════════════════════════════════════════════════════════════

-- ── PERSONNES & FOYER (§14.1) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personnes (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL,                 -- propriétaire du dossier (membre IKCP)
  prenom        TEXT, nom TEXT,
  date_naissance TEXT,
  role          TEXT,                          -- dirigeant | conjoint | enfant | associe | autre
  residence_fiscale TEXT DEFAULT 'FR',
  regime_matrimonial TEXT,                     -- communaute | separation | participation_acquets | ...
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_personnes_member ON personnes(member_id);

CREATE TABLE IF NOT EXISTS foyers (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  nom         TEXT,                            -- libellé du foyer/famille
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS foyer_membres (     -- qui compose le foyer (n-n)
  foyer_id    TEXT NOT NULL,
  personne_id TEXT NOT NULL,
  lien        TEXT,                            -- titulaire | conjoint | enfant | a_charge
  PRIMARY KEY (foyer_id, personne_id)
);

-- ── SOCIÉTÉS & DÉTENTION (§7.2 structure juridique) ─────────────────────────
CREATE TABLE IF NOT EXISTS societes (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL,
  siren         TEXT,                          -- source RNE/Pappers
  nom           TEXT,
  forme_juridique TEXT,                        -- SAS | SARL | SCI | holding | ...
  is_holding    INTEGER DEFAULT 0,
  is_animatrice INTEGER DEFAULT 0,
  regime_fiscal TEXT,                          -- IS | IR
  capital_cents INTEGER,
  code_naf      TEXT,
  source_donnee TEXT DEFAULT 'pappers',
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_societes_member ON societes(member_id);

CREATE TABLE IF NOT EXISTS participations (    -- qui détient quoi, directement/indirectement
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  detenteur_type TEXT,                         -- personne | societe
  detenteur_id   TEXT,                         -- personnes.id ou societes.id
  societe_id     TEXT NOT NULL,                -- société détenue
  pct_detention  REAL,                         -- 0..100
  type_titres    TEXT,                         -- pleine_propriete | usufruit | nue_propriete
  created_at     TEXT NOT NULL
);

-- ── ACTIFS (modèle unifié : comptes, immo, AV, retraite, portefeuilles…) ────
-- Une seule table polymorphe (categorie) — pragmatique pour la bêta. §7.1 bilan.
CREATE TABLE IF NOT EXISTS actifs (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL,
  proprietaire_type TEXT,                      -- personne | societe | foyer
  proprietaire_id   TEXT,
  categorie     TEXT NOT NULL,                 -- compte | livret | assurance_vie | per | pea | cto | immobilier | scpi | private_equity | tresorerie_pm | participation | autre
  libelle       TEXT,
  valorisation_cents INTEGER,
  devise        TEXT DEFAULT 'EUR',
  date_acquisition   TEXT,
  regime_fiscal TEXT,                          -- pfu | bareme | lmnp | is | exonere | ...
  regime_detention TEXT,                       -- direct | sci | holding | demembre
  liquidite     TEXT,                          -- immediate | moyen_terme | illiquide
  usage         TEXT,                          -- rendement | usage | reserve  (§7.1)
  -- métadonnées de confiance (§14.2 / §20)
  source_donnee TEXT DEFAULT 'manuel',         -- manuel | powens | pappers | import
  powens_id     TEXT,                          -- lien vers l'agrégation Powens
  statut_verification TEXT DEFAULT 'declare',  -- declare | verifie
  sensibilite   INTEGER DEFAULT 2,             -- 1 faible .. 3 haute (gouvernance IA)
  date_actualisation TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_actifs_member ON actifs(member_id);
CREATE INDEX IF NOT EXISTS idx_actifs_cat ON actifs(member_id, categorie);

CREATE TABLE IF NOT EXISTS dettes (            -- passif (§7.1 / §7.6)
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  emprunteur_type TEXT, emprunteur_id TEXT,
  type        TEXT,                            -- credit_immo | credit_pro | cca | autre
  capital_restant_cents INTEGER,
  taux        REAL,
  echeance    TEXT,
  mensualite_cents INTEGER,
  source_donnee TEXT DEFAULT 'manuel',
  created_at  TEXT NOT NULL
);

-- ── BÉNÉFICIAIRES (clauses AV, démembrement — §7.5 succession) ──────────────
CREATE TABLE IF NOT EXISTS beneficiaires (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  actif_id    TEXT NOT NULL,                   -- ex : contrat d'assurance-vie
  personne_id TEXT,                            -- bénéficiaire (si personne connue)
  libelle     TEXT,                            -- clause libre si pas de personne
  rang        INTEGER,                         -- 1er, 2e rang…
  quotite_pct REAL,
  type_droit  TEXT,                            -- pleine_propriete | usufruit | nue_propriete
  obsolete    INTEGER DEFAULT 0,               -- clause à jour ? (§7.9 alerte)
  created_at  TEXT NOT NULL
);

-- ── DOCUMENTS (coffre — métadonnées ; contenu en R2 plus tard, §5.2) ────────
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  type        TEXT,                            -- statuts | titre_propriete | clause_benef | testament | acte | kbis | ...
  libelle     TEXT,
  r2_key      TEXT,                            -- pointeur stockage objet (souverain)
  date_document TEXT,
  date_expiration TEXT,                        -- alerte si expirant (§7.9)
  sensibilite INTEGER DEFAULT 3,
  created_at  TEXT NOT NULL
);

-- ── OBJECTIFS de vie (§7.8) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS objectifs (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  type        TEXT,                            -- retraite | transmission | cession | residence | education | philanthropie | independance | expatriation | protection
  libelle     TEXT,
  horizon_annees INTEGER,
  priorite    INTEGER,                         -- 1 haute .. 5 basse
  cible_cents INTEGER,
  created_at  TEXT NOT NULL
);

-- ── STRATÉGIES ÉLIGIBLES (sortie du moteur d'opportunités §9) ───────────────
CREATE TABLE IF NOT EXISTS strategies_eligibles (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL,
  strategie_key TEXT NOT NULL,                 -- réf. fiche (strategies.json)
  score         REAL,                          -- 0..1 éligibilité
  declencheur   TEXT,                          -- règle §9 qui a matché
  statut        TEXT DEFAULT 'detectee',       -- detectee | proposee | validee_expert | ecartee
  detected_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_strat_member ON strategies_eligibles(member_id);

-- ── RECOMMANDATIONS + VALIDATION (MIF II — audit trail §7.10/§12.3) ─────────
-- JAMAIS de reco définitive sans revue humaine : statut trace la validation.
CREATE TABLE IF NOT EXISTS recommandations (
  id            TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL,
  origine       TEXT,                          -- marcel | conseiller | moteur
  contenu       TEXT,
  niveau        TEXT DEFAULT 'information',    -- information | simulation | recommandation
  statut        TEXT DEFAULT 'brouillon',      -- brouillon | revue_humaine | validee | transmise
  validee_par   TEXT,                          -- conseiller CIF (ORIAS) si validée
  created_at    TEXT NOT NULL,
  validated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_reco_member ON recommandations(member_id);

-- ── ÉVÉNEMENTS / timeline patrimoniale (§6.4 calendrier) ────────────────────
CREATE TABLE IF NOT EXISTS evenements (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL,
  type        TEXT,                            -- cession | donation | acquisition | naissance | changement_regime | ...
  libelle     TEXT,
  date_event  TEXT,
  created_at  TEXT NOT NULL
);

-- ── Bêta test : capture d'usage produit (audit, marcel, cockpit, simulateurs) ──
CREATE TABLE IF NOT EXISTS beta_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool TEXT NOT NULL, action TEXT, siren TEXT, label TEXT,
  data TEXT, email TEXT, ua TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_beta_tool ON beta_events(tool);
CREATE INDEX IF NOT EXISTS idx_beta_ts ON beta_events(created_at);
