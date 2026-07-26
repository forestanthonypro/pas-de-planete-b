-- Ajoute la classe taxonomique (Aves, Gastropoda, Mammalia...) pour permettre
-- un affichage plus précis que le simple règne (Animal/Végétal/Champignon).
ALTER TABLE species_status
  ADD COLUMN IF NOT EXISTS class TEXT;
