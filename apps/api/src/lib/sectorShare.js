// Calcule la répartition des émissions de gaz à effet de serre par
// secteur pour un pays donné, pour la dernière année où au moins 3 des 5
// secteurs sont renseignés (sinon le total serait trompeur — mieux vaut
// ne rien afficher). Source : Climate Watch (World Resources Institute),
// voir ingest/sectorEmissions.js.

const TOTAL_SECTORS = ["Energy", "Industrial Processes", "Agriculture", "Waste", "Land-Use Change and Forestry"];

// Calcule la répartition complète (les 5 secteurs, triés du plus gros au
// plus petit) — utilisée à la fois pour l'histogramme et pour extraire la
// part spécifique de l'industrie, sans dupliquer la requête SQL.
export async function computeSectorBreakdown(pool, countryCode) {
  const result = await pool.query(
    `SELECT sector, year, value_mtco2e FROM sector_emissions
     WHERE country_code = $1 AND sector = ANY($2::text[])
     ORDER BY year DESC`,
    [countryCode, TOTAL_SECTORS]
  );
  if (result.rows.length === 0) return null;

  const byYear = new Map();
  for (const row of result.rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, {});
    byYear.get(row.year)[row.sector] = parseFloat(row.value_mtco2e);
  }

  const years = [...byYear.keys()].sort((a, b) => b - a);
  for (const year of years) {
    const bySection = byYear.get(year);
    const sectorsPresent = TOTAL_SECTORS.filter((s) => bySection[s] != null).length;
    if (sectorsPresent < 3) continue;

    const total = TOTAL_SECTORS.reduce((sum, s) => (bySection[s] != null ? sum + bySection[s] : sum), 0);
    if (total <= 0) continue;

    const sectors = TOTAL_SECTORS
      .filter((s) => bySection[s] != null)
      .map((s) => ({
        sector: s,
        valueMtco2e: bySection[s],
        sharePct: Math.round((bySection[s] / total) * 1000) / 10,
      }))
      .sort((a, b) => b.valueMtco2e - a.valueMtco2e);

    return { year, totalMtco2e: total, sectors };
  }
  return null;
}

// Part spécifique des "procédés industriels" (au sens Climate Watch :
// ciment, acier, chimie... — pas l'énergie que l'industrie consomme,
// mélangée avec transport/bâtiment dans le secteur "Energy", impossible à
// isoler proprement à ce niveau d'agrégation). Dérivée de
// computeSectorBreakdown() pour ne faire qu'une seule requête SQL.
export async function computeIndustryProcessShare(pool, countryCode) {
  const breakdown = await computeSectorBreakdown(pool, countryCode);
  if (!breakdown) return null;
  const industrial = breakdown.sectors.find((s) => s.sector === "Industrial Processes");
  if (!industrial) return null;
  return { year: breakdown.year, industrialMtco2e: industrial.valueMtco2e, totalMtco2e: breakdown.totalMtco2e, sharePct: industrial.sharePct };
}
