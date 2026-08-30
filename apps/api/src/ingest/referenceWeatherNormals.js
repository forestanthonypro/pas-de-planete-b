// Calcule, pour chaque station de référence (migration 062), une "normale"
// (moyenne min/max) et un record (min/max absolu) pour chaque jour
// calendaire de l'année, à partir des données quotidiennes déjà
// collectées (voir ingest/referenceWeather.js).
//
// Période de référence ADAPTATIVE par station, pas figée à 1991-2020 pour
// toutes : découvert nécessaire le 30/08/2026 quand la station de Lyon
// (000BG, en réalité une station amateur récente — "ENS - Lyon 7ème",
// active seulement depuis juin 2015) s'est retrouvée avec un échantillon
// ridiculement bas malgré 11 ans de collecte complète, parce que le calcul
// ignorait tout ce qui dépassait 2020. Politique retenue (voir
// determineReferencePeriod) : utiliser la période officielle 1991-2020
// quand elle est disponible (stations à long historique), sinon utiliser
// toutes les années complètes réellement disponibles pour cette station —
// même si ça ne fait que quelques années. La période effectivement
// utilisée est toujours enregistrée (reference_start_year/
// reference_end_year) et exposée jusqu'au site : jamais de "normale"
// affichée sans préciser sur combien d'années elle repose.
//
// Fenêtre de lissage : ±7 jours calendaires autour de chaque date — sans
// ça, une "normale du 15 juillet" ne reposerait que sur une valeur par
// année, bien trop bruité. Même principe que ingest/temperatures.js pour
// la détection des vagues de chaleur/froid. Le repère "jour calendaire"
// est le mois-jour (ex. "07-15"), pas le numéro du jour dans l'année —
// évite les décalages d'une unité que provoqueraient les années
// bissextiles avec un simple jour-de-l'année 1-366.
//
// Les records (le plus chaud/froid jamais enregistré à cette date précise)
// sont calculés sur le jour exact, sans fenêtre de lissage — contrairement
// à la normale, un record se réfère à une date précise.

const WINDOW_RADIUS_DAYS = 7;

// En dessous de ce nombre d'années disponibles, même en utilisant tout ce
// qu'on a, la normale serait trop bruitée pour avoir un sens — mieux vaut
// ne rien afficher que quelque chose de trompeur.
const MIN_YEARS_FOR_ANY_NORMAL = 3;

// Seuil en dessous duquel une normale est jugée trop provisoire pour être
// affichée sur le site (voir route publique /api/reference-weather/today,
// environmentalData.js, qui réutilise cette même constante). Calé sur
// MIN_YEARS_FOR_ANY_NORMAL x la largeur de la fenêtre de lissage — le
// minimum en dessous duquel on refuse déjà de calculer quoi que ce soit.
export const MIN_SAMPLE_SIZE_FOR_DISPLAY = MIN_YEARS_FOR_ANY_NORMAL * (WINDOW_RADIUS_DAYS * 2 + 1);

// Détermine la période de référence à utiliser pour une station, à partir
// de ce qui est réellement disponible en base (minDate/maxDate, au format
// "YYYY-MM-DD") — jamais figée à 1991-2020 pour toutes.
export function determineReferencePeriod(minDate, maxDate) {
  const firstYear = parseInt(minDate.slice(0, 4), 10);
  const lastDataYear = parseInt(maxDate.slice(0, 4), 10);
  const currentYear = new Date().getUTCFullYear();
  // L'année en cours est presque toujours incomplète (collecte en cours)
  // — on l'exclut du calcul de la normale elle-même ; elle ne sert qu'à la
  // comparaison "aujourd'hui vs normale", pas à construire la normale.
  const lastCompleteYear = Math.min(lastDataYear, currentYear - 1);

  if (firstYear <= 1991 && lastCompleteYear >= 2020) {
    return { startYear: 1991, endYear: 2020 };
  }
  return { startYear: firstYear, endYear: lastCompleteYear };
}

// Construit, pour un mois-jour donné, l'ensemble des mois-jours à ±radius
// jours calendaires — indépendant de l'année (utilise une année de
// référence non bissextile arbitraire, 2001). Le 29 février est fusionné
// avec le 28 février (cas marginal, une seule journée par cycle de 4 ans).
function nearbyMonthDays(centerMonthDay, radius) {
  const [month, day] = centerMonthDay.split("-").map(Number);
  if (month === 2 && day === 29) {
    return nearbyMonthDays("02-28", radius);
  }
  const center = new Date(Date.UTC(2001, month - 1, day));
  const result = new Set();
  for (let offset = -radius; offset <= radius; offset++) {
    const d = new Date(center);
    d.setUTCDate(d.getUTCDate() + offset);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    result.add(`${mm}-${dd}`);
  }
  return result;
}

