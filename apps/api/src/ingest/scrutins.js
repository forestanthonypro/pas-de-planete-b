// Ingestion des scrutins et des votes individuels, source officielle :
// Assemblée nationale, open data brut (17e législature).
//
// Le ZIP contient un fichier JSON par scrutin (json/VTANR5L17V{numero}.json),
// avec à la fois les métadonnées (date, titre, résultat) ET le détail
// nominatif complet des votes (qui a voté quoi), organisé par groupe
// politique. Couverture complète : les 8000+ scrutins de la législature en
// cours, avec leur détail nominatif complet (~1 million de lignes de votes
// attendues) — d'où l'insertion par lots plutôt que ligne par ligne, sinon le
// temps d'exécution deviendrait excessif.
//
// Volontairement limité à la législature EN COURS (17e) : les législatures
// précédentes sont closes et ne bougeront plus — un simple lien vers les
// archives officielles suffit plutôt que de dupliquer tout leur historique
// ici (voir la mention correspondante sur les pages /scrutins et /deputes).
//
// Structure confirmée par échantillon réel (voir scrutin.ventilationVotes
// .organe.groupes.groupe[].vote.decompteNominatif.{pours,contres,abstentions,
// nonVotants}.votant[].acteurRef).

import AdmZip from "adm-zip";
import { Buffer } from "node:buffer";

const SCRUTINS_ZIP_URL = "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip";
const SOURCE_LABEL = "Assemblée nationale (open data officiel)";
const LEGISLATURE = 17;
const CHUNK_SIZE = 1000;

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

// Lien vers le dossier legislatif (texte de loi vote), quand disponible
// dans les donnees source (~31% des scrutins - les votes sur un texte
// complet, pas sur un article/amendement isole).
function dossierLegislatifUrl(scrutin) {
  const ref = get(scrutin, "objet.dossierLegislatif.dossierRef");
  if (!ref) return null;
  return `https://www.assemblee-nationale.fr/dyn/${LEGISLATURE}/dossiers/${ref}`;
}
function parseIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
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

export async function ingestScrutins(pool) {
  const res = await fetch(SCRUTINS_ZIP_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => e.entryName.endsWith(".json"));

  // 1) Parser tous les scrutins, garder le JSON complet en mémoire pour la
  // 2e passe (évite de re-décompresser).
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

  // 2) Métadonnées de tous les scrutins, par lots.
  const scrutinRows = parsed.map((scrutin) => [
    LEGISLATURE,
    parseIntOrNull(scrutin.numero),
    scrutin.uid || null,
    scrutin.dateScrutin || null,
    get(scrutin, "typeVote.codeTypeVote") || null,
    get(scrutin, "typeVote.libelleTypeVote") || null,
    get(scrutin, "typeVote.typeMajorite") || null,
    get(scrutin, "sort.code") || null,
    get(scrutin, "sort.libelle") || null,
    scrutin.titre || null,
    get(scrutin, "objet.libelle") || null,
    dossierLegislatifUrl(scrutin),
    SOURCE_LABEL,
  ]);

  let scrutinsInserted = 0;
  for (const batch of chunk(scrutinRows, CHUNK_SIZE)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const values = [];
      const placeholders = batch
        .map((row, i) => {
          const base = i * 13;
          values.push(...row);
          return `(${Array.from({ length: 13 }, (_, j) => `$${base + j + 1}`).join(", ")})`;
        })
        .join(", ");
      await client.query(
        `INSERT INTO scrutins (legislature, numero, scrutin_uid, scrutin_date, type_vote_code,
                                type_vote_label, majority_type, result_code, result_label, title, objet, dossier_legislatif_url, source)
         VALUES ${placeholders}
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
           dossier_legislatif_url = EXCLUDED.dossier_legislatif_url,
           updated_at = now()`,
        values
      );
      await client.query("COMMIT");
      scrutinsInserted += batch.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // 3) Détail nominatif des votes — TOUS les scrutins désormais. On récupère
  // d'abord la liste des députés connus pour filtrer les votes orphelins
  // (contrainte de clé étrangère) avant l'insertion en lot, plutôt que de
  // gérer les erreurs ligne par ligne (bien trop lent à ce volume).
  const knownDeputiesResult = await pool.query("SELECT acteur_uid FROM deputies");
  const knownDeputies = new Set(knownDeputiesResult.rows.map((r) => r.acteur_uid));

  const voteRows = [];
  let votesSkippedNoDeputy = 0;
  for (const scrutin of parsed) {
    const numero = parseIntOrNull(scrutin.numero);
    const votes = extractVotes(scrutin);
    for (const v of votes) {
      if (!knownDeputies.has(v.acteurRef)) {
        votesSkippedNoDeputy += 1;
        continue;
      }
      voteRows.push([LEGISLATURE, numero, v.acteurRef, scrutin.uid || null, v.position, SOURCE_LABEL]);
    }
  }

  let votesInserted = 0;
  for (const batch of chunk(voteRows, CHUNK_SIZE)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const values = [];
      const placeholders = batch
        .map((row, i) => {
          const base = i * 6;
          values.push(...row);
          return `(${Array.from({ length: 6 }, (_, j) => `$${base + j + 1}`).join(", ")})`;
        })
        .join(", ");
      await client.query(
        `INSERT INTO deputy_votes (legislature, numero_scrutin, acteur_uid, scrutin_uid, position, source)
         VALUES ${placeholders}
         ON CONFLICT (legislature, numero_scrutin, acteur_uid)
         DO UPDATE SET scrutin_uid = EXCLUDED.scrutin_uid, position = EXCLUDED.position, updated_at = now()`,
        values
      );
      await client.query("COMMIT");
      votesInserted += batch.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  return { scrutinsInserted, votesInserted, votesSkippedNoDeputy, totalScrutinsFound: parsed.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Téléchargement des scrutins (Assemblée nationale, ~26 Mo, couverture complète — peut prendre plusieurs minutes)...");
  const start = Date.now();
  const result = await ingestScrutins(pool);
  const seconds = Math.round((Date.now() - start) / 1000);
  console.log(
    `Terminé en ${seconds}s : ${result.scrutinsInserted}/${result.totalScrutinsFound} scrutins insérés (métadonnées), ${result.votesInserted} votes détaillés insérés (${result.votesSkippedNoDeputy} ignorés, député non trouvé).`
  );
  await pool.end();
}
