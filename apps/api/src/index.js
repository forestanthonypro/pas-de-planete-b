import express from "express";
import cors from "cors";
import pg from "pg";
import { ingestCo2 } from "./ingest/co2.js";
import { ingestPowerPlants } from "./ingest/power_plants.js";
import { ingestSpecies } from "./ingest/species.js";
import { ingestFires } from "./ingest/fires.js";
import { ingestVegetation } from "./ingest/vegetation.js";
import { ingestWater } from "./ingest/water.js";
import { ingestElectricity } from "./ingest/electricity.js";
import { ingestSpeciesThreatened } from "./ingest/species_threatened.js";
import { ingestPollution } from "./ingest/pollution.js";
import { ingestWorldBenchmarks } from "./ingest/world_benchmarks.js";
import { ingestDeputies } from "./ingest/deputies.js";
import { ingestGroups } from "./ingest/an_groups.js";
import { ingestScrutins } from "./ingest/scrutins.js";
import { ingestDeputyVotes } from "./ingest/deputy_votes.js";

const app = express();
const port = process.env.API_PORT || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  })
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

function requireIngestToken(req, res, next) {
  const token = req.header("x-ingest-token");
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ error: "Jeton invalide" });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- CO2 ---

app.get("/api/co2/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM co2_emissions ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/co2/:country", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/co2", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestCo2(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

// --- Centrales électriques ---

app.get("/api/power-plants/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code FROM power_plants ORDER BY country_code"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/power-plants/fuel-types", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT fuel_type FROM power_plants ORDER BY fuel_type"
    );
    res.json(result.rows.map((r) => r.fuel_type));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/power-plants", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/power-plants", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestPowerPlants(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

// --- Espèces ---

app.get("/api/species/categories", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT category FROM species_status ORDER BY category"
    );
    res.json(result.rows.map((r) => r.category));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/species", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/species/kingdoms", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/species", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped, countryLinks } = await ingestSpecies(pool);
    res.json({ status: "ok", inserted, skipped, countryLinks });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

// --- Dashboard combiné par pays ---

app.get("/api/country-summary/:country", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});


// --- Feux actifs (quasi temps réel) ---

app.get("/api/fires", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/fires", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, countriesSkipped, sampleErrors } = await ingestFires(pool);
    res.json({ status: "ok", inserted, countriesSkipped, sampleErrors });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

// --- Fraîcheur des données ---
// Indique quand CHAQUE table a été rafraîchie pour la dernière fois côté notre base
// (pas la date des données elles-mêmes, qui peut être plus ancienne selon la source).
app.get("/api/meta/last-updated", async (_req, res) => {
  try {
    const [co2, plants, species, fires, vegetation, water, electricity, speciesThreatened, pollution] = await Promise.all([
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM co2_emissions"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM power_plants"),
      pool.query("SELECT MAX(updated_at) AS updated_at FROM species_status"),
      pool.query("SELECT MAX(ingested_at) AS updated_at, MAX(detected_at) AS latest_detection FROM fires"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM vegetation_loss"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM water_data"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM electricity_generation"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM species_threatened_counts"),
      pool.query("SELECT MAX(updated_at) AS updated_at, MAX(year) AS latest_year FROM pollution_data"),
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
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});


// --- Végétation / perte de couverture arborée ---

app.get("/api/vegetation/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM vegetation_loss ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/vegetation/:country", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/vegetation", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestVegetation(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});


// --- Eau : ressources renouvelables et pluviométrie ---

app.get("/api/water/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM water_data ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/water/:country", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/water", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestWater(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});


// --- Génération électrique réelle (vs. capacité installée statique) ---

app.get("/api/electricity/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM electricity_generation ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/electricity/:country", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/electricity", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestElectricity(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});


// --- Espèces menacées : comptage officiel (IUCN via Banque mondiale) ---
// Comptages absolus par groupe, pas des pourcentages par pays (voir le
// commentaire du script d'ingestion pour l'explication).

app.get("/api/species-threatened/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM species_threatened_counts ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/species-threatened/:country", async (req, res) => {
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
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/species-threatened/global/share", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT taxon_group, share_percent, year FROM species_threatened_global_share ORDER BY share_percent DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/species-threatened", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestSpeciesThreatened(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});


// --- Pollution de l'air (PM2.5) ---

app.get("/api/pollution/countries", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT country_code, country_name FROM pollution_data ORDER BY country_name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/pollution/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT year, pm25_ug_m3 FROM pollution_data WHERE country_code = $1 ORDER BY year`,
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/pollution", requireIngestToken, async (_req, res) => {
  try {
    const { inserted, skipped } = await ingestPollution(pool);
    res.json({ status: "ok", inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

// --- Repères mondiaux (comparaison pays vs monde) ---

app.get("/api/world-benchmarks", async (_req, res) => {
  try {
    const result = await pool.query("SELECT metric_key, value, unit, year FROM world_benchmarks");
    const benchmarks = {};
    for (const row of result.rows) {
      benchmarks[row.metric_key] = { value: parseFloat(row.value), unit: row.unit, year: row.year };
    }
    res.json(benchmarks);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/world-benchmarks", requireIngestToken, async (_req, res) => {
  try {
    const { set } = await ingestWorldBenchmarks(pool);
    res.json({ status: "ok", set });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});


// --- Députés, groupes et votes à l'Assemblée nationale (17e législature) ---
// Données factuelles uniquement (qui a voté quoi, résultat officiel) — aucune
// qualification ni interprétation politique n'est ajoutée. Source : CIVIX,
// à partir des données open data de l'Assemblée nationale.

app.get("/api/deputies", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT acteur_uid, full_name, group_name, group_abbreviation, department, circo_number
       FROM deputies ORDER BY last_name, first_name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// Classement de participation : sur la fenêtre de scrutins avec détail
// nominatif disponible, quelle part des scrutins voit chaque député exprimer
// un vote (pour/contre/abstention) plutôt qu'être absent. Un seuil minimum de
// scrutins est appliqué pour éviter qu'un député avec très peu de données
// (ex: arrivé récemment) fausse le classement avec un échantillon trop petit.
app.get("/api/deputies/participation", async (_req, res) => {
  const MIN_VOTES = 20;
  try {
    const result = await pool.query(
      `SELECT d.acteur_uid, d.full_name, d.group_abbreviation,
              COUNT(*) AS total_votes,
              COUNT(*) FILTER (WHERE dv.position != 'absent') AS active_votes
       FROM deputy_votes dv
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE dv.legislature = 17
       GROUP BY d.acteur_uid, d.full_name, d.group_abbreviation
       HAVING COUNT(*) >= $1
       ORDER BY (COUNT(*) FILTER (WHERE dv.position != 'absent'))::float / COUNT(*) DESC`,
      [MIN_VOTES]
    );
    res.json({ minVotes: MIN_VOTES, deputies: result.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/deputies/:acteurUid", async (req, res) => {
  const { acteurUid } = req.params;
  try {
    const deputyResult = await pool.query("SELECT * FROM deputies WHERE acteur_uid = $1", [acteurUid]);
    if (deputyResult.rows.length === 0) {
      return res.status(404).json({ error: "Député non trouvé" });
    }
    const deputy = deputyResult.rows[0];
    const votesResult = await pool.query(
      `SELECT dv.numero_scrutin, dv.position, s.scrutin_date, s.title, s.objet,
              s.result_code, s.result_label
       FROM deputy_votes dv
       JOIN scrutins s ON s.legislature = dv.legislature AND s.numero = dv.numero_scrutin
       WHERE dv.acteur_uid = $1 AND dv.legislature = 17
       ORDER BY s.scrutin_date DESC NULLS LAST, dv.numero_scrutin DESC`,
      [acteurUid]
    );
    let groupStats = null;
    if (deputy.group_abbreviation) {
      const groupResult = await pool.query(
        "SELECT avg_participation_pct, median_participation_pct FROM an_groups WHERE legislature = 17 AND abbreviation = $1",
        [deputy.group_abbreviation]
      );
      groupStats = groupResult.rows[0] || null;
    }
    res.json({ deputy, votes: votesResult.rows, groupStats });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/an-groups", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM an_groups WHERE legislature = 17 ORDER BY effectif DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// Cohésion de groupe : sur les scrutins où au moins 2 membres du groupe ont
// voté (hors absents, qui ne reflètent pas un désaccord de fond), quelle part
// des scrutins voit tous les votants du groupe choisir la même position.
app.get("/api/an-groups/cohesion", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT group_abbreviation,
             COUNT(*) FILTER (WHERE distinct_positions = 1) AS unanimous_count,
             COUNT(*) AS total_count
      FROM (
        SELECT d.group_abbreviation, dv.legislature, dv.numero_scrutin,
               COUNT(DISTINCT dv.position) AS distinct_positions
        FROM deputy_votes dv
        JOIN deputies d ON d.acteur_uid = dv.acteur_uid
        WHERE dv.position IN ('pour', 'contre', 'abstention') AND d.group_abbreviation IS NOT NULL
        GROUP BY d.group_abbreviation, dv.legislature, dv.numero_scrutin
        HAVING COUNT(*) >= 2
      ) sub
      GROUP BY group_abbreviation
      ORDER BY unanimous_count::float / NULLIF(total_count, 0) DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/scrutins", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  try {
    const result = await pool.query(
      `SELECT legislature, numero, scrutin_date, title, objet, type_vote_label,
              result_code, result_label
       FROM scrutins WHERE legislature = 17
       ORDER BY numero DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// Taux d'adoption global, sur l'ensemble des 8000+ scrutins de la
// législature (pas seulement la fenêtre récente des votes détaillés).
app.get("/api/scrutins/stats", async (_req, res) => {
  try {
    const byResult = await pool.query(
      `SELECT result_code, COUNT(*) AS count FROM scrutins WHERE legislature = 17
       GROUP BY result_code ORDER BY count DESC`
    );
    const byType = await pool.query(
      `SELECT type_vote_label, result_code, COUNT(*) AS count FROM scrutins WHERE legislature = 17
       GROUP BY type_vote_label, result_code ORDER BY type_vote_label, count DESC`
    );
    const total = await pool.query("SELECT COUNT(*) AS count FROM scrutins WHERE legislature = 17");
    res.json({ total: parseInt(total.rows[0].count, 10), byResult: byResult.rows, byType: byType.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/scrutins/:legislature/:numero", async (req, res) => {
  const legislature = parseInt(req.params.legislature, 10);
  const numero = parseInt(req.params.numero, 10);
  try {
    const scrutinResult = await pool.query(
      "SELECT * FROM scrutins WHERE legislature = $1 AND numero = $2",
      [legislature, numero]
    );
    if (scrutinResult.rows.length === 0) {
      return res.status(404).json({ error: "Scrutin non trouvé" });
    }
    const votesResult = await pool.query(
      `SELECT dv.acteur_uid, dv.position, d.full_name, d.group_abbreviation
       FROM deputy_votes dv
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE dv.legislature = $1 AND dv.numero_scrutin = $2
       ORDER BY d.group_abbreviation, d.last_name`,
      [legislature, numero]
    );
    res.json({ scrutin: scrutinResult.rows[0], votes: votesResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/ingest/deputies", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestDeputies(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

app.post("/api/admin/ingest/an-groups", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestGroups(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

app.post("/api/admin/ingest/scrutins", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestScrutins(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

app.post("/api/admin/ingest/deputy-votes", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestDeputyVotes(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`API Pas de planète B à l'écoute sur le port ${port}`);
});
