import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VegetationPage() {
  const lastUpdated = useLastUpdated();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState("FRA");
  const [data, setData] = useState([]);
  const [view, setView] = useState("chart");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    setCountryCode(detectDefaultCountry());
    setPreferredLang(detectPreferredLanguage());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/vegetation/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/vegetation/${countryCode}`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles pour ce pays");
        return res.json();
      })
      .then((rows) => {
        setData(rows);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [countryCode]);

  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              type: "bar",
              label: "Perte de couverture arborée (ha)",
              data: data.map((d) => d.tree_cover_loss_ha),
              backgroundColor: "#e67e22",
              yAxisID: "y",
            },
            {
              type: "line",
              label: "% du couvert forestier perdu cette année-là",
              data: data.map((d) =>
                d.forest_area_ha ? (d.tree_cover_loss_ha / d.forest_area_ha) * 100 : null
              ),
              borderColor: "#d63e2a",
              backgroundColor: "rgba(214,62,42,0.1)",
              yAxisID: "y1",
              tension: 0.3,
              pointRadius: 2,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: {
            y: { type: "linear", position: "left", title: { display: true, text: "Perte (ha)" } },
            y1: {
              type: "linear",
              position: "right",
              title: { display: true, text: "% du couvert perdu" },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, view, loading, error]);

  const selectedCountryName =
    localizedCountryName(countryCode, preferredLang);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Perte de couverture arborée — {selectedCountryName}</h1>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>
          Pays{" "}
          <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            {countries.length === 0 && <option value={countryCode}>{countryCode}</option>}
            {countries.map((c) => (
              <option key={c.country_code} value={c.country_code}>{localizedCountryName(c.country_code, preferredLang)}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setView(view === "chart" ? "table" : "chart")}>
          Voir en {view === "chart" ? "tableau" : "graphique"}
        </button>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && view === "chart" && (
        <div style={{ position: "relative", height: 320 }}>
          <canvas ref={canvasRef} role="img" aria-label={`Perte de couverture arborée pour ${selectedCountryName}`} />
        </div>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Perte de couverture arborée pour {selectedCountryName}, par année
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Année</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Perte (ha)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Surface forestière totale (ha)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>% perdu</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{d.year}</th>
                <td style={{ textAlign: "right", padding: 8 }}>
                  {d.tree_cover_loss_ha ? Math.round(d.tree_cover_loss_ha).toLocaleString("fr-FR") : "—"}
                </td>
                <td style={{ textAlign: "right", padding: 8 }}>
                  {d.forest_area_ha ? Math.round(d.forest_area_ha).toLocaleString("fr-FR") : "—"}
                </td>
                <td style={{ textAlign: "right", padding: 8 }}>
                  {d.forest_area_ha && d.tree_cover_loss_ha
                    ? ((d.tree_cover_loss_ha / d.forest_area_ha) * 100).toFixed(2) + " %"
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details style={{ marginTop: "1rem", fontSize: 13, color: "#555" }}>
        <summary style={{ cursor: "pointer" }}>Que couvrent ces chiffres exactement ?</summary>
        <p style={{ marginTop: 8 }}>
          Il s&apos;agit de <strong>perte de couverture arborée</strong> détectée par satellite
          (résolution 30m, Hansen et al.), toutes causes confondues — coupe rase, incendie,
          exploitation forestière, agriculture. Ce n&apos;est pas nécessairement de la
          déforestation permanente : une parcelle peut repousser après coupe forestière gérée.
          Les données de perte couvrent 2001-2024.
        </p>
        <p>
          La courbe rouge (% perdu) rapporte cette perte annuelle à la{" "}
          <strong>surface forestière totale</strong> du pays cette année-là (FAO, référentiel
          recalculé tous les 5 ans et interpolé entre-temps) — pour donner un ordre de grandeur
          relatif plutôt qu&apos;un chiffre brut en hectares sans contexte.
        </p>
      </details>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : Global Forest Watch, via Our World in Data (CC-BY)
        {lastUpdated?.vegetation?.latestYear && (
          <> — dernière année couverte par la source : {lastUpdated.vegetation.latestYear}</>
        )}
        {lastUpdated?.vegetation?.lastIngested && (
          <> · dernière mise à jour de notre base : {formatDate(lastUpdated.vegetation.lastIngested)}</>
        )}
        . Rafraîchissement automatique mensuel.
      </p>
    </main>
  );
}
