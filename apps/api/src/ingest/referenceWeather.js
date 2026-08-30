// Ingestion de l'historique quotidien (min/max) des 10 stations de
// référence (voir migration 062). Collecte en continu depuis 1991 jusqu'à
// avant-hier (pas seulement 1991-2020) — la restriction à la période de
// référence officielle des "normales" climatiques (1991-2020) s'applique
// au moment du CALCUL des normales, pas de la collecte : il faut aussi les
// données récentes pour pouvoir comparer "aujourd'hui" à ces normales une
// fois calculées. But : calculer nous-mêmes un écart à la normale et un
// ratio records de chaleur/froid — inspiré de dataclimat.fr (Infoclimat +
// Data For Good, mai 2026), mais recalculé par nos soins car ni DataClimat
// ni Infoclimat n'exposent d'API publique pour leurs indicateurs déjà
// agrégés (vérifié le 30/08/2026 : seule l'API de données brutes par
// station est documentée et accessible par clé).
//
// Source : API Infoclimat OpenData — https://www.infoclimat.fr/opendata/
// Licence CC BY par station (réseau StatIC amateur) ou Licence Ouverte
// Etalab (stations officielles RESO40/OMM), selon la station.
//
// --- Particularité de cette API : clé verrouillée par IP ---
//
// La clé (INFOCLIMAT_API_TOKEN) est générée par Anthony et liée à l'IP du
// VPS de production (51.75.26.18) — elle ne fonctionnera QUE depuis un
// appel dont l'adresse IP sortante est celle du VPS. Comme le conteneur
// api tourne déjà sur ce VPS en production, cette contrainte est
// naturellement respectée dès lors que l'ingestion est déclenchée via la
// route HTTP de ce conteneur (peu importe d'où part la requête HTTP qui
// déclenche la route — seul l'appel sortant du conteneur vers Infoclimat
// compte). Pas besoin de tâche cron séparée sur le VPS lui-même : le même
// mécanisme GitHub Actions + route /api/admin/ingest/... déjà utilisé pour
// les autres imports fonctionne tel quel.
//
// --- Format de l'API, vérifié en conditions réelles le 30/08/2026 ---
//
// GET https://www.infoclimat.fr/opendata/?version=2&method=get&format=json
//     &stations[]=<code>&start=YYYY-MM-DD&end=YYYY-MM-DD&token=<clé>
//
// Réponse : { status: "OK", errors: [], stations: [{id, name, latitude,
// longitude, elevation, ...}], hourly: { "<code>": [{dh_utc, temperature,
// ...}, ...] } } — malgré son nom, "hourly" contient des relevés bien plus
// fréquents que l'heure pour certaines stations (jusqu'à toutes les 10
// minutes) : les agrégats min/max quotidiens sont donc calculés ici à
// partir du champ "temperature" brut de chaque relevé, pas des champs
// temperature_min/temperature_max déjà présents par relevé (ceux-ci
// reflètent une fenêtre glissante propre à la source, pas la journée
// entière).
//
// --- Limite de l'API et "fair use" ---
//
// 7 jours consécutifs maximum par requête (davantage si propriétaire de la
// station, non applicable ici). Le nombre de requêtes par seconde n'est
// pas techniquement contrôlé par Infoclimat, mais un "fair use" est
// demandé explicitement sur leur page — DELAY_MS ci-dessous cadence donc
// les appels.
//
// Volume total estimé : 30 ans x ~52 tranches de 7 jours x 10 stations
// ≈ 15 600 requêtes. Conçu pour tourner par tranches de temps limité
// (comme species_observations, migration 058) et reprendre où il s'est
// arrêté — pas en un seul run.

