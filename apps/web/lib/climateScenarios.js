// Données de réchauffement climatique mondial, par rapport à la moyenne
// 1850-1900 (référence "préindustrielle" standard du GIEC) — utilisées par
// GenerationalWarmingChart.js sur /temperatures et /decouverte.
//
// Ce ne sont PAS les données de country_temperatures (observations locales
// par pays, via ERA5) : ici il s'agit de la température moyenne MONDIALE,
// et pour la partie 2020-2100, de scénarios futurs — un sujet différent qui
// n'a pas d'équivalent ailleurs sur le site.
//
// Important sur le droit d'auteur : ces chiffres sont des données
// scientifiques publiques (non protégeables en tant que telles), mais la
// mise en forme graphique spécifique du GIEC (couleurs, pictogrammes,
// disposition) est sa propriété — ce fichier ne reproduit que les valeurs
// numériques, la visualisation elle-même est une création originale du
// site.
//
// --- Partie historique (1900-2024), observée ---
// Source : NASA GISS GISTEMP, décennies 1900-2010 (base 1951-1980),
// converties vers la base 1850-1900 via le facteur +0.31°C établi par
// Bonnet (2022), "Global Warming Baselines Conversion Factors"
// (https://zenodo.org/records/6373058) — écart mesuré entre les deux
// périodes de référence.
// Décennie 2011-2020 et année 2024 : chiffres directement exprimés par
// rapport à 1850-1900 dans les publications NASA/GIEC elles-mêmes (pas de
// conversion nécessaire) : "2011-2020 was around 1.1°C warmer than
// 1850-1900" (GIEC, synthèse AR6) ; 2024 = +1.47°C (NASA GISS, analyse
// annuelle 2024, science.nasa.gov/earth/measuring_global_temperature/).
export const HISTORICAL_ANOMALY = [
  { year: 1900, anomalyC: 0.11 },
  { year: 1910, anomalyC: -0.04 },
  { year: 1920, anomalyC: 0.06 },
  { year: 1930, anomalyC: 0.03 },
  { year: 1940, anomalyC: 0.39 },
  { year: 1950, anomalyC: 0.26 },
  { year: 1960, anomalyC: 0.36 },
  { year: 1970, anomalyC: 0.31 },
  { year: 1980, anomalyC: 0.51 },
  { year: 1990, anomalyC: 0.61 },
  { year: 2000, anomalyC: 0.76 },
  { year: 2010, anomalyC: 0.94 },
  { year: 2015, anomalyC: 1.1 }, // point représentatif de la décennie 2011-2020
  { year: 2024, anomalyC: 1.47 },
];

