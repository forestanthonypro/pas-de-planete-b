// Calcule la part des émissions de "procédés industriels" (au sens
// Climate Watch : ciment, acier, chimie... — les émissions directes de la
// fabrication, pas l'électricité qu'elle consomme) dans le total national
// tous secteurs confondus, pour la dernière année où les deux valeurs
// existent pour un pays donné.
//
// Volontairement limité à cette définition précise plutôt qu'à "toute
// l'industrie" au sens large : Climate Watch regroupe l'énergie utilisée
// par l'industrie dans son secteur "Energy", mélangée au transport et au
// bâtiment — impossible de l'isoler proprement à ce niveau d'agrégation
// sans une ingestion plus fine (sous-secteurs), pas faite ici. Mieux vaut
// un chiffre précis et vérifiable qu'une approximation présentée comme
// plus large qu'elle ne l'est.

const TOTAL_SECTORS = ["Energy", "Industrial Processes", "Agriculture", "Waste", "Land-Use Change and Forestry"];

export async function computeIndustryProcessShare(pool, countryCode) {
  const result = await pool.query(
    `SELECT sector, year, value_mtco2e FROM sector_emissions
     WHERE country_code = $1 AND sector = ANY($2::text[])
     ORDER BY year DESC`,
    [countryCode, TOTAL_SECTORS]
  );
  if (result.rows.length === 0) return null;

  // Regroupe par année, ne garde que la plus récente où l'industriel ET
  // au moins un autre secteur sont tous deux renseignés (sinon la part
  // calculée serait trompeuse — mieux vaut ne rien afficher).
  const byYear = new Map();
  for (const row of result.rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, {});
    byYear.get(row.year)[row.sector] = parseFloat(row.value_mtco2e);
  }

  const years = [...byYear.keys()].sort((a, b) => b - a);
  for (const year of years) {
    const bySection = byYear.get(year);
    const industrial = bySection["Industrial Processes"];
    const total = TOTAL_SECTORS.reduce((sum, s) => (bySection[s] != null ? sum + bySection[s] : sum), 0);
    const sectorsPresent = TOTAL_SECTORS.filter((s) => bySection[s] != null).length;
    // Exige au moins 3 des 5 secteurs pour que le total soit représentatif.
    if (industrial != null && total > 0 && sectorsPresent >= 3) {
      return { year, industrialMtco2e: industrial, totalMtco2e: total, sharePct: Math.round((industrial / total) * 1000) / 10 };
    }
  }
  return null;
}
