-- Portée géographique des contenus proposés par les visiteurs — pays
-- concerné(s), mais aussi continent(s) ou "international/monde" pour les
-- contenus à portée plus large qu'un seul pays. Tableau de textes plutôt
-- que des tables de liaison séparées par type de contenu : plus simple
-- (une seule colonne partout, pas cinq tables quasi identiques), et
-- PostgreSQL indexe bien ce type de tableau pour le filtrage (voir les
-- index GIN plus bas) — cohérent avec l'écoconception du projet : moins
-- de structure, moins de requêtes.
--
-- Format des codes : ISO 3166-1 alpha-3 pour un pays ("FRA", "ESP"...),
-- ou l'un des 8 codes fixes ci-dessous pour une portée plus large :
--   AFR (Afrique), NAC (Amérique du Nord), SAM (Amérique du Sud),
--   ASI (Asie), EUR (Europe), OCE (Océanie), ANT (Antarctique),
--   WORLD (international / monde entier)
-- NAC et non NAM : NAM est le vrai code ISO3 de la Namibie, collision
-- repérée en testant le module de sélection avant livraison (16 août
-- 2026) — corrigé avant toute donnée réelle enregistrée avec l'ancien code.
-- La correspondance codes -> libellés traduits est gérée côté front
-- (apps/web/lib/scopes.js), pas en base.

ALTER TABLE petitions ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_petitions_scope_codes ON petitions USING GIN (scope_codes);

ALTER TABLE resource_locations ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_resource_locations_scope_codes ON resource_locations USING GIN (scope_codes);

ALTER TABLE resource_online ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_resource_online_scope_codes ON resource_online USING GIN (scope_codes);

ALTER TABLE future_ideas ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_future_ideas_scope_codes ON future_ideas USING GIN (scope_codes);

-- Debunk et Relais scientifique n'avaient jusqu'ici aucune notion de
-- soumission publique (contenu uniquement rédigé en admin) — on ajoute
-- submitted_publicly pour distinguer "en attente de relecture après
-- soumission visiteur" de "brouillon admin", exactement comme pour les
-- pétitions et les ressources (voir 039_petitions.sql).
ALTER TABLE debunk_entries ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE debunk_entries ADD COLUMN IF NOT EXISTS submitted_publicly BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_debunk_entries_scope_codes ON debunk_entries USING GIN (scope_codes);

ALTER TABLE science_relays ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE science_relays ADD COLUMN IF NOT EXISTS submitted_publicly BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_science_relays_scope_codes ON science_relays USING GIN (scope_codes);
