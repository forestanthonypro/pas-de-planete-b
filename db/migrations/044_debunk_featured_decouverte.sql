-- Sélection des entrées Débunk mises en avant sur la page /decouverte (mode
-- découverte) — un booléen simple plutôt qu'une table séparée, cohérent
-- avec published sur cette même table. La limite de 6 entrées maximum est
-- appliquée côté API (route /api/admin/debunk/:slug/featured), pas en
-- contrainte SQL (une contrainte "au plus 6 lignes à true" n'est pas
-- exprimable proprement avec une simple CHECK constraint).
ALTER TABLE debunk_entries
  ADD COLUMN IF NOT EXISTS featured_decouverte BOOLEAN NOT NULL DEFAULT false;
