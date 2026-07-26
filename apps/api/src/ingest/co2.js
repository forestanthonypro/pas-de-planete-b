// Ingestion des émissions de CO2 par pays.
// Source : Our World in Data (Global Carbon Project), licence CC-BY.
// Utilisable en CLI (node src/ingest/co2.js) ou importée par l'API (endpoint admin).

import { parse } from "csv-parse/sync";

const CSV_URL = "https://owid-public.owid.io/data/co2/owid-co2-data.csv";
const SOURCE_LABEL = "Global Carbon Project via Our World in Data";
const ISO3_RE = /^[A-Z]{3}$/;

export async function ingestCo2(pool) {
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  }
  const csvText = await res.text();
  const rows = parse(csvText, { columns: true, skip_empty_lines: true });

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const isoCode = (row.iso_code || "").trim().toUpperCase();
      const year = parseInt(row.year, 10);
      const emissions = row.co2 === "" ? null : parseFloat(row.co2);

      if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || emissions === null) {
        skipped += 1;
        continue;
      }

      const perCapita = row.co2_per_capita === "" ? null : parseFloat(row.co2_per_capita);
      const consumptionCo2 = row.consumption_co2 === "" || row.consumption_co2 === undefined ? null : parseFloat(row.consumption_co2);
      const consumptionCo2PerCapita = row.consumption_co2_per_capita === "" || row.consumption_co2_per_capita === undefined ? null : parseFloat(row.consumption_co2_per_capita);
      const population = row.population === "" || row.population === undefined ? null : parseInt(row.population, 10);

      await client.query(
        `INSERT INTO co2_emissions (country_code, country_name, year, emissions_mt, emissions_per_capita, consumption_co2, consumption_co2_per_capita, population, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           emissions_mt = EXCLUDED.emissions_mt,
           emissions_per_capita = EXCLUDED.emissions_per_capita,
           consumption_co2 = EXCLUDED.consumption_co2,
           consumption_co2_per_capita = EXCLUDED.consumption_co2_per_capita,
           population = EXCLUDED.population,
           updated_at = now()`,
        [isoCode, row.country, year, emissions, perCapita, consumptionCo2, consumptionCo2PerCapita, population, SOURCE_LABEL]
      );
      inserted += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { inserted, skipped };
}

// Exécution directe en CLI : node src/ingest/co2.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log(`Téléchargement de ${CSV_URL} ...`);
  const { inserted, skipped } = await ingestCo2(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
