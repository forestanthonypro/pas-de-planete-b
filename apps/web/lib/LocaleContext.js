import { createContext, useContext } from "react";

// Contexte minimal exposant la locale active, alimenté par _app.js à partir
// de sa prop "router" — PAS via le Hook useRouter(), qui lève une exception
// ("NextRouter was not mounted") en l'absence de contexte routeur complet
// (pages 404/500 générées automatiquement, génération statique...).
//
// useContext() ne lève jamais d'exception, contrairement à useRouter() : il
// retombe silencieusement sur cette valeur par défaut s'il n'y a pas de
// Provider au-dessus — exactement le comportement recherché, sans avoir à
// envelopper un Hook dans un try/catch (qui viole les Rules of Hooks et
// peut provoquer des décalages d'hydratation serveur/client, voir
// KNOWN_ISSUES_build.md).
export const LocaleContext = createContext({
  locale: "fr",
  locales: ["fr"],
  defaultLocale: "fr",
});

export function useLocaleContext() {
  return useContext(LocaleContext);
}
