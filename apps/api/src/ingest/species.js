// Ingestion des statuts d'extinction des espèces.
// Source : GBIF, qui republie les catégories IUCN Red List sur les occurrences
// dans le cadre d'un accord de collaboration officiel GBIF/IUCN (API ouverte, sans token).
// Voir : https://www.gbif.org/news/3vu7HxLgHTqKtSF69oNqNr
//
// Limite assumée : un échantillon par catégorie (pas la liste complète des ~150 000
// espèces évaluées), suffisant pour illustrer chaque catégorie sans solliciter
// excessivement l'API GBIF à chaque rafraîchissement.

const GBIF_BASE = "https://api.gbif.org/v1";
const CATEGORIES = ["EX", "EW", "CR", "EN", "VU"];
const PER_CATEGORY_LIMIT = 100;
const SOURCE_LABEL = "GBIF (occurrences classées via la collaboration GBIF-IUCN)";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export async function ingestSpecies(pool) {
  // 1. Récupère un échantillon de clés d'espèces par catégorie via la facette d'occurrence.
  const speciesToCategory = new Map();
  for (const category of CATEGORIES) {
    const url = `${GBIF_BASE}/occurrence/search?iucnRedListCategory=${category}&facet=speciesKey&facetLimit=${PER_CATEGORY_LIMIT}&limit=0`;
    const data = await fetchJson(url);
    const facet = data.facets?.[0];
    for (const entry of facet?.counts || []) {
      if (!speciesToCategory.has(entry.name)) {
        speciesToCategory.set(entry.name, category);
      }
    }
  }

  // 2. Résout chaque clé en nom scientifique (+ nom vernaculaire français si disponible).
  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [speciesKey, category] of speciesToCategory) {
      try {
        const species = await fetchJson(`${GBIF_BASE}/species/${speciesKey}`);
        const scientificName = species.canonicalName || species.scientificName;
        if (!scientificName) {
          skipped += 1;
          continue;
        }

        let commonName = null;
        try {
          const vern = await fetchJson(`${GBIF_BASE}/species/${speciesKey}/vernacularNames?language=fr&limit=1`);
          commonName = vern.results?.[0]?.vernacularName || null;
        } catch {
          // Pas de nom vernaculaire disponible : on garde simplement le nom scientifique.
        }

        await client.query(
          `INSERT INTO species_status (scientific_name, common_name, category, source)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (scientific_name)
           DO UPDATE SET
             common_name = EXCLUDED.common_name,
             category = EXCLUDED.category,
             updated_at = now()`,
          [scientificName, commonName, category, SOURCE_LABEL]
        );
        inserted += 1;
      } catch {
        skipped += 1;
      }
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
  console.log("Ingestion des espèces (GBIF) en cours, ceci peut prendre plusieurs minutes...");
  const { inserted, skipped } = await ingestSpecies(pool);
  console.log(`Terminé : ${inserted} espèces insérées/mises à jour, ${skipped} ignorées.`);
  await pool.end();
}
