-- Boîte à idées pour "Les enfants d'aujourd'hui et de demain" — même
-- principe que la boîte à idées de la charte éthique : jamais publié
-- directement, toujours modéré manuellement.
CREATE TABLE IF NOT EXISTS future_idea_suggestions (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'draft', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_future_idea_suggestions_status ON future_idea_suggestions (status, submitted_at DESC);
