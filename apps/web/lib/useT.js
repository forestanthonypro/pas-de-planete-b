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
//
// useRouter() lève une erreur ("NextRouter was not mounted") quand aucun
// contexte routeur n'est disponible — c'est le cas pendant la génération de
// pages spéciales comme la 404 automatique de Next.js. Le try/catch protège
// contre ce cas précis ; le hook reste appelé exactement une fois à chaque
// rendu (jamais sauté ni répété), donc l'avertissement react-hooks/
// rules-of-hooks ici est un faux positif propre à ce pattern, pas un vrai
// problème d'ordre des hooks.
export function useT() {
  let locale = "fr";
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const router = useRouter();
    locale = router?.locale || "fr";
  } catch {
    // Pas de routeur disponible (ex: page d'erreur générée automatiquement
    // pendant le build) — on reste sur le français par défaut.
  }
  const dict = DICTIONARIES[locale] || DICTIONARIES.fr;

  function t(key, params) {
    const value = getNested(dict, key) ?? getNested(DICTIONARIES.fr, key);
    if (value === undefined) return key;
    return interpolate(value, params);
  }

  return { t, locale };
}
