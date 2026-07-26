// Ingestion des statuts d'extinction des espèces, avec liaison par pays.
// Source : GBIF, qui republie les catégories IUCN Red List sur les occurrences
// dans le cadre d'un accord de collaboration officiel GBIF/IUCN (API ouverte, sans token).
// Voir : https://www.gbif.org/news/3vu7HxLgHTqKtSF69oNqNr
//
// Limites assumées, documentées côté interface :
// - un échantillon par pays et par catégorie (pas la liste complète des espèces évaluées)
// - au plus MAX_SPECIES_RESOLVED espèces résolues en détail par exécution,
//   pour garder un temps d'exécution raisonnable et rester respectueux de l'API GBIF.

import countriesLib from "i18n-iso-countries";

const GBIF_BASE = "https://api.gbif.org/v1";
const CATEGORIES = ["EX", "EW", "CR", "EN", "VU"];
const PER_COUNTRY_CATEGORY_LIMIT = 5;
const MAX_SPECIES_RESOLVED = 1500;
const TARGET_LANGUAGES = ["fr", "en", "es", "de"];
const SOURCE_LABEL = "GBIF (occurrences classées via la collaboration GBIF-IUCN)";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function toAlpha2(iso3) {
  try {
    return countriesLib.alpha3ToAlpha2(iso3);
  } catch {
    return null;
  }
}

export async function ingestSpecies(pool) {
  // 1. Périmètre des pays : ceux déjà suivis via CO2 ou énergie (pas les ~195 pays du monde
  //    d'un coup, pour garder le nombre de requêtes GBIF raisonnable).
  const countryRows = await pool.query(`
    SELECT DISTINCT country_code FROM co2_emissions
    UNION
    SELECT DISTINCT country_code FROM power_plants
  `);
  const countryCodes3 = countryRows.rows.map((r) => r.country_code);

  // gbifKey -> { category, countries: Set<alpha3> }
  const speciesMap = new Map();

  for (const iso3 of countryCodes3) {
    const iso2 = toAlpha2(iso3);
    if (!iso2) continue;

    for (const category of CATEGORIES) {
      const url = `${GBIF_BASE}/occurrence/search?country=${iso2}&iucnRedListCategory=${category}&facet=speciesKey&facetLimit=${PER_COUNTRY_CATEGORY_LIMIT}&limit=0`;
      let data;
      try {
        data = await fetchJson(url);
      } catch {
        continue; // un pays en erreur ponctuelle ne doit pas interrompre tout le run
      }
      const facet = data.facets?.[0];
      for (const entry of facet?.counts || []) {
        const key = entry.name;
        if (!speciesMap.has(key)) {
          speciesMap.set(key, { category, countries: new Set() });
        }
        speciesMap.get(key).countries.add(iso3);
      }
    }
  }

  // 2. Résolution des espèces (nom, règne, noms vernaculaires), bornée à MAX_SPECIES_RESOLVED.
  let inserted = 0;
  let skipped = 0;
  let countryLinks = 0;
  let processed = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [gbifKey, { category, countries }] of speciesMap) {
      if (processed >= MAX_SPECIES_RESOLVED) break;
      processed += 1;

      try {
        const species = await fetchJson(`${GBIF_BASE}/species/${gbifKey}`);
        const scientificName = species.canonicalName || species.scientificName;
        if (!scientificName) {
          skipped += 1;
          continue;
        }
        const kingdom = species.kingdom || null;

        const commonNames = {};
        try {
          const vern = await fetchJson(`${GBIF_BASE}/species/${gbifKey}/vernacularNames?limit=50`);
          for (const lang of TARGET_LANGUAGES) {
            const match = vern.results?.find((v) => v.language === lang && v.vernacularName);
            if (match) commonNames[lang] = match.vernacularName;
          }
        } catch {
          // Pas de noms vernaculaires disponibles : on garde un objet vide.
        }

        await client.query(
          `INSERT INTO species_status (gbif_key, scientific_name, kingdom, category, common_names, source)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (gbif_key)
           DO UPDATE SET
             scientific_name = EXCLUDED.scientific_name,
             kingdom = EXCLUDED.kingdom,
             category = EXCLUDED.category,
             common_names = EXCLUDED.common_names,
             updated_at = now()`,
          [gbifKey, scientificName, kingdom, category, JSON.stringify(commonNames), SOURCE_LABEL]
        );
        inserted += 1;

        for (const countryCode of countries) {
          await client.query(
            `INSERT INTO species_countries (gbif_key, country_code)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [gbifKey, countryCode]
          );
          countryLinks += 1;
        }
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

  return { inserted, skipped, countryLinks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Ingestion des espèces par pays (GBIF) en cours — cela peut prendre plusieurs minutes...");
  const { inserted, skipped, countryLinks } = await ingestSpecies(pool);
  console.log(`Terminé : ${inserted} espèces, ${countryLinks} liens pays-espèce, ${skipped} ignorées.`);
  await pool.end();
}
