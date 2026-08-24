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
// Même fichier d'overrides que species.js (ingestion des statuts d'extinction) —
// pas de duplication, les deux ingestions bénéficient des mêmes corrections
// manuelles.
const NAME_OVERRIDES = JSON.parse(
  readFileSync(join(__dirname, "species_common_names_overrides.json"), "utf-8")
);

// Couvre les 8 langues du site. GBIF ne renvoie pas toujours un code ISO
// 639-1 à 2 lettres — certaines entrées utilisent le code à 3 lettres
// (ISO 639-2/3). On accepte les deux formes, vérifié par appel réel
// (species/8351737/vernacularNames — Hedera helix) avant écriture.
const LANGUAGE_CODES = {
  fr: ["fr", "fra"],
  en: ["en", "eng"],
  es: ["es", "spa"],
  it: ["it", "ita"],
  ru: ["ru", "rus"],
  ja: ["ja", "jpn"],
  zh: ["zh", "zho", "chi"],
  hi: ["hi", "hin"],
};

const GBIF_BASE = "https://api.gbif.org/v1";
const KINGDOM_PLANTAE = 6;
const GLOBAL_TREE_SEARCH_DATASET_KEY = "7cfcd73b-03ae-476b-a61c-872d36b6c38f";
const TOP_SPECIES_PER_ZONE = 15;
const MAX_SPECIES_GTS_CHECKS = 800; // plafond de vérifications GlobalTreeSearch + noms communs par exécution

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// Avec ~200 pays et plusieurs centaines d'espèces sur une exécution de
// 10-15 minutes, un échec réseau ponctuel est attendu. Sans retry, une
// espèce très commune (ex. Hedera helix, la plus observée en France) peut
// perdre son nom commun pour toute l'exécution si un seul appel échoue au
// mauvais moment — d'où ce petit retry avant d'abandonner.
async function fetchJsonWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(500 * (i + 1)); // 500ms, puis 1000ms
    }
  }
  throw lastErr;
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

// Retourne { present, ok }. ok=false signifie un échec réseau (à ne pas
// mettre en cache définitivement) ; present=false avec ok=true signifie
// une vraie réponse GBIF ne trouvant rien dans GlobalTreeSearch.
async function checkGlobalTreeSearch(scientificName) {
  try {
    const url = `${GBIF_BASE}/species/search?datasetKey=${GLOBAL_TREE_SEARCH_DATASET_KEY}&q=${encodeURIComponent(scientificName)}&limit=1`;
    const data = await fetchJsonWithRetry(url);
    return { present: (data.results || []).length > 0, ok: true };
  } catch (err) {
    console.error(`[speciesObservations] erreur GlobalTreeSearch pour "${scientificName}" (abandon après retry):`, err.message);
    return { present: false, ok: false };
  }
}

function resolveCommonNames(scientificName, vernacularResults) {
  const names = {};
  for (const [lang, codes] of Object.entries(LANGUAGE_CODES)) {
    const match = vernacularResults?.find(
      (v) => codes.includes((v.language || "").toLowerCase()) && v.vernacularName
    );
    if (match) names[lang] = match.vernacularName;
  }
  // Les correspondances manuelles priment sur ce que GBIF a pu fournir.
  const manual = NAME_OVERRIDES[scientificName];
  if (manual) Object.assign(names, manual);
  return names;
}

// Retourne { names, ok } — même logique ok=false que checkGlobalTreeSearch :
// un échec sur l'un ou l'autre des deux appels GBIF (match puis
// vernacularNames) n'est jamais mis en cache comme "pas de nom commun".
async function fetchCommonNames(scientificName) {
  try {
    const matchUrl = `${GBIF_BASE}/species/match?name=${encodeURIComponent(scientificName)}&kingdom=Plantae`;
    const match = await fetchJsonWithRetry(matchUrl);
    if (!match.usageKey) return { names: {}, ok: true }; // réponse valide, juste aucune correspondance GBIF
    await sleep(300); // pas de rafale sans pause entre les deux appels species/* — cause identifiée d'échecs 429
    const vernUrl = `${GBIF_BASE}/species/${match.usageKey}/vernacularNames?limit=50`;
    const vern = await fetchJsonWithRetry(vernUrl);
    return { names: resolveCommonNames(scientificName, vern.results || []), ok: true };
  } catch (err) {
    console.error(`[speciesObservations] erreur noms communs pour "${scientificName}" (abandon après retry):`, err.message);
    return { names: {}, ok: false };
  }
}

// Résout en une fois, pour un nom scientifique donné, sa présence dans
// GlobalTreeSearch et ses noms communs — mis en cache par nom scientifique
// pour ne jamais refaire ces appels quand la même espèce revient dans
// plusieurs pays/lieux (très fréquent : Hedera helix apparaît dans presque
// toutes les zones tempérées testées). Un échec réseau (même après retry)
// n'est PAS mis en cache : la prochaine occurrence de la même espèce
// retentera plutôt que de rester bloquée sur un résultat vide pour toute
// l'exécution.
async function enrichSpecies(scientificName, cache) {
  if (cache.has(scientificName)) return cache.get(scientificName);
  const gts = await checkGlobalTreeSearch(scientificName);
  await sleep(300);
  const common = await fetchCommonNames(scientificName);
  await sleep(300);
  const result = { inGts: gts.present, commonNames: common.names };
  if (gts.ok && common.ok) {
    cache.set(scientificName, result);
  }
  return result;
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
        let commonNames = {};
        if (gtsChecksUsed < MAX_SPECIES_GTS_CHECKS) {
          const enriched = await enrichSpecies(sp.name, gtsCache);
          inGts = enriched.inGts;
          commonNames = enriched.commonNames;
          gtsChecksUsed += 1;
        } else if (gtsCache.has(sp.name)) {
          const cached = gtsCache.get(sp.name);
          inGts = cached.inGts;
          commonNames = cached.commonNames;
        }
        await client.query(
          `INSERT INTO species_observations_countries
             (country_code, scientific_name, observation_count, in_global_tree_search, common_names, rank)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (country_code, scientific_name)
           DO UPDATE SET observation_count = EXCLUDED.observation_count,
             in_global_tree_search = EXCLUDED.in_global_tree_search,
             common_names = EXCLUDED.common_names,
             rank = EXCLUDED.rank, updated_at = now()`,
          [iso3, sp.name, sp.count, inGts, JSON.stringify(commonNames), rank]
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
        let commonNames = {};
        if (gtsChecksUsed < MAX_SPECIES_GTS_CHECKS) {
          const enriched = await enrichSpecies(sp.name, gtsCache);
          inGts = enriched.inGts;
          commonNames = enriched.commonNames;
          gtsChecksUsed += 1;
        } else if (gtsCache.has(sp.name)) {
          const cached = gtsCache.get(sp.name);
          inGts = cached.inGts;
          commonNames = cached.commonNames;
        }
        await client.query(
          `INSERT INTO species_observation_places_species
             (place_id, scientific_name, observation_count, in_global_tree_search, common_names, rank)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (place_id, scientific_name)
           DO UPDATE SET observation_count = EXCLUDED.observation_count,
             in_global_tree_search = EXCLUDED.in_global_tree_search,
             common_names = EXCLUDED.common_names, rank = EXCLUDED.rank`,
          [placeId, sp.name, sp.count, inGts, JSON.stringify(commonNames), rank]
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
