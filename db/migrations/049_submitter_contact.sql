-- Coordonnées du visiteur qui propose un contenu — jamais affichées
-- publiquement, uniquement visibles en admin pour recontacter la personne
-- si besoin (préciser des points, expliquer un refus...). submission_notes
-- existait déjà sur debunk_entries/science_relays (voir
-- 048_submission_notes.sql) ; étendu ici aux 4 autres tables pour le même
-- usage — un message personnel libre, séparé du contenu éditorial soumis.
ALTER TABLE petitions ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE petitions ADD COLUMN IF NOT EXISTS submission_notes TEXT;

ALTER TABLE resource_locations ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE resource_locations ADD COLUMN IF NOT EXISTS submission_notes TEXT;

ALTER TABLE resource_online ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE resource_online ADD COLUMN IF NOT EXISTS submission_notes TEXT;

ALTER TABLE future_idea_suggestions ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE future_idea_suggestions ADD COLUMN IF NOT EXISTS submission_notes TEXT;

ALTER TABLE debunk_entries ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE science_relays ADD COLUMN IF NOT EXISTS submitter_email TEXT;
