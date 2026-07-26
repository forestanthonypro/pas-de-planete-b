// Formatte les noms communs disponibles (fr, en, es, de). Si la langue du
// visiteur est détectée ET disponible, on affiche uniquement ce nom-là ;
// sinon (langue non détectée, ou absente pour cette espèce), on affiche tout,
// pour ne jamais laisser quelqu'un sans aucune information exploitable.
const LANGUAGE_LABELS = { fr: "FR", en: "EN", es: "ES", de: "DE" };
const LANGUAGE_ORDER = ["fr", "en", "es", "de"];

export function formatCommonNames(commonNames, preferredLang) {
  if (!commonNames || Object.keys(commonNames).length === 0) {
    return null;
  }
  if (preferredLang && commonNames[preferredLang]) {
    return commonNames[preferredLang];
  }
  return LANGUAGE_ORDER.filter((lang) => commonNames[lang])
    .map((lang) => `${LANGUAGE_LABELS[lang]} : ${commonNames[lang]}`)
    .join(" · ");
}
