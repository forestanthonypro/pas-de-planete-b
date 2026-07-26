import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Co2Page() {
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState("FRA");
  const [metric, setMetric] = useState("emissions_mt"); // ou "emissions_per_capita"
  const [data, setData] = useState([]);
  const [view, setView] = useState("chart"); // "chart" ou "table"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Charge la liste des pays une seule fois, pour peupler le filtre.
  useEffect(() => {
    fetch(`${API_URL}/api/co2/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));
  }, []);

  // Recharge la série à chaque changement de pays.
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/co2/${countryCode}`)
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

  // Dessine/redessine le graphique quand les données, le métrique ou la vue changent.
  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;

    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              label: metric === "emissions_mt" ? "Émissions (Mt CO2)" : "Émissions par habitant (t)",
              data: data.map((d) => d[metric]),
              borderColor: "#2a78d6",
              backgroundColor: "rgba(42,120,214,0.1)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [data, metric, view, loading, error]);

  const selectedCountryName =
    countries.find((c) => c.country_code === countryCode)?.country_name || countryCode;

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Émissions de CO2 — {selectedCountryName}</h1>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>
          Pays{" "}
          <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            {countries.length === 0 && <option value={countryCode}>{countryCode}</option>}
            {countries.map((c) => (
              <option key={c.country_code} value={c.country_code}>
                {c.country_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Unité{" "}
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="emissions_mt">Total (Mt)</option>
            <option value="emissions_per_capita">Par habitant (t)</option>
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
          <canvas ref={canvasRef} role="img" aria-label={`Émissions de CO2 pour ${selectedCountryName}`} />
        </div>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Émissions de CO2 pour {selectedCountryName}, par année
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Année</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Total (Mt)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Par habitant (t)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{d.year}</th>
                <td style={{ textAlign: "right", padding: 8 }}>{d.emissions_mt ?? "—"}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{d.emissions_per_capita ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : Global Carbon Project, via Our World in Data (CC-BY)
      </p>
    </main>
  );
}
