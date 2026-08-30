-- Verrou anti-chevauchement pour ingestReferenceWeatherOneBatch — une
-- seule ligne, mise à jour de façon atomique (voir referenceWeather.js
-- pour le détail et pourquoi ce n'est volontairement pas un verrou
-- consultatif Postgres classique).

CREATE TABLE IF NOT EXISTS reference_weather_ingest_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_at TIMESTAMPTZ,
    CONSTRAINT reference_weather_ingest_lock_single_row CHECK (id = 1)
);

INSERT INTO reference_weather_ingest_lock (id, locked_at) VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
