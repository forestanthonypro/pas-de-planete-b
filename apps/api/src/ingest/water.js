// Ingestion des données eau par pays : ressources renouvelables par habitant
// (AQUASTAT/FAO via Banque mondiale) et pluviométrie annuelle (Copernicus ERA5),
// toutes deux republiées par Our World in Data — CSV ouverts, sans authentification.
//
// Particularité : la donnée "ressources renouvelables" est une estimation à long
// terme recalculée chaque année seulement pour tenir compte de la population —
// la valeur physique sous-jacente change rarement d'une année sur l'autre.
// La pluviométrie, elle, varie réellement chaque année (données climatiques).

import { parse } from "csv-parse/sync";

const FRESHWATER_URL =
  "https://ourworldindata.org/grapher/renewable-water-resources-per-capita.csv?v=1&csvType=full&useColumnShortNames=false";
const PRECIPITATION_URL =
  "https://ourworldindata.org/grapher/average-precipitation-per-year.csv?v=1&csvType=full&useColumnShortNames=false";
const SOURCE_LABEL = "AQUASTAT/FAO via Banque mondiale, et Copernicus ERA5, via Our World in Data";
const ISO3_RE = /^[A-Z]{3}$/;

async function fetchCsvRows(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Échec du téléchargement (${url}) : ${res.status} ${res.statusText}`);
  const text = await res.text();
  return parse(text, { columns: true, skip_empty_lines: true });
}

export async function ingestWater(pool) {
  const [freshRows, precipRows] = await Promise.all([
    fetchCsvRows(FRESHWATER_URL),
    fetchCsvRows(PRECIPITATION_URL),
  ]);

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const freshCol = "Renewable internal freshwater resources per capita (cubic meters)";
    for (const row of freshRows) {
      const isoCode = (row.Code || "").trim().toUpperCase();
      const year = parseInt(row.Year, 10);
      const value = row[freshCol] === "" || row[freshCol] === undefined ? null : parseFloat(row[freshCol]);
      if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || value === null) {
        skipped += 1;
        continue;
      }
      await client.query(
        `INSERT INTO water_data (country_code, country_name, year, renewable_freshwater_m3_per_capita, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           renewable_freshwater_m3_per_capita = EXCLUDED.renewable_freshwater_m3_per_capita,
           updated_at = now()`,
        [isoCode, row.Entity, year, value, SOURCE_LABEL]
      );
      inserted += 1;
    }

    const precipCol = "Annual precipitation";
    for (const row of precipRows) {
      const isoCode = (row.Code || "").trim().toUpperCase();
      const year = parseInt(row.Year, 10);
      const value = row[precipCol] === "" || row[precipCol] === undefined ? null : parseFloat(row[precipCol]);
      if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || value === null) {
        skipped += 1;
        continue;
      }
      await client.query(
        `INSERT INTO water_data (country_code, country_name, year, precipitation_mm, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           precipitation_mm = EXCLUDED.precipitation_mm,
           country_name = EXCLUDED.country_name,
           updated_at = now()`,
        [isoCode, row.Entity, year, value, SOURCE_LABEL]
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Téléchargement des données eau (ressources renouvelables + pluviométrie)...");
  const { inserted, skipped } = await ingestWater(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