const API_BASE = "https://www.infoclimat.fr/opendata/";
const CHUNK_DAYS = 7;
const DELAY_MS = 1500;
// Marge de sécurité : ne jamais réclamer le jour même ni la veille, dont
// les données Infoclimat peuvent encore être incomplètes (station pas
// encore synchronisée) — on s'arrête 2 jours avant "aujourd'hui".
const FRESHNESS_BUFFER_DAYS = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function fetchChunk(stationCode, startStr, endStr, token) {
  const url = `${API_BASE}?version=2&method=get&format=json&stations[]=${encodeURIComponent(stationCode)}&start=${startStr}&end=${endStr}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.status !== "OK") {
    throw new Error(`API status=${data.status} errors=${JSON.stringify(data.errors)}`);
  }
  return data;
}

// Regroupe les relevés bruts (10 min à quelques heures selon la station)
// par jour calendaire (partie date de dh_utc, en UTC), calcule le min/max
// du champ "temperature" de chaque relevé du jour.
export function aggregateDaily(apiResponse, stationCode) {
  const readings = apiResponse.hourly?.[stationCode] || [];
  const byDate = new Map();
  for (const reading of readings) {
    if (!reading.dh_utc || reading.temperature == null) continue;
    const temp = parseFloat(reading.temperature);
    if (Number.isNaN(temp)) continue;
    const date = reading.dh_utc.slice(0, 10);
    if (!byDate.has(date)) {
      byDate.set(date, { min: temp, max: temp, count: 0 });
    }
    const agg = byDate.get(date);
    agg.min = Math.min(agg.min, temp);
    agg.max = Math.max(agg.max, temp);
    agg.count += 1;
  }
  return Array.from(byDate.entries()).map(([date, agg]) => ({
    date,
    tempMin: agg.min,
    tempMax: agg.max,
    readingCount: agg.count,
  }));
}

export async function ingestReferenceWeatherOneBatch(pool, maxDurationMs) {
  const token = process.env.INFOCLIMAT_API_TOKEN;
  if (!token) {
    throw new Error("INFOCLIMAT_API_TOKEN manquant (variable d'environnement requise)");
  }

  const startTime = Date.now();
  const timeIsUp = () => maxDurationMs != null && Date.now() - startTime >= maxDurationMs;

  // Calculé à chaque appel plutôt que figé : la collecte avance en continu
  // jusqu'à "avant-hier" (voir FRESHNESS_BUFFER_DAYS) — pas seulement
  // jusqu'à la fin de la période de référence 1991-2020. Cette dernière
  // n'intervient que plus tard, au moment de calculer les normales
  // (restriction appliquée dans la requête de calcul, pas ici) — sans
  // cette distinction, on n'aurait jamais de données récentes à comparer
  // aux normales une fois qu'elles seront calculées.
  const cutoff = addDaysISO(new Date().toISOString().slice(0, 10), -FRESHNESS_BUFFER_DAYS);

  let requestsMade = 0;
  let daysStored = 0;
  let stationsCaughtUpThisRun = 0;

  const progressRows = (
    await pool.query(
      `SELECT station_code, next_start_date::text AS next_start_date, consecutive_errors
       FROM reference_weather_ingest_progress ORDER BY station_code`
    )
  ).rows;

  if (progressRows.length === 0) {
    return { status: "no-stations", requestsMade: 0, daysStored: 0, stationsCaughtUpThisRun: 0 };
  }

  for (const row of progressRows) {
    let nextStartDate = row.next_start_date;

    while (!timeIsUp()) {
      if (nextStartDate > cutoff) {
        // À jour pour l'instant — sera à nouveau "en retard" dès demain,
        // quand cutoff aura avancé d'un jour. "completed" n'est donc
        // qu'indicatif (utile pour un coup d'œil rapide en base), jamais
        // utilisé pour sauter une station dans la requête ci-dessus.
        await pool.query(
          "UPDATE reference_weather_ingest_progress SET completed = true, last_run_at = now() WHERE station_code = $1",
          [row.station_code]
        );
        stationsCaughtUpThisRun += 1;
        break;
      }

      const endStr = addDaysISO(nextStartDate, CHUNK_DAYS - 1);
      const clampedEnd = endStr > cutoff ? cutoff : endStr;

      try {
        const data = await fetchChunk(row.station_code, nextStartDate, clampedEnd, token);
        requestsMade += 1;

        const stationMeta = data.stations?.[0];
        if (stationMeta) {
          await pool.query(
            `UPDATE reference_weather_stations
             SET api_station_name = $2, latitude = $3, longitude = $4, elevation = $5
             WHERE station_code = $1`,
            [row.station_code, stationMeta.name || null, stationMeta.latitude ?? null, stationMeta.longitude ?? null, stationMeta.elevation ?? null]
          );
        }

        const days = aggregateDaily(data, row.station_code);
        for (const day of days) {
          await pool.query(
            `INSERT INTO reference_weather_daily (station_code, observed_date, temp_min, temp_max, reading_count)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (station_code, observed_date)
             DO UPDATE SET temp_min = EXCLUDED.temp_min, temp_max = EXCLUDED.temp_max, reading_count = EXCLUDED.reading_count`,
            [row.station_code, day.date, day.tempMin, day.tempMax, day.readingCount]
          );
          daysStored += 1;
        }

        nextStartDate = addDaysISO(clampedEnd, 1);
        await pool.query(
          `UPDATE reference_weather_ingest_progress
           SET next_start_date = $2, consecutive_errors = 0, last_run_at = now() WHERE station_code = $1`,
          [row.station_code, nextStartDate]
        );
      } catch (err) {
        console.error(`[referenceWeather] ${row.station_code} ${nextStartDate}..${clampedEnd} échec (repris au prochain lot): ${err.message}`);
        await pool.query(
          `UPDATE reference_weather_ingest_progress
           SET consecutive_errors = consecutive_errors + 1, last_run_at = now() WHERE station_code = $1`,
          [row.station_code]
        );
        break; // passe à la station suivante, cette tranche sera retentée au prochain lot
      }

      await sleep(DELAY_MS);
    }

    if (timeIsUp()) break;
  }

  // "caught-up" seulement si les 10 stations ont été vérifiées et sont
  // toutes à jour jusqu'à cutoff — jamais "définitivement terminé" comme
  // avant, puisque cutoff avance d'un jour à chaque exécution. Permet au
  // workflow de sortir tôt une fois le rattrapage quotidien fait, sans
  // boucler inutilement 30 fois pour rien chaque nuit.
  const allCaughtUp = !timeIsUp() && stationsCaughtUpThisRun === progressRows.length;

  return {
    status: allCaughtUp ? "caught-up" : timeIsUp() ? "partial" : "continuing",
    requestsMade,
    daysStored,
    stationsCaughtUpThisRun,
  };
}
