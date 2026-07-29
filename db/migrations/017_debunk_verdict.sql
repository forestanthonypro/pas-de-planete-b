-- Ajoute le verdict (badge coloré) et la citation exacte de l'affirmation
-- passée au crible — inspiré du gabarit AFP Factuel : un badge clair en
-- tête, puis l'affirmation citée avant de la démonter.
ALTER TABLE debunk_entries
  ADD COLUMN IF NOT EXISTS verdict TEXT NOT NULL DEFAULT 'faux'
    CHECK (verdict IN ('faux', 'trompeur', 'confirme')),
  ADD COLUMN IF NOT EXISTS claim_quote TEXT;
