// Ingestion des centrales électriques mondiales.
// Source : Global Power Plant Database (World Resources Institute), licence CC-BY 4.0.
// Utilisable en CLI (node src/ingest/power_plants.js) ou importée par l'API.

import { parse } from "csv-parse/sync";

const CSV_URL =
  "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv";
const SOURCE_LABEL = "Global Power Plant Database (WRI)";

export async function ingestPowerPlants(pool) {
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
      const lat = parseFloat(row.latitude);
      const lon = parseFloat(row.longitude);
      const capacity = row.capacity_mw === "" ? null : parseFloat(row.capacity_mw);
      const countryCode = (row.country || "").trim().toUpperCase();

      if (
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        !row.gppd_idnr ||
        !row.primary_fuel ||
        countryCode.length !== 3
      ) {
        skipped += 1;
        continue;
      }

      await client.query(
        `INSERT INTO power_plants (external_id, name, country_code, fuel_type, capacity_mw, location, source)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8)
         ON CONFLICT (external_id)
         DO UPDATE SET
           name = EXCLUDED.name,
           fuel_type = EXCLUDED.fuel_type,
           capacity_mw = EXCLUDED.capacity_mw,
           location = EXCLUDED.location,
           updated_at = now()`,
        [row.gppd_idnr, row.name, countryCode, row.primary_fuel, capacity, lon, lat, SOURCE_LABEL]
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
  console.log(`Téléchargement de ${CSV_URL} ...`);
  const { inserted, skipped } = await ingestPowerPlants(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
