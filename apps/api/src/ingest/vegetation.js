// Ingestion de la perte de couverture arborée par pays, avec le référentiel de
// surface forestière totale (FAO) permettant de situer la perte annuelle en
// proportion de ce qui existe — pas seulement en hectares bruts.
// Sources : Global Forest Watch (Hansen et al.) et FAO Global Forest Resources
// Assessment, toutes deux republiées par Our World in Data — CSV ouverts, sans clé.

import { parse } from "csv-parse/sync";

const LOSS_URL = "https://ourworldindata.org/grapher/tree-cover-loss.csv?v=1&csvType=full&useColumnShortNames=false";
const AREA_URL = "https://ourworldindata.org/grapher/forest-area-km.csv?v=1&csvType=full&useColumnShortNames=false";
const SOURCE_LABEL = "Global Forest Watch et FAO (Global Forest Resources Assessment), via Our World in Data";
const ISO3_RE = /^[A-Z]{3}$/;

async function fetchCsvRows(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Échec du téléchargement (${url}) : ${res.status} ${res.statusText}`);
  const text = await res.text();
  return parse(text, { columns: true, skip_empty_lines: true });
}

export async function ingestVegetation(pool) {
  const [lossRows, areaRows] = await Promise.all([fetchCsvRows(LOSS_URL), fetchCsvRows(AREA_URL)]);

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of lossRows) {
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

    const areaCol = "Forest area";
    for (const row of areaRows) {
      const isoCode = (row.Code || "").trim().toUpperCase();
      const year = parseInt(row.Year, 10);
      const area = row[areaCol] === "" || row[areaCol] === undefined ? null : parseFloat(row[areaCol]);
      if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || area === null) {
        skipped += 1;
        continue;
      }
      await client.query(
        `INSERT INTO vegetation_loss (country_code, country_name, year, forest_area_ha, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           forest_area_ha = EXCLUDED.forest_area_ha,
           country_name = EXCLUDED.country_name,
           updated_at = now()`,
        [isoCode, row.Entity, year, area, SOURCE_LABEL]
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
  console.log("Téléchargement des données végétation (perte + référentiel de surface)...");
  const { inserted, skipped } = await ingestVegetation(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
