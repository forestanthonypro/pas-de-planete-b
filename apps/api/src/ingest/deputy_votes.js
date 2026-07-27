// Ingestion des votes individuels de chaque député pour les N scrutins les
// plus récents (voir la note de périmètre dans la migration 013 : la 17e
// législature a déjà dépassé 8000 scrutins, trop pour tout ingérer).
//
// Nécessite que scrutins.js ait déjà tourné (pour connaître les numéros de
// scrutin existants). Un délai est ajouté entre chaque requête pour rester
// respectueux du serveur de Regards Citoyens (petite association).
//
// IMPORTANT : la structure exacte du JSON par scrutin n'a pas pu être
// vérifiée en direct au moment de l'écriture de ce script (nosdeputes.fr
// n'étant pas dans la liste des domaines accessibles depuis l'environnement
// de développement) — le parsing ci-dessous est défensif (plusieurs formes de
// clés essayées) mais un premier test réel peut révéler un ajustement
// nécessaire sur les noms de champs exacts.

const LEGISLATURE = 17;
const RECENT_COUNT = 200;
const SOURCE_LABEL = "NosDéputés.fr (Regards Citoyens), à partir de l'Assemblée nationale et du Journal Officiel";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Essaie plusieurs formes plausibles pour extraire, depuis un scrutin, la
// liste { slug, position } de chaque député ayant voté.
function extractVotes(scrutin) {
  const votes = [];
  const groupes = scrutin.groupes || scrutin.groupe || [];
  const groupList = Array.isArray(groupes) ? groupes : [groupes];

  for (const g of groupList) {
    const groupe = g.groupe || g;
    const votesByPosition = groupe.votes || groupe.positions || {};

    const positionKeyMap = {
      pour: "pour",
      pours: "pour",
      contre: "contre",
      contres: "contre",
      abstention: "abstention",
      abstentions: "abstention",
      nonVotant: "absent",
      nonVotants: "absent",
      non_votant: "absent",
      non_votants: "absent",
      absent: "absent",
      absents: "absent",
    };

    for (const [key, list] of Object.entries(votesByPosition)) {
      const normalizedPosition = positionKeyMap[key];
      if (!normalizedPosition || !Array.isArray(list)) continue;
      for (const entry of list) {
        const parl = entry.parlementaire || entry;
        const slug = parl.slug;
        if (slug) votes.push({ slug, position: normalizedPosition });
      }
    }
  }

  return votes;
}

export async function ingestDeputyVotes(pool, { recentCount = RECENT_COUNT } = {}) {
  const numerosResult = await pool.query(
    "SELECT numero FROM scrutins WHERE legislature = $1 ORDER BY numero DESC LIMIT $2",
    [LEGISLATURE, recentCount]
  );
  const numeros = numerosResult.rows.map((r) => r.numero);

  let scrutinsProcessed = 0;
  let votesInserted = 0;
  let scrutinsFailed = 0;

  for (const numero of numeros) {
    const url = `https://www.nosdeputes.fr/${LEGISLATURE}/scrutin/${numero}/json`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "PasDePlaneteB/1.0 (contact via GitHub repo)" } });
      if (!res.ok) {
        scrutinsFailed += 1;
        continue;
      }
      const data = await res.json();
      const scrutin = data.scrutin || data;
      const votes = extractVotes(scrutin);

      if (votes.length > 0) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          for (const v of votes) {
            await client.query(
              `INSERT INTO deputy_votes (deputy_slug, legislature, scrutin_numero, position)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (deputy_slug, legislature, scrutin_numero)
               DO UPDATE SET position = EXCLUDED.position, updated_at = now()`,
              [v.slug, LEGISLATURE, numero, v.position]
            );
            votesInserted += 1;
          }
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          // Un scrutin individuel qui échoue (ex: député non encore dans la
          // table deputies, contrainte de clé étrangère) ne doit pas arrêter
          // l'ingestion des autres scrutins.
          scrutinsFailed += 1;
        } finally {
          client.release();
        }
      }
      scrutinsProcessed += 1;
    } catch (err) {
      scrutinsFailed += 1;
    }
    await sleep(150);
  }

  return { scrutinsProcessed, votesInserted, scrutinsFailed, totalScrutins: numeros.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log(`Téléchargement des votes détaillés pour les ${RECENT_COUNT} scrutins les plus récents...`);
  const result = await ingestDeputyVotes(pool);
  console.log(
    `Terminé : ${result.scrutinsProcessed}/${result.totalScrutins} scrutins traités, ${result.votesInserted} votes insérés/mis à jour, ${result.scrutinsFailed} échecs.`
  );
  await pool.end();
}
