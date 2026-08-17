-- Complément à 046_scope_codes.sql : future_idea_suggestions est la vraie
-- table de soumission publique pour "Les enfants d'aujourd'hui et de
-- demain" (le formulaire "Proposer une idée" y écrit directement) —
-- future_ideas, qui avait déjà reçu scope_codes, est la table des idées
-- déjà retenues et mises au vote par l'admin. Les deux méritent la
-- colonne : l'une pour la soumission, l'autre pour l'affichage/filtre des
-- idées déjà publiées.
ALTER TABLE future_idea_suggestions ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_future_idea_suggestions_scope_codes ON future_idea_suggestions USING GIN (scope_codes);
