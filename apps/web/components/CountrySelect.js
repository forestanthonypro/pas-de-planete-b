import { useMemo } from "react";
import { localizedCountryName } from "../lib/countryNames";
import { useT } from "../lib/useT";
import SearchableSelect from "./SearchableSelect";

// Sélecteur de pays — accepte soit une liste de codes ISO3 (string[]), soit
// une liste d'objets {country_code, ...} (comme renvoyés par certains
// endpoints) : les deux formats coexistent encore selon les pages.
// Le rendu (recherche web vs <select> natif mobile) est délégué à
// SearchableSelect, partagé avec les autres filtres du site.
export default function CountrySelect({ countries, value, onChange, preferredLang, label }) {
  const { t } = useT();
  const resolvedLabel = label || t("common.country_label");

  const codes = useMemo(
    () => countries.map((c) => (typeof c === "string" ? c : c.country_code)),
    [countries]
  );

  const options = useMemo(() => {
    return codes
      .map((code) => ({ value: code, label: localizedCountryName(code, preferredLang) }))
      .sort((a, b) => a.label.localeCompare(b.label, preferredLang || "fr"));
  }, [codes, preferredLang]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      label={resolvedLabel}
      placeholder={t("common.country_search_placeholder")}
      noResultsLabel={t("common.no_results")}
      mobileNative={false}
    />
  );
}
