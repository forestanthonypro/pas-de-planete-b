// Ingestion de la liste des députés actuellement en mandat, depuis
// NosDéputés.fr (Regards Citoyens) — licence CC-BY-SA (contenus) / ODbL
// (données), à partir des données de l'Assemblée nationale et du Journal
// Officiel.

const DEPUTIES_URL = "https://www.nosdeputes.fr/deputes/enmandat/json";
const SOURCE_LABEL = "NosDéputés.fr (Regards Citoyens), à partir de l'Assemblée nationale et du Journal Officiel";

export async function ingestDeputies(pool) {
  const res = await fetch(DEPUTIES_URL, { headers: { "User-Agent": "PasDePlaneteB/1.0 (contact via GitHub repo)" } });
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const data = await res.json();

  // La structure attendue est { deputes: [ { depute: {...} }, ... ] } — mais on
  // reste défensif au cas où la forme exacte diffère légèrement (imbrication,
  // nom de champ), pour ne pas planter sur un détail de format.
  const rows = Array.isArray(data.deputes) ? data.deputes : Array.isArray(data) ? data : [];

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const entry of rows) {
      const d = entry.depute || entry;
      const slug = d.slug;
      if (!slug) {
        skipped += 1;
        continue;
      }
      const fullName = d.nom || `${d.prenom || ""} ${d.nom_de_famille || ""}`.trim();
      const mandateStart = d.mandat_debut || null;
      const circoNumber = d.num_circo ? parseInt(d.num_circo, 10) : null;

      await client.query(
        `INSERT INTO deputies (slug, full_name, first_name, last_name, group_acronym, group_name,
                                department, circo_name, circo_number, profession, mandate_start, url_an, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (slug)
         DO UPDATE SET
           full_name = EXCLUDED.full_name,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           group_acronym = EXCLUDED.group_acronym,
           group_name = EXCLUDED.group_name,
           department = EXCLUDED.department,
           circo_name = EXCLUDED.circo_name,
           circo_number = EXCLUDED.circo_number,
           profession = EXCLUDED.profession,
           mandate_start = EXCLUDED.mandate_start,
           url_an = EXCLUDED.url_an,
           updated_at = now()`,
        [
          slug,
          fullName || slug,
          d.prenom || null,
          d.nom_de_famille || null,
          d.groupe_sigle || null,
          d.parti_ratt_financier || d.groupe_sigle || null,
          d.num_deptmt || null,
          d.nom_circo || null,
          Number.isNaN(circoNumber) ? null : circoNumber,
          d.profession || null,
          mandateStart,
          d.url_an || null,
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
  console.log("Téléchargement de la liste des députés en mandat...");
  const { inserted, skipped } = await ingestDeputies(pool);
  console.log(`Terminé : ${inserted} députés insérés/mis à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
