// Ingestion des émissions de CO2 par pays.
// Source : Our World in Data (Global Carbon Project), licence CC-BY.
// Usage : node src/ingest/co2.js

import { parse } from "csv-parse/sync";
import pg from "pg";

const CSV_URL = "https://owid-public.owid.io/data/co2/owid-co2-data.csv";
const SOURCE_LABEL = "Global Carbon Project via Our World in Data";

// Un code ISO 3166-1 alpha-3 valide : exactement 3 lettres majuscules.
// Exclut les agrégats OWID (World, continents, groupes de revenu...)
// qui n'ont pas de code pays réel et ne correspondent à aucun filtre "pays" de l'app.
const ISO3_RE = /^[A-Z]{3}$/;

async function main() {
  console.log(`Téléchargement de ${CSV_URL} ...`);
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  }
  const csvText = await res.text();

  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  });

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  let inserted = 0;
  let skipped = 0;

  // On regroupe en une seule transaction : soit tout passe, soit rien n'est modifié.
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

      await client.query(
        `INSERT INTO co2_emissions (country_code, country_name, year, emissions_mt, emissions_per_capita, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           emissions_mt = EXCLUDED.emissions_mt,
           emissions_per_capita = EXCLUDED.emissions_per_capita,
           updated_at = now()`,
        [isoCode, row.country, year, emissions, perCapita, SOURCE_LABEL]
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

  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées (agrégats ou données manquantes).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Échec de l'ingestion CO2 :", err);
  process.exit(1);
});
