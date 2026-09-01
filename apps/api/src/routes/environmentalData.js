import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireIngestToken } from "../lib/auth.js";
import { ingestCo2 } from "../ingest/co2.js";
import { ingestTemperaturesOneBatch } from "../ingest/temperatures.js";
import { ingestReferenceWeatherOneBatch } from "../ingest/referenceWeather.js";
import { ingestRecentReferenceWeather } from "../ingest/referenceWeatherRecent.js";
import { computeAndStoreNormalsForStation, MIN_SAMPLE_SIZE_FOR_DISPLAY } from "../ingest/referenceWeatherNormals.js";
import { ingestSectorEmissions } from "../ingest/sectorEmissions.js";
import { ingestPowerPlants } from "../ingest/power_plants.js";
import { ingestSpecies } from "../ingest/species.js";
import { ingestFires } from "../ingest/fires.js";
import { ingestVegetation } from "../ingest/vegetation.js";
import { ingestWater } from "../ingest/water.js";
import { ingestElectricity } from "../ingest/electricity.js";
import { ingestSpeciesThreatened } from "../ingest/species_threatened.js";
import { ingestSpeciesObservations } from "../ingest/speciesObservations.js";
import { ingestPollution } from "../ingest/pollution.js";
import { ingestWorldBenchmarks, ingestTemperatureBenchmark } from "../ingest/world_benchmarks.js";
import { ingestTemperatures } from "../ingest/temperatures.js";
import { mergeTranslations } from "../lib/translations.js";

const router = Router();

// --- CO2 ---

