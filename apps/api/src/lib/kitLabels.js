import { labelsFr } from "./kitLabelsFr.js";
import { labelsEn } from "./kitLabelsEn.js";
import { labelsEs } from "./kitLabelsEs.js";
import { labelsIt } from "./kitLabelsIt.js";
import { labelsRu } from "./kitLabelsRu.js";
import { labelsJa } from "./kitLabelsJa.js";
import { labelsZh } from "./kitLabelsZh.js";
import { labelsHi } from "./kitLabelsHi.js";

const ALL_LABELS = {
  fr: labelsFr,
  en: labelsEn,
  es: labelsEs,
  it: labelsIt,
  ru: labelsRu,
  ja: labelsJa,
  zh: labelsZh,
  hi: labelsHi,
};

// Repli sur le français si la langue demandée n'est pas (encore) couverte —
// jamais de page blanche ou de crash pour une langue mal orthographiée.
export function getKitLabels(lang) {
  return ALL_LABELS[lang] || labelsFr;
}