// --- Partie future (2020-2100), scénarios ---
// Source : GIEC, 6e rapport d'évaluation (AR6), groupe de travail I,
// "Résumé à l'intention des décideurs", tableau SPM.1 (2021) — estimations
// centrales ("best estimate") de réchauffement par rapport à 1850-1900,
// pour les 3 horizons temporels du rapport : court terme (2021-2040),
// moyen terme (2041-2060), long terme (2081-2100). Années "pivot" choisies
// au milieu de chaque période (2030, 2050, 2090) pour le tracé.
//
// Les 5 scénarios (SSP = "Shared Socioeconomic Pathways") correspondent à
// des trajectoires d'émissions différentes, du plus sobre au plus intensif
// — ce ne sont pas des prédictions, mais des futurs possibles selon les
// choix collectifs faits ou non.
//
// "choicesKey" (texte affiché au survol de chaque courbe et sous la
// légende) résume la trajectoire socio-économique associée à chaque
// scénario dans le cadre AR6 lui-même — GIEC AR6 WG1, chapitre 1 et
// annexe III (description des 5 familles SSP) : SSP1 = développement
// orienté durabilité, SSP2 = prolongement des tendances actuelles,
// SSP3 = priorité aux enjeux nationaux/sécuritaires, faible coopération
// internationale, SSP5 = développement fondé sur les énergies fossiles.
// Les repères 1.9/2.6/4.5/7.0/8.5 correspondent au forçage radiatif visé
// en 2100 (W/m²) — plus le chiffre est élevé, moins l'effort de réduction
// des émissions est important.
// "natureImpactKey" (texte pédagogique affiché quand on sélectionne un
// scénario) résume les impacts sur la biodiversité au niveau de
// réchauffement long terme correspondant — GIEC AR6 groupe de travail II
// (impacts, adaptation, vulnérabilité, 2022), notamment :
// - risque d'extinction "très élevé" par palier de réchauffement, pour les
//   espèces terrestres étudiées : 14 % à +1,5°C, 18 % à +2°C, 29 % à +3°C,
//   39 % à +4°C, jusqu'à 48 % à +5°C (chiffres du rapport, largement
//   relayés — ex. Yale Climate Connections, 28/02/2022) ;
// - GIEC AR6 WG2, FAQ 2 : à ~4°C d'ici 2100, mortalités massives et
//   extinctions attendues, transformant de façon irréversible des zones à
//   très forte biodiversité (récifs coralliens tropicaux, forêts de kelp
//   en eaux froides, forêts tropicales) ;
// - Chaque scénario est rattaché au chiffre du palier le plus proche de sa
//   valeur "long terme" (2081-2100) — une approximation assumée et
//   expliquée dans le texte lui-même plutôt que présentée comme une
//   précision qu'elle n'a pas.
export const SCENARIOS = [
  {
    id: "ssp119",
    labelKey: "generationalWarming.scenario_ssp119",
    choicesKey: "generationalWarming.choices_ssp119",
    natureImpactKey: "generationalWarming.nature_ssp119",
    color: "#2a78d6", // bleu — cohérent avec la palette déjà utilisée pour les graphiques du site (DebunkCharts.js)
    points: [
      { year: 2020, anomalyC: 1.1 },
      { year: 2030, anomalyC: 1.5 },
      { year: 2050, anomalyC: 1.6 },
      { year: 2090, anomalyC: 1.4 },
      { year: 2100, anomalyC: 1.4 },
    ],
  },
  {
    id: "ssp126",
    labelKey: "generationalWarming.scenario_ssp126",
    choicesKey: "generationalWarming.choices_ssp126",
    natureImpactKey: "generationalWarming.nature_ssp126",
    color: "#1baf7a", // vert
    points: [
      { year: 2020, anomalyC: 1.1 },
      { year: 2030, anomalyC: 1.5 },
      { year: 2050, anomalyC: 1.7 },
      { year: 2090, anomalyC: 1.8 },
      { year: 2100, anomalyC: 1.8 },
    ],
  },
  {
    id: "ssp245",
    labelKey: "generationalWarming.scenario_ssp245",
    choicesKey: "generationalWarming.choices_ssp245",
    natureImpactKey: "generationalWarming.nature_ssp245",
    color: "#eda100", // ambre
    points: [
      { year: 2020, anomalyC: 1.1 },
      { year: 2030, anomalyC: 1.5 },
      { year: 2050, anomalyC: 2.0 },
      { year: 2090, anomalyC: 2.7 },
      { year: 2100, anomalyC: 2.7 },
    ],
  },
  {
    id: "ssp370",
    labelKey: "generationalWarming.scenario_ssp370",
    choicesKey: "generationalWarming.choices_ssp370",
    natureImpactKey: "generationalWarming.nature_ssp370",
    color: "#eb6834", // orange
    points: [
      { year: 2020, anomalyC: 1.1 },
      { year: 2030, anomalyC: 1.5 },
      { year: 2050, anomalyC: 2.1 },
      { year: 2090, anomalyC: 3.6 },
      { year: 2100, anomalyC: 3.6 },
    ],
  },
  {
    id: "ssp585",
    labelKey: "generationalWarming.scenario_ssp585",
    choicesKey: "generationalWarming.choices_ssp585",
    natureImpactKey: "generationalWarming.nature_ssp585",
    color: "#b0401f", // rouge
    points: [
      { year: 2020, anomalyC: 1.1 },
      { year: 2030, anomalyC: 1.6 },
      { year: 2050, anomalyC: 2.4 },
      { year: 2090, anomalyC: 4.4 },
      { year: 2100, anomalyC: 4.4 },
    ],
  },
];

const LAST_HISTORICAL_YEAR = HISTORICAL_ANOMALY[HISTORICAL_ANOMALY.length - 1].year;

// Interpolation linéaire entre les points connus les plus proches — pas de
// prétention de précision au-delà de ce que les données sources
// permettent réellement (le GIEC lui-même ne donne que 3 horizons, pas une
// valeur par année).
function interpolate(points, year) {
  if (year <= points[0].year) return points[0].anomalyC;
  if (year >= points[points.length - 1].year) return points[points.length - 1].anomalyC;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (year >= a.year && year <= b.year) {
      const ratio = (year - a.year) / (b.year - a.year);
      return a.anomalyC + ratio * (b.anomalyC - a.anomalyC);
    }
  }
  return points[points.length - 1].anomalyC;
}

// Pour une année donnée : si elle est déjà passée (ou proche du présent,
// avant que les scénarios ne divergent réellement), un seul chiffre
// observé. Sinon, une valeur par scénario — le futur n'est pas écrit,
// contrairement au passé.
export function estimateWarmingAtYear(year) {
  const clampedYear = Math.min(year, 2100);
  if (clampedYear <= LAST_HISTORICAL_YEAR) {
    return { type: "historical", value: interpolate(HISTORICAL_ANOMALY, clampedYear) };
  }
  const byScenario = {};
  for (const scenario of SCENARIOS) {
    byScenario[scenario.id] = interpolate(scenario.points, clampedYear);
  }
  return { type: "scenarios", values: byScenario };
}