router.get("/api/co2/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM co2_emissions ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/co2/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, emissions_mt, emissions_per_capita, consumption_co2, consumption_co2_per_capita, population
       FROM co2_emissions
       WHERE country_code = $1
       ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/co2", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestCo2(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/sector-emissions", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestSectorEmissions(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// Un seul lot borné en durée (~10-15 min, ~20 pays) — voir
// ingestTemperaturesOneBatch (ingest/temperatures.js) pour le détail du
// cadencement. Appelée en boucle par un workflow planifié plutôt qu'en une
// seule requête de plusieurs heures, pour rester sous la limite de 6h d'un
// job GitHub Actions.
router.post("/api/admin/ingest/temperatures-batch", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestTemperaturesOneBatch(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// Un seul lot borné à 10 minutes — voir ingestReferenceWeatherOneBatch
// (ingest/referenceWeather.js) pour le détail (limite de 7 jours par
// requête côté API Infoclimat, ~15 600 requêtes au total sur les 10
// stations x 30 ans). Comme pour les autres ingestions par lots, appelée
// en boucle par un workflow planifié plutôt qu'en une seule requête de
// plusieurs heures.
router.post("/api/admin/ingest/reference-weather-batch", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestReferenceWeatherOneBatch(pool, 10 * 60 * 1000);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// Calcule les normales/records des 10 stations à partir de ce qui a déjà
// été collecté — à déclencher manuellement une fois le backfill
// suffisamment avancé (voir sample_size en base pour juger de la
// fiabilité), pas encore automatisé en tâche planifiée le temps que la
// collecte 1991-2020 avance. Rapide (~10 stations x <1s chacune), pas
// besoin du système de lot avec reprise utilisé pour la collecte elle-même.
router.post("/api/admin/ingest/reference-weather-normals", requireIngestToken, async (_req, res) => {
  try {
    const stations = (await pool.query("SELECT station_code FROM reference_weather_stations ORDER BY display_order")).rows;
    const results = {};
    for (const s of stations) {
      results[s.station_code] = await computeAndStoreNormalsForStation(pool, s.station_code);
    }
    res.json({ status: "ok", results });
  } catch (err) {
    res.status(500).json({ error: "Échec du calcul", detail: errorDetail(err) });
  }
});

// Collecte ponctuelle et rapide des N derniers jours pour les 10 stations
// — voir ingest/referenceWeatherRecent.js pour pourquoi cette route existe
// séparément du grand backfill chronologique. À déclencher une fois, puis
// idéalement à reprogrammer en tâche quotidienne légère une fois le
// backfill principal terminé (pas encore fait — l'ingestion continue de
// toute façon rattraper ces mêmes dates automatiquement).
router.post("/api/admin/ingest/reference-weather-recent", requireIngestToken, async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days, 10) : 60;
    const result = await ingestRecentReferenceWeather(pool, days);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// --- Stations météo de référence (écart à la normale, records) ---

// Le seuil de fiabilité (MIN_SAMPLE_SIZE_FOR_DISPLAY) vient de
// referenceWeatherNormals.js — une seule valeur, partagée avec le
// diagnostic "reliableCount" de la route de calcul des normales.
// Au-delà de ce nombre de jours de retard, la donnée la plus récente
// d'une station est jugée trop ancienne pour être présentée comme
// "aujourd'hui" — repéré le 30/08/2026 : Strasbourg (ME126) n'a plus
// transmis de relevé depuis fin janvier 2026 (station "Lycée Couffignal"
// hors service ou déconnectée côté source), et la comparaison "vs
// normale" s'affichait quand même comme si c'était le jour même, ce qui
// est trompeur — pas un bug de calcul, mais un vrai défaut d'affichage :
// la fraîcheur de la donnée n'était jamais vérifiée avant affichage.
const MAX_STALE_DAYS = 5;

router.get("/api/reference-weather/today", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.station_code, s.city_label,
             d.observed_date::text AS observed_date, d.temp_min, d.temp_max,
             n.normal_temp_min, n.normal_temp_max, n.record_temp_min, n.record_temp_max, n.sample_size,
             n.reference_start_year, n.reference_end_year
      FROM reference_weather_stations s
      -- Le jour le plus récent disponible pour chaque station (LATERAL,
      -- pas forcément le même jour calendaire pour toutes si l'une a pris
      -- du retard dans sa collecte).
      LEFT JOIN LATERAL (
        SELECT * FROM reference_weather_daily
        WHERE station_code = s.station_code
        ORDER BY observed_date DESC LIMIT 1
      ) d ON true
      LEFT JOIN reference_weather_normals n
        ON n.station_code = s.station_code AND d.observed_date IS NOT NULL
        AND n.month_day = to_char(d.observed_date, 'MM-DD')
      ORDER BY s.display_order
    `);

    const rows = result.rows.map((r) => {
      const hasData = r.observed_date != null;
      const daysSinceObserved = hasData
        ? Math.round((Date.now() - new Date(`${r.observed_date}T00:00:00Z`).getTime()) / 86400000)
        : null;
      const isStale = hasData && daysSinceObserved > MAX_STALE_DAYS;
      const sampleSize = r.sample_size != null ? parseInt(r.sample_size, 10) : 0;
      const hasReliableNormal = hasData && !isStale && r.normal_temp_max != null && sampleSize >= MIN_SAMPLE_SIZE_FOR_DISPLAY;
      const tempMax = hasData ? parseFloat(r.temp_max) : null;
      const tempMin = hasData ? parseFloat(r.temp_min) : null;
      const normalTempMax = hasReliableNormal ? parseFloat(r.normal_temp_max) : null;
      const normalTempMin = hasReliableNormal ? parseFloat(r.normal_temp_min) : null;
      const recordTempMax = hasReliableNormal && r.record_temp_max != null ? parseFloat(r.record_temp_max) : null;
      const recordTempMin = hasReliableNormal && r.record_temp_min != null ? parseFloat(r.record_temp_min) : null;
      return {
        stationCode: r.station_code,
        cityLabel: r.city_label,
        observedDate: r.observed_date,
        tempMin: hasReliableNormal ? tempMin : null,
        tempMax: hasReliableNormal ? tempMax : null,
        dataReady: hasReliableNormal,
        // Distingue "jamais eu de données/normale" de "en a eu, mais plus
        // récemment" — permet d'afficher un message différent et honnête
        // selon le cas côté frontend, plutôt qu'un simple silence dans
        // les deux cas.
        isStale,
        sampleSize,
        deviationMax: hasReliableNormal ? Math.round((tempMax - normalTempMax) * 10) / 10 : null,
        deviationMin: hasReliableNormal ? Math.round((tempMin - normalTempMin) * 10) / 10 : null,
        isNewRecordMax: hasReliableNormal && recordTempMax != null && tempMax >= recordTempMax,
        isNewRecordMin: hasReliableNormal && recordTempMin != null && tempMin <= recordTempMin,
        // Toujours exposé quand une normale existe : jamais de comparaison
        // "vs normale" sans préciser sur quelle période elle repose (peut
        // être bien plus court que 1991-2020 pour une station récente,
        // voir determineReferencePeriod dans referenceWeatherNormals.js).
        referenceStartYear: hasReliableNormal ? r.reference_start_year : null,
        referenceEndYear: hasReliableNormal ? r.reference_end_year : null,
      };
    });

    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Courbe de normale (température moyenne sur 1991-2020, jour par jour de
// l'année) pour chaque station suffisamment fiable — sert à visualiser
// concrètement ce qu'est "la normale" évoquée dans /api/reference-weather/
// today, plutôt qu'un simple chiffre abstrait.
router.get("/api/reference-weather/normals-curve", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.station_code, s.city_label, s.display_order,
              n.month_day, n.normal_temp_min, n.normal_temp_max,
              n.reference_start_year, n.reference_end_year
       FROM reference_weather_stations s
       JOIN reference_weather_normals n ON n.station_code = s.station_code
       WHERE n.sample_size >= $1 AND s.excluded_from_charts = false
       ORDER BY s.display_order, n.month_day`,
      [MIN_SAMPLE_SIZE_FOR_DISPLAY]
    );

    const byStation = new Map();
    for (const row of result.rows) {
      if (!byStation.has(row.station_code)) {
        byStation.set(row.station_code, {
          stationCode: row.station_code,
          cityLabel: row.city_label,
          referenceStartYear: row.reference_start_year,
          referenceEndYear: row.reference_end_year,
          points: [],
        });
      }
      byStation.get(row.station_code).points.push({
        monthDay: row.month_day,
        normalTempMin: row.normal_temp_min != null ? parseFloat(row.normal_temp_min) : null,
        normalTempMax: row.normal_temp_max != null ? parseFloat(row.normal_temp_max) : null,
      });
    }

    res.json(Array.from(byStation.values()));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Pourcentage de jours par an où la température maximale a dépassé la
// normale de ce jour précis, par ville — permet de voir si ces
// dépassements deviennent plus fréquents au fil des années collectées.
// N'inclut que les années suffisamment complètes (≥300 jours de données)
// pour ne pas fausser le pourcentage avec une première ou dernière année
// partielle (voir MIN_DAYS_FOR_YEAR).
const MIN_DAYS_FOR_YEAR = 300;

router.get("/api/reference-weather/exceedance-by-year", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.station_code, s.city_label, s.display_order,
              extract(year from d.observed_date)::int AS year,
              count(*) FILTER (WHERE d.temp_max > n.normal_temp_max) AS hot_days,
              count(*) AS total_days
       FROM reference_weather_daily d
       JOIN reference_weather_stations s ON s.station_code = d.station_code
       JOIN reference_weather_normals n
         ON n.station_code = d.station_code AND n.month_day = to_char(d.observed_date, 'MM-DD')
       WHERE n.sample_size >= $1 AND s.excluded_from_charts = false
       GROUP BY s.station_code, s.city_label, s.display_order, year
       HAVING count(*) >= $2
       ORDER BY s.display_order, year`,
      [MIN_SAMPLE_SIZE_FOR_DISPLAY, MIN_DAYS_FOR_YEAR]
    );

    const byStation = new Map();
    for (const row of result.rows) {
      if (!byStation.has(row.station_code)) {
        byStation.set(row.station_code, { stationCode: row.station_code, cityLabel: row.city_label, points: [] });
      }
      const hotDays = parseInt(row.hot_days, 10);
      const totalDays = parseInt(row.total_days, 10);
      byStation.get(row.station_code).points.push({
        year: row.year,
        percentHotDays: Math.round((hotDays / totalDays) * 1000) / 10,
        hotDays,
        totalDays,
      });
    }

    res.json(Array.from(byStation.values()));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// --- Centrales électriques ---

router.get("/api/power-plants/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code FROM power_plants ORDER BY country_code"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/power-plants/fuel-types", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT fuel_type FROM power_plants ORDER BY fuel_type"
    );
    res.json(result.rows.map((r) => r.fuel_type));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/power-plants", async (req, res) => {
  const { country, fuel_type: fuelType } = req.query;
  if (!country) {
    return res.status(400).json({ error: "Le paramètre 'country' (code ISO3) est obligatoire" });
  }
  try {
    const params = [country.toUpperCase()];
    let query = `
      SELECT name, fuel_type, capacity_mw,
             ST_Y(location::geometry) AS latitude,
             ST_X(location::geometry) AS longitude
      FROM power_plants
      WHERE country_code = $1
    `;
    if (fuelType) {
      params.push(fuelType);
      query += ` AND fuel_type = $2`;
    }
    query += " ORDER BY capacity_mw DESC NULLS LAST LIMIT 2000";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/power-plants", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestPowerPlants(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// --- Espèces ---

router.get("/api/species/categories", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT category FROM species_status ORDER BY category"
    );
    res.json(result.rows.map((r) => r.category));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/species", async (req, res) => {
  const { category, country, kingdom } = req.query;
  try {
    const params = [];
    const conditions = [];
    let query = `
      SELECT s.scientific_name, s.kingdom, s.class, s.taxon_order, s.category, s.common_names
      FROM species_status s
    `;
    if (country) {
      query += " JOIN species_countries sc ON sc.gbif_key = s.gbif_key";
      params.push(country.toUpperCase());
      conditions.push(`sc.country_code = $${params.length}`);
    }
    if (category) {
      params.push(category.toUpperCase());
      conditions.push(`s.category = $${params.length}`);
    }
    if (kingdom) {
      params.push(kingdom);
      conditions.push(`s.kingdom = $${params.length}`);
    }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY s.scientific_name LIMIT 1000";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/species/kingdoms", async (req, res) => {
  const { country } = req.query;
  try {
    const params = [];
    let query = "SELECT DISTINCT s.kingdom FROM species_status s";
    if (country) {
      query += " JOIN species_countries sc ON sc.gbif_key = s.gbif_key WHERE sc.country_code = $1";
      params.push(country.toUpperCase());
    }
    query += " ORDER BY s.kingdom";
    const result = await pool.query(query, params);
    res.json(result.rows.map((r) => r.kingdom).filter(Boolean));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/species", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped, countryLinks } = await ingestSpecies(pool);
    res.json({ status: "ok", inserted, skipped, countryLinks });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// --- Dashboard combiné par pays ---

router.get("/api/country-summary/:country", async (req, res) => {
  const country = req.params.country.toUpperCase();
  try {
    const [co2Result, plantsResult, speciesResult, firesResult, vegetationResult, waterResult, electricityGenerationResult, speciesThreatenedResult, pollutionResult, temperaturesResult] = await Promise.all([
      pool.query(
        `SELECT year, emissions_mt::float, emissions_per_capita::float, consumption_co2::float, consumption_co2_per_capita::float, population::float
         FROM co2_emissions WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT fuel_type, COUNT(*) AS plant_count, SUM(capacity_mw)::float AS total_capacity_mw
         FROM power_plants WHERE country_code = $1
         GROUP BY fuel_type ORDER BY total_capacity_mw DESC NULLS LAST`,
        [country]
      ),
      pool.query(
        `SELECT s.category, s.kingdom, COUNT(*) AS species_count
         FROM species_status s
         JOIN species_countries sc ON sc.gbif_key = s.gbif_key
         WHERE sc.country_code = $1
         GROUP BY s.category, s.kingdom`,
        [country]
      ),
      pool.query(
        `SELECT COUNT(*) AS fire_count, MAX(detected_at) AS latest_detection
         FROM fires WHERE country_code = $1`,
        [country]
      ),
      pool.query(
        `SELECT year, tree_cover_loss_ha::float, forest_area_ha::float
         FROM vegetation_loss WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, renewable_freshwater_m3_per_capita::float, precipitation_mm::float, withdrawal_m3::float, withdrawal_share_percent::float
         FROM water_data WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, coal_twh::float, gas_twh::float, oil_twh::float, nuclear_twh::float, hydro_twh::float, wind_twh::float,
                solar_twh::float, biofuel_twh::float, other_renewable_twh::float, total_generation_twh::float, demand_twh::float, demand_per_capita_kwh::float
         FROM electricity_generation WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, mammals_threatened, birds_threatened, fish_threatened
         FROM species_threatened_counts WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, pm25_ug_m3::float FROM pollution_data WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, avg_temp_c::float, deviation_from_reference_c::float, heatwave_count, coldwave_count
         FROM country_temperatures WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
    ]);

    res.json({
      country,
      co2: co2Result.rows,
      energyMix: plantsResult.rows,
      speciesBreakdown: speciesResult.rows,
      fires: firesResult.rows[0],
      vegetation: vegetationResult.rows,
      water: waterResult.rows,
      electricityGeneration: electricityGenerationResult.rows,
      speciesThreatened: speciesThreatenedResult.rows,
      pollution: pollutionResult.rows,
      temperatures: temperaturesResult.rows,
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});


// --- Feux actifs (quasi temps réel) ---

router.get("/api/fires", async (req, res) => {
  const { country } = req.query;
  if (!country) {
    return res.status(400).json({ error: "Le paramètre 'country' (code ISO3) est obligatoire" });
  }
  try {
    const result = await pool.query(
      `SELECT detected_at, confidence, frp,
              ST_Y(location::geometry) AS latitude,
              ST_X(location::geometry) AS longitude
       FROM fires
       WHERE country_code = $1
       ORDER BY detected_at DESC
       LIMIT 2000`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/fires", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, countriesSkipped, sampleErrors } = await ingestFires(pool);
    res.json({ status: "ok", inserted, countriesSkipped, sampleErrors });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// --- Fraîcheur des données ---
// Indique quand CHAQUE table a été rafraîchie pour la dernière fois côté notre base
// (pas la date des données elles-mêmes, qui peut être plus ancienne selon la source).
router.get("/api/meta/last-updated", async (_req, res) => {
  try {
    const [co2, plants, species, fires, vegetation, water, electricity, speciesThreatened, speciesObservations, pollution, deputies, anGroups, scrutins, worldBenchmarks, temperatures, usCongressMembers, usCongressVotes, spainCongressMembers, spainCongressVotes, spainSenateMembers, spainSenateVotes, italySenateMembers, italySenateVotes, italyCameraMembers, italyCameraVotes] = await Promise.all([
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM co2_emissions"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM power_plants"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM species_status"),
      pool.query("SELECT MAX(ingested_at) AS updated_at, MAX(detected_at) AS latest_detection FROM fires"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM vegetation_loss"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM water_data"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM electricity_generation"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM species_threatened_counts"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(DISTINCT country_code) AS country_count FROM species_observations_coverage"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM pollution_data"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM deputies"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM an_groups"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM scrutins"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM world_benchmarks"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year, COUNT(DISTINCT country_code) AS country_count FROM country_temperatures"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_members WHERE country_code = 'us'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_votes WHERE country_code = 'us'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_members WHERE country_code = 'es' AND chamber = 'lower'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_votes WHERE country_code = 'es' AND chamber = 'lower'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_members WHERE country_code = 'es' AND chamber = 'upper'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_votes WHERE country_code = 'es' AND chamber = 'upper'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_members WHERE country_code = 'it' AND chamber = 'upper'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_votes WHERE country_code = 'it' AND chamber = 'upper'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_members WHERE country_code = 'it' AND chamber = 'lower'"),
      pool.query("SELECT MAX(updated_at) AS updated_at, COUNT(*) AS row_count FROM parliament_votes WHERE country_code = 'it' AND chamber = 'lower'"),
    ]);
    res.json({
      co2: { lastIngested: co2.rows[0].updated_at, latestYear: co2.rows[0].latest_year },
      powerPlants: { lastIngested: plants.rows[0].updated_at },
      species: { lastIngested: species.rows[0].updated_at },
      fires: { lastIngested: fires.rows[0].updated_at, latestDetection: fires.rows[0].latest_detection },
      vegetation: { lastIngested: vegetation.rows[0].updated_at, latestYear: vegetation.rows[0].latest_year },
      water: { lastIngested: water.rows[0].updated_at, latestYear: water.rows[0].latest_year },
      electricity: { lastIngested: electricity.rows[0].updated_at, latestYear: electricity.rows[0].latest_year },
      speciesThreatened: { lastIngested: speciesThreatened.rows[0].updated_at, latestYear: speciesThreatened.rows[0].latest_year },
      speciesObservations: {
        lastIngested: speciesObservations.rows[0].updated_at,
        countryCount: Number(speciesObservations.rows[0].country_count),
      },
      pollution: { lastIngested: pollution.rows[0].updated_at, latestYear: pollution.rows[0].latest_year },
      deputies: { lastIngested: deputies.rows[0].updated_at, rowCount: Number(deputies.rows[0].row_count) },
      anGroups: { lastIngested: anGroups.rows[0].updated_at },
      scrutins: { lastIngested: scrutins.rows[0].updated_at, rowCount: Number(scrutins.rows[0].row_count) },
      worldBenchmarks: { lastIngested: worldBenchmarks.rows[0].updated_at },
      temperatures: {
        lastIngested: temperatures.rows[0].updated_at,
        latestYear: temperatures.rows[0].latest_year,
        countryCount: Number(temperatures.rows[0].country_count),
      },
      usCongressMembers: { lastIngested: usCongressMembers.rows[0].updated_at, rowCount: Number(usCongressMembers.rows[0].row_count) },
      usCongressVotes: { lastIngested: usCongressVotes.rows[0].updated_at, rowCount: Number(usCongressVotes.rows[0].row_count) },
      spainCongressMembers: { lastIngested: spainCongressMembers.rows[0].updated_at, rowCount: Number(spainCongressMembers.rows[0].row_count) },
      spainCongressVotes: { lastIngested: spainCongressVotes.rows[0].updated_at, rowCount: Number(spainCongressVotes.rows[0].row_count) },
      spainSenateMembers: { lastIngested: spainSenateMembers.rows[0].updated_at, rowCount: Number(spainSenateMembers.rows[0].row_count) },
      spainSenateVotes: { lastIngested: spainSenateVotes.rows[0].updated_at, rowCount: Number(spainSenateVotes.rows[0].row_count) },
      italySenateMembers: { lastIngested: italySenateMembers.rows[0].updated_at, rowCount: Number(italySenateMembers.rows[0].row_count) },
      italySenateVotes: { lastIngested: italySenateVotes.rows[0].updated_at, rowCount: Number(italySenateVotes.rows[0].row_count) },
      italyCameraMembers: { lastIngested: italyCameraMembers.rows[0].updated_at, rowCount: Number(italyCameraMembers.rows[0].row_count) },
      italyCameraVotes: { lastIngested: italyCameraVotes.rows[0].updated_at, rowCount: Number(italyCameraVotes.rows[0].row_count) },
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// --- Impact environnemental du site (EcoIndex, Lighthouse) ---
// Alimenté automatiquement par le workflow CI à chaque déploiement en
// production (voir .github/workflows/ci.yml, job "environmental-audit")
// — jamais saisi à la main.

router.get("/api/environmental-metrics", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, measured_at, url, ecoindex_grade, ecoindex_score, page_weight_kb,
              dom_elements, requests_count, ghg_co2_g, water_cl,
              lighthouse_performance, lighthouse_accessibility, lighthouse_seo,
              lighthouse_best_practices, load_time_ms
       FROM environmental_metrics
       ORDER BY measured_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/environmental-metrics", requireIngestToken, async (req, res) => {
  const {
    url, ecoindexGrade, ecoindexScore, pageWeightKb, domElements, requestsCount,
    ghgCo2G, waterCl, lighthousePerformance, lighthouseAccessibility,
    lighthouseSeo, lighthouseBestPractices, loadTimeMs,
  } = req.body || {};
  if (!url || !ecoindexGrade || ecoindexScore == null || pageWeightKb == null) {
    return res.status(400).json({ error: "Champs requis manquants (url, ecoindexGrade, ecoindexScore, pageWeightKb)" });
  }
  try {
    await pool.query(
      `INSERT INTO environmental_metrics
         (url, ecoindex_grade, ecoindex_score, page_weight_kb, dom_elements, requests_count,
          ghg_co2_g, water_cl, lighthouse_performance, lighthouse_accessibility,
          lighthouse_seo, lighthouse_best_practices, load_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        url, ecoindexGrade, ecoindexScore, pageWeightKb, domElements || null, requestsCount || null,
        ghgCo2G || null, waterCl || null, lighthousePerformance || null, lighthouseAccessibility || null,
        lighthouseSeo || null, lighthouseBestPractices || null, loadTimeMs || null,
      ]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

// --- Végétation / perte de couverture arborée ---

router.get("/api/vegetation/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM vegetation_loss ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/vegetation/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, tree_cover_loss_ha, forest_area_ha
       FROM vegetation_loss
       WHERE country_code = $1
       ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/vegetation", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestVegetation(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});


// --- Eau : ressources renouvelables et pluviométrie ---

router.get("/api/water/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM water_data ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/water/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, renewable_freshwater_m3_per_capita, precipitation_mm, withdrawal_m3, withdrawal_share_percent
       FROM water_data
       WHERE country_code = $1
       ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/water", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestWater(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});


// --- Génération électrique réelle (vs. capacité installée statique) ---

router.get("/api/electricity/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM electricity_generation ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/electricity/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, coal_twh, gas_twh, oil_twh, nuclear_twh, hydro_twh, wind_twh,
              solar_twh, biofuel_twh, other_renewable_twh, total_generation_twh, demand_twh, demand_per_capita_kwh
       FROM electricity_generation
       WHERE country_code = $1
       ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/electricity", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestElectricity(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});


// --- Espèces menacées : comptage officiel (IUCN via Banque mondiale) ---
// Comptages absolus par groupe, pas des pourcentages par pays (voir le
// commentaire du script d'ingestion pour l'explication).

router.get("/api/species-threatened/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM species_threatened_counts ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/species-threatened/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, mammals_threatened, birds_threatened, fish_threatened
       FROM species_threatened_counts
       WHERE country_code = $1
       ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/species-threatened/global/share", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT taxon_group, share_percent, species_count, year FROM species_threatened_global_share ORDER BY share_percent DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/species-threatened", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestSpeciesThreatened(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});


// --- Espèces réellement observées (GBIF occurrence/search), par pays et
// par quelques villes/régions pilotes. Signal différent de species_status
// (statut d'extinction officiel) : ce qui est concrètement recensé sur le
// terrain. Voir migration 055 pour le détail des limites de couverture. ---

router.get("/api/species-observations/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT country_code, country_name FROM species_observations_coverage ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/species-observations/:country", async (req, res) => {
  const country = req.params.country.toUpperCase();
  try {
    const [coverage, species] = await Promise.all([
      pool.query(
        `SELECT total_occurrences, establishment_means_count, degree_of_establishment_count, updated_at
         FROM species_observations_coverage WHERE country_code = $1`,
        [country]
      ),
      pool.query(
        `SELECT scientific_name, observation_count, in_global_tree_search, common_names, rank
         FROM species_observations_countries WHERE country_code = $1 ORDER BY rank`,
        [country]
      ),
    ]);
    res.json({
      coverage: coverage.rows[0] || null,
      topSpecies: species.rows,
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/species-observations/places/list", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT slug, name, country_code, contexte FROM species_observation_places ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/species-observations/places/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const place = await pool.query(
      "SELECT id, slug, name, country_code, contexte FROM species_observation_places WHERE slug = $1",
      [slug]
    );
    if (place.rows.length === 0) {
      return res.status(404).json({ error: "Lieu inconnu" });
    }
    const placeId = place.rows[0].id;
    const [coverage, species] = await Promise.all([
      pool.query(
        `SELECT total_occurrences, establishment_means_count, degree_of_establishment_count, updated_at
         FROM species_observation_places_coverage WHERE place_id = $1`,
        [placeId]
      ),
      pool.query(
        `SELECT scientific_name, observation_count, in_global_tree_search, common_names, rank
         FROM species_observation_places_species WHERE place_id = $1 ORDER BY rank`,
        [placeId]
      ),
    ]);
    res.json({
      place: place.rows[0],
      coverage: coverage.rows[0] || null,
      topSpecies: species.rows,
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/species-observations", requireIngestToken, async (req, res) => {
  try {
    const resume = req.query.resume === "true" || req.query.resume === "1";
    const maxDurationMinutesRaw = req.query.maxDurationMinutes;
    const maxDurationMs = maxDurationMinutesRaw ? Number(maxDurationMinutesRaw) * 60 * 1000 : null;
    const result = await ingestSpeciesObservations(pool, { resume, maxDurationMs });
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});


// --- Pollution de l'air (PM2.5) ---

router.get("/api/pollution/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM pollution_data ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/pollution/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, pm25_ug_m3 FROM pollution_data WHERE country_code = $1 ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/pollution", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestPollution(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// --- Températures : moyennes, écart à la référence, canicules/vagues de froid ---
// Un point (capitale) par pays, voir ingest/temperatures.js pour le détail
// du calcul. La liste de pays disponibles est déjà l'intersection avec le
// CO2 (voir ingest/temperatures.js), donc /api/temperatures/countries n'a
// pas besoin de filtre supplémentaire ici.

router.get("/api/temperatures/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM country_temperatures ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Moyenne mondiale année par année, calculée à la volée sur tous les pays
// déjà couverts (pas une table à part, pas de matérialisation nécessaire —
// le volume reste faible, une agrégation par année). Sert le warming
// stripes mondial affiché par défaut sur /temperatures, avant même le
// choix d'un pays précis. reference_period pris du premier pays trouvé :
// tous les pays de ce site partagent la même période de référence (OMM,
// 1991-2020), donc n'importe quelle ligne convient.
router.get("/api/temperatures/world", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT year, AVG(deviation_from_reference_c)::float AS deviation_from_reference_c,
              COUNT(DISTINCT country_code) AS country_count,
              (ARRAY_AGG(reference_period))[1] AS reference_period
       FROM country_temperatures
       WHERE deviation_from_reference_c IS NOT NULL
       GROUP BY year
       ORDER BY year`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/temperatures/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, avg_temp_c::float, max_temp_c::float, min_temp_c::float,
              deviation_from_reference_c::float,
              heatwave_count, coldwave_count, reference_period
       FROM country_temperatures
       WHERE country_code = $1
       ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/temperatures", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, countriesProcessed, countriesFailed, skippedNoCapital, sampleErrors } =
      await ingestTemperatures(pool);
    await ingestTemperatureBenchmark(pool);
    res.json({ status: "ok", inserted, countriesProcessed, countriesFailed, skippedNoCapital, sampleErrors });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// Route dédiée légère : ne fait que recalculer le repère mondial de
// température à partir des données déjà en base (pas d'appel Open-Meteo) —
// utile pour rafraîchir ce repère à la demande pendant qu'un backfill
// complet est encore en cours en arrière-plan (voir ingest/temperatures.js),
// sans attendre sa fin ni relancer l'ingestion complète.
router.post("/api/admin/ingest/temperature-benchmark", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestTemperatureBenchmark(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// --- Repères mondiaux (comparaison pays vs monde) ---

router.get("/api/world-benchmarks", async (_req, res) => {
  try {
    const result = await pool.query("SELECT metric_key, value, unit, year FROM world_benchmarks");
    const benchmarks = {};
    for (const row of result.rows) {
      benchmarks[row.metric_key] = { value: parseFloat(row.value), unit: row.unit, year: row.year };
    }
    res.json(benchmarks);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/world-benchmarks", requireIngestToken, async (_req, res) => {
  try {
    const { set } = await ingestWorldBenchmarks(pool);
    res.json({ status: "ok", set });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});



// Version allégée de /api/country-summary/:country — une seule ligne (la
// plus récente) par thème, au lieu de l'historique complet année par
// année. Créée spécifiquement pour /decouverte (page d'accueil par défaut
// pour un premier visiteur, voir DiscoveryModeContext.js) qui n'affiche
// qu'un chiffre par thème et n'a jamais besoin de l'historique complet —
// contrairement à /pays/[code].js qui, lui, continue d'utiliser la route
// complète pour ses graphiques. Réduit fortement le poids de page (et donc
// l'EcoIndex/Lighthouse mesurés en CI sur l'URL racine, qui redirige
// désormais vers /decouverte pour un premier visiteur).
// Extrait en fonction pour être réutilisée à la fois par la route standalone
// ci-dessous et par /api/decouverte-bootstrap (qui l'appelle deux fois en
// parallèle, pour les deux pays, dans le cadre d'un seul aller-retour HTTP
// côté client — voir la route bootstrap plus bas).
async function fetchLatestCountrySummary(country) {
  const [co2Result, waterResult, electricityResult, vegetationResult, speciesThreatenedResult, pollutionResult, temperaturesResult] = await Promise.all([
    pool.query(
      `SELECT emissions_per_capita::float, population::float
       FROM co2_emissions WHERE country_code = $1 AND emissions_per_capita IS NOT NULL
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT withdrawal_m3::float
       FROM water_data WHERE country_code = $1 AND withdrawal_m3 IS NOT NULL
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT demand_per_capita_kwh::float
       FROM electricity_generation WHERE country_code = $1 AND demand_per_capita_kwh IS NOT NULL
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT tree_cover_loss_ha::float, forest_area_ha::float
       FROM vegetation_loss WHERE country_code = $1 AND tree_cover_loss_ha IS NOT NULL AND forest_area_ha IS NOT NULL
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT mammals_threatened, birds_threatened, fish_threatened
       FROM species_threatened_counts WHERE country_code = $1
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT pm25_ug_m3::float
       FROM pollution_data WHERE country_code = $1 AND pm25_ug_m3 IS NOT NULL
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT deviation_from_reference_c::float
       FROM country_temperatures WHERE country_code = $1 AND deviation_from_reference_c IS NOT NULL
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
  ]);

  return {
    country,
    co2: co2Result.rows[0] || null,
    water: waterResult.rows[0] || null,
    electricity: electricityResult.rows[0] || null,
    vegetation: vegetationResult.rows[0] || null,
    speciesThreatened: speciesThreatenedResult.rows[0] || null,
    pollution: pollutionResult.rows[0] || null,
    temperatures: temperaturesResult.rows[0] || null,
  };
}

router.get("/api/country-summary-latest/:country", async (req, res) => {
  try {
    res.json(await fetchLatestCountrySummary(req.params.country.toUpperCase()));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Un seul aller-retour HTTP pour tout ce dont /decouverte a besoin au
// chargement (repère mondial, objections Débunk mises en avant, résumé des
// deux pays comparés) — au lieu de 4 requêtes séparées. Motivé par
// l'EcoIndex : le nombre de requêtes réseau (87 mesuré, cible 40) pesait
// bien plus que le poids de page ou la complexité DOM, déjà sous la cible.
router.get("/api/decouverte-bootstrap", async (req, res) => {
  const countryA = (req.query.countryA || "FRA").toUpperCase();
  const countryB = req.query.countryB ? req.query.countryB.toUpperCase() : null;
  const locale = req.query.locale;

  try {
    const [worldBenchmarksResult, debunkResult, videoResult, summaryA, summaryB] = await Promise.all([
      pool.query("SELECT metric_key, value, unit, year FROM world_benchmarks"),
      pool.query(
        `SELECT d.slug, d.myth, d.verdict, d.image_url, d.updated_at,
                c.name AS category_name, c.slug AS category_slug
         FROM debunk_entries d
         LEFT JOIN debunk_categories c ON c.id = d.category_id
         WHERE d.published = true AND d.featured_decouverte = true
         ORDER BY d.updated_at DESC`
      ),
      pool.query("SELECT value FROM site_settings WHERE key = 'decouverte_video_url'"),
      fetchLatestCountrySummary(countryA),
      countryB ? fetchLatestCountrySummary(countryB) : Promise.resolve(null),
    ]);

    const worldBenchmarks = {};
    for (const row of worldBenchmarksResult.rows) {
      worldBenchmarks[row.metric_key] = { value: parseFloat(row.value), unit: row.unit, year: row.year };
    }
    const objections = await mergeTranslations(debunkResult.rows, "debunk", locale);
    const videoUrl = videoResult.rows[0]?.value || "";

    res.json({ worldBenchmarks, objections, videoUrl, summaryA, summaryB });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

export default router;
