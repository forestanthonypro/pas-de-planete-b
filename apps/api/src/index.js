import express from "express";
import cors from "cors";
import pg from "pg";
import { ingestCo2 } from "./ingest/co2.js";
import { ingestPowerPlants } from "./ingest/power_plants.js";
import { ingestSpecies } from "./ingest/species.js";

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
      `SELECT year, emissions_mt, emissions_per_capita
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
    const [co2Result, plantsResult, speciesResult] = await Promise.all([
      pool.query(
        `SELECT year, emissions_mt, emissions_per_capita
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
    ]);

    res.json({
      country,
      co2: co2Result.rows,
      energyMix: plantsResult.rows,
      speciesBreakdown: speciesResult.rows,
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`API Pas de planète B à l'écoute sur le port ${port}`);
});
