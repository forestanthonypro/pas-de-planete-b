-- Ajoute le comptage absolu mondial (en plus du %, déjà présent) pour les
-- mêmes groupes taxonomiques larges (pas seulement mammifères/oiseaux/
-- poissons) — source IUCN Red List Summary Statistics, via Our World in Data
-- (republication légale sous licence CC-BY ; l'API/le site IUCN direct
-- interdit explicitement toute redistribution automatisée dans ses conditions
-- d'utilisation, d'où le passage systématique par OWID dans ce projet).
ALTER TABLE species_threatened_global_share
  ADD COLUMN IF NOT EXISTS species_count INTEGER;
