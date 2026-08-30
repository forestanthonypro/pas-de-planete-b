-- La période de référence utilisée pour calculer chaque normale n'est
-- plus systématiquement 1991-2020 (voir referenceWeatherNormals.js,
-- determineReferencePeriod) — elle est désormais adaptée à ce qui est
-- réellement disponible pour chaque station. Ces deux colonnes
-- enregistrent la période effectivement utilisée, pour ne jamais afficher
-- une "normale" sans préciser sur combien d'années elle repose.

ALTER TABLE reference_weather_normals
  ADD COLUMN IF NOT EXISTS reference_start_year INTEGER,
  ADD COLUMN IF NOT EXISTS reference_end_year INTEGER;
