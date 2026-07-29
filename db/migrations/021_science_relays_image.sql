-- Image de vignette pour les entrées sans vidéo (article, podcast) — les
-- vidéos utilisent automatiquement la miniature YouTube, pas besoin de
-- champ séparé pour elles.
ALTER TABLE science_relays
  ADD COLUMN IF NOT EXISTS image_url TEXT;
