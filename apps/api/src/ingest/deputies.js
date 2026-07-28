// Ingestion de la liste des députés en mandat (17e législature), source CIVIX
// via data.gouv.fr — colonnes confirmées par échantillon réel :
// acteur_uid, prenom, nom, legislature, circ_num, circ_departement,
// groupe_libelle, groupe_libelle_abrev

import { parse } from "csv-parse/sync";

const DEPUTIES_URL = "https://www.data.gouv.fr/api/1/datasets/r/0c6045e2-631d-4759-b1dc-f8d76d624321";
const SOURCE_LABEL = "CIVIX, à partir des données open data de l'Assemblée nationale";

export async function ingestDeputies(pool) {
  const res = await fetch(DEPUTIES_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const text = await res.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true });

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const acteurUid = row.acteur_uid;
      if (!acteurUid) {
        skipped += 1;
        continue;
      }
      const fullName = `${row.prenom || ""} ${row.nom || ""}`.trim();
      const circoNumber = row.circ_num ? parseInt(row.circ_num, 10) : null;

      await client.query(
        `INSERT INTO deputies (acteur_uid, first_name, last_name, full_name, legislature,
                                circo_number, department, group_name, group_abbreviation, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (acteur_uid)
         DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           full_name = EXCLUDED.full_name,
           legislature = EXCLUDED.legislature,
           circo_number = EXCLUDED.circo_number,
           department = EXCLUDED.department,
           group_name = EXCLUDED.group_name,
           group_abbreviation = EXCLUDED.group_abbreviation,
           updated_at = now()`,
        [
          acteurUid,
          row.prenom || null,
          row.nom || null,
          fullName || acteurUid,
          parseInt(row.legislature, 10) || 17,
          Number.isNaN(circoNumber) ? null : circoNumber,
          row.circ_departement || null,
          row.groupe_libelle || null,
          row.groupe_libelle_abrev || null,
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
  console.log("Téléchargement de la liste des députés (CIVIX)...");
  const { inserted, skipped } = await ingestDeputies(pool);
  console.log(`Terminé : ${inserted} députés insérés/mis à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
