-- Marque les entrées créées via le formulaire public de soumission
-- (paysan_resources, resource_locations, resource_online) — purement
-- informatif pour l'admin, aucun impact fonctionnel. Le vrai mécanisme de
-- modération reste le champ published existant (false par défaut = en
-- attente de relecture), exactement comme pour la charte/idées enfants.
ALTER TABLE paysan_resources
    ADD COLUMN IF NOT EXISTS submitted_publicly BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE resource_locations
    ADD COLUMN IF NOT EXISTS submitted_publicly BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE resource_online
    ADD COLUMN IF NOT EXISTS submitted_publicly BOOLEAN NOT NULL DEFAULT false;
