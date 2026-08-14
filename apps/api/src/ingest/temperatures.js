// Ingestion des indicateurs de température par pays et par année.
// Source : Open-Meteo Historical Weather API (ERA5/ERA5-Land), gratuite,
// sans clé, licence CC BY 4.0 — https://open-meteo.com/en/docs/historical-weather-api
//
// Particularité par rapport aux autres ingestions du site : Open-Meteo donne
// des données par coordonnées, pas par pays. Un seul point par pays est
// interrogé (sa capitale, voir country_capitals.js) — approche simple assumée
// en première approche (voir TODO.md), avec un biais connu pour les très
// grands pays (Brasília ne représente ni l'Amazonie ni le Sud du Brésil).
//
// Les séries journalières brutes ne sont jamais stockées en base (volume
// important sur plusieurs décennies x ~190 pays) : cette fonction les
// récupère, calcule les agrégats annuels et les seuils canicule/vague de
// froid en mémoire pour chaque pays, puis n'enregistre que le résultat
// annuel (voir migration 043).
//
// Portée des pays traités : uniquement l'intersection avec les pays déjà
// couverts par les autres thématiques du site (table co2_emissions, le jeu
// de données le plus large déjà en base) — pas la liste complète de
// country_capitals.js, volontairement plus large. Voir getCoveredCountries().
//
// Définition retenue pour les vagues de chaleur/froid : recommandation OMM —
// 5 jours consécutifs où la température max (resp. min) s'écarte de plus de
// 5°C de la normale saisonnière locale. La "normale saisonnière locale" est
// ici une normale climatologique lissée sur une fenêtre de ±7 jours autour de
// chaque jour de l'année (jour-calendaire), calculée sur la période de
// référence — une normale à jour unique serait trop bruitée.
//
// Période de référence retenue : 1991-2020, la normale climatologique
// actuellement en vigueur à l'OMM (remplace 1961-1990 depuis 2021).
//
// --- Quota Open-Meteo : pourquoi ce fichier cadence lui-même ses appels ---
//
// L'API gratuite ne compte pas "1 requête HTTP = 1 appel" : une requête est
// pondérée selon la période demandée et le nombre de variables, dès qu'elle
// dépasse 2 semaines ou 10 variables (voir https://open-meteo.com/en/pricing,
// section "How is one API call defined?") — poids = (semaines / 2) x
// (variables / 10). Plafonds du plan gratuit : 600 appels pondérés/minute,
// 5 000/heure, 10 000/jour.
//
// Une requête unique de plusieurs décennies x 3 variables (température
// moyenne journalière incluse) pèse à elle seule plusieurs centaines
// d'"appels" — largement de quoi saturer le plafond minute/heure en un seul
// HTTP request. Deux ajustements en conséquence :
//   1) Seules temperature_2m_max et temperature_2m_min sont demandées (2
//      variables, pas 3) — la moyenne journalière est approximée par
//      (max + min) / 2, une convention météorologique courante quand la
//      moyenne intégrée horaire n'est pas disponible/nécessaire.
//   2) L'ingestion s'exécute par lots (batches) : elle traite des pays
//      jusqu'à approcher le budget de poids autorisé par heure, puis
//      s'endort automatiquement jusqu'à l'heure suivante avant de
//      continuer — le tout en une seule exécution, sans intervention.
//
// Avec START_YEAR = 1990 (~35 ans d'historique), le poids total pour tous
// les pays couverts avoisine 40 000 — soit environ 10h de traitement actif
// une fois réparties par lots horaires. Pour remonter à START_YEAR = 1950
// (~76 ans, cohérent avec le démarrage d'ERA5-Land cité dans le brief), le
// poids total double (~85 000, ~21h).
//
// START_YEAR et le nombre de pays traités par exécution sont pilotables sans
// modifier le code, via variables d'environnement :
//   TEMPERATURES_START_YEAR=1950        (défaut : 1990)
//   TEMPERATURES_COUNTRY_LIMIT=3         (défaut : pas de limite)
// Pratique pour valider rapidement sur quelques pays en local avant de
// lancer le backfill complet (1950, sans limite) sur le VPS en tâche de
// fond — le script reprend de toute façon automatiquement là où il s'arrête
// (voir isCountryFullyIngested), donc un premier essai limité puis un run
// complet plus tard ne refont pas le travail déjà fait.

import { COUNTRY_CAPITALS } from "./country_capitals.js";

const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";
const SOURCE_LABEL = "Open-Meteo Historical Weather API (ERA5/ERA5-Land)";

