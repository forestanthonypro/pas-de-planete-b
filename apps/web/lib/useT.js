import { useCallback } from "react";
import { useRouter } from "next/router";
import fr from "./i18n/fr.json";
import en from "./i18n/en.json";
import es from "./i18n/es.json";
import it from "./i18n/it.json";
import ru from "./i18n/ru.json";
import ja from "./i18n/ja.json";
import zh from "./i18n/zh.json";
import hi from "./i18n/hi.json";

const DICTIONARIES = { fr, en, es, it, ru, ja, zh, hi };

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
// rendu (jamais sauté ni répété), donc ce pattern est sûr.
export function useT() {
  let locale = "fr";
  try {
    const router = useRouter();
    locale = router?.locale || "fr";
  } catch {
    // Pas de routeur disponible (ex: page d'erreur générée automatiquement
    // pendant le build) — on reste sur le français par défaut.
  }
  const dict = DICTIONARIES[locale] || DICTIONARIES.fr;

  // Mémoïsée sur "locale" uniquement : sans ça, t() change de référence à
  // chaque rendu du composant (même quand la langue ne change pas), ce qui
  // oblige soit à l'omettre des tableaux de dépendances des useEffect (avec
  // un commentaire de suppression ESLint), soit — si on l'y inclut quand
  // même — à réexécuter ces effets à chaque rendu au lieu de seulement au
  // changement de langue. Avec cette mémoïsation, t peut être ajoutée aux
  // dépendances en toute sécurité : elle ne change que quand locale change.
  const t = useCallback(
    (key, params) => {
      const value = getNested(dict, key) ?? getNested(DICTIONARIES.fr, key);
      if (value === undefined) return key;
      return interpolate(value, params);
    },
    // "dict" est dérivé uniquement de "locale" (accès à une propriété d'un
    // objet stable importé), donc les deux sont équivalents ici — on garde
    // "locale" en dépendance : plus explicite sur ce qui déclenche réellement
    // le changement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  return { t, locale };
}
