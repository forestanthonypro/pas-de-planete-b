import { Router } from "express";
import { chromium } from "playwright-core";
import countriesLib from "i18n-iso-countries";
import QRCode from "qrcode";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { buildKitHtml } from "../lib/kitTemplate.js";
import { buildOgImageHtml } from "../lib/ogImageTemplate.js";
import { getKitLabels } from "../lib/kitLabels.js";
import { buildKitActionHtml } from "../lib/kitActionTemplate.js";
import { getKitActionLabels } from "../lib/kitActionLabels.js";
import { computeGridIntensity, gridIntensityTier } from "../lib/gridIntensity.js";
import { computeIndustryProcessShare } from "../lib/sectorShare.js";
import { requireAdminSession } from "../lib/auth.js";
import { pdfGenerationLimiter } from "../lib/rateLimits.js";

// Les tables du site stockent les noms de pays en anglais (langue de la
// donnée source) — jamais ce qu'on veut montrer dans un document destiné à
// être lu. i18n-iso-countries couvre les 8 langues du site (vérifié :
// fr/en/es/it/ru/ja/zh/hi) à partir du seul code ISO3, déjà en base.
function localizeCountryName(code, lang) {
  if (!code) return code;
  return countriesLib.getName(code, lang, { select: "official" }) || code;
}

const router = Router();

// Phase 1 du kit de communication PDF : pour chaque indicateur, calcule le
// pays le mieux placé, le pays le moins bien placé, et la moyenne mondiale
// — en ne prenant que la dernière année disponible par pays (comme
// /api/country-summary-latest), pas l'historique complet.
//
// Chaque requête suit le même schéma : une CTE "latest" qui isole la
// dernière valeur par pays (DISTINCT ON), puis une sélection unique qui en
// tire le minimum, le maximum et la moyenne via des sous-requêtes triées.
// Les indicateurs dérivés (eau, forêt, espèces) calculent leur valeur dans
// la CTE elle-même, avant l'agrégation — pas de calcul de moyenne sur des
// moyennes déjà agrégées.

const QUERIES = {
  co2: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, emissions_per_capita::float AS value
      FROM co2_emissions
      WHERE emissions_per_capita IS NOT NULL AND emissions_per_capita > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  electricite: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, demand_per_capita_kwh::float AS value
      FROM electricity_generation
      WHERE demand_per_capita_kwh IS NOT NULL AND demand_per_capita_kwh > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  eau: `
    WITH latest_withdrawal AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, withdrawal_m3::float AS withdrawal
      FROM water_data
      WHERE withdrawal_m3 IS NOT NULL AND withdrawal_m3 > 0
      ORDER BY country_code, year DESC
    ),
    latest_population AS (
      SELECT DISTINCT ON (country_code) country_code, population::float AS population
      FROM co2_emissions
      WHERE population IS NOT NULL AND population > 0
      ORDER BY country_code, year DESC
    ),
    latest AS (
      SELECT w.country_code, w.country_name, (w.withdrawal / p.population) AS value
      FROM latest_withdrawal w
      JOIN latest_population p ON p.country_code = w.country_code
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  foret: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name,
        (tree_cover_loss_ha / NULLIF(forest_area_ha, 0) * 100) AS value
      FROM vegetation_loss
      WHERE tree_cover_loss_ha IS NOT NULL AND forest_area_ha IS NOT NULL AND forest_area_ha > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  pollution: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name, pm25_ug_m3::float AS value
      FROM pollution_data
      WHERE pm25_ug_m3 IS NOT NULL AND pm25_ug_m3 > 0
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest) AS avg_value,
      (SELECT COUNT(*) FROM latest) AS country_count
  `,
  especes: `
    WITH latest AS (
      SELECT DISTINCT ON (country_code) country_code, country_name,
        (COALESCE(mammals_threatened, 0) + COALESCE(birds_threatened, 0) + COALESCE(fish_threatened, 0)) AS value
      FROM species_threatened_counts
      ORDER BY country_code, year DESC
    )
    SELECT
      (SELECT country_name FROM latest WHERE value > 0 ORDER BY value ASC, country_code ASC LIMIT 1) AS best_name,
      (SELECT country_code FROM latest WHERE value > 0 ORDER BY value ASC, country_code ASC LIMIT 1) AS best_code,
      (SELECT value FROM latest WHERE value > 0 ORDER BY value ASC, country_code ASC LIMIT 1) AS best_value,
      (SELECT country_name FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_name,
      (SELECT country_code FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_code,
      (SELECT value FROM latest ORDER BY value DESC, country_code ASC LIMIT 1) AS worst_value,
      (SELECT AVG(value) FROM latest WHERE value > 0) AS avg_value,
      (SELECT COUNT(*) FROM latest WHERE value > 0) AS country_count
  `,
};

