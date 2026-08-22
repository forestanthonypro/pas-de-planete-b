import { labelsActionFr } from "./kitActionLabelsFr.js";
import { labelsActionEn } from "./kitActionLabelsEn.js";
import { labelsActionEs } from "./kitActionLabelsEs.js";
import { labelsActionIt } from "./kitActionLabelsIt.js";
import { labelsActionRu } from "./kitActionLabelsRu.js";
import { labelsActionJa } from "./kitActionLabelsJa.js";
import { labelsActionZh } from "./kitActionLabelsZh.js";
import { labelsActionHi } from "./kitActionLabelsHi.js";

const ALL_LABELS = {
  fr: labelsActionFr,
  en: labelsActionEn,
  es: labelsActionEs,
  it: labelsActionIt,
  ru: labelsActionRu,
  ja: labelsActionJa,
  zh: labelsActionZh,
  hi: labelsActionHi,
};

// Même principe que getKitLabels() (kitLabels.js) pour la rubrique
// "Constats" : repli sur le français si la langue demandée n'est pas
// couverte, jamais de page blanche.
export function getKitActionLabels(lang) {
  return ALL_LABELS[lang] || labelsActionFr;
}
