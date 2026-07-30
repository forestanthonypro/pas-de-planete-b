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
app.use(express.json());

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
      "SELECT taxon_group, share_percent, species_count, year FROM species_threatened_global_share ORDER BY share_percent DESC"
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

// Détail d'un groupe : ses infos + le résultat (adopté/rejeté) des scrutins
// où au moins un de ses membres a voté, en pourcentage — puisque les votes
// sont individuels, on ne peut pas dire que "le groupe a fait adopter" un
// texte, seulement que ses membres ont participé à des scrutins qui ont
// abouti à tel ou tel résultat.
app.get("/api/an-groups/:abbreviation", async (req, res) => {
  const { abbreviation } = req.params;
  try {
    const groupResult = await pool.query(
      "SELECT * FROM an_groups WHERE legislature = 17 AND abbreviation = $1",
      [abbreviation]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Groupe non trouvé" });
    }

    const resultBreakdown = await pool.query(
      `SELECT s.result_code, COUNT(DISTINCT s.numero) AS count
       FROM scrutins s
       JOIN deputy_votes dv ON dv.legislature = s.legislature AND dv.numero_scrutin = s.numero
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE s.legislature = 17 AND d.group_abbreviation = $1
       GROUP BY s.result_code`,
      [abbreviation]
    );

    const recentScrutins = await pool.query(
      `SELECT s.legislature, s.numero, s.scrutin_date, s.title, s.objet, s.result_code, s.result_label,
              COUNT(*) FILTER (WHERE dv.position = 'pour') AS pour,
              COUNT(*) FILTER (WHERE dv.position = 'contre') AS contre,
              COUNT(*) FILTER (WHERE dv.position = 'abstention') AS abstention
       FROM scrutins s
       JOIN deputy_votes dv ON dv.legislature = s.legislature AND dv.numero_scrutin = s.numero
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE s.legislature = 17 AND d.group_abbreviation = $1
       GROUP BY s.legislature, s.numero, s.scrutin_date, s.title, s.objet, s.result_code, s.result_label
       ORDER BY s.scrutin_date DESC NULLS LAST, s.numero DESC
       LIMIT 100`,
      [abbreviation]
    );

    res.json({
      group: groupResult.rows[0],
      resultBreakdown: resultBreakdown.rows,
      recentScrutins: recentScrutins.rows,
    });
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

// Recherche par mot-clé sur l'ensemble des 8000+ scrutins (titre + objet),
// pas seulement la fenêtre des 200 plus récents — pour retrouver un débat
// spécifique (ex: un pesticide, une substance) même ancien dans la
// législature. Le détail nominatif des votes peut ne pas être disponible pour
// les résultats hors de la fenêtre récente (voir la fiche du scrutin).
app.get("/api/scrutins/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 3) {
    return res.status(400).json({ error: "Recherche trop courte (3 caractères minimum)" });
  }
  try {
    const result = await pool.query(
      `SELECT legislature, numero, scrutin_date, title, objet, type_vote_label, result_code, result_label
       FROM scrutins
       WHERE legislature = 17 AND (title ILIKE $1 OR objet ILIKE $1)
       ORDER BY scrutin_date DESC NULLS LAST
       LIMIT 100`,
      [`%${q}%`]
    );
    res.json(result.rows);
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

// --- Newsletter "Il est temps d'agir !" ---
// Ne couvre que la collecte et le stockage : l'envoi réel des emails
// nécessite un service tiers (Mailgun, SendGrid, Brevo...) à configurer
// séparément, une fois choisi.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/newsletter/signup", async (req, res) => {
  const { email, areaType, housingType, hasChildren } = req.body || {};
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "Adresse email invalide" });
  }
  const validAreaTypes = ["ville", "campagne", null, undefined];
  const validHousingTypes = ["maison", "appartement", null, undefined];
  if (!validAreaTypes.includes(areaType) || !validHousingTypes.includes(housingType)) {
    return res.status(400).json({ error: "Valeur de profil invalide" });
  }
  try {
    await pool.query(
      `INSERT INTO newsletter_subscribers (email, area_type, housing_type, has_children)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET area_type = EXCLUDED.area_type, housing_type = EXCLUDED.housing_type, has_children = EXCLUDED.has_children`,
      [email.trim().toLowerCase(), areaType || null, housingType || null, hasChildren === true]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'inscription", detail: err.message });
  }
});

app.post("/api/newsletter/unsubscribe", async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Adresse email invalide" });
  }
  try {
    await pool.query(
      "UPDATE newsletter_subscribers SET unsubscribed_at = now() WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec du désabonnement", detail: err.message });
  }
});

