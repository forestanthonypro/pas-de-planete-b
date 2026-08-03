-- Historique des mesures d'impact environnemental du site (EcoIndex,
-- Lighthouse), alimenté automatiquement par le workflow CI à chaque
-- déploiement en production — jamais saisi à la main.
CREATE TABLE IF NOT EXISTS environmental_metrics (
    id SERIAL PRIMARY KEY,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    url TEXT NOT NULL,
    ecoindex_grade TEXT NOT NULL,
    ecoindex_score NUMERIC(5, 2) NOT NULL,
    page_weight_kb NUMERIC(10, 2) NOT NULL,
    dom_elements INTEGER NOT NULL,
    requests_count INTEGER NOT NULL,
    ghg_co2_g NUMERIC(6, 2) NOT NULL,
    water_cl NUMERIC(6, 2) NOT NULL,
    lighthouse_performance INTEGER,
    lighthouse_accessibility INTEGER,
    lighthouse_seo INTEGER,
    lighthouse_best_practices INTEGER,
    load_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_environmental_metrics_date ON environmental_metrics (measured_at DESC);
