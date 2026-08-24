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

const COUNTRIES_DEV_BASE = "https://countries.dev";
const CITIES_PER_COUNTRY = 10;

// Récupère jusqu'à `limit` villes d'un pays via countries.dev (gratuit,
// sans clé, données GeoNames CC BY 4.0), triées par population.
async function fetchCitiesForCountry(iso2, limit = 15) {
  try {
    const url = `${COUNTRIES_DEV_BASE}/cities?country=${iso2}&limit=${limit}`;
    const cities = await fetchJsonWithRetry(url);
    return Array.isArray(cities) ? cities : [];
  } catch (err) {
    console.error(`[speciesObservations] erreur villes pour "${iso2}" (abandon après retry):`, err.message);
    return [];
  }
}

// Sélectionne jusqu'à maxCount villes représentatives : les plus peuplées,
// en garantissant que la vraie capitale (featureCode=PPLC) y figure même
// si elle n'est pas parmi les plus peuplées — vérifié en réel sur la
// Suisse (Berne, 5e ville par population, correctement incluse).
function selectRepresentativeCities(cities, maxCount) {
  const capital = cities.find((c) => c.featureCode === "PPLC");
  const top = cities.slice(0, maxCount);
  if (capital && !top.some((c) => c.geonameId === capital.geonameId)) {
    top.pop();
    top.push(capital);
  }
  return top;
}

// Complète les 4 lieux pilotes choisis à la main par jusqu'à 10 villes par
// pays déjà suivi par le site qui n'a pas encore de lieu pilote — pour ne
// jamais dupliquer un lieu déjà couvert (ex. la France a déjà Paris et la
// Lozère, pas besoin d'ajouter Paris une seconde fois via ce mécanisme).
async function buildPlacesList(countryCodes3) {
  const seedCountryCodes = new Set(PLACES_SEED.map((p) => p.countryCode));
  const autoPlaces = [];
  for (const iso3 of countryCodes3) {
    if (seedCountryCodes.has(iso3)) continue;
    const iso2 = toAlpha2(iso3);
    if (!iso2) continue;
    const cities = await fetchCitiesForCountry(iso2, 15);
    await sleep(300);
    const selected = selectRepresentativeCities(cities, CITIES_PER_COUNTRY);
    const countryName = localizeCountryNameFr(iso3) || iso3;
    for (const city of selected) {
      if (typeof city.latitude !== "number" || typeof city.longitude !== "number") continue;
      autoPlaces.push({
        slug: `city-${iso3.toLowerCase()}-${city.geonameId}`,
        name: `${city.name}, ${countryName}`,
        countryCode: iso3,
        contexte: city.featureCode === "PPLC" ? "Capitale nationale" : null,
        lat: city.latitude,
        lon: city.longitude,
        demiCoteDeg: 0.15, // échelle ville, cohérent avec Paris (0.12) et Mumbai (0.15)
        isAuto: true,
      });
    }
  }
  return [...PLACES_SEED.map((p) => ({ ...p, isAuto: false })), ...autoPlaces];
}

// Traite un pays : facettes GBIF, upsert coverage + top espèces enrichies.
// Retourne true si traité avec succès, false s'il a été ignoré (échec ou
// pas de code alpha-2 valide).
async function processCountry(client, iso3, gtsCache) {
  const iso2 = toAlpha2(iso3);
  if (!iso2) return false;
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
    return false;
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
    const { inGts, commonNames } = await enrichSpecies(sp.name, gtsCache);
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
  return true;
}

// Traite un lieu : facettes GBIF sur son rectangle géographique, upsert
// métadonnées + coverage + top espèces enrichies. Retourne true si
// traité avec succès, false s'il a été ignoré (échec réseau).
async function processPlace(client, place, gtsCache) {
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
    return false;
  }

  const placeResult = await client.query(
    `INSERT INTO species_observation_places (slug, name, country_code, contexte, lat, lon, demi_cote_deg, is_auto)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (slug)
     DO UPDATE SET name = EXCLUDED.name, country_code = EXCLUDED.country_code,
       contexte = EXCLUDED.contexte, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
       demi_cote_deg = EXCLUDED.demi_cote_deg, is_auto = EXCLUDED.is_auto
     RETURNING id`,
    [place.slug, place.name, place.countryCode, place.contexte, place.lat, place.lon, place.demiCoteDeg, place.isAuto]
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
    const { inGts, commonNames } = await enrichSpecies(sp.name, gtsCache);
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
  return true;
}

// Supprime les lieux auto-générés de l'ancien format de slug
// ("capital-xxx", un seul par pays) remplacé par le nouveau
// ("city-xxx-N", jusqu'à 10 par pays) — purement transitoire, sans effet
// après la première exécution qui suit ce changement.
async function cleanupLegacyAutoPlaces(client) {
  await client.query("DELETE FROM species_observation_places WHERE is_auto = true AND slug LIKE 'capital-%'");
}

