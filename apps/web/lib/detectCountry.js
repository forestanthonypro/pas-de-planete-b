import countries from "i18n-iso-countries";

// Devine un pays par défaut à partir de la langue du navigateur, sans aucun appel
// réseau ni donnée transmise à qui que ce soit — juste une meilleure estimation
// que "France" pour tout le monde. L'utilisateur peut toujours changer le pays
// manuellement ensuite via le sélecteur.
export function detectDefaultCountry(fallback = "FRA") {
  if (typeof navigator === "undefined") return fallback;
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = locale.region; // ex: "FR", "US", "DE"
    if (!region) return fallback;
    const alpha3 = countries.alpha2ToAlpha3(region);
    return alpha3 || fallback;
  } catch {
    return fallback;
  }
}
