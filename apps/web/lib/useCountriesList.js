import { useApiFetch } from "./useApiFetch";

// Isole le chargement de la liste des pays — utilisé par useCountrySelector
// (qui gère en plus l'état local + la détection automatique), et
// directement par les pages où le pays vient d'ailleurs que d'un état local
// détecté (ex. pays/[code].js, où il vient de l'URL).
export function useCountriesList(endpoint) {
  const { data } = useApiFetch(endpoint, {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  return data ?? [];
}