function allMonthDays() {
  const days = [];
  // 2000 est bissextile : couvre les 366 jours possibles, y compris le 29
  // février (traité à part dans nearbyMonthDays ci-dessus le cas échéant).
  const d = new Date(Date.UTC(2000, 0, 1));
  for (let i = 0; i < 366; i++) {
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    days.push(`${mm}-${dd}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

// Calcule les normales/records d'une station à partir d'un tableau de
// lignes {observed_date, temp_min, temp_max} DÉJÀ RESTREINTES à la période
// de référence choisie par l'appelant (voir computeAndStoreNormalsForStation
// — ce n'est plus cette fonction qui filtre par date, contrairement à la
// version précédente qui filtrait en dur sur 1991-2020). Séparé pour
// rester testable avec des données synthétiques, sans dépendre de
// Postgres.
export function computeNormalsFromRows(rows) {
  // Regroupe par mois-jour, avec l'année de chaque relevé (utile pour les
  // records, qui doivent indiquer en quelle année ils ont été battus).
  const byMonthDay = new Map();
  for (const row of rows) {
    const monthDay = row.observed_date.slice(5, 10);
    const year = parseInt(row.observed_date.slice(0, 4), 10);
    if (!byMonthDay.has(monthDay)) byMonthDay.set(monthDay, []);
    byMonthDay.get(monthDay).push({ year, tempMin: row.temp_min, tempMax: row.temp_max });
  }

  const results = [];
  for (const monthDay of allMonthDays()) {
    const nearby = nearbyMonthDays(monthDay, WINDOW_RADIUS_DAYS);
    const windowSamples = [];
    for (const md of nearby) {
      if (byMonthDay.has(md)) windowSamples.push(...byMonthDay.get(md));
    }

    let normalTempMin = null;
    let normalTempMax = null;
    if (windowSamples.length > 0) {
      const minsValid = windowSamples.map((s) => s.tempMin).filter((v) => v != null);
      const maxsValid = windowSamples.map((s) => s.tempMax).filter((v) => v != null);
      if (minsValid.length > 0) normalTempMin = minsValid.reduce((a, b) => a + b, 0) / minsValid.length;
      if (maxsValid.length > 0) normalTempMax = maxsValid.reduce((a, b) => a + b, 0) / maxsValid.length;
    }

    // Records : uniquement sur le jour exact (pas la fenêtre ±7j).
    const exactDaySamples = byMonthDay.get(monthDay) || [];
    let recordTempMin = null;
    let recordTempMinYear = null;
    let recordTempMax = null;
    let recordTempMaxYear = null;
    for (const s of exactDaySamples) {
      if (s.tempMin != null && (recordTempMin === null || s.tempMin < recordTempMin)) {
        recordTempMin = s.tempMin;
        recordTempMinYear = s.year;
      }
      if (s.tempMax != null && (recordTempMax === null || s.tempMax > recordTempMax)) {
        recordTempMax = s.tempMax;
        recordTempMaxYear = s.year;
      }
    }

    results.push({
      monthDay,
      normalTempMin,
      normalTempMax,
      recordTempMin,
      recordTempMinYear,
      recordTempMax,
      recordTempMaxYear,
      sampleSize: windowSamples.length,
      reliable: windowSamples.length >= MIN_SAMPLE_SIZE_FOR_DISPLAY,
    });
  }
  return results;
}

export async function computeAndStoreNormalsForStation(pool, stationCode) {
  const rangeResult = await pool.query(
    "SELECT MIN(observed_date)::text AS min_date, MAX(observed_date)::text AS max_date FROM reference_weather_daily WHERE station_code = $1",
    [stationCode]
  );
  const { min_date: minDate, max_date: maxDate } = rangeResult.rows[0];
  if (!minDate) {
    return { monthDaysComputed: 0, reliableCount: 0, referenceStartYear: null, referenceEndYear: null };
  }

  const { startYear, endYear } = determineReferencePeriod(minDate, maxDate);
  if (endYear - startYear + 1 < MIN_YEARS_FOR_ANY_NORMAL) {
    return { monthDaysComputed: 0, reliableCount: 0, referenceStartYear: startYear, referenceEndYear: endYear, tooFewYears: true };
  }

  const rows = (
    await pool.query(
      `SELECT observed_date::text AS observed_date, temp_min, temp_max
       FROM reference_weather_daily WHERE station_code = $1 AND observed_date BETWEEN $2 AND $3`,
      [stationCode, `${startYear}-01-01`, `${endYear}-12-31`]
    )
  ).rows.map((r) => ({
    // pg renvoie les colonnes NUMERIC sous forme de chaînes de caractères
    // (pour ne jamais perdre de précision en les convertissant lui-même) —
    // sans ce parseFloat explicite, les additions dans computeNormalsFromRows
    // deviennent des concaténations de texte et produisent NaN, vérifié en
    // conditions réelles le 30/08/2026.
    observed_date: r.observed_date,
    temp_min: r.temp_min != null ? parseFloat(r.temp_min) : null,
    temp_max: r.temp_max != null ? parseFloat(r.temp_max) : null,
  }));

  const normals = computeNormalsFromRows(rows);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const n of normals) {
      await client.query(
        `INSERT INTO reference_weather_normals
           (station_code, month_day, normal_temp_min, normal_temp_max, record_temp_min, record_temp_min_year, record_temp_max, record_temp_max_year, sample_size, reference_start_year, reference_end_year, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (station_code, month_day) DO UPDATE SET
           normal_temp_min = EXCLUDED.normal_temp_min, normal_temp_max = EXCLUDED.normal_temp_max,
           record_temp_min = EXCLUDED.record_temp_min, record_temp_min_year = EXCLUDED.record_temp_min_year,
           record_temp_max = EXCLUDED.record_temp_max, record_temp_max_year = EXCLUDED.record_temp_max_year,
           sample_size = EXCLUDED.sample_size, reference_start_year = EXCLUDED.reference_start_year,
           reference_end_year = EXCLUDED.reference_end_year, computed_at = now()`,
        [
          stationCode, n.monthDay, n.normalTempMin, n.normalTempMax,
          n.recordTempMin, n.recordTempMinYear, n.recordTempMax, n.recordTempMaxYear, n.sampleSize,
          startYear, endYear,
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

  return {
    monthDaysComputed: normals.length,
    reliableCount: normals.filter((n) => n.reliable).length,
    referenceStartYear: startYear,
    referenceEndYear: endYear,
  };
}
