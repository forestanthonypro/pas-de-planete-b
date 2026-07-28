// Ingestion de la liste complète des députés en mandat (17e législature),
// source officielle : Assemblée nationale, open data brut (format complexe,
// contrairement aux autres sources plus simples utilisées ailleurs dans ce
// projet). Remplace la version précédente basée sur CIVIX (limitée à ~100
// députés sur 577) par la liste complète.
//
// Le ZIP contient un fichier JSON par acteur (acteurs/PA*.json) et un par
// organe (organes/PO*.json, incluant les groupes politiques). Il faut
// recouper les deux pour retrouver le groupe politique actuel de chaque
// député, puisque le mandat ne référence l'organe que par un identifiant.
//
// AVERTISSEMENT : le schéma exact n'a pas pu être vérifié en direct au moment
// de l'écriture (l'environnement de développement ne peut pas accéder à ce
// domaine) — le parsing ci-dessous est écrit à partir de la documentation
// connue du format (stable depuis ~2015) mais un premier test réel peut
// révéler un ajustement de noms de champs à faire. Le script logue la
// structure brute du premier acteur rencontré pour faciliter ce diagnostic.

import AdmZip from "adm-zip";

const DEPUTIES_ZIP_URL =
  "https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip";
const SOURCE_LABEL = "Assemblée nationale (open data officiel)";
const LEGISLATURE = 17;

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

export async function ingestDeputies(pool) {
  const res = await fetch(DEPUTIES_ZIP_URL);
  if (!res.ok) throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // 1) Charger tous les organes (pour résoudre les noms de groupes politiques)
  const organesByUid = {};
  for (const entry of entries) {
    if (!entry.entryName.startsWith("json/organe/") || !entry.entryName.endsWith(".json")) continue;
    try {
      const data = JSON.parse(entry.getData().toString("utf8"));
      const organe = data.organe || data;
      const uid = get(organe, "uid") || get(organe, "uid.#text");
      if (!uid) continue;
      organesByUid[uid] = {
        libelle: organe.libelle || get(organe, "libelleEdition") || null,
        libelleAbrev: organe.libelleAbrev || null,
        codeType: organe.codeType || null,
      };
    } catch {
      // Fichier organe illisible — ignoré, ne bloque pas le reste.
    }
  }

  // 2) Charger tous les acteurs (députés)
  let inserted = 0;
  let skipped = 0;
  let diagnosticLogged = false;
  let electionDiagLogged = false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const entry of entries) {
      if (!entry.entryName.startsWith("json/acteur/") || !entry.entryName.endsWith(".json")) continue;

      let data;
      try {
        data = JSON.parse(entry.getData().toString("utf8"));
      } catch {
        skipped += 1;
        continue;
      }

      if (!diagnosticLogged) {
        console.log("--- Diagnostic : structure du premier acteur rencontré ---");
        console.log(JSON.stringify(data).slice(0, 2000));
        diagnosticLogged = true;
      }

      const acteur = data.acteur || data;
      const uid = get(acteur, "uid.#text") || get(acteur, "uid") || null;
      if (!uid) {
        skipped += 1;
        continue;
      }

      const ident = get(acteur, "etatCivil.ident") || {};
      const firstName = ident.prenom || null;
      const lastName = ident.nom || null;
      const fullName = `${firstName || ""} ${lastName || ""}`.trim() || uid;

      // Cherche, parmi les mandats, celui de type "groupe politique" (GP)
      // actuellement actif (sans date de fin, ou date de fin future).
      let mandats = get(acteur, "mandats.mandat") || [];
      if (!Array.isArray(mandats)) mandats = [mandats];
      const now = new Date();
      let groupName = null;
      let groupAbbrev = null;
      let department = null;
      let circoNumber = null;

      for (const mandat of mandats) {
        const typeOrgane = mandat.typeOrgane || get(mandat, "infosQualite.codeQualite");
        const dateFin = mandat.dateFin ? new Date(mandat.dateFin) : null;
        const isActive = !dateFin || dateFin > now;

        if (typeOrgane === "GP" && isActive) {
          const organeRef = get(mandat, "organes.organeRef") || mandat.organeRef;
          const organe = organesByUid[organeRef];
          if (organe) {
            groupName = organe.libelle;
            groupAbbrev = organe.libelleAbrev;
          }
        }
        if (typeOrgane === "ASSEMBLEE" && isActive) {
          const lieu = get(mandat, "election.lieu") || {};
          department = lieu.departement || lieu.region || department;
          const numCirco = lieu.numCirco || lieu.numCirconscription;
          circoNumber = numCirco ? parseInt(numCirco, 10) : circoNumber;

          if (!department && !electionDiagLogged) {
            console.log("--- Diagnostic : mandat ASSEMBLEE sans circonscription résolue ---");
            console.log(JSON.stringify(mandat).slice(0, 800));
            electionDiagLogged = true;
          }
        }
      }

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
        [uid, firstName, lastName, fullName, LEGISLATURE, circoNumber, department, groupName, groupAbbrev, SOURCE_LABEL]
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

  return { inserted, skipped, organesFound: Object.keys(organesByUid).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Téléchargement de la liste complète des députés (Assemblée nationale)...");
  const result = await ingestDeputies(pool);
  console.log(
    `Terminé : ${result.inserted} députés insérés/mis à jour, ${result.skipped} lignes ignorées (${result.organesFound} organes chargés en référence).`
  );
  await pool.end();
}
