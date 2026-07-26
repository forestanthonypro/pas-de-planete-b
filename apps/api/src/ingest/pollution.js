// Ingestion de l'exposition à la pollution de l'air (PM2.5) par pays.
// Source : SatPM (modélisation satellite, Washington University in St. Louis),
// republiée par Our World in Data — CSV ouvert, sans authentification.
// L'OMS recommande un seuil de 5 µg/m³ pour limiter les risques sanitaires —
// c'est un repère universel fixe, pas une moyenne mondiale calculée.

import { parse } from "csv-parse/sync";

const CSV_URL = "https://ourworldindata.org/grapher/outdoor-air-pollution-exposure.csv?v=1&csvType=full&useColumnShortNames=false";
const SOURCE_LABEL = "SatPM (Washington University in St. Louis), via Our World in Data";
const ISO3_RE = /^[A-Z]{3}$/;

export async function ingestPollution(pool) {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const text = await res.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true });

  const col = "Outdoor air pollution exposure (population-weighted PM2.5)";
  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const isoCode = (row.Code || "").trim().toUpperCase();
      const year = parseInt(row.Year, 10);
      const value = row[col] === "" || row[col] === undefined ? null : parseFloat(row[col]);
      if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || value === null) {
        skipped += 1;
        continue;
      }
      await client.query(
        `INSERT INTO pollution_data (country_code, country_name, year, pm25_ug_m3, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           pm25_ug_m3 = EXCLUDED.pm25_ug_m3,
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
  console.log("Téléchargement des données pollution de l'air (PM2.5)...");
  const { inserted, skipped } = await ingestPollution(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
