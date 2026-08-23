// Valide la configuration JSON des graphiques attachés à une entrée
// debunk (colonne charts, voir migration 054). Volontairement strict :
// c'est une structure de DONNÉES collée par un admin (type, libellés,
// valeurs, couleurs) — jamais de code exécutable. Toute chaîne acceptée
// ici finit affichée comme texte brut côté React (jamais injectée en
// HTML), donc pas de risque XSS classique ; la validation sert surtout à
// éviter les plantages de rendu (champs manquants, tableaux de tailles
// incohérentes) et les payloads démesurés.

const CHART_TYPES = ["bar", "bar-horizontal", "line", "pie", "doughnut"];
const MAX_CHARTS = 5;
const MAX_LABELS = 20;
const MAX_DATASETS = 6;
const MAX_TITLE_LEN = 200;
const MAX_LABEL_LEN = 60;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function isNonEmptyString(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

// Renvoie { valid: true, charts: [...] } ou { valid: false, errors: [...] }.
// "charts" en sortie est la version nettoyée (jamais l'entrée brute) —
// seuls les champs reconnus sont conservés, tout le reste est ignoré.
export function validateCharts(rawCharts) {
  const errors = [];
  if (rawCharts === null || rawCharts === undefined) {
    return { valid: true, charts: null };
  }
  if (!Array.isArray(rawCharts)) {
    return { valid: false, errors: ["charts doit être un tableau (ou absent)"] };
  }
  if (rawCharts.length > MAX_CHARTS) {
    return { valid: false, errors: [`Maximum ${MAX_CHARTS} graphiques par entrée`] };
  }

  const cleaned = [];
  rawCharts.forEach((chart, i) => {
    const prefix = `Graphique ${i + 1}`;
    if (typeof chart !== "object" || chart === null) {
      errors.push(`${prefix} : doit être un objet`);
      return;
    }
    if (!CHART_TYPES.includes(chart.type)) {
      errors.push(`${prefix} : type invalide (attendu : ${CHART_TYPES.join(", ")})`);
      return;
    }
    if (!Array.isArray(chart.labels) || chart.labels.length === 0 || chart.labels.length > MAX_LABELS) {
      errors.push(`${prefix} : labels doit être un tableau de 1 à ${MAX_LABELS} éléments`);
      return;
    }
    if (!chart.labels.every((l) => isNonEmptyString(l, MAX_LABEL_LEN))) {
      errors.push(`${prefix} : chaque label doit être une chaîne non vide (max ${MAX_LABEL_LEN} caractères)`);
      return;
    }
    if (!Array.isArray(chart.datasets) || chart.datasets.length === 0 || chart.datasets.length > MAX_DATASETS) {
      errors.push(`${prefix} : datasets doit être un tableau de 1 à ${MAX_DATASETS} éléments`);
      return;
    }

    const cleanDatasets = [];
    let datasetError = false;
    chart.datasets.forEach((ds, j) => {
      if (typeof ds !== "object" || ds === null) {
        errors.push(`${prefix}, série ${j + 1} : doit être un objet`);
        datasetError = true;
        return;
      }
      if (!Array.isArray(ds.data) || ds.data.length !== chart.labels.length) {
        errors.push(`${prefix}, série ${j + 1} : data doit avoir exactement ${chart.labels.length} valeurs (autant que de labels)`);
        datasetError = true;
        return;
      }
      if (!ds.data.every((v) => typeof v === "number" && Number.isFinite(v))) {
        errors.push(`${prefix}, série ${j + 1} : toutes les valeurs de data doivent être des nombres`);
        datasetError = true;
        return;
      }
      const cleanDs = { data: ds.data };
      if (ds.label !== undefined) {
        if (!isNonEmptyString(ds.label, MAX_LABEL_LEN)) {
          errors.push(`${prefix}, série ${j + 1} : label invalide`);
          datasetError = true;
          return;
        }
        cleanDs.label = ds.label;
      }
      if (ds.color !== undefined) {
        if (!HEX_COLOR_RE.test(ds.color)) {
          errors.push(`${prefix}, série ${j + 1} : color doit être une couleur hexadécimale (ex. "#1baf7a")`);
          datasetError = true;
          return;
        }
        cleanDs.color = ds.color;
      }
      if (ds.colors !== undefined) {
        if (!Array.isArray(ds.colors) || ds.colors.length !== chart.labels.length || !ds.colors.every((c) => HEX_COLOR_RE.test(c))) {
          errors.push(`${prefix}, série ${j + 1} : colors doit être un tableau de couleurs hexadécimales, une par label`);
          datasetError = true;
          return;
        }
        cleanDs.colors = ds.colors;
      }
      cleanDatasets.push(cleanDs);
    });
    if (datasetError) return;

    const cleanChart = { type: chart.type, labels: chart.labels, datasets: cleanDatasets };
    if (chart.title !== undefined) {
      if (!isNonEmptyString(chart.title, MAX_TITLE_LEN)) {
        errors.push(`${prefix} : title invalide (max ${MAX_TITLE_LEN} caractères)`);
        return;
      }
      cleanChart.title = chart.title;
    }
    if (chart.unit !== undefined) {
      if (!isNonEmptyString(chart.unit, 30)) {
        errors.push(`${prefix} : unit invalide (max 30 caractères)`);
        return;
      }
      cleanChart.unit = chart.unit;
    }
    cleaned.push(cleanChart);
  });

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, charts: cleaned };
}
