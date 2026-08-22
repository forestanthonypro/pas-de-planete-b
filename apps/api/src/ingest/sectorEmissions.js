// Ingestion des émissions de gaz à effet de serre par secteur économique.
// Source : Climate Watch, World Resources Institute (CC BY 4.0).
// API publique documentée : https://www.climatewatchdata.org/data-explorer/
//
// Contrairement à co2.js (un seul fichier CSV téléchargé d'un coup), cette
// API est paginée et interrogée par paramètres (gaz, secteurs, pays,
// années). Écrit de façon défensive (vérifications de forme + logs
// détaillés) : la structure exacte de la réponse JSON n'a pas pu être
// vérifiée en amont (accès direct bloqué par le robots.txt du site pendant
// le développement) — à valider lors du premier vrai lancement, avant
// d'automatiser cette ingestion dans un cron.
//
// Utilisable en CLI (node src/ingest/sectorEmissions.js) ou importée par
// l'API (endpoint admin), sur le même principe que les autres scripts de
// ce dossier.

const API_BASE = "https://www.climatewatchdata.org/api/v1/data/historical_emissions";
const SOURCE_LABEL = "Climate Watch (World Resources Institute)";

// Secteurs de premier niveau qu'on veut conserver — les noms exacts
// utilisés par Climate Watch, à confirmer/ajuster après le premier
// lancement réel si l'un d'eux ne matche pas.
const WANTED_SECTORS = [
  "Energy",
  "Industrial Processes",
  "Agriculture",
  "Waste",
  "Land-Use Change and Forestry",
];

const ISO3_RE = /^[A-Z]{3}$/;

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Échec de la requête ${url} : ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Récupère la liste des secteurs disponibles et ne garde que les IDs
// correspondant à WANTED_SECTORS — plus robuste que de coder des IDs en
// dur, qui pourraient changer ou différer de ce que documente le site.
async function resolveSectorIds() {
  const data = await fetchJson(`${API_BASE}/sectors`);
  const list = Array.isArray(data) ? data : data.data || [];
  console.log(`  ${list.length} secteurs disponibles côté Climate Watch.`);

  const resolved = [];
  for (const wanted of WANTED_SECTORS) {
    const match = list.find((s) => (s.name || s.sector || "").trim().toLowerCase() === wanted.toLowerCase());
    if (match) {
      resolved.push({ id: match.id, name: wanted });
    } else {
      console.warn(`  ⚠️  Secteur "${wanted}" introuvable dans la liste renvoyée par l'API — ignoré. Vérifier le libellé exact.`);
    }
  }
  if (resolved.length === 0) {
    throw new Error("Aucun secteur reconnu — la structure de l'API a probablement changé, vérifier manuellement avant de continuer.");
  }
  return resolved;
}

async function resolveGasId(gasName) {
  const data = await fetchJson(`${API_BASE}/gases`);
  const list = Array.isArray(data) ? data : data.data || [];
  const match = list.find((g) => (g.name || "").trim().toLowerCase() === gasName.toLowerCase());
  if (!match) {
    throw new Error(`Gaz "${gasName}" introuvable — libellés disponibles : ${list.map((g) => g.name).join(", ")}`);
  }
  return match.id;
}

export async function ingestSectorEmissions(pool) {
  console.log("Résolution des identifiants secteurs/gaz auprès de Climate Watch...");
  const sectors = await resolveSectorIds();
  const gasId = await resolveGasId("All GHG");

  let inserted = 0;
  let skipped = 0;
  let page = 1;
  const MAX_PAGES = 50; // garde-fou : ne jamais boucler indéfiniment si la pagination se comporte différemment de ce qui est documenté

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const sector of sectors) {
      console.log(`Secteur "${sector.name}" (id ${sector.id})...`);
      page = 1;
      // Fenêtre volontairement récente (15 dernières années) : au-delà,
      // l'intérêt pour "la part actuelle de l'industrie" est marginal, et
      // ça limite le volume de la première ingestion.
      const startYear = new Date().getFullYear() - 15;

      while (page <= MAX_PAGES) {
        const url = `${API_BASE}?sector_ids[]=${sector.id}&gas_ids[]=${gasId}&start_year=${startYear}&page=${page}`;
        const data = await fetchJson(url);
        const records = Array.isArray(data) ? data : data.data || [];

        if (records.length === 0) break;

        for (const record of records) {
          const isoCode = (record.iso_code3 || record.iso_code || "").trim().toUpperCase();
          if (!ISO3_RE.test(isoCode)) { skipped += 1; continue; }

          const emissionsByYear = record.emissions || record.data || [];
          for (const point of emissionsByYear) {
            const year = parseInt(point.year, 10);
            const value = point.value === null || point.value === undefined || point.value === "" ? null : parseFloat(point.value);
            if (Number.isNaN(year) || value === null) { skipped += 1; continue; }

            await client.query(
              `INSERT INTO sector_emissions (country_code, year, sector, value_mtco2e)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (country_code, year, sector) DO UPDATE SET value_mtco2e = EXCLUDED.value_mtco2e`,
              [isoCode, year, sector.name, value]
            );
            inserted += 1;
          }
        }
        page += 1;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(`Ingestion terminée : ${inserted} lignes insérées/mises à jour, ${skipped} ignorées.`);
  return { inserted, skipped, source: SOURCE_LABEL };
}

// Exécution directe : node src/ingest/sectorEmissions.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const { pool } = await import("../lib/db.js");
  try {
    await ingestSectorEmissions(pool);
    process.exit(0);
  } catch (err) {
    console.error("Échec de l'ingestion :", err);
    process.exit(1);
  }
}
