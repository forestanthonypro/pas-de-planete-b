-- Filet de sécurité : GBIF ne renseigne pas toujours la classe taxonomique,
-- mais l'ordre l'est presque toujours. On le stocke pour pouvoir en déduire
-- un groupe (Poisson, Oiseau...) même quand la classe est absente.
ALTER TABLE species_status
  ADD COLUMN IF NOT EXISTS taxon_order TEXT;
