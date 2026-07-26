-- Ajoute le % de stress hydrique par pays (prélèvements / ressources
-- renouvelables), déjà extrait uniquement pour le repère mondial jusqu'ici —
-- pour permettre une vraie comparaison pays vs monde sur la même unité (%).
ALTER TABLE water_data
  ADD COLUMN IF NOT EXISTS withdrawal_share_percent NUMERIC(8, 2);
