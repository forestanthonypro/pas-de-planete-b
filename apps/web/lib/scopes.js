// Portée géographique partagée par les 6 formulaires de proposition et
// leurs filtres — pays (codes ISO3 via i18n-iso-countries, déjà une
// dépendance du site, zéro poids supplémentaire) + 8 codes fixes pour une
// portée plus large. Voir db/migrations/046_scope_codes.sql pour le détail
// du format en base.
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import frLocale from "i18n-iso-countries/langs/fr.json";
import esLocale from "i18n-iso-countries/langs/es.json";
import itLocale from "i18n-iso-countries/langs/it.json";
import ruLocale from "i18n-iso-countries/langs/ru.json";
import jaLocale from "i18n-iso-countries/langs/ja.json";
import zhLocale from "i18n-iso-countries/langs/zh.json";
import hiLocale from "i18n-iso-countries/langs/hi.json";

// Enregistré ici directement plutôt que de compter sur le fait que
// countryNames.js ait été importé ailleurs avant dans l'app — un module
// ne doit pas dépendre implicitement de l'ordre d'import d'un autre
// (bug repéré en testant ce module isolément dans un navigateur : les
// noms de pays ne se résolvaient pas sans cet enregistrement explicite).
countries.registerLocale(enLocale);
countries.registerLocale(frLocale);
countries.registerLocale(esLocale);
countries.registerLocale(itLocale);
countries.registerLocale(ruLocale);
countries.registerLocale(jaLocale);
countries.registerLocale(zhLocale);
countries.registerLocale(hiLocale);

export const CONTINENT_WORLD_CODES = ["AFR", "NAC", "SAM", "ASI", "EUR", "OCE", "ANT", "WORLD"];

// Libellés traduits des 8 codes fixes — les noms de pays sont déjà gérés
// par i18n-iso-countries (voir countryNames.js), seuls ces 8-là ont besoin
// d'une traduction maison. NAC (pas NAM, qui entre en collision avec le
// code ISO3 réel de la Namibie — bug repéré en testant ce module avant
// livraison, voir le commit).
const CONTINENT_WORLD_LABELS = {
  fr: { AFR: "Afrique", NAC: "Amérique du Nord", SAM: "Amérique du Sud", ASI: "Asie", EUR: "Europe", OCE: "Océanie", ANT: "Antarctique", WORLD: "International / Monde" },
  en: { AFR: "Africa", NAC: "North America", SAM: "South America", ASI: "Asia", EUR: "Europe", OCE: "Oceania", ANT: "Antarctica", WORLD: "International / World" },
  es: { AFR: "África", NAC: "América del Norte", SAM: "América del Sur", ASI: "Asia", EUR: "Europa", OCE: "Oceanía", ANT: "Antártida", WORLD: "Internacional / Mundo" },
  it: { AFR: "Africa", NAC: "America del Nord", SAM: "America del Sud", ASI: "Asia", EUR: "Europa", OCE: "Oceania", ANT: "Antartide", WORLD: "Internazionale / Mondo" },
  ru: { AFR: "Африка", NAC: "Северная Америка", SAM: "Южная Америка", ASI: "Азия", EUR: "Европа", OCE: "Океания", ANT: "Антарктида", WORLD: "Международное / Весь мир" },
  ja: { AFR: "アフリカ", NAC: "北アメリカ", SAM: "南アメリカ", ASI: "アジア", EUR: "ヨーロッパ", OCE: "オセアニア", ANT: "南極大陸", WORLD: "国際 / 世界全体" },
  zh: { AFR: "非洲", NAC: "北美洲", SAM: "南美洲", ASI: "亚洲", EUR: "欧洲", OCE: "大洋洲", ANT: "南极洲", WORLD: "国际 / 全球" },
  hi: { AFR: "अफ़्रीका", NAC: "उत्तरी अमेरिका", SAM: "दक्षिण अमेरिका", ASI: "एशिया", EUR: "यूरोप", OCE: "ओशिनिया", ANT: "अंटार्कटिका", WORLD: "अंतरराष्ट्रीय / विश्व" },
};

export function continentWorldLabel(code, locale) {
  const table = CONTINENT_WORLD_LABELS[locale] || CONTINENT_WORLD_LABELS.fr;
  return table[code] || code;
}

export function isContinentOrWorld(code) {
  return CONTINENT_WORLD_CODES.includes(code);
}

// Émoji drapeau à partir d'un code ISO2 — technique standard (symboles
// indicateurs régionaux Unicode), aucune image à charger, cohérent avec
// l'écoconception du site. Pas de drapeau "exact" pour continents/monde
// (ça n'existe pas) : un globe générique à la place, le libellé fait le
// reste du travail de précision.
function alpha2ToFlagEmoji(alpha2) {
  return alpha2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function scopeFlag(code) {
  if (isContinentOrWorld(code)) return "🌐";
  const alpha2 = countries.alpha3ToAlpha2(code);
  return alpha2 ? alpha2ToFlagEmoji(alpha2) : "🌐";
}

export function scopeLabel(code, locale) {
  if (isContinentOrWorld(code)) return continentWorldLabel(code, locale);
  return countries.getName(code, locale || "fr") || countries.getName(code, "fr") || code;
}

// Liste complète des options pour un sélecteur : les 8 codes fixes
// d'abord (portée large, plus rarement choisie mais utile en tête pour la
// visibilité), puis tous les pays triés alphabétiquement dans la langue
// active.
export function getAllScopeOptions(locale) {
  const continentOptions = CONTINENT_WORLD_CODES.map((code) => ({
    value: code,
    label: continentWorldLabel(code, locale),
    flag: "🌐",
    group: "continent",
  }));

  const countryNames = countries.getNames(locale || "fr", { select: "official" });
  const countryOptions = Object.keys(countryNames)
    .map((alpha2) => {
      const alpha3 = countries.alpha2ToAlpha3(alpha2);
      if (!alpha3) return null;
      return { value: alpha3, label: countryNames[alpha2], flag: alpha2ToFlagEmoji(alpha2), group: "country" };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, locale || "fr"));

  return [...continentOptions, ...countryOptions];
}