async function computeAllExtremes(lang) {
  const keys = Object.keys(QUERIES);
  const results = await Promise.all(keys.map((key) => pool.query(QUERIES[key])));

  const out = {};
  keys.forEach((key, i) => {
    const row = results[i].rows[0];
    out[key] = {
      best: { country: localizeCountryName(row.best_code, lang), code: row.best_code, value: row.best_value !== null ? parseFloat(row.best_value) : null },
      worst: { country: localizeCountryName(row.worst_code, lang), code: row.worst_code, value: row.worst_value !== null ? parseFloat(row.worst_value) : null },
      avg: row.avg_value !== null ? parseFloat(row.avg_value) : null,
      countryCount: parseInt(row.country_count, 10),
    };
  });
  return out;
}

router.get("/api/admin/kit-communication/extremes", requireAdminSession, async (req, res) => {
  const lang = req.query.lang || "fr";
  try {
    res.json(await computeAllExtremes(lang));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Position en pourcentage (0-100) d'une valeur entre le meilleur et le pire
// pays d'un indicateur — sert à placer le cercle France et le trait moyenne
// mondiale sur la barre dégradée du PDF. Retourne null si le calcul n'est
// pas possible (meilleur == pire, ou valeur manquante).
function computePosition(value, best, worst) {
  if (value === null || value === undefined || best === null || worst === null || best === worst) return null;
  const pct = ((value - best) / (worst - best)) * 100;
  return Math.max(0, Math.min(100, pct));
}

// Ordre de tri : classe les 4 entrées (meilleur, France, moyenne, pire)
// d'un indicateur par valeur croissante, en fusionnant les cases dont la
// valeur serait identique (France == meilleur ou France == pire) plutôt
// que de les répéter deux fois — cas prévu dès la maquette (voir échanges
// précédents).
function buildComparisonRow(labelKey, unit, decimals, franceValue, extremes) {
  const entries = [
    { role: "best", name: extremes.best.country, code: extremes.best.code, value: extremes.best.value },
    { role: "france", name: null, code: "FRA", value: franceValue },
    { role: "avg", name: null, code: null, value: extremes.avg },
    { role: "worst", name: extremes.worst.country, code: extremes.worst.code, value: extremes.worst.value },
  ].filter((e) => e.value !== null && e.value !== undefined);

  entries.sort((a, b) => a.value - b.value);

  // Fusionne les entrées dont la France partage exactement la valeur du
  // meilleur ou du pire pays (évite d'afficher deux cases identiques).
  const merged = [];
  for (const entry of entries) {
    const dup = merged.find((m) => m.value === entry.value && (m.role === "france" || entry.role === "france"));
    if (dup) {
      dup.mergedRoles = [...(dup.mergedRoles || [dup.role]), entry.role];
    } else {
      merged.push({ ...entry });
    }
  }

  return {
    labelKey,
    unit,
    decimals,
    franceValue,
    avgValue: extremes.avg,
    bestCountry: extremes.best.country,
    bestValue: extremes.best.value,
    worstCountry: extremes.worst.country,
    worstValue: extremes.worst.value,
    francePosition: computePosition(franceValue, extremes.best.value, extremes.worst.value),
    avgPosition: computePosition(extremes.avg, extremes.best.value, extremes.worst.value),
    orderedEntries: merged,
    countryCount: extremes.countryCount,
  };
}

// Trois principales sources d'électricité d'un pays, triées par TWh
// décroissant. La liste des filières et leur libellé est volontairement
// figée ici (pas de table dédiée) — à étendre si un pays a un mix
// dominé par une filière absente de cette liste.
const ENERGY_SOURCES = [
  { key: "nuclear_twh", icon: "nuclear" },
  { key: "hydro_twh", icon: "hydro" },
  { key: "gas_twh", icon: "gas" },
  { key: "coal_twh", icon: "coal" },
  { key: "wind_twh", icon: "wind" },
  { key: "solar_twh", icon: "solar" },
  { key: "oil_twh", icon: "oil" },
  { key: "biofuel_twh", icon: "biofuel" },
  { key: "other_renewable_twh", icon: "other" },
];

function computeTop3EnergySources(row) {
  if (!row) return [];
  const total = parseFloat(row.total_generation_twh) || null;
  const sources = ENERGY_SOURCES.map((s) => ({ ...s, value: row[s.key] !== null ? parseFloat(row[s.key]) : null }))
    .filter((s) => s.value !== null && s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  if (!total) return sources.map((s) => ({ ...s, share: null }));
  return sources.map((s) => ({ ...s, share: Math.round((s.value / total) * 1000) / 10 }));
}

async function getCountryKitData(country, lang) {
  const [extremes, co2Row, elecRow, waterRow, popRow, forestRow, pollutionRow, speciesRow, tempLatestRow, tempHistoryResult, heatwaveResult, elecMixRow, worldTempRow] = await Promise.all([
    computeAllExtremes(lang),
    pool.query(
      `SELECT emissions_per_capita::float AS value FROM co2_emissions
       WHERE country_code = $1 AND emissions_per_capita IS NOT NULL ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT demand_per_capita_kwh::float AS value FROM electricity_generation
       WHERE country_code = $1 AND demand_per_capita_kwh IS NOT NULL ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT withdrawal_m3::float AS value FROM water_data
       WHERE country_code = $1 AND withdrawal_m3 IS NOT NULL ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT population::float AS value FROM co2_emissions
       WHERE country_code = $1 AND population IS NOT NULL ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT (tree_cover_loss_ha / NULLIF(forest_area_ha, 0) * 100)::float AS value, year
       FROM vegetation_loss WHERE country_code = $1 AND tree_cover_loss_ha IS NOT NULL AND forest_area_ha IS NOT NULL
       ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT pm25_ug_m3::float AS value FROM pollution_data
       WHERE country_code = $1 AND pm25_ug_m3 IS NOT NULL ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT mammals_threatened, birds_threatened, fish_threatened FROM species_threatened_counts
       WHERE country_code = $1 ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT deviation_from_reference_c::float AS value FROM country_temperatures
       WHERE country_code = $1 AND deviation_from_reference_c IS NOT NULL ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    pool.query(
      `SELECT year, deviation_from_reference_c::float AS value FROM country_temperatures
       WHERE country_code = $1 AND deviation_from_reference_c IS NOT NULL ORDER BY year ASC`,
      [country]
    ),
    pool.query(
      `SELECT
         SUM(CASE WHEN year BETWEEN 1991 AND 2025 THEN heatwave_count ELSE 0 END) AS recent_total,
         SUM(CASE WHEN year BETWEEN 1956 AND 1990 THEN heatwave_count ELSE 0 END) AS past_total
       FROM country_temperatures WHERE country_code = $1`,
      [country]
    ),
    pool.query(
      `SELECT coal_twh::float AS coal_twh, gas_twh::float AS gas_twh, oil_twh::float AS oil_twh, nuclear_twh::float AS nuclear_twh,
              hydro_twh::float AS hydro_twh, wind_twh::float AS wind_twh, solar_twh::float AS solar_twh,
              biofuel_twh::float AS biofuel_twh, other_renewable_twh::float AS other_renewable_twh, total_generation_twh::float AS total_generation_twh
       FROM electricity_generation WHERE country_code = $1 ORDER BY year DESC LIMIT 1`,
      [country]
    ),
    // Écart mondial — même valeur que celle déjà utilisée sur /decouverte
    // (world_benchmarks), indispensable pour ne jamais afficher un chiffre
    // France isolé sans son repère mondial.
    pool.query(`SELECT value::float AS value FROM world_benchmarks WHERE metric_key = 'temperature_deviation_world'`),
  ]);

  const waterValue = waterRow.rows[0]?.value && popRow.rows[0]?.value ? waterRow.rows[0].value / popRow.rows[0].value : null;
  const speciesRowData = speciesRow.rows[0];
  const speciesValue = speciesRowData
    ? (speciesRowData.mammals_threatened || 0) + (speciesRowData.birds_threatened || 0) + (speciesRowData.fish_threatened || 0)
    : null;

  const comparisons = {
    co2: buildComparisonRow("co2", "t", 1, co2Row.rows[0]?.value ?? null, extremes.co2),
    electricite: buildComparisonRow("electricite", "kWh", 0, elecRow.rows[0]?.value ?? null, extremes.electricite),
    eau: buildComparisonRow("eau", "m³", 0, waterValue, extremes.eau),
    foret: buildComparisonRow("foret", "%", 2, forestRow.rows[0]?.value ?? null, extremes.foret),
    pollution: buildComparisonRow("pollution", "µg/m³", 1, pollutionRow.rows[0]?.value ?? null, extremes.pollution),
    especes: buildComparisonRow("especes", "", 0, speciesValue > 0 ? speciesValue : null, extremes.especes),
  };

  return {
    country,
    countryName: localizeCountryName(country, lang),
    temperatureDeviation: tempLatestRow.rows[0]?.value ?? null,
    worldTemperatureDeviation: worldTempRow.rows[0]?.value ?? null,
    temperatureHistory: tempHistoryResult.rows.map((r) => ({ year: r.year, value: r.value })),
    forestLossYear: forestRow.rows[0]?.year ?? null,
    heatwaves: {
      recent: parseInt(heatwaveResult.rows[0]?.recent_total, 10) || 0,
      past: parseInt(heatwaveResult.rows[0]?.past_total, 10) || 0,
    },
    energyTop3: computeTop3EnergySources(elecMixRow.rows[0]),
    comparisons,
  };
}

router.get("/api/kit-communication/country/:code", async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  try {
    res.json(await getCountryKitData(country, lang));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/kit-communication/pdf/:code", pdfGenerationLimiter, async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  let browser;
  try {
    const data = await getCountryKitData(country, lang);

    // QR code vers la fiche pays correspondante — un seul par document,
    // réutilisé sur les deux pages (même image, pas besoin de le générer
    // deux fois).
    const qrCodeDataUrl = await QRCode.toDataURL(`https://pasdeplaneteb.com/pays/${country.toLowerCase()}`, {
      margin: 1,
      width: 200,
    });

    const html = buildKitHtml(data, data.countryName, getKitLabels(lang), qrCodeDataUrl);

    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pasdeplaneteb-${country.toLowerCase()}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    res.status(503).json({ error: "Génération PDF impossible", detail: errorDetail(err) });
  } finally {
    if (browser) await browser.close();
  }
});

// Image de prévisualisation (og:image) — délibérément une requête légère,
// pas l'assemblage complet de getCountryKitData (qui recalcule les 6
// comparatifs meilleur/pire sur tous les pays, coûteux et inutile pour une
// simple image). Les robots des réseaux sociaux (Facebook, Twitter...)
// peuvent solliciter cette route bien plus souvent qu'un humain ne clique
// "Générer le PDF" — d'où la même limite de fréquence par prudence.
router.get("/api/kit-communication/og-image/:code", pdfGenerationLimiter, async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  let browser;
  try {
    const [tempRow] = await Promise.all([
      pool.query(
        `SELECT deviation_from_reference_c::float AS value FROM country_temperatures
         WHERE country_code = $1 AND deviation_from_reference_c IS NOT NULL ORDER BY year DESC LIMIT 1`,
        [country]
      ),
    ]);

    const labels = getKitLabels(lang);
    const countryName = localizeCountryName(country, lang);
    const html = buildOgImageHtml(countryName, tempRow.rows[0]?.value ?? null, labels);

    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    const pngBuffer = await page.screenshot({ type: "png" });

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    });
    res.send(pngBuffer);
  } catch (err) {
    res.status(503).json({ error: "Génération de l'image impossible", detail: errorDetail(err) });
  } finally {
    if (browser) await browser.close();
  }
});

