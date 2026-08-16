import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";

const router = Router();

// Phase 1 du kit de communication PDF : pour chaque indicateur, calcule le
// pays le mieux placé, le pays le moins bien placé, et la moyenne mondiale
// — en ne prenant que la dernière année disponible par pays (comme
// /api/country-summary-latest), pas l'historique complet.
//
// Chaque requête suit le même schéma : une CTE "latest" qui isole la
// dernière valeur par pays (DISTINCT ON), puis une sélection unique qui en
// tire le minimum, le maximum et la moyenne via des sous-requêtes triées.
// Les indicateurs dérivés (eau, forêt, espèces) calculent leur valeur dans
// la CTE elle-même, avant l'agrégation — pas de calcul de moyenne sur des
// moyennes déjà agrégées.

const QUERIES = {
  co2: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, emissions_per_capita::float AS value
      FROM co2_emissions
      WHERE emissions_per_capita IS NOT NULL AND emissions_per_capita > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  electricite: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, demand_per_capita_kwh::float AS value
      FROM electricity_generation
      WHERE demand_per_capita_kwh IS NOT NULL AND demand_per_capita_kwh > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  eau: `
    WITH latest_withdrawal AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, withdrawal_m3::float AS withdrawal
      FROM water_data
      WHERE withdrawal_m3 IS NOT NULL AND withdrawal_m3 > 0
      ORDER BY country_code, year DESC
    ),
    latest_population AS (
      SELECT DISTINCT ON (country_code) country_code, population::float AS population
      FROM co2_emissions
      WHERE population IS NOT NULL AND population > 0
      ORDER BY country_code, year DESC
    ),
    latest AS (
      SELECT w.country_code, w.country_name, (w.withdrawal / p.population) AS value
      FROM latest_withdrawal w
      JOIN latest_population p ON p.country_code = w.country_code
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  foret: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name,
        (tree_cover_loss_ha / NULLIF(forest_area_ha, 0) * 100) AS value
      FROM vegetation_loss
      WHERE tree_cover_loss_ha IS NOT NULL AND forest_area_ha IS NOT NULL AND forest_area_ha > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  pollution: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, pm25_ug_m3::float AS value
      FROM pollution_data
      WHERE pm25_ug_m3 IS NOT NULL AND pm25_ug_m3 > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  especes: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name,
        (COALESCE(mammals_threatened, 0) + COALESCE(birds_threatened, 0) + COALESCE(fish_threatened, 0)) AS value
      FROM species_threatened_counts
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest WHERE value > 0 ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest WHERE value > 0 ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest WHERE value > 0 ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest WHERE value > 0) AS avg_value,
      (SELECT COUNT(*) FROM latest WHERE value > 0) AS country_count
  `,
};

router.get("/api/admin/kit-communication/extremes", async (req, res) => {
  try {
    const keys = Object.keys(QUERIES);
    const results = await Promise.all(keys.map((key) => pool.query(QUERIES[key])));

    const out = {};
    keys.forEach((key, i) => {
      const row = results[i].rows[0];
      out[key] = {
        best: { country: row.best_name, code: row.best_code, value: row.best_value !== null ? parseFloat(row.best_value) : null },
        worst: { country: row.worst_name, code: row.worst_code, value: row.worst_value !== null ? parseFloat(row.worst_value) : null },
        avg: row.avg_value !== null ? parseFloat(row.avg_value) : null,
        countryCount: parseInt(row.country_count, 10),
      };
    });

    res.json(out);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

export default router;
