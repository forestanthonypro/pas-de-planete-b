-- Fait passer la catégorie de Debunk d'un champ texte libre à une liste
-- gérable en admin — cohérent avec Paysans et Ressources. L'ancien champ
-- texte "category" est conservé (legacy, plus utilisé par le frontend une
-- fois cette migration appliquée) pour ne pas perdre de données existantes.
CREATE TABLE IF NOT EXISTS debunk_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE debunk_entries
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES debunk_categories(id) ON DELETE SET NULL;
