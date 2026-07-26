// Ingestion de la perte de couverture arborée par pays.
// Source : Global Forest Watch (Hansen et al.), republié par Our World in Data.
// CSV ouvert, sans authentification, licence CC-BY.

import { parse } from "csv-parse/sync";

const CSV_URL = "https://ourworldindata.org/grapher/tree-cover-loss.csv?v=1&csvType=full&useColumnShortNames=false";
const SOURCE_LABEL = "Global Forest Watch via Our World in Data";
const ISO3_RE = /^[A-Z]{3}$/;

export async function ingestVegetation(pool) {
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
      const isoCode = (row.Code || "").trim().toUpperCase();
      const year = parseInt(row.Year, 10);
      const loss = row.Total === "" ? null : parseFloat(row.Total);

      // On exclut les agrégats OWID (continents, groupes de revenu...) qui n'ont pas
      // de code ISO3 réel et ne correspondent à aucun filtre "pays" de l'app.
      if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || loss === null) {
        skipped += 1;
        continue;
      }

      await client.query(
        `INSERT INTO vegetation_loss (country_code, country_name, year, tree_cover_loss_ha, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           tree_cover_loss_ha = EXCLUDED.tree_cover_loss_ha,
           updated_at = now()`,
        [isoCode, row.Entity, year, loss, SOURCE_LABEL]
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
  const { inserted, skipped } = await ingestVegetation(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