const START_YEAR = parseInt(process.env.TEMPERATURES_START_YEAR, 10) || 1990; // voir note ci-dessus pour remonter à 1950
// Limite le nombre de pays traités dans cette exécution — pratique pour un
// test rapide en local (ex. TEMPERATURES_COUNTRY_LIMIT=3) avant de lancer le
// backfill complet sur le VPS (pas de limite, laisser la variable absente).
const COUNTRY_LIMIT = process.env.TEMPERATURES_COUNTRY_LIMIT
  ? parseInt(process.env.TEMPERATURES_COUNTRY_LIMIT, 10)
  : null;
const REFERENCE_START_YEAR = 1991;
const REFERENCE_END_YEAR = 2020;
const REFERENCE_PERIOD_LABEL = `${REFERENCE_START_YEAR}-${REFERENCE_END_YEAR}`;
const WAVE_THRESHOLD_C = 5;
const WAVE_MIN_DAYS = 5;
const CLIMATOLOGY_WINDOW_DAYS = 7; // ±7 jours autour de chaque jour de l'année

// --- Cadencement du quota (voir note en tête de fichier) ---
const BATCH_WEIGHT_BUDGET = 4000; // par lot, marge sous le plafond de 5000/heure
const REQUEST_DELAY_MS = 25000; // entre deux pays au sein d'un même lot, marge sous 600/minute
const BATCH_INTERVAL_MS = 60 * 60 * 1000; // 1h entre le début de deux lots
const MAX_BATCHES = 30; // garde-fou, largement au-dessus des ~11 lots attendus
const RETRY_WAIT_MS = 65000; // filet de sécurité si un 429 survient malgré tout
const MAX_RETRIES = 2;

function lastCompleteYear() {
  const now = new Date();
  return now.getUTCMonth() === 0 && now.getUTCDate() < 15 ? now.getUTCFullYear() - 2 : now.getUTCFullYear() - 1;
}

function estimatedWeight(startYear, endYear, numVars = 2) {
  const weeks = ((endYear - startYear + 1) * 52);
  return (weeks / 2) * (numVars / 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

// Jour-calendaire 1..365, en ignorant le 29 février (fusionné avec le 28
// février) pour avoir une échelle stable indépendamment des années bissextiles.
function dayOfYearKey(dateStr) {
  const [, month, day] = dateStr.split("-").map(Number);
  const MONTH_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const doy = MONTH_CUMULATIVE[month - 1] + day;
  return month === 2 && day === 29 ? 59 : doy;
}

function circularDistance(a, b, period = 365) {
  const diff = Math.abs(a - b);
  return Math.min(diff, period - diff);
}

async function fetchDailySeries(lat, lng) {
  const url =
    `${ARCHIVE_BASE}?latitude=${lat}&longitude=${lng}` +
    `&start_date=${START_YEAR}-01-01&end_date=${lastCompleteYear()}-12-31` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} : ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.daily || !Array.isArray(json.daily.time)) {
    throw new Error("Réponse Open-Meteo sans série journalière exploitable");
  }
  const { time, temperature_2m_max, temperature_2m_min } = json.daily;
  const rows = [];
  for (let i = 0; i < time.length; i += 1) {
    if (temperature_2m_max[i] === null || temperature_2m_min[i] === null) continue; // trous ponctuels
    const max = temperature_2m_max[i];
    const min = temperature_2m_min[i];
    rows.push({
      date: time[i],
      year: parseInt(time[i].slice(0, 4), 10),
      doy: dayOfYearKey(time[i]),
      max,
      min,
      mean: (max + min) / 2, // approximation, voir note en tête de fichier
    });
  }
  return rows;
}

// Filet de sécurité : si malgré le cadencement un 429 survient (marge
// insuffisante, quota déjà entamé par un autre usage du site...), on attend
// la réinitialisation de la fenêtre "par minute" avant de réessayer, un
// nombre de tentatives limité pour ne pas bloquer indéfiniment un lot.
async function fetchDailySeriesWithRetry(lat, lng, countryCode) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fetchDailySeries(lat, lng);
    } catch (err) {
      const isRateLimited = err.message.includes("HTTP 429");
      if (!isRateLimited || attempt === MAX_RETRIES) throw err;
      console.log(
        `  ${countryCode} : limite Open-Meteo atteinte malgré le cadencement, attente ` +
          `${Math.round(RETRY_WAIT_MS / 1000)}s (${attempt + 1}/${MAX_RETRIES})...`
      );
      await sleep(RETRY_WAIT_MS);
    }
  }
  throw new Error("unreachable");
}

