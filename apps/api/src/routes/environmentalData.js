import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireIngestToken } from "../lib/auth.js";
import { ingestCo2 } from "../ingest/co2.js";
import { ingestPowerPlants } from "../ingest/power_plants.js";
import { ingestSpecies } from "../ingest/species.js";
import { ingestFires } from "../ingest/fires.js";
import { ingestVegetation } from "../ingest/vegetation.js";
import { ingestWater } from "../ingest/water.js";
import { ingestElectricity } from "../ingest/electricity.js";
import { ingestSpeciesThreatened } from "../ingest/species_threatened.js";
import { ingestPollution } from "../ingest/pollution.js";
import { ingestWorldBenchmarks } from "../ingest/world_benchmarks.js";
import { ingestTemperatures } from "../ingest/temperatures.js";

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
    const [co2Result, plantsResult, speciesResult, firesResult, vegetationResult, waterResult, electricityGenerationResult, speciesThreatenedResult, pollutionResult] = await Promise.all([
      pool.query(
        `SELECT year, emissions_mt, emissions_per_capita, consumption_co2, consumption_co2_per_capita, population
         FROM co2_emissions WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT fuel_type, COUNT(*) AS plant_count, SUM(capacity_mw) AS total_capacity_mw
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
        `SELECT year, tree_cover_loss_ha, forest_area_ha
         FROM vegetation_loss WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, renewable_freshwater_m3_per_capita, precipitation_mm, withdrawal_m3, withdrawal_share_percent
         FROM water_data WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, coal_twh, gas_twh, oil_twh, nuclear_twh, hydro_twh, wind_twh,
                solar_twh, biofuel_twh, other_renewable_twh, total_generation_twh, demand_twh, demand_per_capita_kwh
         FROM electricity_generation WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, mammals_threatened, birds_threatened, fish_threatened
         FROM species_threatened_counts WHERE country_code = $1 ORDER BY year`,
        [country]
      ),
      pool.query(
        `SELECT year, pm25_ug_m3 FROM pollution_data WHERE country_code = $1 ORDER BY year`,
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
    const [co2, plants, species, fires, vegetation, water, electricity, speciesThreatened, pollution, deputies, anGroups, scrutins, worldBenchmarks, temperatures, usCongressMembers, usCongressVotes, spainCongressMembers, spainCongressVotes, spainSenateMembers, spainSenateVotes, italySenateMembers, italySenateVotes, italyCameraMembers, italyCameraVotes] = await Promise.all([
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM co2_emissions"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM power_plants"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM species_status"),
      pool.query("SELECT MAX(ingested_at) AS updated_at, MAX(detected_at) AS latest_detection FROM fires"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM vegetation_loss"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM water_data"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM electricity_generation"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM species_threatened_counts"),
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
    res.json({ status: "ok", inserted, countriesProcessed, countriesFailed, skippedNoCapital, sampleErrors });
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



export default router;