// Version HTML brute du kit — la même que celle envoyée à Chromium pour
// produire le PDF, mais renvoyée telle quelle (pas de conversion PDF, donc
// pas de lancement de navigateur). C'est la route la plus légère des
// trois : utilisée par la page web /kit-communication/[code], appelée à
// chaque visite (getServerSideProps) pour rester toujours à jour.
router.get("/api/kit-communication/html/:code", async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  try {
    const data = await getCountryKitData(country, lang);
    const html = buildKitHtml(data, data.countryName, getKitLabels(lang));
    // Cette route est volontairement affichée dans une <iframe> sur
    // pasdeplaneteb.com (/kit-communication/[code]) — helmet() applique par
    // défaut X-Frame-Options: SAMEORIGIN sur toute l'API, ce qui bloquerait
    // cette iframe puisque api.pasdeplaneteb.com est une origine différente
    // du point de vue du navigateur. On neutralise ça uniquement ici (pas
    // touché ailleurs sur l'API) via frame-ancestors, la version moderne
    // qui remplace X-Frame-Options.
    //
    // CSP resserrée suite à l'audit de sécurité du 20 août 2026 : cette
    // page n'a besoin d'aucun JavaScript ni d'aucune ressource externe —
    // juste un peu de style inline (bloc <style> du gabarit) et une image
    // en data: (QR code). tout le reste est explicitement bloqué. Avant ce
    // correctif, seul frame-ancestors était défini, ce qui remplaçait
    // entièrement la CSP par défaut d'Helmet (res.set() écrase, ne
    // fusionne pas) et laissait toutes les autres catégories permissives
    // par défaut.
    res.removeHeader("X-Frame-Options");
    res.set(
      "Content-Security-Policy",
      [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        "img-src data:",
        "frame-ancestors https://pasdeplaneteb.com",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
        "script-src 'none'",
      ].join("; ")
    );
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// ============================================================================
// Kit "Actions" — rubrique indépendante du kit "Constats" ci-dessus (carte
// distincte sur /kit-communication, PDF/page web séparés). Contenu très
// majoritairement générique et sourcé (ADEME, GIEC) car universel par
// nature (un litre d'eau économisé compte pareil partout) ; les deux seuls
// points personnalisés par pays sont le commentaire sur la voiture
// électrique et sur le solaire résidentiel, nuancés selon l'intensité
// carbone réelle du réseau électrique local (voir lib/gridIntensity.js) —
// même donnée electricity_generation que le mix énergétique du kit
// Constats, pas de nouvelle ingestion nécessaire.
async function getCountryActionData(country, lang) {
  const elecMixRow = await pool.query(
    `SELECT coal_twh::float AS coal_twh, gas_twh::float AS gas_twh, oil_twh::float AS oil_twh, nuclear_twh::float AS nuclear_twh,
            hydro_twh::float AS hydro_twh, wind_twh::float AS wind_twh, solar_twh::float AS solar_twh,
            biofuel_twh::float AS biofuel_twh, other_renewable_twh::float AS other_renewable_twh, total_generation_twh::float AS total_generation_twh
     FROM electricity_generation WHERE country_code = $1 ORDER BY year DESC LIMIT 1`,
    [country]
  );

  const gCo2PerKwh = computeGridIntensity(elecMixRow.rows[0]);

  // Part des procédés industriels dans les émissions totales — calculée
  // pour le pays demandé, avec repli sur la France (elle aussi calculée
  // dynamiquement, jamais codée en dur) si absente. Les deux appels sont
  // volontairement indépendants : la France n'est PAS toujours calculée
  // uniquement quand needed, mais son coût est négligeable (une requête
  // indexée) comparé à la clarté du code.
  const [industryShare, franceIndustryShare] = await Promise.all([
    computeIndustryProcessShare(pool, country),
    country === "FRA" ? Promise.resolve(null) : computeIndustryProcessShare(pool, "FRA"),
  ]);

  return {
    country,
    countryName: localizeCountryName(country, lang),
    gridTier: gridIntensityTier(gCo2PerKwh),
    industryShare,
    franceIndustryShare,
  };
}

router.get("/api/kit-communication-actions/country/:code", async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  try {
    res.json(await getCountryActionData(country, lang));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/kit-communication-actions/pdf/:code", pdfGenerationLimiter, async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  let browser;
  try {
    const data = await getCountryActionData(country, lang);

    const qrCodeDataUrl = await QRCode.toDataURL(`https://pasdeplaneteb.com/pays/${country.toLowerCase()}`, {
      margin: 1,
      width: 200,
    });

    const html = buildKitActionHtml(data.countryName, data.gridTier, getKitActionLabels(lang), qrCodeDataUrl, data.industryShare, data.franceIndustryShare);

    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pasdeplaneteb-actions-${country.toLowerCase()}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    res.status(503).json({ error: "Génération PDF impossible", detail: errorDetail(err) });
  } finally {
    if (browser) await browser.close();
  }
});

// Image de prévisualisation (og:image) — réutilise buildOgImageHtml tel
// quel (kit Constats) : appelée sans valeur de température (tempDeviation
// = null), elle retombe automatiquement sur son mode générique
// (ogFallbackTitle + ogTagline), déjà présents dans les 8 fichiers
// kitActionLabels*.js. Rien à dupliquer.
router.get("/api/kit-communication-actions/og-image/:code", pdfGenerationLimiter, async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  let browser;
  try {
    const labels = getKitActionLabels(lang);
    const countryName = localizeCountryName(country, lang);
    const html = buildOgImageHtml(countryName, null, labels);

    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    const pngBuffer = await page.screenshot({ type: "png" });

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    });
    res.send(pngBuffer);
  } catch (err) {
    res.status(503).json({ error: "Génération de l'image impossible", detail: errorDetail(err) });
  } finally {
    if (browser) await browser.close();
  }
});

router.get("/api/kit-communication-actions/html/:code", async (req, res) => {
  const country = req.params.code.toUpperCase();
  const lang = req.query.lang || "fr";
  try {
    const data = await getCountryActionData(country, lang);
    const html = buildKitActionHtml(data.countryName, data.gridTier, getKitActionLabels(lang), undefined, data.industryShare, data.franceIndustryShare);
    res.set({ "Content-Type": "text/html; charset=utf-8" });
    res.send(html);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

export default router;