function buildClimatology(rows) {
  const refRows = rows.filter((r) => r.year >= REFERENCE_START_YEAR && r.year <= REFERENCE_END_YEAR);

  const byDoy = new Map();
  for (const r of refRows) {
    if (!byDoy.has(r.doy)) byDoy.set(r.doy, { max: [], min: [], mean: [] });
  }

  for (const targetDoy of byDoy.keys()) {
    const bucket = byDoy.get(targetDoy);
    for (const r of refRows) {
      if (circularDistance(r.doy, targetDoy) <= CLIMATOLOGY_WINDOW_DAYS) {
        bucket.max.push(r.max);
        bucket.min.push(r.min);
        bucket.mean.push(r.mean);
      }
    }
  }

  const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const climatology = new Map();
  for (const [doy, bucket] of byDoy.entries()) {
    if (bucket.max.length === 0) continue;
    climatology.set(doy, { normalMax: average(bucket.max), normalMin: average(bucket.min) });
  }

  const referenceAnnualMean = refRows.length > 0 ? average(refRows.map((r) => r.mean)) : null;

  return { climatology, referenceAnnualMean };
}

function countWaveEvents(daysFlags) {
  let events = 0;
  let streak = 0;
  for (const flagged of daysFlags) {
    if (flagged) {
      streak += 1;
    } else {
      if (streak >= WAVE_MIN_DAYS) events += 1;
      streak = 0;
    }
  }
  if (streak >= WAVE_MIN_DAYS) events += 1;
  return events;
}

function computeYearlyMetrics(rows, climatology, referenceAnnualMean) {
  const byYear = new Map();
  for (const r of rows) {
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year).push(r);
  }

  const results = [];
  for (const [year, yearRows] of byYear.entries()) {
    if (yearRows.length < 300) continue; // année incomplète, agrégats non fiables

    yearRows.sort((a, b) => (a.date < b.date ? -1 : 1));

    const avgTemp = yearRows.reduce((a, r) => a + r.mean, 0) / yearRows.length;
    const maxTemp = Math.max(...yearRows.map((r) => r.max));
    const minTemp = Math.min(...yearRows.map((r) => r.min));

    const hotFlags = yearRows.map((r) => {
      const normal = climatology.get(r.doy);
      return normal ? r.max > normal.normalMax + WAVE_THRESHOLD_C : false;
    });
    const coldFlags = yearRows.map((r) => {
      const normal = climatology.get(r.doy);
      return normal ? r.min < normal.normalMin - WAVE_THRESHOLD_C : false;
    });

    results.push({
      year,
      avgTemp,
      maxTemp,
      minTemp,
      deviation: referenceAnnualMean !== null ? avgTemp - referenceAnnualMean : null,
      heatwaveCount: countWaveEvents(hotFlags),
      coldwaveCount: countWaveEvents(coldFlags),
    });
  }
  return results;
}

// Pays à traiter : intersection entre les pays déjà couverts par le CO2 (le
// jeu de données OWID le plus large déjà en base sur le site) et les pays
// pour lesquels on dispose de coordonnées de capitale.
async function getCoveredCountries(pool) {
  const result = await pool.query(
    "SELECT DISTINCT country_code, country_name FROM co2_emissions ORDER BY country_code"
  );
  const covered = [];
  const skippedNoCapital = [];
  for (const row of result.rows) {
    const capitalInfo = COUNTRY_CAPITALS[row.country_code];
    if (!capitalInfo) {
      skippedNoCapital.push(row.country_code);
      continue;
    }
    covered.push({ code: row.country_code, name: row.country_name, ...capitalInfo });
  }
  return { covered, skippedNoCapital };
}

// Un pays est considéré comme déjà traité si la table contient déjà autant
// de lignes que d'années attendues sur la plage START_YEAR..dernière année
// complète — permet de reprendre une ingestion interrompue (ou répartie sur
// plusieurs jours) sans refaire d'appels Open-Meteo inutiles.
async function getAlreadyIngestedCountryCodes(pool) {
  const expectedYears = lastCompleteYear() - START_YEAR + 1;
  const result = await pool.query(
    `SELECT country_code FROM country_temperatures
     WHERE year >= $1 AND year <= $2
     GROUP BY country_code
     HAVING COUNT(*) >= $3`,
    [START_YEAR, lastCompleteYear(), expectedYears]
  );
  return new Set(result.rows.map((r) => r.country_code));
}

