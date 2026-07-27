// Ingestion de la liste des scrutins (métadonnées seulement : date, titre,
// résultat, décompte des voix) — pas les votes individuels de chaque député,
// qui sont gérés séparément par deputy_votes.js pour rester sur un périmètre
// gérable (voir la note dans la migration 013).
//
// Législature actuelle : 17e (depuis juillet 2024, après la dissolution de
// l'Assemblée par le Président de la République).

const LEGISLATURE = 17;
const SCRUTINS_URL = `https://www.nosdeputes.fr/${LEGISLATURE}/scrutins/json`;
const SOURCE_LABEL = "NosDéputés.fr (Regards Citoyens), à partir de l'Assemblée nationale et du Journal Officiel";

function parseIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export async function ingestScrutins(pool) {
  const res = await fetch(SCRUTINS_URL, { headers: { "User-Agent": "PasDePlaneteB/1.0 (contact via GitHub repo)" } });
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const data = await res.json();

  // Structure attendue : { scrutins: [ { scrutin: {...} }, ... ] } — défensif
  // au cas où la forme exacte diffère (imbrication, nom de champ).
  const rows = Array.isArray(data.scrutins) ? data.scrutins : Array.isArray(data) ? data : [];

  let inserted = 0;
  let skipped = 0;
  let maxNumero = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const entry of rows) {
      const s = entry.scrutin || entry;
      const numero = parseIntOrNull(s.numero);
      if (numero === null) {
        skipped += 1;
        continue;
      }
      if (numero > maxNumero) maxNumero = numero;

      await client.query(
        `INSERT INTO scrutins (legislature, numero, scrutin_date, title, result,
                                votes_pour, votes_contre, votes_abstention, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (legislature, numero)
         DO UPDATE SET
           scrutin_date = EXCLUDED.scrutin_date,
           title = EXCLUDED.title,
           result = EXCLUDED.result,
           votes_pour = EXCLUDED.votes_pour,
           votes_contre = EXCLUDED.votes_contre,
           votes_abstention = EXCLUDED.votes_abstention,
           updated_at = now()`,
        [
          LEGISLATURE,
          numero,
          s.date || null,
          s.titre || null,
          s.sort || s.result || null,
          parseIntOrNull(s.nb_pours ?? s.nb_pour),
          parseIntOrNull(s.nb_contres ?? s.nb_contre),
          parseIntOrNull(s.nb_abstentions ?? s.nb_abstention),
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

  return { inserted, skipped, maxNumero, legislature: LEGISLATURE };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Téléchargement de la liste des scrutins (métadonnées)...");
  const { inserted, skipped, maxNumero } = await ingestScrutins(pool);
  console.log(`Terminé : ${inserted} scrutins insérés/mis à jour, ${skipped} lignes ignorées. Dernier numéro : ${maxNumero}.`);
  await pool.end();
}
