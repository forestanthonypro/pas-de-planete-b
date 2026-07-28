// Ingestion des métadonnées de scrutins, source CIVIX via data.gouv.fr —
// colonnes confirmées par échantillon réel :
// uid, legislature, numero, date_scrutin, type_vote, sort, titre, objet
//
// type_vote et sort sont des chaînes JSON imbriquées dans la cellule CSV
// (ex: sort = {"code":"rejeté","libelle":"L'Assemblée nationale n'a pas
// adopté"}) — nécessitent un second JSON.parse() après le parsing CSV.

import { parse } from "csv-parse/sync";

const SCRUTINS_URL = "https://www.data.gouv.fr/api/1/datasets/r/43e110e2-90a9-4cdb-a443-559ac306315f";
const SOURCE_LABEL = "CIVIX, à partir des données open data de l'Assemblée nationale";

function safeJsonParse(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export async function ingestScrutins(pool) {
  const res = await fetch(SCRUTINS_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const text = await res.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true });

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const legislature = parseInt(row.legislature, 10);
      const numero = parseInt(row.numero, 10);
      if (Number.isNaN(legislature) || Number.isNaN(numero)) {
        skipped += 1;
        continue;
      }

      const typeVote = safeJsonParse(row.type_vote);
      const sort = safeJsonParse(row.sort);

      await client.query(
        `INSERT INTO scrutins (legislature, numero, scrutin_uid, scrutin_date, type_vote_code,
                                type_vote_label, majority_type, result_code, result_label, title, objet, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (legislature, numero)
         DO UPDATE SET
           scrutin_uid = EXCLUDED.scrutin_uid,
           scrutin_date = EXCLUDED.scrutin_date,
           type_vote_code = EXCLUDED.type_vote_code,
           type_vote_label = EXCLUDED.type_vote_label,
           majority_type = EXCLUDED.majority_type,
           result_code = EXCLUDED.result_code,
           result_label = EXCLUDED.result_label,
           title = EXCLUDED.title,
           objet = EXCLUDED.objet,
           updated_at = now()`,
        [
          legislature,
          numero,
          row.uid || null,
          row.date_scrutin || null,
          typeVote?.codeTypeVote || null,
          typeVote?.libelleTypeVote || null,
          typeVote?.typeMajorite || null,
          sort?.code || null,
          sort?.libelle || null,
          row.titre || null,
          row.objet || null,
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
  console.log("Téléchargement des métadonnées de scrutins (CIVIX)...");
  const { inserted, skipped } = await ingestScrutins(pool);
  console.log(`Terminé : ${inserted} scrutins insérés/mis à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
