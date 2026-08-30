// Calcule, pour chaque station de référence (migration 062), une "normale"
// (moyenne min/max) et un record (min/max absolu) pour chaque jour
// calendaire de l'année, à partir des données quotidiennes déjà
// collectées (voir ingest/referenceWeather.js) — restreint à la période
// officielle 1991-2020 pour les normales elles-mêmes (voir REFERENCE_START
// et REFERENCE_END ci-dessous), même si la table reference_weather_daily
// contient aussi des données plus récentes (nécessaires pour comparer
// "aujourd'hui" à ces normales, pas pour les calculer).
//
// Fenêtre de lissage : ±7 jours calendaires autour de chaque date — sans
// ça, une "normale du 15 juillet" ne reposerait que sur 30 valeurs (une
// par année), bien trop bruité. Même principe que ingest/temperatures.js
// pour la détection des vagues de chaleur/froid. Le repère "jour
// calendaire" est le mois-jour (ex. "07-15"), pas le numéro du jour dans
// l'année — évite les décalages d'une unité que provoqueraient les années
// bissextiles avec un simple jour-de-l'année 1-366.
//
// Les records (le plus chaud/froid jamais enregistré à cette date précise)
// sont calculés sur le jour exact, sans fenêtre de lissage — contrairement
// à la normale, un record se réfère à une date précise.
//
// Calcul fait en mémoire (JS), pas en SQL pur : ~11 000 lignes par station
// sur 30 ans, largement gérable, et bien plus simple à relire/tester que
// l'équivalent en SQL avec gestion du chevauchement d'année.

const REFERENCE_START = "1991-01-01";
const REFERENCE_END = "2020-12-31";
const WINDOW_RADIUS_DAYS = 7;
const MIN_SAMPLE_SIZE = 20 * (WINDOW_RADIUS_DAYS * 2 + 1); // ~20 ans minimum avant de considérer la normale fiable (sur les 30 ans visés)

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
// lignes {observed_date, temp_min, temp_max} déjà en mémoire (voir
// computeAndStoreNormals pour la version qui lit la base et enregistre le
// résultat). Séparé pour rester testable avec des données synthétiques,
// sans dépendre de Postgres.
export function computeNormalsFromRows(rows) {
  // Regroupe par mois-jour, avec l'année de chaque relevé (utile pour les
  // records, qui doivent indiquer en quelle année ils ont été battus).
  const byMonthDay = new Map();
  for (const row of rows) {
    if (row.observed_date < REFERENCE_START || row.observed_date > REFERENCE_END) continue;
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
      reliable: windowSamples.length >= MIN_SAMPLE_SIZE,
    });
  }
  return results;
}

export async function computeAndStoreNormalsForStation(pool, stationCode) {
  const rows = (
    await pool.query(
      `SELECT observed_date::text AS observed_date, temp_min, temp_max
       FROM reference_weather_daily WHERE station_code = $1 AND observed_date BETWEEN $2 AND $3`,
      [stationCode, REFERENCE_START, REFERENCE_END]
    )
  ).rows.map((r) => ({
    // pg renvoie les colonnes NUMERIC sous forme de chaînes de caractères
    // (pour ne jamais perdre de précision en les convertissant lui-même) —
    // sans ce parseFloat explicite, les additions dans computeNormalsFromRows
    // deviennent des concaténations de texte et produisent NaN, vérifié en
    // conditions réelles le 30/08/2026 (normales à NaN alors que les records,
    // calculés par comparaison et non addition, restaient corrects).
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
           (station_code, month_day, normal_temp_min, normal_temp_max, record_temp_min, record_temp_min_year, record_temp_max, record_temp_max_year, sample_size, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (station_code, month_day) DO UPDATE SET
           normal_temp_min = EXCLUDED.normal_temp_min, normal_temp_max = EXCLUDED.normal_temp_max,
           record_temp_min = EXCLUDED.record_temp_min, record_temp_min_year = EXCLUDED.record_temp_min_year,
           record_temp_max = EXCLUDED.record_temp_max, record_temp_max_year = EXCLUDED.record_temp_max_year,
           sample_size = EXCLUDED.sample_size, computed_at = now()`,
        [
          stationCode, n.monthDay, n.normalTempMin, n.normalTempMax,
          n.recordTempMin, n.recordTempMinYear, n.recordTempMax, n.recordTempMaxYear, n.sampleSize,
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

  return { monthDaysComputed: normals.length, reliableCount: normals.filter((n) => n.reliable).length };
}
