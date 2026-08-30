// Récupère rapidement les N derniers jours pour les 10 stations de
// référence, indépendamment du grand backfill chronologique 1991→
// aujourd'hui (ingestReferenceWeatherOneBatch) — celui-ci avance station
// par station dans l'ordre, et n'atteindra les dates récentes qu'une fois
// les ~35 ans d'historique complètement rattrapés pour CHAQUE station,
// dans plusieurs heures. Sans cette collecte séparée, impossible d'avoir
// la moindre donnée "aujourd'hui" à comparer aux normales avant que tout
// le backfill soit terminé.
//
// Écrit dans la même table reference_weather_daily (clé primaire
// station+date, upsert) — aucun conflit avec le backfill principal :
// quand celui-ci atteindra plus tard ces mêmes dates récentes, il les
// réécrira simplement à l'identique (quelques appels API redondants, sans
// conséquence).
//
// Contrairement au backfill principal, pas de suivi de progression
// persistant nécessaire : à exécuter ponctuellement (route admin dédiée),
// le volume est trivial (10 stations x 1 courte tranche chacune).

import { fetchChunk, aggregateDaily, addDaysISO } from "./referenceWeather.js";

const DELAY_MS = 1500;
const FRESHNESS_BUFFER_DAYS = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ingestRecentReferenceWeather(pool, days = 60) {
  const token = process.env.INFOCLIMAT_API_TOKEN;
  if (!token) {
    throw new Error("INFOCLIMAT_API_TOKEN manquant (variable d'environnement requise)");
  }

  const cutoff = addDaysISO(new Date().toISOString().slice(0, 10), -FRESHNESS_BUFFER_DAYS);
  const stations = (await pool.query("SELECT station_code FROM reference_weather_stations ORDER BY display_order")).rows;

  let requestsMade = 0;
  let daysStored = 0;
  const errors = [];

  for (const { station_code: stationCode } of stations) {
    // Découpe en tranches de 7 jours max (limite API), en partant de la
    // plus ancienne pour rester cohérent avec le sens du backfill
    // principal, même si l'ordre n'a ici aucune importance fonctionnelle.
    let start = addDaysISO(cutoff, -days + 1);
    while (start <= cutoff) {
      const end = addDaysISO(start, 6);
      const clampedEnd = end > cutoff ? cutoff : end;
      try {
        const data = await fetchChunk(stationCode, start, clampedEnd, token);
        requestsMade += 1;
        const daysAgg = aggregateDaily(data, stationCode);
        for (const day of daysAgg) {
          await pool.query(
            `INSERT INTO reference_weather_daily (station_code, observed_date, temp_min, temp_max, reading_count)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (station_code, observed_date)
             DO UPDATE SET temp_min = EXCLUDED.temp_min, temp_max = EXCLUDED.temp_max, reading_count = EXCLUDED.reading_count`,
            [stationCode, day.date, day.tempMin, day.tempMax, day.readingCount]
          );
          daysStored += 1;
        }
      } catch (err) {
        errors.push(`${stationCode} ${start}..${clampedEnd}: ${err.message}`);
      }
      await sleep(DELAY_MS);
      start = addDaysISO(clampedEnd, 1);
    }
  }

  return { requestsMade, daysStored, errors, stationsProcessed: stations.length };
}