// --- Mode complet (localhost / déclenchement manuel) : comportement
// inchangé depuis la version d'origine — traite tout, sans notion de
// tranche ni de reprise. C'est ce que lance `npm run ingest:species-observations`
// sans argument. ---
async function runFullCycle(pool) {
  const countryRows = await pool.query(`
    SELECT DISTINCT country_code FROM co2_emissions
    UNION
    SELECT DISTINCT country_code FROM power_plants
  `);
  const countryCodes3 = countryRows.rows.map((r) => r.country_code);

  const gtsCache = new Map();
  let countriesProcessed = 0;
  let countriesSkipped = 0;
  let placesProcessed = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await cleanupLegacyAutoPlaces(client);

    for (const iso3 of countryCodes3) {
      const ok = await processCountry(client, iso3, gtsCache);
      if (ok) countriesProcessed += 1;
      else countriesSkipped += 1;
    }

    const placesList = await buildPlacesList(countryCodes3);
    console.log(`[speciesObservations] ${placesList.length} lieux à traiter (${PLACES_SEED.length} pilotes + ${placesList.length - PLACES_SEED.length} villes auto-générées).`);

    for (const place of placesList) {
      const ok = await processPlace(client, place, gtsCache);
      if (ok) placesProcessed += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { status: "complete", countriesProcessed, countriesSkipped, placesProcessed, uniqueSpeciesResolved: gtsCache.size };
}

// --- Mode par tranches (production, via GitHub Actions toutes les 20
// minutes — voir .github/workflows/refresh-species-observations.yml).
// Reprend automatiquement où le cycle précédent s'est arrêté, en se
// basant sur updated_at des tables de couverture plutôt que sur un
// curseur explicite : un pays/lieu pas encore mis à jour depuis le début
// du cycle en cours est simplement repris, ce qui rend la reprise
// naturellement robuste à un arrêt en plein milieu (crash, timeout). ---

const CYCLE_MAX_AGE_DAYS = 25; // au-delà, on démarre un nouveau cycle mensuel plutôt que de considérer le précédent "encore frais"

async function runResumableBatch(pool, maxDurationMs) {
  const startTime = Date.now();
  const timeIsUp = () => maxDurationMs != null && Date.now() - startTime >= maxDurationMs;

  const progressResult = await pool.query("SELECT * FROM species_observations_progress WHERE id = 1");
  let progress = progressResult.rows[0];
  const cycleAgeDays = (Date.now() - new Date(progress.cycle_started_at).getTime()) / (1000 * 60 * 60 * 24);

  if (progress.phase === "done" && cycleAgeDays < CYCLE_MAX_AGE_DAYS) {
    return { status: "up-to-date", phase: "done", countriesProcessed: 0, placesProcessed: 0 };
  }
  if (progress.phase === "done") {
    // Cycle précédent terminé mais ancien : on en redémarre un nouveau.
    await pool.query(
      `UPDATE species_observations_progress
       SET phase = 'countries', cycle_started_at = now(), updated_at = now() WHERE id = 1`
    );
    progress = { phase: "countries", cycle_started_at: new Date() };
  }
  const cycleStartedAt = progress.cycle_started_at;

  const countryRows = await pool.query(`
    SELECT DISTINCT country_code FROM co2_emissions
    UNION
    SELECT DISTINCT country_code FROM power_plants
  `);
  const countryCodes3 = countryRows.rows.map((r) => r.country_code);

  const gtsCache = new Map();
  let countriesProcessed = 0;
  let placesProcessed = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await cleanupLegacyAutoPlaces(client);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  if (progress.phase === "countries") {
    const pending = await pool.query(
      `SELECT c.code AS country_code FROM unnest($1::text[]) AS c(code)
       LEFT JOIN species_observations_coverage cov ON cov.country_code = c.code
       WHERE cov.country_code IS NULL OR cov.updated_at < $2
       ORDER BY c.code`,
      [countryCodes3, cycleStartedAt]
    );

    for (const row of pending.rows) {
      const client2 = await pool.connect();
      try {
        await client2.query("BEGIN");
        const ok = await processCountry(client2, row.country_code, gtsCache);
        await client2.query("COMMIT");
        if (ok) countriesProcessed += 1;
      } catch (err) {
        await client2.query("ROLLBACK");
        console.error(`[speciesObservations] pays "${row.country_code}" échec (tranche), sera repris:`, err.message);
      } finally {
        client2.release();
      }
      if (timeIsUp()) {
        await pool.query("UPDATE species_observations_progress SET updated_at = now() WHERE id = 1");
        return { status: "partial", phase: "countries", countriesProcessed, placesProcessed: 0 };
      }
    }

    // Tous les pays du cycle sont à jour : on construit la liste des
    // lieux (appels countries.dev) une seule fois, puis on passe en phase
    // "places". Les tranches suivantes n'auront plus besoin de rappeler
    // countries.dev — elles reliront la liste déjà en base.
    const placesList = await buildPlacesList(countryCodes3);
    const client3 = await pool.connect();
    try {
      await client3.query("BEGIN");
      for (const place of placesList) {
        await client3.query(
          `INSERT INTO species_observation_places (slug, name, country_code, contexte, lat, lon, demi_cote_deg, is_auto)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (slug)
           DO UPDATE SET name = EXCLUDED.name, country_code = EXCLUDED.country_code,
             contexte = EXCLUDED.contexte, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
             demi_cote_deg = EXCLUDED.demi_cote_deg, is_auto = EXCLUDED.is_auto`,
          [place.slug, place.name, place.countryCode, place.contexte, place.lat, place.lon, place.demiCoteDeg, place.isAuto]
        );
      }
      await client3.query(
        `UPDATE species_observations_progress SET phase = 'places', updated_at = now() WHERE id = 1`
      );
      await client3.query("COMMIT");
    } catch (err) {
      await client3.query("ROLLBACK");
      throw err;
    } finally {
      client3.release();
    }

    if (timeIsUp()) {
      return { status: "partial", phase: "places", countriesProcessed, placesProcessed: 0 };
    }
  }

  // Phase "places" : les métadonnées sont déjà en base (construites ci-dessus,
  // potentiellement lors d'une tranche précédente) — on relit directement
  // depuis species_observation_places, pas besoin de rappeler countries.dev.
  const pendingPlaces = await pool.query(
    `SELECT p.id, p.slug, p.name, p.country_code, p.contexte, p.lat, p.lon, p.demi_cote_deg, p.is_auto
     FROM species_observation_places p
     LEFT JOIN species_observation_places_coverage cov ON cov.place_id = p.id
     WHERE cov.place_id IS NULL OR cov.updated_at < $1
     ORDER BY p.slug`,
    [cycleStartedAt]
  );

  for (const row of pendingPlaces.rows) {
    const place = {
      slug: row.slug,
      name: row.name,
      countryCode: row.country_code,
      contexte: row.contexte,
      lat: Number(row.lat),
      lon: Number(row.lon),
      demiCoteDeg: Number(row.demi_cote_deg),
      isAuto: row.is_auto,
    };
    const client4 = await pool.connect();
    try {
      await client4.query("BEGIN");
      const ok = await processPlace(client4, place, gtsCache);
      await client4.query("COMMIT");
      if (ok) placesProcessed += 1;
    } catch (err) {
      await client4.query("ROLLBACK");
      console.error(`[speciesObservations] lieu "${row.slug}" échec (tranche), sera repris:`, err.message);
    } finally {
      client4.release();
    }
    if (timeIsUp()) {
      await pool.query("UPDATE species_observations_progress SET updated_at = now() WHERE id = 1");
      return { status: "partial", phase: "places", countriesProcessed, placesProcessed };
    }
  }

  await pool.query("UPDATE species_observations_progress SET phase = 'done', updated_at = now() WHERE id = 1");
  return { status: "complete", phase: "done", countriesProcessed, placesProcessed };
}

export async function ingestSpeciesObservations(pool, options = {}) {
  const { resume = false, maxDurationMs = null } = options;
  if (resume) {
    return runResumableBatch(pool, maxDurationMs);
  }
  return runFullCycle(pool);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const args = process.argv.slice(2);
  const resume = args.includes("--resume");
  const durationArg = args.find((a) => a.startsWith("--max-duration-minutes="));
  const maxDurationMs = durationArg ? Number(durationArg.split("=")[1]) * 60 * 1000 : null;

  if (resume) {
    console.log(`Ingestion des espèces observées (GBIF) — mode tranche (reprise), budget ${maxDurationMs ? maxDurationMs / 60000 + " min" : "illimité"}...`);
    const result = await runResumableBatch(pool, maxDurationMs);
    console.log(`Tranche terminée : statut "${result.status}", phase "${result.phase}", ${result.countriesProcessed} pays traités, ${result.placesProcessed} lieux traités.`);
  } else {
    console.log("Ingestion des espèces observées (GBIF) — pays + lieux (jusqu'à 10 villes/pays), mode complet, compter jusqu'à 1h-1h30 selon le nombre d'espèces uniques rencontrées...");
    const result = await runFullCycle(pool);
    console.log(
      `Terminé : ${result.countriesProcessed} pays traités (${result.countriesSkipped} ignorés), ` +
        `${result.placesProcessed} lieux traités, ${result.uniqueSpeciesResolved} espèces uniques résolues (GlobalTreeSearch + noms communs).`
    );
  }
  await pool.end();
}
