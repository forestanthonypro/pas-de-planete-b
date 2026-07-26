import { useEffect, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { speciesGroupLabel } from "../lib/speciesGroups";
import { formatCommonNames } from "../lib/commonNames";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const CATEGORY_INFO = {
  EX: { label: "Éteinte", color: "#000000" },
  EW: { label: "Éteinte à l'état sauvage", color: "#3d3d3d" },
  CR: { label: "En danger critique", color: "#d63e2a" },
  EN: { label: "En danger", color: "#e67e22" },
  VU: { label: "Vulnérable", color: "#f4b400" },
  NT: { label: "Quasi menacée", color: "#cbd423" },
  LC: { label: "Préoccupation mineure", color: "#1baf7a" },
  DD: { label: "Données insuffisantes", color: "#95a5a6" },
};

export default function EspecesPage() {
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("FRA");
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/co2/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));

    fetch(`${API_URL}/api/species/categories`)
      .then((res) => res.json())
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (country) params.set("country", country);

    fetch(`${API_URL}/api/species?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      })
      .then((rows) => {
        setSpecies(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [category, country]);

  const selectedCountryName =
    countries.find((c) => c.country_code === country)?.country_name || country;

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Espèces menacées — {selectedCountryName}</h1>

      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Échantillon d&apos;espèces observées dans ce pays, par catégorie d&apos;extinction UICN,
        à partir des occurrences republiées par GBIF. Ce n&apos;est pas la liste complète des
        espèces évaluées, mais un aperçu représentatif. Les noms communs sans traduction connue
        sont indiqués comme tels plutôt que devinés.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>
          Pays{" "}
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.length === 0 && <option value={country}>{country}</option>}
            {countries.map((c) => (
              <option key={c.country_code} value={c.country_code}>
                {c.country_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Catégorie{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c]?.label || c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}
      {!loading && !error && species.length === 0 && (
        <p>Aucune espèce trouvée pour ce filtre dans cet échantillon.</p>
      )}

      {!loading && !error && species.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Espèces — {selectedCountryName} {category ? `(${CATEGORY_INFO[category]?.label || category})` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Nom scientifique</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Noms communs</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Catégorie</th>
            </tr>
          </thead>
          <tbody>
            {species.map((s) => {
              const info = CATEGORY_INFO[s.category] || { label: s.category, color: "#999" };
              const names = formatCommonNames(s.common_names);
              return (
                <tr key={s.scientific_name}>
                  <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400, fontStyle: "italic" }}>
                    {s.scientific_name}
                  </th>
                  <td style={{ textAlign: "left", padding: 8, color: names ? "inherit" : "#999", fontSize: 13 }}>
                    {names || "non disponible"}
                  </td>
                  <td style={{ textAlign: "left", padding: 8 }}>
                    {speciesGroupLabel(s.kingdom, s.class)}
                  </td>
                  <td style={{ padding: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "white",
                        backgroundColor: info.color,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {info.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : GBIF, occurrences classées par catégorie UICN via la collaboration GBIF-IUCN (CC-BY)
      </p>
    </main>
  );
}
