// Associe le code de langue du site au tag BCP47 approprié pour
// toLocaleDateString()/toLocaleString() — évite d'afficher des dates/nombres
// au format français quand le site est consulté dans une autre langue.
const LOCALE_MAP = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
  it: "it-IT",
  ru: "ru-RU",
  ja: "ja-JP",
  zh: "zh-CN",
  hi: "hi-IN",
};

export function localeTag(locale) {
  return LOCALE_MAP[locale] || "fr-FR";
}
