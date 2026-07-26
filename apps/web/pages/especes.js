import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Libellés et couleurs officiels des catégories UICN.
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
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  }, [category]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Espèces menacées</h1>

      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Échantillon d&apos;espèces par catégorie d&apos;extinction, à partir des occurrences
        classées par la Liste rouge de l&apos;UICN et republiées par GBIF. Ce n&apos;est pas
        la liste complète des espèces évaluées, mais un aperçu par catégorie.
      </p>

      <div style={{ marginBottom: "1rem" }}>
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
      {!loading && !error && species.length === 0 && <p>Aucune espèce trouvée pour ce filtre.</p>}

      {!loading && !error && species.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Espèces {category ? `— catégorie ${CATEGORY_INFO[category]?.label || category}` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Nom scientifique</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Nom commun</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Catégorie</th>
            </tr>
          </thead>
          <tbody>
            {species.map((s) => {
              const info = CATEGORY_INFO[s.category] || { label: s.category, color: "#999" };
              return (
                <tr key={s.scientific_name}>
                  <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400, fontStyle: "italic" }}>
                    {s.scientific_name}
                  </th>
                  <td style={{ textAlign: "left", padding: 8 }}>{s.common_name || "—"}</td>
                  <td style={{ padding: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "white",
                        backgroundColor: info.color,
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
