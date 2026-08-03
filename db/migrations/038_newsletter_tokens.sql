-- Complète le mécanisme de double opt-in déjà entamé (la colonne
-- "confirmed" existait déjà mais n'était jamais réellement activée par
-- l'API) — ajoute les jetons nécessaires pour confirmer l'inscription et
-- se désabonner sans avoir à connaître son adresse email pour désabonner
-- quelqu'un d'autre.
ALTER TABLE newsletter_subscribers
    ADD COLUMN IF NOT EXISTS confirm_token TEXT,
    ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

CREATE INDEX IF NOT EXISTS idx_newsletter_confirm_token ON newsletter_subscribers (confirm_token);
CREATE INDEX IF NOT EXISTS idx_newsletter_unsub_token ON newsletter_subscribers (unsubscribe_token);
