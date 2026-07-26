// Ingestion des feux actifs récents (détections satellite quasi temps réel).
// Source : NASA FIRMS (MODIS_NRT), API publique et ouverte, sans restriction d'usage —
// nécessite une clé MAP_KEY gratuite (inscription : https://firms.modaps.eosdis.nasa.gov/api/map_key/).
//
// Note technique : l'endpoint documenté /api/country/ (par code pays) renvoie désormais
// une erreur générique côté FIRMS, y compris sans clé — signe d'un changement non
// documenté de leur part. On utilise donc /api/area/ (confirmé fonctionnel) avec une
// zone géographique par pays, voir country_bboxes.js pour la liste couverte.
//
// Particularité par rapport aux autres ingestions : ces données sont transitoires par
// nature (un feu d'il y a deux semaines n'a plus d'intérêt "temps réel"), donc on
// remplace entièrement le contenu de la table à chaque exécution plutôt que de faire
// un upsert cumulatif comme pour le CO2/l'énergie/les espèces.

import { parse } from "csv-parse/sync";
import { COUNTRY_BBOXES } from "./country_bboxes.js";

const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const SOURCE_DATASET = "MODIS_NRT";
const DAY_RANGE = 3;
const SOURCE_LABEL = "NASA FIRMS (MODIS_NRT)";

async function fetchCsv(url) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} : ${text.slice(0, 200)}`);
  if (!text.includes(",")) throw new Error(`Réponse inattendue : ${text.slice(0, 200)}`);
  return parse(text, { columns: true, skip_empty_lines: true });
}

export async function ingestFires(pool) {
  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    throw new Error(
      "FIRMS_MAP_KEY manquant : inscrivez-vous gratuitement sur https://firms.modaps.eosdis.nasa.gov/api/map_key/ et ajoutez la clé dans .env"
    );
  }

  const allFires = [];
  const sampleErrors = [];
  let countriesSkipped = 0;

  for (const [iso3, bbox] of Object.entries(COUNTRY_BBOXES)) {
    const url = `${FIRMS_BASE}/${mapKey}/${SOURCE_DATASET}/${bbox.join(",")}/${DAY_RANGE}`;
    try {
      const rows = await fetchCsv(url);
      for (const row of rows) {
        const lat = parseFloat(row.latitude);
        const lon = parseFloat(row.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

        const detectedAt = new Date(
          `${row.acq_date}T${String(row.acq_time).padStart(4, "0").slice(0, 2)}:${String(row.acq_time).padStart(4, "0").slice(2)}:00Z`
        );
        allFires.push({
          detectedAt,
          lat,
          lon,
          confidence: row.confidence !== undefined && row.confidence !== "" ? parseFloat(row.confidence) : null,
          frp: row.frp !== undefined && row.frp !== "" ? parseFloat(row.frp) : null,
          countryCode: iso3,
        });
      }
    } catch (err) {
      countriesSkipped += 1;
      if (sampleErrors.length < 3) sampleErrors.push(`${iso3} : ${err.message}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM fires");

    for (const fire of allFires) {
      await client.query(
        `INSERT INTO fires (detected_at, location, confidence, frp, source, country_code)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7)`,
        [fire.detectedAt, fire.lon, fire.lat, fire.confidence, fire.frp, SOURCE_LABEL, fire.countryCode]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { inserted: allFires.length, countriesSkipped, sampleErrors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Ingestion des feux actifs (NASA FIRMS) en cours...");
  const { inserted, countriesSkipped, sampleErrors } = await ingestFires(pool);
  console.log(`Terminé : ${inserted} détections, ${countriesSkipped} pays ignorés (erreur).`);
  if (sampleErrors?.length) {
    console.log("Exemples d'erreurs rencontrées :");
    sampleErrors.forEach((e) => console.log(`  - ${e}`));
  }
  await pool.end();
}
