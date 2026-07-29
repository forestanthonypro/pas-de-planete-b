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

app.get("/api/debunk", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT slug, myth, category, verdict, image_url, updated_at FROM debunk_entries WHERE published = true ORDER BY updated_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/debunk/:slug", async (req, res) => {
  try {
    const entryResult = await pool.query(
      "SELECT * FROM debunk_entries WHERE slug = $1 AND published = true",
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
      "SELECT slug, myth, category, verdict, published, image_url, updated_at FROM debunk_entries ORDER BY updated_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
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
  const { slug, myth, reality, category, verdict, claimQuote, imageUrl, published, sources } = req.body || {};
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
      `INSERT INTO debunk_entries (slug, myth, reality, category, verdict, claim_quote, image_url, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (slug)
       DO UPDATE SET myth = EXCLUDED.myth, reality = EXCLUDED.reality, category = EXCLUDED.category,
                     verdict = EXCLUDED.verdict, claim_quote = EXCLUDED.claim_quote,
                     image_url = EXCLUDED.image_url, published = EXCLUDED.published, updated_at = now()`,
      [slug, myth, reality, category || null, verdict || "faux", claimQuote || null, imageUrl || null, published === true]
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

app.get("/api/science-relays", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT slug, title, description, scientist_name, scientist_field, content_type,
              source_name, category, embed_url, image_url, updated_at
       FROM science_relays WHERE published = true ORDER BY updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.get("/api/science-relays/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM science_relays WHERE slug = $1 AND published = true",
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
      "SELECT slug, title, content_type, category, published, image_url, updated_at FROM science_relays ORDER BY updated_at DESC"
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
    sourceUrl, sourceName, embedUrl, imageUrl, category, relatedDebunkSlug, published,
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
          source_url, source_name, embed_url, image_url, category, related_debunk_slug, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         scientist_name = EXCLUDED.scientist_name, scientist_field = EXCLUDED.scientist_field,
         content_type = EXCLUDED.content_type, source_url = EXCLUDED.source_url,
         source_name = EXCLUDED.source_name, embed_url = EXCLUDED.embed_url,
         image_url = EXCLUDED.image_url,
         category = EXCLUDED.category, related_debunk_slug = EXCLUDED.related_debunk_slug,
         published = EXCLUDED.published, updated_at = now()`,
      [slug, title, description, scientistName || null, scientistField || null, contentType,
       sourceUrl, sourceName || null, embedUrl || null, imageUrl || null, category || null, relatedDebunkSlug || null, published === true]
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

app.listen(port, () => {
  console.log(`API Pas de planète B à l'écoute sur le port ${port}`);
});
