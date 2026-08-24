// Ingestion des espèces de plantes réellement observées (GBIF
// occurrence/search), par pays (filtre `country=` natif GBIF) et par
// quelques villes/régions pilotes (rectangle géographique, GBIF n'offrant
// pas de filtre "ville"). Vérifie aussi, pour les espèces les plus
// observées, leur présence dans le checklist GlobalTreeSearch (BGCI).
//
// Aucune clé requise. Source et logique vérifiées par appels réels à
// l'API avant écriture (voir commentaire de migration 055) — notamment le
// constat que establishmentMeans/degreeOfEstablishment sont très
// inégalement renseignés selon les pays, d'où les tables *_coverage qui
// stockent ce qui est vraiment disponible plutôt qu'un indicateur
// natif/introduit peu fiable.
//
// Licence GlobalTreeSearch = CC BY-NC 4.0 (non commerciale) — le champ
// in_global_tree_search est un simple constat de présence, jamais une
// recommandation d'essence.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import countriesLib from "i18n-iso-countries";

// Même pattern que routes/kitCommunication.js : les tables stockent les
// codes ISO3, i18n-iso-countries les résout directement (pas besoin de
// repasser par l'alpha-2 pour le nom, seulement pour les appels GBIF).
function localizeCountryNameFr(code) {
  if (!code) return code;
  return countriesLib.getName(code, "fr", { select: "official" }) || code;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLACES_SEED = JSON.parse(
  readFileSync(join(__dirname, "species_observation_places_seed.json"), "utf-8")
);

const GBIF_BASE = "https://api.gbif.org/v1";
const KINGDOM_PLANTAE = 6;
const GLOBAL_TREE_SEARCH_DATASET_KEY = "7cfcd73b-03ae-476b-a61c-872d36b6c38f";
const TOP_SPECIES_PER_ZONE = 15;
const MAX_SPECIES_GTS_CHECKS = 800; // plafond de vérifications GlobalTreeSearch par exécution

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildBBoxWKT(lat, lon, demiCoteDeg) {
  const latMin = lat - demiCoteDeg;
  const latMax = lat + demiCoteDeg;
  const lonMin = lon - demiCoteDeg;
  const lonMax = lon + demiCoteDeg;
  return `POLYGON((${lonMin} ${latMin}, ${lonMax} ${latMin}, ${lonMax} ${latMax}, ${lonMin} ${latMax}, ${lonMin} ${latMin}))`;
}

const OCCURRENCE_FILTERS = `kingdomKey=${KINGDOM_PLANTAE}&basisOfRecord=HUMAN_OBSERVATION&hasCoordinate=true`;

async function fetchTopSpecies(zoneFilter) {
  const url = `${GBIF_BASE}/occurrence/search?${zoneFilter}&${OCCURRENCE_FILTERS}&limit=0&facet=scientificName&facetLimit=${TOP_SPECIES_PER_ZONE}`;
  const data = await fetchJson(url);
  const facet = data.facets?.find((f) => f.field === "SCIENTIFIC_NAME");
  return facet ? facet.counts : [];
}

async function fetchCoverage(zoneFilter) {
  const url = `${GBIF_BASE}/occurrence/search?${zoneFilter}&${OCCURRENCE_FILTERS}&limit=0&facet=establishmentMeans&facet=degreeOfEstablishment&facetLimit=20`;
  const data = await fetchJson(url);
  const em = data.facets?.find((f) => f.field === "ESTABLISHMENT_MEANS");
  const de = data.facets?.find((f) => f.field === "DEGREE_OF_ESTABLISHMENT");
  const sum = (facet) => (facet ? facet.counts.reduce((s, c) => s + c.count, 0) : 0);
  return {
    total: data.count,
    establishmentMeansCount: sum(em),
    degreeOfEstablishmentCount: sum(de),
  };
}

async function checkGlobalTreeSearch(scientificName, cache) {
  if (cache.has(scientificName)) return cache.get(scientificName);
  let present = false;
  try {
    const url = `${GBIF_BASE}/species/search?datasetKey=${GLOBAL_TREE_SEARCH_DATASET_KEY}&q=${encodeURIComponent(scientificName)}&limit=1`;
    const data = await fetchJson(url);
    present = (data.results || []).length > 0;
  } catch (err) {
    console.error(`[speciesObservations] erreur GlobalTreeSearch pour "${scientificName}":`, err.message);
  }
  cache.set(scientificName, present);
  return present;
}

export async function ingestSpeciesObservations(pool) {
  const countryRows = await pool.query(`
    SELECT DISTINCT country_code FROM co2_emissions
    UNION
    SELECT DISTINCT country_code FROM power_plants
  `);
  const countryCodes3 = countryRows.rows.map((r) => r.country_code);

  const gtsCache = new Map();
  let gtsChecksUsed = 0;

  let countriesProcessed = 0;
  let countriesSkipped = 0;
  let placesProcessed = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const iso3 of countryCodes3) {
      const iso2 = toAlpha2(iso3);
      if (!iso2) {
        countriesSkipped += 1;
        continue;
      }
      const zoneFilter = `country=${iso2}`;

      let topSpecies;
      let coverage;
      try {
        topSpecies = await fetchTopSpecies(zoneFilter);
        await sleep(300);
        coverage = await fetchCoverage(zoneFilter);
        await sleep(300);
      } catch (err) {
        console.error(`[speciesObservations] ${iso3} fetch error:`, err.message);
        countriesSkipped += 1;
        continue;
      }

      const countryName = localizeCountryNameFr(iso3) || iso3;

      await client.query(
        `INSERT INTO species_observations_coverage
           (country_code, country_name, total_occurrences, establishment_means_count, degree_of_establishment_count)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (country_code)
         DO UPDATE SET
           country_name = EXCLUDED.country_name,
           total_occurrences = EXCLUDED.total_occurrences,
           establishment_means_count = EXCLUDED.establishment_means_count,
           degree_of_establishment_count = EXCLUDED.degree_of_establishment_count,
           updated_at = now()`,
        [iso3, countryName, coverage.total, coverage.establishmentMeansCount, coverage.degreeOfEstablishmentCount]
      );

      await client.query("DELETE FROM species_observations_countries WHERE country_code = $1", [iso3]);

      let rank = 0;
      for (const sp of topSpecies) {
        rank += 1;
        let inGts = false;
        if (gtsChecksUsed < MAX_SPECIES_GTS_CHECKS) {
          inGts = await checkGlobalTreeSearch(sp.name, gtsCache);
          gtsChecksUsed += 1;
          await sleep(300);
        } else if (gtsCache.has(sp.name)) {
          inGts = gtsCache.get(sp.name);
        }
        await client.query(
          `INSERT INTO species_observations_countries
             (country_code, scientific_name, observation_count, in_global_tree_search, rank)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (country_code, scientific_name)
           DO UPDATE SET observation_count = EXCLUDED.observation_count,
             in_global_tree_search = EXCLUDED.in_global_tree_search,
             rank = EXCLUDED.rank, updated_at = now()`,
          [iso3, sp.name, sp.count, inGts, rank]
        );
      }

      countriesProcessed += 1;
    }

    for (const place of PLACES_SEED) {
      const wkt = buildBBoxWKT(place.lat, place.lon, place.demiCoteDeg);
      const zoneFilter = `geometry=${encodeURIComponent(wkt)}`;

      let topSpecies;
      let coverage;
      try {
        topSpecies = await fetchTopSpecies(zoneFilter);
        await sleep(300);
        coverage = await fetchCoverage(zoneFilter);
        await sleep(300);
      } catch (err) {
        console.error(`[speciesObservations] lieu "${place.slug}" fetch error:`, err.message);
        continue;
      }

      const placeResult = await client.query(
        `INSERT INTO species_observation_places (slug, name, country_code, contexte, lat, lon, demi_cote_deg)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (slug)
         DO UPDATE SET name = EXCLUDED.name, country_code = EXCLUDED.country_code,
           contexte = EXCLUDED.contexte, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
           demi_cote_deg = EXCLUDED.demi_cote_deg
         RETURNING id`,
        [place.slug, place.name, place.countryCode, place.contexte, place.lat, place.lon, place.demiCoteDeg]
      );
      const placeId = placeResult.rows[0].id;

      await client.query(
        `INSERT INTO species_observation_places_coverage
           (place_id, total_occurrences, establishment_means_count, degree_of_establishment_count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (place_id)
         DO UPDATE SET total_occurrences = EXCLUDED.total_occurrences,
           establishment_means_count = EXCLUDED.establishment_means_count,
           degree_of_establishment_count = EXCLUDED.degree_of_establishment_count,
           updated_at = now()`,
        [placeId, coverage.total, coverage.establishmentMeansCount, coverage.degreeOfEstablishmentCount]
      );

      await client.query("DELETE FROM species_observation_places_species WHERE place_id = $1", [placeId]);

      let rank = 0;
      for (const sp of topSpecies) {
        rank += 1;
        let inGts = false;
        if (gtsChecksUsed < MAX_SPECIES_GTS_CHECKS) {
          inGts = await checkGlobalTreeSearch(sp.name, gtsCache);
          gtsChecksUsed += 1;
          await sleep(300);
        } else if (gtsCache.has(sp.name)) {
          inGts = gtsCache.get(sp.name);
        }
        await client.query(
          `INSERT INTO species_observation_places_species
             (place_id, scientific_name, observation_count, in_global_tree_search, rank)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (place_id, scientific_name)
           DO UPDATE SET observation_count = EXCLUDED.observation_count,
             in_global_tree_search = EXCLUDED.in_global_tree_search, rank = EXCLUDED.rank`,
          [placeId, sp.name, sp.count, inGts, rank]
        );
      }

      placesProcessed += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { countriesProcessed, countriesSkipped, placesProcessed, gtsChecksUsed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Ingestion des espèces observées (GBIF) — pays + lieux pilotes, cela peut prendre plusieurs minutes...");
  const result = await ingestSpeciesObservations(pool);
  console.log(
    `Terminé : ${result.countriesProcessed} pays traités (${result.countriesSkipped} ignorés), ` +
      `${result.placesProcessed} lieux pilotes, ${result.gtsChecksUsed} vérifications GlobalTreeSearch.`
  );
  await pool.end();
}
