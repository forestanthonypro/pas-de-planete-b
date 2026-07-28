// Ingestion des comptages officiels d'espèces menacées par pays (mammifères,
// oiseaux, poissons — IUCN Red List / UNEP-WCMC, via Banque mondiale) et du
// référentiel mondial de % d'espèces menacées par grand groupe taxonomique.
//
// Différence importante avec le module "espèces" existant : ceci est un
// comptage officiel issu des évaluations IUCN, pas un échantillon d'occurrences
// GBIF — mais il ne couvre que mammifères/oiseaux/poissons (les seuls groupes
// pour lesquels la Banque mondiale publie un comptage par pays), et ce sont des
// comptages absolus, pas des pourcentages : aucune source fiable ne publie le
// nombre total d'espèces présentes par pays pour calculer un vrai %.

import { parse } from "csv-parse/sync";

const MAMMAL_URL = "https://ourworldindata.org/grapher/threatened-mammal-species.csv?v=1&csvType=full&useColumnShortNames=false";
const BIRD_URL = "https://ourworldindata.org/grapher/threatened-bird-species.csv?v=1&csvType=full&useColumnShortNames=false";
const FISH_URL = "https://ourworldindata.org/grapher/fish-species-threatened.csv?v=1&csvType=full&useColumnShortNames=false";
const GLOBAL_SHARE_URL = "https://ourworldindata.org/grapher/share-threatened-species.csv?v=1&csvType=full&useColumnShortNames=false";
const GLOBAL_COUNT_URL = "https://ourworldindata.org/grapher/number-species-threatened.csv?v=1&csvType=full&useColumnShortNames=false";

const SOURCE_LABEL = "IUCN Red List / UNEP-WCMC via Banque mondiale, via Our World in Data";
const ISO3_RE = /^[A-Z]{3}$/;

async function fetchCsvRows(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Échec du téléchargement (${url}) : ${res.status} ${res.statusText}`);
  const text = await res.text();
  return parse(text, { columns: true, skip_empty_lines: true });
}

export async function ingestSpeciesThreatened(pool) {
  const [mammalRows, birdRows, fishRows, globalShareRows, globalCountRows] = await Promise.all([
    fetchCsvRows(MAMMAL_URL),
    fetchCsvRows(BIRD_URL),
    fetchCsvRows(FISH_URL),
    fetchCsvRows(GLOBAL_SHARE_URL),
    fetchCsvRows(GLOBAL_COUNT_URL),
  ]);

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    async function upsertCountColumn(rows, columnName, dbColumn) {
      for (const row of rows) {
        const isoCode = (row.Code || "").trim().toUpperCase();
        const year = parseInt(row.Year, 10);
        const raw = row[columnName];
        const value = raw === "" || raw === undefined ? null : parseInt(raw, 10);
        if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || value === null || Number.isNaN(value)) {
          skipped += 1;
          continue;
        }
        await client.query(
          `INSERT INTO species_threatened_counts (country_code, country_name, year, ${dbColumn}, source)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (country_code, year)
           DO UPDATE SET
             ${dbColumn} = EXCLUDED.${dbColumn},
             country_name = EXCLUDED.country_name,
             updated_at = now()`,
          [isoCode, row.Entity, year, value, SOURCE_LABEL]
        );
        inserted += 1;
      }
    }

    await upsertCountColumn(mammalRows, "Mammal species, threatened", "mammals_threatened");
    await upsertCountColumn(birdRows, "Bird species, threatened", "birds_threatened");
    await upsertCountColumn(fishRows, "Fish species, threatened", "fish_threatened");

    // Comptage absolu, à recouper par groupe taxonomique (Entity) avec le %
    // déjà récupéré ci-dessus — colonne exacte non garantie d'une version à
    // l'autre du jeu de données OWID, d'où la recherche défensive du nom de
    // colonne plutôt qu'un nom figé.
    const countByEntity = {};
    if (globalCountRows.length > 0) {
      const countCol = Object.keys(globalCountRows[0]).find(
        (k) => k !== "Entity" && k !== "Code" && k !== "Year" && /threat/i.test(k)
      );
      if (countCol) {
        for (const row of globalCountRows) {
          const value = row[countCol] === "" || row[countCol] === undefined ? null : parseInt(row[countCol], 10);
          if (row.Entity && value !== null && !Number.isNaN(value)) {
            countByEntity[row.Entity] = value;
          }
        }
      }
    }

    const shareCol = "Share of species threatened with extinction";
    for (const row of globalShareRows) {
      const year = parseInt(row.Year, 10);
      const value = row[shareCol] === "" || row[shareCol] === undefined ? null : parseFloat(row[shareCol]);
      if (!row.Entity || value === null || Number.isNaN(value)) {
        skipped += 1;
        continue;
      }
      await client.query(
        `INSERT INTO species_threatened_global_share (taxon_group, share_percent, species_count, year, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (taxon_group)
         DO UPDATE SET
           share_percent = EXCLUDED.share_percent,
           species_count = EXCLUDED.species_count,
           year = EXCLUDED.year,
           updated_at = now()`,
        [row.Entity, value, countByEntity[row.Entity] ?? null, Number.isNaN(year) ? null : year, "IUCN Red List Summary Statistics, via Our World in Data"]
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
  console.log("Téléchargement des données espèces menacées (comptages + référentiel mondial)...");
  const { inserted, skipped } = await ingestSpeciesThreatened(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
