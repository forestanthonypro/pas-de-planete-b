// Warming stripes : regroupe l'historique complet (une valeur par année) en
// bandes de ~5 ans, puis attribue à chaque bande une couleur sur une
// échelle FIXE (pas relative aux valeurs du pays affiché) — pour que le
// bleu/rouge d'un pays veuille dire la même chose que sur la fiche d'un
// autre pays.

export const STRIPE_COLORS = [
  "#0b3c5d", "#185fa5", "#378add", "#85b7eb", "#b5d4f4", "#e6f1fb",
  "#f5f2e8", "#faeeda", "#fac775", "#ef9f27", "#ba7517", "#f0997b",
  "#d85a30", "#993c1d", "#4a1b0c",
];
export const SCALE_MIN = -1.5; // borne froide de l'échelle fixe
export const SCALE_MAX = 2.5; // borne chaude de l'échelle fixe

export function deviationToColor(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "#cccccc";
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
  const ratio = (clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN); // 0..1
  const idx = Math.round(ratio * (STRIPE_COLORS.length - 1));
  return STRIPE_COLORS[idx];
}

// history : [{ year, value }, ...] triés par année croissante, value =
// deviation_from_reference_c. Renvoie un tableau de couleurs, une par
// bande de bandSize années (moyenne des valeurs de la bande).
export function buildWarmingStripes(history, bandSize = 5) {
  if (!history || history.length === 0) return [];
  const bands = [];
  for (let i = 0; i < history.length; i += bandSize) {
    const slice = history.slice(i, i + bandSize).filter((h) => h.value !== null && h.value !== undefined);
    if (slice.length === 0) continue;
    const avg = slice.reduce((sum, h) => sum + h.value, 0) / slice.length;
    bands.push({
      startYear: slice[0].year,
      endYear: slice[slice.length - 1].year,
      avgValue: avg,
      color: deviationToColor(avg),
    });
  }
  return bands;
}
