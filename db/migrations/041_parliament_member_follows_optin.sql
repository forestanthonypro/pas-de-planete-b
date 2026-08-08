-- Ajoute au suivi des élus étrangers (créé vide dans la migration 040) les
-- colonnes nécessaires au double opt-in RGPD, sur le même modèle que
-- deputy_follows côté France : une inscription crée une ligne non
-- confirmée avec un jeton envoyé par email, seule la confirmation active
-- réellement le suivi.
--
-- La colonne "token" d'origine (unique, non nulle) est retirée : elle
-- n'était pas utilisée (fonctionnalité pas encore implémentée côté
-- frontend/API), remplacée par confirm_token/unsubscribe_token séparés.

ALTER TABLE parliament_member_follows DROP COLUMN IF EXISTS token;

ALTER TABLE parliament_member_follows
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirm_token TEXT,
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT,
  ADD COLUMN IF NOT EXISTS last_notified_vote_id INTEGER REFERENCES parliament_votes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parliament_member_follows_confirm_token
  ON parliament_member_follows (confirm_token);
CREATE INDEX IF NOT EXISTS idx_parliament_member_follows_unsubscribe_token
  ON parliament_member_follows (unsubscribe_token);
