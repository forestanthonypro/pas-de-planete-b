import { useEffect, useState } from "react";
import { detectDefaultCountry } from "./detectCountry";
import { localizedCountryName } from "./countryNames";
import { useApiFetch } from "./useApiFetch";

// Centralise le motif répété sur co2.js, eau.js, energie.js, especes.js,
// incendies.js, pollution.js, vegetation.js : état du pays sélectionné,
// détection du pays par défaut via la langue du navigateur (côté client
// uniquement, pour éviter un décalage serveur/client), et chargement de la
// liste des pays disponibles pour peupler le sélecteur.
//
// countriesEndpoint : endpoint spécifique à la page (diffère selon les
// données — ex. "/api/co2/countries") ; passer null pour ne rien charger
// (si la page gère sa propre liste autrement).
export function useCountrySelector(countriesEndpoint, { locale, fallback = "FRA" } = {}) {
  const [countryCode, setCountryCode] = useState(fallback);

  useEffect(() => {
    setCountryCode(detectDefaultCountry(fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: countriesData } = useApiFetch(countriesEndpoint, {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const countries = countriesData || [];

  const selectedCountryName = localizedCountryName(countryCode, locale);

  return { countryCode, setCountryCode, countries, selectedCountryName };
}
