-- Même principe que Debunk : catégorie gérable en admin plutôt que texte
-- libre, cohérent avec Paysans et Ressources.
CREATE TABLE IF NOT EXISTS interview_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE science_relays
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES interview_categories(id) ON DELETE SET NULL;
