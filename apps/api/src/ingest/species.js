// Ingestion des statuts d'extinction des espèces, avec liaison par pays.
// Source : GBIF, qui republie les catégories IUCN Red List sur les occurrences
// dans le cadre d'un accord de collaboration officiel GBIF/IUCN (API ouverte, sans token).
// Voir : https://www.gbif.org/news/3vu7HxLgHTqKtSF69oNqNr
//
// Limites assumées, documentées côté interface :
// - un échantillon par pays et par catégorie (pas la liste complète des espèces évaluées)
// - au plus MAX_SPECIES_RESOLVED espèces résolues en détail par exécution
// - GBIF ne fournit pas toujours de nom vernaculaire français, même quand il existe
//   ailleurs (Wikipédia, INPN...) : species_common_names_overrides.json comble ce manque
//   manuellement et est prioritaire sur ce que GBIF renvoie. À enrichir au fil du temps.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import countriesLib from "i18n-iso-countries";

const __dirname = dirname(fileURLToPath(import.meta.url));
const overrides = JSON.parse(
  readFileSync(join(__dirname, "species_common_names_overrides.json"), "utf-8")
);

const GBIF_BASE = "https://api.gbif.org/v1";
const CATEGORIES = ["EX", "EW", "CR", "EN", "VU"];
const PER_COUNTRY_CATEGORY_LIMIT = 5;
const MAX_SPECIES_RESOLVED = 1500;
const SOURCE_LABEL = "GBIF (occurrences classées via la collaboration GBIF-IUCN)";

// GBIF ne renvoie pas toujours des codes de langue ISO 639-1 (fr, en...) — certaines
// entrées utilisent le code ISO 639-2 à 3 lettres (fra, eng...). On accepte les deux.
const LANGUAGE_CODES = {
  fr: ["fr", "fra"],
  en: ["en", "eng"],
  es: ["es", "spa"],
  de: ["de", "deu", "ger"],
};

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

function resolveCommonNames(scientificName, gbifVernacularResults) {
  const names = {};
  for (const [lang, codes] of Object.entries(LANGUAGE_CODES)) {
    const match = gbifVernacularResults?.find(
      (v) => codes.includes((v.language || "").toLowerCase()) && v.vernacularName
    );
    if (match) names[lang] = match.vernacularName;
  }
  // Les correspondances manuelles priment sur ce que GBIF a pu fournir.
  const manual = overrides[scientificName];
  if (manual) Object.assign(names, manual);
  return names;
}

export async function ingestSpecies(pool) {
  const countryRows = await pool.query(`
    SELECT DISTINCT country_code FROM co2_emissions
    UNION
    SELECT DISTINCT country_code FROM power_plants
  `);
  const countryCodes3 = countryRows.rows.map((r) => r.country_code);

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
        continue;
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

        let vernacularResults = [];
        try {
          const vern = await fetchJson(`${GBIF_BASE}/species/${gbifKey}/vernacularNames?limit=50`);
          vernacularResults = vern.results || [];
        } catch {
          // Pas de noms vernaculaires disponibles côté GBIF : on se rabat sur les overrides.
        }
        const commonNames = resolveCommonNames(scientificName, vernacularResults);

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
