// Nom de pays traduit et cohérent partout dans l'app — au lieu de dépendre du
// libellé brut renvoyé par chaque source de données (OWID en anglais, GBIF
// différemment, etc.), on retraduit systématiquement à partir du seul code
// ISO3 fiable, dans la langue détectée du navigateur (repli sur le français).
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import frLocale from "i18n-iso-countries/langs/fr.json";
import esLocale from "i18n-iso-countries/langs/es.json";
import deLocale from "i18n-iso-countries/langs/de.json";

countries.registerLocale(enLocale);
countries.registerLocale(frLocale);
countries.registerLocale(esLocale);
countries.registerLocale(deLocale);

export function localizedCountryName(iso3, lang) {
  if (!iso3) return "";
  const wanted = lang || "fr";
  return countries.getName(iso3, wanted) || countries.getName(iso3, "fr") || countries.getName(iso3, "en") || iso3;
}
