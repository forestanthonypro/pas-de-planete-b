// Ingestion des votes individuels des députés, source CIVIX via data.gouv.fr —
// colonnes confirmées par échantillon réel :
// scrutin_uid, numero_scrutin, date_scrutin, acteur_uid, prenom, nom, groupe, position
//
// Note de couverture : ce fichier public est plus restreint que l'ensemble
// des scrutins de la législature (voir le fichier scrutins, bien plus gros) —
// il ne couvre vraisemblablement qu'un sous-ensemble récent, pas tout
// l'historique. On ingère ce qui est disponible plutôt que de le simuler.

import { parse } from "csv-parse/sync";

const VOTES_URL = "https://www.data.gouv.fr/api/1/datasets/r/bb1757e3-ccfd-43a8-b7d3-bb5624ff97a4";
const SOURCE_LABEL = "CIVIX, à partir des données open data de l'Assemblée nationale";
const LEGISLATURE = 17;

export async function ingestDeputyVotes(pool) {
  const res = await fetch(VOTES_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const text = await res.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true });

  let inserted = 0;
  let skipped = 0;
  let skippedNoDeputy = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const acteurUid = row.acteur_uid;
      const numero = parseInt(row.numero_scrutin, 10);
      const position = (row.position || "").trim().toLowerCase();
      if (!acteurUid || Number.isNaN(numero) || !position) {
        skipped += 1;
        continue;
      }

      try {
        await client.query("SAVEPOINT vote_row");
        await client.query(
          `INSERT INTO deputy_votes (legislature, numero_scrutin, acteur_uid, scrutin_uid, position, source)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (legislature, numero_scrutin, acteur_uid)
           DO UPDATE SET
             scrutin_uid = EXCLUDED.scrutin_uid,
             position = EXCLUDED.position,
             updated_at = now()`,
          [LEGISLATURE, numero, acteurUid, row.scrutin_uid || null, position, SOURCE_LABEL]
        );
        await client.query("RELEASE SAVEPOINT vote_row");
        inserted += 1;
      } catch (err) {
        // Le député référencé n'est pas (encore) dans la table deputies
        // (contrainte de clé étrangère) — on annule seulement cette ligne
        // via SAVEPOINT plutôt que de faire échouer toute la transaction.
        await client.query("ROLLBACK TO SAVEPOINT vote_row");
        skippedNoDeputy += 1;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { inserted, skipped, skippedNoDeputy };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Téléchargement des votes individuels des députés (CIVIX)...");
  const { inserted, skipped, skippedNoDeputy } = await ingestDeputyVotes(pool);
  console.log(`Terminé : ${inserted} votes insérés/mis à jour, ${skipped} lignes ignorées, ${skippedNoDeputy} sans député correspondant.`);
  await pool.end();
}
