-- Population par pays et par année (déjà présente dans le CSV CO2 qu'on utilise,
-- jamais capturée jusqu'ici) — nécessaire pour calculer des "par habitant" que
-- les sources ne fournissent pas déjà toutes faites (ex: eau prélevée/habitant).
ALTER TABLE co2_emissions
  ADD COLUMN IF NOT EXISTS population BIGINT;