async function ingestOneCountry(pool, country) {
  const rows = await fetchDailySeriesWithRetry(country.lat, country.lng, country.code);
  const { climatology, referenceAnnualMean } = buildClimatology(rows);
  const yearlyMetrics = computeYearlyMetrics(rows, climatology, referenceAnnualMean);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const m of yearlyMetrics) {
      await client.query(
        `INSERT INTO country_temperatures
           (country_code, country_name, year, avg_temp_c, max_temp_c, min_temp_c,
            deviation_from_reference_c, heatwave_count, coldwave_count,
            reference_period, latitude, longitude, source, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           avg_temp_c = EXCLUDED.avg_temp_c,
           max_temp_c = EXCLUDED.max_temp_c,
           min_temp_c = EXCLUDED.min_temp_c,
           deviation_from_reference_c = EXCLUDED.deviation_from_reference_c,
           heatwave_count = EXCLUDED.heatwave_count,
           coldwave_count = EXCLUDED.coldwave_count,
           reference_period = EXCLUDED.reference_period,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           updated_at = now()`,
        [
          country.code,
          country.name,
          m.year,
          m.avgTemp,
          m.maxTemp,
          m.minTemp,
          m.deviation,
          m.heatwaveCount,
          m.coldwaveCount,
          REFERENCE_PERIOD_LABEL,
          country.lat,
          country.lng,
          SOURCE_LABEL,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return yearlyMetrics.length;
}

export async function ingestTemperatures(pool) {
  const { covered, skippedNoCapital } = await getCoveredCountries(pool);
  const alreadyDone = await getAlreadyIngestedCountryCodes(pool);
  let remaining = covered.filter((c) => !alreadyDone.has(c.code));
  if (COUNTRY_LIMIT !== null && COUNTRY_LIMIT >= 0) {
    remaining = remaining.slice(0, COUNTRY_LIMIT);
    console.log(`TEMPERATURES_COUNTRY_LIMIT actif : limité à ${remaining.length} pays pour cette exécution.`);
  }

  console.log(
    `${covered.length} pays couverts au total, ${alreadyDone.size} déjà complets, ` +
      `${remaining.length} restant à traiter.`
  );

  let inserted = 0;
  let countriesProcessed = 0;
  let countriesFailed = 0;
  const sampleErrors = [];

  let cursor = 0;
  for (let batch = 1; batch <= MAX_BATCHES && cursor < remaining.length; batch += 1) {
    const batchStart = Date.now();
    let batchWeight = 0;
    let batchCount = 0;

    console.log(`--- Lot ${batch} : démarrage ---`);

    while (cursor < remaining.length && batchWeight < BATCH_WEIGHT_BUDGET) {
      const country = remaining[cursor];
      cursor += 1;
      batchCount += 1;

      console.log(
        `[${cursor}/${remaining.length}] ${country.code} (${country.capital}) — lot ${batch}...`
      );

      try {
        inserted += await ingestOneCountry(pool, country);
        countriesProcessed += 1;
      } catch (err) {
        countriesFailed += 1;
        if (sampleErrors.length < 8) sampleErrors.push(`${country.code} : ${err.message}`);
        console.log(`  échec (${country.code}) : ${err.message}`);
      }

      batchWeight += estimatedWeight(START_YEAR, lastCompleteYear());

      if (cursor < remaining.length && batchWeight < BATCH_WEIGHT_BUDGET) {
        await sleep(REQUEST_DELAY_MS);
      }
    }

    console.log(
      `--- Lot ${batch} terminé : ${batchCount} pays traités dans ce lot, ` +
        `${remaining.length - cursor} restants au total ---`
    );

    if (cursor < remaining.length) {
      const elapsed = Date.now() - batchStart;
      const waitMs = Math.max(0, BATCH_INTERVAL_MS - elapsed);
      if (waitMs > 0) {
        console.log(`Pause de ${formatDuration(waitMs)} avant le lot suivant (respect du quota horaire)...`);
        await sleep(waitMs);
      }
    }
  }

  if (cursor < remaining.length) {
    console.log(
      `Nombre maximal de lots (${MAX_BATCHES}) atteint avant la fin — ${remaining.length - cursor} ` +
        `pays restants. Relancer le script plus tard reprendra automatiquement là où il s'est arrêté.`
    );
  }

  return { inserted, countriesProcessed, countriesFailed, skippedNoCapital, sampleErrors };
}

// Exécution directe en CLI : node src/ingest/temperatures.js
// Ingestion longue (potentiellement plusieurs heures, voir la note en tête de
// fichier) — pensée pour tourner sans surveillance (laisser le terminal
// ouvert, ex. toute une nuit). Interrompre et relancer plus tard est sûr : le
// script reprend automatiquement les pays non encore complets.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Ingestion des températures (Open-Meteo) en cours — cadencée automatiquement, peut durer plusieurs heures...");
  const { inserted, countriesProcessed, countriesFailed, skippedNoCapital, sampleErrors } =
    await ingestTemperatures(pool);
  console.log(
    `Terminé (pour cette exécution) : ${inserted} lignes pays/année insérées/mises à jour, ` +
      `${countriesProcessed} pays traités, ${countriesFailed} échecs.`
  );
  if (skippedNoCapital.length) {
    console.log(`Pays sans coordonnées de capitale (ignorés) : ${skippedNoCapital.join(", ")}`);
  }
  if (sampleErrors.length) {
    console.log("Exemples d'erreurs rencontrées :");
    sampleErrors.forEach((e) => console.log(`  - ${e}`));
  }
  await pool.end();
}
