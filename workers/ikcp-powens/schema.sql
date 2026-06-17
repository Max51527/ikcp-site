-- Schéma D1 (Paris) du worker ikcp-powens.
-- Range un jeton d'accès Powens par membre. Le jeton permet de relire les comptes
-- sans redemander la banque. Renfort à ajouter avant la prod : chiffrement applicatif
-- de la colonne access_token (ne pas la stocker en clair pour de la vraie donnée bancaire).

CREATE TABLE IF NOT EXISTS powens_tokens (
  member_id    TEXT PRIMARY KEY,   -- l'id du membre IKCP qui a connecté sa banque
  access_token TEXT NOT NULL,      -- jeton Powens (à chiffrer avant prod)
  id_user      INTEGER,            -- l'id utilisateur côté Powens
  created_at   TEXT                -- horodatage (ISO)
);
