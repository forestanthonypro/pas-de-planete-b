// Ingestion des groupes politiques et de leurs statistiques de participation,
// source CIVIX via data.gouv.fr — colonnes confirmées par échantillon réel :
// nom_groupe, abreviation, legislature, effectif, avg_participation_pct,
// median_participation_pct, total_votes_exprimes, scrutins_eligibles

import { parse } from "csv-parse/sync";

const GROUPS_URL = "https://www.data.gouv.fr/api/1/datasets/r/6b1a5995-c194-47a3-8570-bdf61e196170";
const SOURCE_LABEL = "CIVIX, à partir des données open data de l'Assemblée nationale";

function parseIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
function parseFloatOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

export async function ingestGroups(pool) {
  const res = await fetch(GROUPS_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const text = await res.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true });

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const abbreviation = row.abreviation;
      const legislature = parseIntOrNull(row.legislature);
      if (!abbreviation || legislature === null) {
        skipped += 1;
        continue;
      }

      await client.query(
        `INSERT INTO an_groups (legislature, abbreviation, name, effectif, avg_participation_pct,
                                 median_participation_pct, total_votes_exprimes, scrutins_eligibles, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (legislature, abbreviation)
         DO UPDATE SET
           name = EXCLUDED.name,
           effectif = EXCLUDED.effectif,
           avg_participation_pct = EXCLUDED.avg_participation_pct,
           median_participation_pct = EXCLUDED.median_participation_pct,
           total_votes_exprimes = EXCLUDED.total_votes_exprimes,
           scrutins_eligibles = EXCLUDED.scrutins_eligibles,
           updated_at = now()`,
        [
          legislature,
          abbreviation,
          row.nom_groupe || abbreviation,
          parseIntOrNull(row.effectif),
          parseFloatOrNull(row.avg_participation_pct),
          parseFloatOrNull(row.median_participation_pct),
          parseIntOrNull(row.total_votes_exprimes),
          parseIntOrNull(row.scrutins_eligibles),
          SOURCE_LABEL,
        ]
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
  console.log("Téléchargement des groupes politiques (CIVIX)...");
  const { inserted, skipped } = await ingestGroups(pool);
  console.log(`Terminé : ${inserted} groupes insérés/mis à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
