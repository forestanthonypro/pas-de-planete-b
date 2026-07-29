-- Image d'illustration optionnelle pour une entrée Debunk — une URL externe
-- pour l'instant (pas de stockage de fichiers en place côté serveur).
ALTER TABLE debunk_entries
  ADD COLUMN IF NOT EXISTS image_url TEXT;
