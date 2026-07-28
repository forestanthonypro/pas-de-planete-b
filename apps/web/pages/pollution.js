import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { localizedCountryName } from "../lib/countryNames";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PollutionPage() {
  const lastUpdated = useLastUpdated();
  const benchmarks = useWorldBenchmarks();
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
    fetch(`${API_URL}/api/pollution/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/pollution/${countryCode}`)
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
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const datasets = [
        {
          label: "Exposition PM2.5 (µg/m³)",
          data: data.map((d) => d.pm25_ug_m3),
          borderColor: "#e67e22",
          backgroundColor: "rgba(230,126,34,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ];

      if (benchmarks?.pm25_who_guideline) {
        datasets.push({
          label: "Seuil recommandé OMS (5 µg/m³)",
          data: data.map(() => benchmarks.pm25_who_guideline.value),
          borderColor: "#1baf7a",
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 2,
          fill: false,
        });
      }
      if (benchmarks?.pm25_world_average) {
        datasets.push({
          label: "Moyenne mondiale",
          data: data.map(() => benchmarks.pm25_world_average.value),
          borderColor: "#95a5a6",
          borderDash: [2, 3],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false,
        });
      }

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { labels: data.map((d) => d.year), datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { title: { display: true, text: "µg/m³" } } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, view, loading, error, benchmarks]);

  const selectedCountryName = localizedCountryName(countryCode, preferredLang);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Pollution de l&apos;air — {selectedCountryName}</h1>
      <ShareButtons title={`Pollution de l'air — ${selectedCountryName}`} />


      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={countryCode}
          onChange={setCountryCode}
          preferredLang={preferredLang}
        />
        <button onClick={() => setView(view === "chart" ? "table" : "chart")}>
          Voir en {view === "chart" ? "tableau" : "graphique"}
        </button>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      <h2 style={{ fontSize: 18, marginBottom: "0.25rem" }}>Que montre ce graphique ?</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
        La courbe orange, c&apos;est la quantité de particules fines respirées en moyenne par les
        habitants du pays. Plus c&apos;est haut, plus l&apos;air est pollué. La ligne verte
        (5 µg/m³), c&apos;est le seuil que l&apos;OMS recommande de ne pas dépasser pour limiter
        les risques pour la santé — moins de 15 % des villes du monde le respectent aujourd&apos;hui.
        Exemple : une valeur à 15 µg/m³ veut dire que le pays respire, en moyenne, 3 fois plus de
        particules fines que ce que l&apos;OMS recommande.
      </p>

      {!loading && !error && view === "chart" && (
        <div style={{ position: "relative", height: 340 }}>
          <canvas ref={canvasRef} role="img" aria-label={`Exposition PM2.5 pour ${selectedCountryName}`} />
        </div>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Pollution de l&apos;air pour {selectedCountryName}, par année
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Année</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>PM2.5 (µg/m³)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{d.year}</th>
                <td style={{ textAlign: "right", padding: 8 }}>{d.pm25_ug_m3 ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details style={{ marginTop: "1rem", fontSize: 13, color: "#555" }}>
        <summary style={{ cursor: "pointer" }}>Que couvre ce chiffre exactement ?</summary>
        <p style={{ marginTop: 8 }}>
          Il s&apos;agit de l&apos;<strong>exposition moyenne annuelle aux particules fines PM2.5</strong>,
          pondérée par la population (les zones les plus peuplées comptent davantage), estimée par
          modélisation satellite. L&apos;OMS recommande de rester sous 5 µg/m³ pour limiter les
          risques cardiovasculaires et respiratoires — moins de 15 % des villes du monde respectent
          ce seuil aujourd&apos;hui.
        </p>
      </details>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : SatPM (Washington University in St. Louis), via Our World in Data (CC-BY)
        {lastUpdated?.pollution?.latestYear && (
          <> — dernière année couverte : {lastUpdated.pollution.latestYear}</>
        )}
        {lastUpdated?.pollution?.lastIngested && (
          <> · dernière mise à jour de notre base : {formatDate(lastUpdated.pollution.lastIngested)}</>
        )}
        . Rafraîchissement automatique mensuel.
      </p>
    </div>
  );
}
