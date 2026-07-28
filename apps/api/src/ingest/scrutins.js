// Ingestion des scrutins et des votes individuels, source officielle :
// Assemblée nationale, open data brut (17e législature).
//
// Le ZIP contient un fichier JSON par scrutin (json/VTANR5L17V{numero}.json),
// avec à la fois les métadonnées (date, titre, résultat) ET le détail
// nominatif complet des votes (qui a voté quoi), organisé par groupe
// politique. On ingère les métadonnées de TOUS les scrutins (léger, juste du
// texte), mais on ne détaille les votes nominatifs individuels que pour les
// scrutins les plus récents (~200) — l'historique complet représenterait
// plusieurs millions de lignes, hors de proportion avec le reste de l'app.
//
// Structure confirmée par échantillon réel (voir scrutin.ventilationVotes
// .organe.groupes.groupe[].vote.decompteNominatif.{pours,contres,abstentions,
// nonVotants}.votant[].acteurRef).

import AdmZip from "adm-zip";

const SCRUTINS_ZIP_URL = "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip";
const SOURCE_LABEL = "Assemblée nationale (open data officiel)";
const LEGISLATURE = 17;
const RECENT_VOTES_COUNT = 200;

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}
function parseIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// Extrait la liste {acteurRef, position} de tous les votants d'un scrutin, en
// parcourant chaque groupe politique et chacune des 3-4 listes de position.
function extractVotes(scrutin) {
  const votes = [];
  let groupes = get(scrutin, "ventilationVotes.organe.groupes.groupe") || [];
  if (!Array.isArray(groupes)) groupes = [groupes];

  const positionKeyMap = { pours: "pour", contres: "contre", abstentions: "abstention", nonVotants: "absent" };

  for (const groupe of groupes) {
    const decompte = get(groupe, "vote.decompteNominatif") || {};
    for (const [key, normalized] of Object.entries(positionKeyMap)) {
      let votants = get(decompte, `${key}.votant`);
      if (!votants) continue;
      if (!Array.isArray(votants)) votants = [votants];
      for (const v of votants) {
        if (v.acteurRef) votes.push({ acteurRef: v.acteurRef, position: normalized });
      }
    }
  }
  return votes;
}

export async function ingestScrutins(pool, { recentVotesCount = RECENT_VOTES_COUNT } = {}) {
  const res = await fetch(SCRUTINS_ZIP_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => e.entryName.endsWith(".json"));

  // 1) Parser tous les scrutins pour les métadonnées, garder le JSON complet
  // en mémoire pour la 2e passe (évite de re-décompresser).
  const parsed = [];
  for (const entry of entries) {
    try {
      const data = JSON.parse(entry.getData().toString("utf8"));
      const scrutin = data.scrutin || data;
      const numero = parseIntOrNull(scrutin.numero);
      if (numero !== null) parsed.push(scrutin);
    } catch {
      // Fichier illisible — ignoré.
    }
  }

  let scrutinsInserted = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const scrutin of parsed) {
      const numero = parseIntOrNull(scrutin.numero);
      const decompte = get(scrutin, "syntheseVote.decompte") || {};

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
          LEGISLATURE,
          numero,
          scrutin.uid || null,
          scrutin.dateScrutin || null,
          get(scrutin, "typeVote.codeTypeVote") || null,
          get(scrutin, "typeVote.libelleTypeVote") || null,
          get(scrutin, "typeVote.typeMajorite") || null,
          get(scrutin, "sort.code") || null,
          get(scrutin, "sort.libelle") || null,
          scrutin.titre || null,
          get(scrutin, "objet.libelle") || null,
          SOURCE_LABEL,
        ]
      );
      scrutinsInserted += 1;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // 2) Détail nominatif des votes, seulement pour les N scrutins les plus
  // récents (par numéro décroissant).
  const recentScrutins = [...parsed]
    .sort((a, b) => parseIntOrNull(b.numero) - parseIntOrNull(a.numero))
    .slice(0, recentVotesCount);

  let votesInserted = 0;
  let votesSkippedNoDeputy = 0;

  for (const scrutin of recentScrutins) {
    const numero = parseIntOrNull(scrutin.numero);
    const votes = extractVotes(scrutin);
    if (votes.length === 0) continue;

    const voteClient = await pool.connect();
    try {
      await voteClient.query("BEGIN");
      for (const v of votes) {
        try {
          await voteClient.query("SAVEPOINT vote_row");
          await voteClient.query(
            `INSERT INTO deputy_votes (legislature, numero_scrutin, acteur_uid, scrutin_uid, position, source)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (legislature, numero_scrutin, acteur_uid)
             DO UPDATE SET scrutin_uid = EXCLUDED.scrutin_uid, position = EXCLUDED.position, updated_at = now()`,
            [LEGISLATURE, numero, v.acteurRef, scrutin.uid || null, v.position, SOURCE_LABEL]
          );
          await voteClient.query("RELEASE SAVEPOINT vote_row");
          votesInserted += 1;
        } catch {
          await voteClient.query("ROLLBACK TO SAVEPOINT vote_row");
          votesSkippedNoDeputy += 1;
        }
      }
      await voteClient.query("COMMIT");
    } catch (err) {
      await voteClient.query("ROLLBACK");
    } finally {
      voteClient.release();
    }
  }

  return { scrutinsInserted, votesInserted, votesSkippedNoDeputy, totalScrutinsFound: parsed.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Téléchargement des scrutins (Assemblée nationale, peut prendre un moment — ~26 Mo)...");
  const result = await ingestScrutins(pool);
  console.log(
    `Terminé : ${result.scrutinsInserted}/${result.totalScrutinsFound} scrutins insérés (métadonnées), ${result.votesInserted} votes détaillés insérés (${result.votesSkippedNoDeputy} ignorés, député non trouvé).`
  );
  await pool.end();
}
