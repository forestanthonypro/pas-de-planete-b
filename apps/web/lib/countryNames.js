// Nom de pays traduit et cohérent partout dans l'app — au lieu de dépendre du
// libellé brut renvoyé par chaque source de données (OWID en anglais, GBIF
// différemment, etc.), on retraduit systématiquement à partir du seul code
// ISO3 fiable, dans la langue active du site (repli sur le français).
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import frLocale from "i18n-iso-countries/langs/fr.json";
import esLocale from "i18n-iso-countries/langs/es.json";
import itLocale from "i18n-iso-countries/langs/it.json";
import ruLocale from "i18n-iso-countries/langs/ru.json";
import jaLocale from "i18n-iso-countries/langs/ja.json";
import zhLocale from "i18n-iso-countries/langs/zh.json";
import hiLocale from "i18n-iso-countries/langs/hi.json";
import deLocale from "i18n-iso-countries/langs/de.json";

countries.registerLocale(enLocale);
countries.registerLocale(frLocale);
countries.registerLocale(esLocale);
countries.registerLocale(itLocale);
countries.registerLocale(ruLocale);
countries.registerLocale(jaLocale);
countries.registerLocale(zhLocale);
countries.registerLocale(hiLocale);
countries.registerLocale(deLocale);

export function localizedCountryName(iso3, lang) {
  if (!iso3) return "";
  const wanted = lang || "fr";
  return countries.getName(iso3, wanted) || countries.getName(iso3, "fr") || countries.getName(iso3, "en") || iso3;
}