// --- Rubrique DEBUNK ---
// Contenu éditorial (pas ingéré automatiquement) — ajouté/modifié via les
// routes protégées ci-dessous, avec le même jeton que les routes d'admin
// d'ingestion. Seules les entrées "published = true" sont visibles
// publiquement.

app.get("/api/debunk-categories", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, slug FROM debunk_categories ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/debunk", async (req, res) => {
  const { category } = req.query;
  try {
    const params = [];
    let where = "WHERE d.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT d.slug, d.myth, d.verdict, d.image_url, d.updated_at,
              c.name AS category_name, c.slug AS category_slug
       FROM debunk_entries d
       LEFT JOIN debunk_categories c ON c.id = d.category_id
       ${where}
       ORDER BY d.updated_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/debunk/:slug", async (req, res) => {
  try {
    const entryResult = await pool.query(
      `SELECT d.*, c.name AS category_name, c.slug AS category_slug
       FROM debunk_entries d
       LEFT JOIN debunk_categories c ON c.id = d.category_id
       WHERE d.slug = $1 AND d.published = true`,
      [req.params.slug]
    );
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const sourcesResult = await pool.query(
      "SELECT label, url FROM debunk_sources WHERE debunk_slug = $1 ORDER BY id",
      [req.params.slug]
    );
    res.json({ entry: entryResult.rows[0], sources: sourcesResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// Création/mise à jour d'une entrée — protégé, réservé à la rédaction du
// site. "sources" est un tableau [{label, url}, ...].
// Lecture admin : toutes les entrées, publiées ou non (contrairement aux
// routes publiques ci-dessus) — pour l'interface d'administration.
app.get("/api/admin/debunk", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.slug, d.myth, d.verdict, d.published, d.image_url, d.updated_at, c.name AS category_name
       FROM debunk_entries d
       LEFT JOIN debunk_categories c ON c.id = d.category_id
       ORDER BY d.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/debunk-categories", requireIngestToken, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO debunk_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.delete("/api/admin/debunk-categories/:id", requireIngestToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM debunk_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

app.get("/api/admin/debunk/:slug", requireIngestToken, async (req, res) => {
  try {
    const entryResult = await pool.query("SELECT * FROM debunk_entries WHERE slug = $1", [req.params.slug]);
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const sourcesResult = await pool.query(
      "SELECT label, url FROM debunk_sources WHERE debunk_slug = $1 ORDER BY id",
      [req.params.slug]
    );
    res.json({ entry: entryResult.rows[0], sources: sourcesResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// Bascule rapide publié/brouillon depuis la liste — sans repasser par tout
// le formulaire, ne touche que ce seul champ.
app.post("/api/admin/debunk/:slug/publish", requireIngestToken, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE debunk_entries SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

app.post("/api/admin/debunk", requireIngestToken, async (req, res) => {
  const { slug, myth, reality, categoryId, verdict, claimQuote, imageUrl, published, sources } = req.body || {};
  if (!slug || !myth || !reality) {
    return res.status(400).json({ error: "slug, myth et reality sont requis" });
  }
  if (verdict && !["faux", "trompeur", "confirme"].includes(verdict)) {
    return res.status(400).json({ error: "verdict doit être 'faux', 'trompeur' ou 'confirme'" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO debunk_entries (slug, myth, reality, category_id, verdict, claim_quote, image_url, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (slug)
       DO UPDATE SET myth = EXCLUDED.myth, reality = EXCLUDED.reality, category_id = EXCLUDED.category_id,
                     verdict = EXCLUDED.verdict, claim_quote = EXCLUDED.claim_quote,
                     image_url = EXCLUDED.image_url, published = EXCLUDED.published, updated_at = now()`,
      [slug, myth, reality, categoryId || null, verdict || "faux", claimQuote || null, imageUrl || null, published === true]
    );
    if (Array.isArray(sources)) {
      await client.query("DELETE FROM debunk_sources WHERE debunk_slug = $1", [slug]);
      for (const s of sources) {
        if (s?.label && s?.url) {
          await client.query(
            "INSERT INTO debunk_sources (debunk_slug, label, url) VALUES ($1, $2, $3)",
            [slug, s.label, s.url]
          );
        }
      }
    }
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  } finally {
    client.release();
  }
});

// --- Vote citoyen ---
// Un visiteur peut voter (anonymement) sur un scrutin pour comparer sa
// réponse à celle de l'Assemblée. Rien n'est stocké ici tant que le
// frontend n'envoie pas explicitement le vote — ce qui n'arrive qu'après
// consentement explicite de la personne (voir lib/anonymousId.js côté web).
// L'identifiant est un UUID généré dans le navigateur, jamais lié à un
// compte, un email ou une IP.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.post("/api/citizen-votes", async (req, res) => {
  const { anonymousId, legislature, numeroScrutin, position } = req.body || {};
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  if (!["pour", "contre", "abstention"].includes(position)) {
    return res.status(400).json({ error: "Position invalide" });
  }
  const legislatureNum = parseInt(legislature, 10);
  const numeroNum = parseInt(numeroScrutin, 10);
  if (Number.isNaN(legislatureNum) || Number.isNaN(numeroNum)) {
    return res.status(400).json({ error: "Scrutin invalide" });
  }
  try {
    await pool.query(
      `INSERT INTO citizen_votes (anonymous_id, legislature, numero_scrutin, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (anonymous_id, legislature, numero_scrutin)
       DO UPDATE SET position = EXCLUDED.position, voted_at = now()`,
      [anonymousId, legislatureNum, numeroNum, position]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.get("/api/citizen-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    const result = await pool.query(
      `SELECT cv.legislature, cv.numero_scrutin, cv.position, cv.voted_at,
              s.title, s.objet, s.scrutin_date, s.result_code, s.result_label
       FROM citizen_votes cv
       LEFT JOIN scrutins s ON s.legislature = cv.legislature AND s.numero = cv.numero_scrutin
       WHERE cv.anonymous_id = $1
       ORDER BY cv.voted_at DESC`,
      [anonymousId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// Alignement avec les député·e·s et les groupes — uniquement calculé sur les
// scrutins où la personne a ELLE-MÊME voté ET où on a le détail nominatif
// des député·e·s. Seuil minimum de 3 scrutins communs pour éviter qu'un tout
// petit échantillon fausse le classement (même logique que le classement de
// participation).
app.get("/api/citizen-votes/:anonymousId/alignment", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  const MIN_COMMON_VOTES = 3;
  try {
    const deputiesResult = await pool.query(
      `SELECT dv.acteur_uid, d.full_name, d.group_abbreviation,
              COUNT(*) FILTER (WHERE dv.position = cv.position) AS matches,
              COUNT(*) AS total
       FROM citizen_votes cv
       JOIN deputy_votes dv ON dv.legislature = cv.legislature AND dv.numero_scrutin = cv.numero_scrutin
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE cv.anonymous_id = $1 AND dv.position IN ('pour', 'contre', 'abstention')
       GROUP BY dv.acteur_uid, d.full_name, d.group_abbreviation
       HAVING COUNT(*) >= $2
       ORDER BY (COUNT(*) FILTER (WHERE dv.position = cv.position))::float / COUNT(*) DESC
       LIMIT 20`,
      [anonymousId, MIN_COMMON_VOTES]
    );

    const groupsResult = await pool.query(
      `SELECT d.group_abbreviation,
              COUNT(*) FILTER (WHERE dv.position = cv.position) AS matches,
              COUNT(*) AS total
       FROM citizen_votes cv
       JOIN deputy_votes dv ON dv.legislature = cv.legislature AND dv.numero_scrutin = cv.numero_scrutin
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE cv.anonymous_id = $1 AND dv.position IN ('pour', 'contre', 'abstention')
             AND d.group_abbreviation IS NOT NULL
       GROUP BY d.group_abbreviation
       HAVING COUNT(*) >= $2
       ORDER BY (COUNT(*) FILTER (WHERE dv.position = cv.position))::float / COUNT(*) DESC`,
      [anonymousId, MIN_COMMON_VOTES]
    );

    res.json({ minCommonVotes: MIN_COMMON_VOTES, deputies: deputiesResult.rows, groups: groupsResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// Droit à l'oubli : efface tout l'historique lié à cet identifiant.
app.delete("/api/citizen-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    await pool.query("DELETE FROM citizen_votes WHERE anonymous_id = $1", [anonymousId]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

// Agrégat public (jamais individuel) des votes citoyens sur un scrutin — pas
// d'authentification requise, aucune donnée personnelle exposée : juste des
// comptages. Seuil minimum avant affichage pour éviter qu'un tout petit
// nombre de votes (ex: 1 ou 2) donne une fausse impression de tendance.
const MIN_CITIZEN_VOTES_FOR_STATS = 5;

app.get("/api/scrutins/:legislature/:numero/citizen-stats", async (req, res) => {
  const legislatureNum = parseInt(req.params.legislature, 10);
  const numeroNum = parseInt(req.params.numero, 10);
  if (Number.isNaN(legislatureNum) || Number.isNaN(numeroNum)) {
    return res.status(400).json({ error: "Scrutin invalide" });
  }
  try {
    const result = await pool.query(
      `SELECT position, COUNT(*) AS count FROM citizen_votes
       WHERE legislature = $1 AND numero_scrutin = $2
       GROUP BY position`,
      [legislatureNum, numeroNum]
    );
    const total = result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);
    if (total < MIN_CITIZEN_VOTES_FOR_STATS) {
      return res.json({ total, available: false, minRequired: MIN_CITIZEN_VOTES_FOR_STATS });
    }
    res.json({
      total,
      available: true,
      counts: Object.fromEntries(result.rows.map((r) => [r.position, parseInt(r.count, 10)])),
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

// --- Relais d'interviews et vidéos scientifiques ---
// Même principe que Debunk : contenu éditorial géré via l'interface admin,
// jamais ingéré automatiquement.

app.get("/api/interview-categories", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, slug FROM interview_categories ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/interview-categories", requireIngestToken, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO interview_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.delete("/api/admin/interview-categories/:id", requireIngestToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM interview_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

app.get("/api/science-relays", async (req, res) => {
  const { category } = req.query;
  try {
    const params = [];
    let where = "WHERE r.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT r.slug, r.title, r.description, r.scientist_name, r.scientist_field, r.content_type,
              r.source_name, r.embed_url, r.image_url, c.name AS category_name, c.slug AS category_slug, r.updated_at
       FROM science_relays r
       LEFT JOIN interview_categories c ON c.id = r.category_id
       ${where}
       ORDER BY r.updated_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/science-relays/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name AS category_name, c.slug AS category_slug
       FROM science_relays r
       LEFT JOIN interview_categories c ON c.id = r.category_id
       WHERE r.slug = $1 AND r.published = true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/science-relays", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.slug, r.title, r.content_type, r.published, r.image_url, r.updated_at, c.name AS category_name
       FROM science_relays r
       LEFT JOIN interview_categories c ON c.id = r.category_id
       ORDER BY r.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/science-relays/:slug", requireIngestToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM science_relays WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/science-relays", requireIngestToken, async (req, res) => {
  const {
    slug, title, description, scientistName, scientistField, contentType,
    sourceUrl, sourceName, embedUrl, imageUrl, categoryId, relatedDebunkSlug, published,
  } = req.body || {};
  if (!slug || !title || !description || !sourceUrl) {
    return res.status(400).json({ error: "slug, title, description et sourceUrl sont requis" });
  }
  if (!["video", "article", "podcast"].includes(contentType)) {
    return res.status(400).json({ error: "contentType doit être 'video', 'article' ou 'podcast'" });
  }
  try {
    await pool.query(
      `INSERT INTO science_relays
         (slug, title, description, scientist_name, scientist_field, content_type,
          source_url, source_name, embed_url, image_url, category_id, related_debunk_slug, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         scientist_name = EXCLUDED.scientist_name, scientist_field = EXCLUDED.scientist_field,
         content_type = EXCLUDED.content_type, source_url = EXCLUDED.source_url,
         source_name = EXCLUDED.source_name, embed_url = EXCLUDED.embed_url,
         image_url = EXCLUDED.image_url,
         category_id = EXCLUDED.category_id, related_debunk_slug = EXCLUDED.related_debunk_slug,
         published = EXCLUDED.published, updated_at = now()`,
      [slug, title, description, scientistName || null, scientistField || null, contentType,
       sourceUrl, sourceName || null, embedUrl || null, imageUrl || null, categoryId || null, relatedDebunkSlug || null, published === true]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.post("/api/admin/science-relays/:slug/publish", requireIngestToken, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE science_relays SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

// --- "On devient tous paysans" ---
// Mêmes principes que Debunk/Relais scientifique : contenu éditorial géré
// via l'admin. Catégories gérables séparément (pas du texte libre), pour
// garder un filtre cohérent dans le temps.

app.get("/api/paysan-categories", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, slug FROM paysan_categories ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/paysan-categories", requireIngestToken, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO paysan_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.delete("/api/admin/paysan-categories/:id", requireIngestToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM paysan_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

app.get("/api/paysan-resources", async (req, res) => {
  const { category } = req.query;
  try {
    const params = [];
    let where = "WHERE r.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT r.slug, r.title, r.description, r.content_type, r.source_name,
              r.embed_url, r.image_url, c.name AS category_name, c.slug AS category_slug, r.updated_at
       FROM paysan_resources r
       LEFT JOIN paysan_categories c ON c.id = r.category_id
       ${where}
       ORDER BY r.updated_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/paysan-resources/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name AS category_name, c.slug AS category_slug
       FROM paysan_resources r
       LEFT JOIN paysan_categories c ON c.id = r.category_id
       WHERE r.slug = $1 AND r.published = true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/paysan-resources", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.slug, r.title, r.content_type, r.published, r.updated_at, c.name AS category_name
       FROM paysan_resources r
       LEFT JOIN paysan_categories c ON c.id = r.category_id
       ORDER BY r.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/paysan-resources/:slug", requireIngestToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM paysan_resources WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/paysan-resources", requireIngestToken, async (req, res) => {
  const {
    slug, title, description, contentType, sourceUrl, sourceName,
    embedUrl, imageUrl, categoryId, published,
  } = req.body || {};
  if (!slug || !title || !description || !sourceUrl) {
    return res.status(400).json({ error: "slug, title, description et sourceUrl sont requis" });
  }
  if (!["video", "article", "podcast", "document"].includes(contentType)) {
    return res.status(400).json({ error: "contentType invalide" });
  }
  try {
    await pool.query(
      `INSERT INTO paysan_resources
         (slug, title, description, content_type, source_url, source_name, embed_url, image_url, category_id, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description, content_type = EXCLUDED.content_type,
         source_url = EXCLUDED.source_url, source_name = EXCLUDED.source_name, embed_url = EXCLUDED.embed_url,
         image_url = EXCLUDED.image_url, category_id = EXCLUDED.category_id,
         published = EXCLUDED.published, updated_at = now()`,
      [slug, title, description, contentType, sourceUrl, sourceName || null, embedUrl || null, imageUrl || null, categoryId || null, published === true]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.post("/api/admin/paysan-resources/:slug/publish", requireIngestToken, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE paysan_resources SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

// --- Ressources ---
// Volet 1 : lieux physiques (carte) — jardins partagés, AMAP, recycleries...
// Volet 2 : ressources non physiques (trocs, plateformes d'échange en ligne).
// Catégories partagées entre les deux volets.

app.get("/api/resource-categories", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, slug FROM resource_categories ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/resource-categories", requireIngestToken, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO resource_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.delete("/api/admin/resource-categories/:id", requireIngestToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM resource_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

// Lieux physiques — toujours renvoyés avec leurs liens joints, pour éviter
// un aller-retour supplémentaire (une carte affiche tout d'un coup).
app.get("/api/resource-locations", async (req, res) => {
  const { category } = req.query;
  try {
    const params = [];
    let where = "WHERE l.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const locations = await pool.query(
      `SELECT l.slug, l.name, l.description, l.address, l.latitude, l.longitude,
              c.name AS category_name, c.slug AS category_slug
       FROM resource_locations l
       LEFT JOIN resource_categories c ON c.id = l.category_id
       ${where}
       ORDER BY l.name`,
      params
    );
    const links = await pool.query(
      `SELECT location_slug, label, url FROM resource_location_links
       WHERE location_slug = ANY($1::text[]) ORDER BY id`,
      [locations.rows.map((l) => l.slug)]
    );
    const linksBySlug = {};
    for (const l of links.rows) {
      if (!linksBySlug[l.location_slug]) linksBySlug[l.location_slug] = [];
      linksBySlug[l.location_slug].push({ label: l.label, url: l.url });
    }
    res.json(locations.rows.map((l) => ({ ...l, links: linksBySlug[l.slug] || [] })));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/resource-locations", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.slug, l.name, l.published, l.updated_at, c.name AS category_name
       FROM resource_locations l
       LEFT JOIN resource_categories c ON c.id = l.category_id
       ORDER BY l.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/resource-locations/:slug", requireIngestToken, async (req, res) => {
  try {
    const location = await pool.query("SELECT * FROM resource_locations WHERE slug = $1", [req.params.slug]);
    if (location.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const links = await pool.query(
      "SELECT label, url FROM resource_location_links WHERE location_slug = $1 ORDER BY id",
      [req.params.slug]
    );
    res.json({ location: location.rows[0], links: links.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/resource-locations", requireIngestToken, async (req, res) => {
  const { slug, name, description, address, latitude, longitude, categoryId, published, links } = req.body || {};
  if (!slug || !name || !description || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "slug, name, description, latitude et longitude sont requis" });
  }
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Coordonnées invalides" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO resource_locations (slug, name, description, address, latitude, longitude, category_id, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, address = EXCLUDED.address,
         latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, category_id = EXCLUDED.category_id,
         published = EXCLUDED.published, updated_at = now()`,
      [slug, name, description, address || null, lat, lng, categoryId || null, published === true]
    );
    if (Array.isArray(links)) {
      await client.query("DELETE FROM resource_location_links WHERE location_slug = $1", [slug]);
      for (const l of links) {
        if (l?.label && l?.url) {
          await client.query(
            "INSERT INTO resource_location_links (location_slug, label, url) VALUES ($1, $2, $3)",
            [slug, l.label, l.url]
          );
        }
      }
    }
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  } finally {
    client.release();
  }
});

app.post("/api/admin/resource-locations/:slug/publish", requireIngestToken, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE resource_locations SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

// Ressources non physiques (trocs, plateformes d'échange...).
app.get("/api/resource-online", async (req, res) => {
  const { category } = req.query;
  try {
    const params = [];
    let where = "WHERE o.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT o.slug, o.title, o.description, o.url, c.name AS category_name, c.slug AS category_slug
       FROM resource_online o
       LEFT JOIN resource_categories c ON c.id = o.category_id
       ${where}
       ORDER BY o.title`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/resource-online", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.slug, o.title, o.published, o.updated_at, c.name AS category_name
       FROM resource_online o
       LEFT JOIN resource_categories c ON c.id = o.category_id
       ORDER BY o.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/resource-online/:slug", requireIngestToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM resource_online WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/resource-online", requireIngestToken, async (req, res) => {
  const { slug, title, description, url, categoryId, published } = req.body || {};
  if (!slug || !title || !description || !url) {
    return res.status(400).json({ error: "slug, title, description et url sont requis" });
  }
  try {
    await pool.query(
      `INSERT INTO resource_online (slug, title, description, url, category_id, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description, url = EXCLUDED.url,
         category_id = EXCLUDED.category_id, published = EXCLUDED.published, updated_at = now()`,
      [slug, title, description, url, categoryId || null, published === true]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.post("/api/admin/resource-online/:slug/publish", requireIngestToken, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE resource_online SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

// --- Charte éthique "Les enfants d'aujourd'hui et de demain" ---
// Sections et éléments gérables et réordonnables en admin, vote citoyen
// anonyme (adhère / à nuancer, jamais de rejet brutal), boîte à idées
// modérée avant toute publication.

app.get("/api/charter", async (_req, res) => {
  try {
    const sections = await pool.query(
      "SELECT id, name, display_order FROM charter_sections ORDER BY display_order"
    );
    const items = await pool.query(
      `SELECT i.id, i.section_id, i.title, i.description, i.display_order,
              COUNT(*) FILTER (WHERE v.vote_type = 'adhere') AS adhere_count,
              COUNT(*) FILTER (WHERE v.vote_type = 'nuance') AS nuance_count
       FROM charter_items i
       LEFT JOIN charter_votes v ON v.item_id = i.id
       WHERE i.published = true
       GROUP BY i.id
       ORDER BY i.display_order`
    );
    const itemsBySection = {};
    for (const item of items.rows) {
      if (!itemsBySection[item.section_id]) itemsBySection[item.section_id] = [];
      itemsBySection[item.section_id].push({
        id: item.id,
        title: item.title,
        description: item.description,
        adhereCount: parseInt(item.adhere_count, 10),
        nuanceCount: parseInt(item.nuance_count, 10),
      });
    }
    const suggestions = await pool.query(
      "SELECT id, text FROM charter_suggestions WHERE status = 'published' ORDER BY submitted_at DESC"
    );
    res.json({
      sections: sections.rows.map((s) => ({ id: s.id, name: s.name, items: itemsBySection[s.id] || [] })),
      publishedSuggestions: suggestions.rows,
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/charter-votes", async (req, res) => {
  const { anonymousId, itemId, voteType } = req.body || {};
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  if (!["adhere", "nuance"].includes(voteType)) {
    return res.status(400).json({ error: "Vote invalide" });
  }
  const itemIdNum = parseInt(itemId, 10);
  if (Number.isNaN(itemIdNum)) {
    return res.status(400).json({ error: "Élément invalide" });
  }
  try {
    await pool.query(
      `INSERT INTO charter_votes (anonymous_id, item_id, vote_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (anonymous_id, item_id) DO UPDATE SET vote_type = EXCLUDED.vote_type, voted_at = now()`,
      [anonymousId, itemIdNum, voteType]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.get("/api/charter-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    const result = await pool.query(
      "SELECT item_id, vote_type FROM charter_votes WHERE anonymous_id = $1",
      [anonymousId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/charter-suggestions", async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text est requis" });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Texte trop long (2000 caractères max)" });
  }
  try {
    await pool.query("INSERT INTO charter_suggestions (text, status) VALUES ($1, 'pending')", [text.trim()]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

// -- Administration : sections --

app.get("/api/admin/charter-sections", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, display_order FROM charter_sections ORDER BY display_order");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/charter-sections", requireIngestToken, async (req, res) => {
  const { id, name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name est requis" });
  }
  try {
    if (id) {
      await pool.query("UPDATE charter_sections SET name = $1 WHERE id = $2", [name.trim(), id]);
      res.json({ status: "ok", id });
    } else {
      const maxOrder = await pool.query("SELECT COALESCE(MAX(display_order), 0) AS max FROM charter_sections");
      const result = await pool.query(
        "INSERT INTO charter_sections (name, display_order) VALUES ($1, $2) RETURNING id",
        [name.trim(), parseInt(maxOrder.rows[0].max, 10) + 1]
      );
      res.json({ status: "ok", id: result.rows[0].id });
    }
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.delete("/api/admin/charter-sections/:id", requireIngestToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM charter_sections WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

app.post("/api/admin/charter-sections/:id/move", requireIngestToken, async (req, res) => {
  const { direction } = req.body || {};
  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "direction doit être 'up' ou 'down'" });
  }
  const client = await pool.connect();
  try {
    const current = await client.query("SELECT id, display_order FROM charter_sections WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: "Section non trouvée" });
    const currentOrder = current.rows[0].display_order;
    const neighborResult = await client.query(
      direction === "up"
        ? "SELECT id, display_order FROM charter_sections WHERE display_order < $1 ORDER BY display_order DESC LIMIT 1"
        : "SELECT id, display_order FROM charter_sections WHERE display_order > $1 ORDER BY display_order ASC LIMIT 1",
      [currentOrder]
    );
    if (neighborResult.rows.length === 0) return res.json({ status: "ok" });
    await client.query("BEGIN");
    await client.query("UPDATE charter_sections SET display_order = $1 WHERE id = $2", [neighborResult.rows[0].display_order, req.params.id]);
    await client.query("UPDATE charter_sections SET display_order = $1 WHERE id = $2", [currentOrder, neighborResult.rows[0].id]);
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Échec du déplacement", detail: err.message });
  } finally {
    client.release();
  }
});

// -- Administration : éléments --

app.get("/api/admin/charter-items", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.title, i.published, i.display_order, i.section_id, s.name AS section_name
       FROM charter_items i
       JOIN charter_sections s ON s.id = i.section_id
       ORDER BY s.display_order, i.display_order`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/charter-items/:id", requireIngestToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM charter_items WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Élément non trouvé" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/charter-items", requireIngestToken, async (req, res) => {
  const { id, sectionId, title, description, published } = req.body || {};
  if (!sectionId || !title || !title.trim()) {
    return res.status(400).json({ error: "sectionId et title sont requis" });
  }
  try {
    if (id) {
      await pool.query(
        "UPDATE charter_items SET section_id = $1, title = $2, description = $3, published = $4, updated_at = now() WHERE id = $5",
        [sectionId, title.trim(), description || null, published === true, id]
      );
      res.json({ status: "ok", id });
    } else {
      const maxOrder = await pool.query(
        "SELECT COALESCE(MAX(display_order), 0) AS max FROM charter_items WHERE section_id = $1",
        [sectionId]
      );
      const result = await pool.query(
        `INSERT INTO charter_items (section_id, title, description, display_order, published, updated_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
        [sectionId, title.trim(), description || null, parseInt(maxOrder.rows[0].max, 10) + 1, published === true]
      );
      res.json({ status: "ok", id: result.rows[0].id });
    }
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.delete("/api/admin/charter-items/:id", requireIngestToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM charter_items WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

app.post("/api/admin/charter-items/:id/publish", requireIngestToken, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    await pool.query("UPDATE charter_items SET published = $1, updated_at = now() WHERE id = $2", [published, req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

app.post("/api/admin/charter-items/:id/move", requireIngestToken, async (req, res) => {
  const { direction } = req.body || {};
  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "direction doit être 'up' ou 'down'" });
  }
  const client = await pool.connect();
  try {
    const current = await client.query("SELECT id, section_id, display_order FROM charter_items WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: "Élément non trouvé" });
    const { section_id: sectionId, display_order: currentOrder } = current.rows[0];
    const neighborResult = await client.query(
      direction === "up"
        ? "SELECT id, display_order FROM charter_items WHERE section_id = $1 AND display_order < $2 ORDER BY display_order DESC LIMIT 1"
        : "SELECT id, display_order FROM charter_items WHERE section_id = $1 AND display_order > $2 ORDER BY display_order ASC LIMIT 1",
      [sectionId, currentOrder]
    );
    if (neighborResult.rows.length === 0) return res.json({ status: "ok" });
    await client.query("BEGIN");
    await client.query("UPDATE charter_items SET display_order = $1 WHERE id = $2", [neighborResult.rows[0].display_order, req.params.id]);
    await client.query("UPDATE charter_items SET display_order = $1 WHERE id = $2", [currentOrder, neighborResult.rows[0].id]);
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Échec du déplacement", detail: err.message });
  } finally {
    client.release();
  }
});

// -- Administration : suggestions (boîte à idées, modération) --

app.get("/api/admin/charter-suggestions", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, text, status, submitted_at FROM charter_suggestions ORDER BY submitted_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/charter-suggestions/:id/status", requireIngestToken, async (req, res) => {
  const { status } = req.body || {};
  if (!["pending", "published", "draft", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }
  try {
    await pool.query("UPDATE charter_suggestions SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

// --- "Les enfants d'aujourd'hui et de demain" ---
// Espace d'idées à soutenir par le vote — indépendant de la charte éthique.
// Classement par popularité (nombre de soutiens), pas d'ordre géré à la main.

app.get("/api/future-ideas", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.slug, i.title, i.description, i.updated_at,
              COUNT(v.anonymous_id) AS support_count
       FROM future_ideas i
       LEFT JOIN future_idea_votes v ON v.idea_slug = i.slug
       WHERE i.published = true
       GROUP BY i.slug
       ORDER BY support_count DESC, i.updated_at DESC`
    );
    res.json(result.rows.map((r) => ({ ...r, support_count: parseInt(r.support_count, 10) })));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/future-idea-votes", async (req, res) => {
  const { anonymousId, ideaSlug } = req.body || {};
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  if (!ideaSlug) {
    return res.status(400).json({ error: "ideaSlug est requis" });
  }
  try {
    const existing = await pool.query(
      "SELECT 1 FROM future_idea_votes WHERE anonymous_id = $1 AND idea_slug = $2",
      [anonymousId, ideaSlug]
    );
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM future_idea_votes WHERE anonymous_id = $1 AND idea_slug = $2", [anonymousId, ideaSlug]);
      return res.json({ status: "ok", voted: false });
    }
    await pool.query("INSERT INTO future_idea_votes (anonymous_id, idea_slug) VALUES ($1, $2)", [anonymousId, ideaSlug]);
    res.json({ status: "ok", voted: true });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.get("/api/future-idea-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    const result = await pool.query("SELECT idea_slug FROM future_idea_votes WHERE anonymous_id = $1", [anonymousId]);
    res.json(result.rows.map((r) => r.idea_slug));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/future-ideas", requireIngestToken, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.slug, i.title, i.published, i.updated_at, COUNT(v.anonymous_id) AS support_count
       FROM future_ideas i
       LEFT JOIN future_idea_votes v ON v.idea_slug = i.slug
       GROUP BY i.slug
       ORDER BY i.updated_at DESC`
    );
    res.json(result.rows.map((r) => ({ ...r, support_count: parseInt(r.support_count, 10) })));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/admin/future-ideas/:slug", requireIngestToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM future_ideas WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Idée non trouvée" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.post("/api/admin/future-ideas", requireIngestToken, async (req, res) => {
  const { slug, title, description, published } = req.body || {};
  if (!slug || !title || !title.trim()) {
    return res.status(400).json({ error: "slug et title sont requis" });
  }
  try {
    await pool.query(
      `INSERT INTO future_ideas (slug, title, description, published, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         published = EXCLUDED.published, updated_at = now()`,
      [slug, title.trim(), description || null, published === true]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: err.message });
  }
});

app.delete("/api/admin/future-ideas/:slug", requireIngestToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM future_ideas WHERE slug = $1", [req.params.slug]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: err.message });
  }
});

app.post("/api/admin/future-ideas/:slug/publish", requireIngestToken, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE future_ideas SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Idée non trouvée" });
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`API Pas de planète B à l'écoute sur le port ${port}`);
});
