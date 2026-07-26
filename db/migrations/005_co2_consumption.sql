-- Ajoute les émissions "basées sur la consommation" (ajustées du commerce :
-- production nationale - exportations + importations), disponibles dans le même
-- CSV Our World in Data que les émissions territoriales, mais pas encore captées.
ALTER TABLE co2_emissions
  ADD COLUMN IF NOT EXISTS consumption_co2 NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS consumption_co2_per_capita NUMERIC(8, 3);
