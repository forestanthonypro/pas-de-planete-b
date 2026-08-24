// Formatte les noms communs disponibles (8 langues du site). Si la langue du
// visiteur est détectée ET disponible, on affiche uniquement ce nom-là ;
// sinon (langue non détectée, ou absente pour cette espèce), on affiche tout,
// pour ne jamais laisser quelqu'un sans aucune information exploitable.
const LANGUAGE_LABELS = { fr: "FR", en: "EN", es: "ES", it: "IT", ru: "RU", ja: "JA", zh: "ZH", hi: "HI", de: "DE" };
const LANGUAGE_ORDER = ["fr", "en", "es", "it", "ru", "ja", "zh", "hi", "de"];

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

// Un seul nom, pour les contextes compacts (libellé de graphique) : la
// langue du visiteur si disponible, sinon le premier nom trouvé dans
// l'ordre de LANGUAGE_ORDER, sinon null (jamais de chaîne vide).
export function primaryCommonName(commonNames, preferredLang) {
  if (!commonNames || Object.keys(commonNames).length === 0) return null;
  if (preferredLang && commonNames[preferredLang]) return commonNames[preferredLang];
  const lang = LANGUAGE_ORDER.find((l) => commonNames[l]);
  return lang ? commonNames[lang] : null;
}
