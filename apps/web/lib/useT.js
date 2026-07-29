import { useRouter } from "next/router";
import fr from "./i18n/fr.json";
import en from "./i18n/en.json";

const DICTIONARIES = { fr, en };

// Récupère une valeur imbriquée via une clé en notation pointée
// (ex: "co2.title" -> dictionary.co2.title).
function getNested(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

// Remplace les paramètres {nom} dans une chaîne (ex: "Bonjour {name}").
function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) => (params[key] !== undefined ? params[key] : match));
}

// Hook de traduction : t("section.cle", { param: valeur }). Si la clé
// n'existe pas dans la langue courante, on retombe sur le français plutôt
// que d'afficher une clé brute ou du vide — une traduction manquante ne doit
// jamais casser la lecture de la page.
export function useT() {
  const router = useRouter();
  const locale = router.locale || "fr";
  const dict = DICTIONARIES[locale] || DICTIONARIES.fr;

  function t(key, params) {
    const value = getNested(dict, key) ?? getNested(DICTIONARIES.fr, key);
    if (value === undefined) return key;
    return interpolate(value, params);
  }

  return { t, locale };
}
