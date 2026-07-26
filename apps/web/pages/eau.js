import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function EauPage() {
  const lastUpdated = useLastUpdated();
  const worldBenchmarks = useWorldBenchmarks();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState("FRA");
  const [data, setData] = useState([]);
  const [view, setView] = useState("chart");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const withdrawalCanvasRef = useRef(null);
  const withdrawalChartRef = useRef(null);
  const stressCanvasRef = useRef(null);
  const stressChartRef = useRef(null);

  useEffect(() => {
    setCountryCode(detectDefaultCountry());
    setPreferredLang(detectPreferredLanguage());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/water/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/water/${countryCode}`)
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
        type: "line",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              label: "Eau douce disponible par habitant (m³/an)",
              data: data.map((d) => d.renewable_freshwater_m3_per_capita),
              borderColor: "#2a78d6",
              backgroundColor: "rgba(42,120,214,0.1)",
              yAxisID: "y",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
            },
            {
              label: "Pluviométrie (mm/an)",
              data: data.map((d) => d.precipitation_mm),
              borderColor: "#1baf7a",
              backgroundColor: "rgba(27,175,122,0.1)",
              yAxisID: "y1",
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [5, 4],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: {
            y: { type: "linear", position: "left", title: { display: true, text: "m³ par habitant et par an" } },
            y1: { type: "linear", position: "right", title: { display: true, text: "mm/an" }, grid: { drawOnChartArea: false } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, view, loading, error]);

  // Second graphique : prélèvements d'eau réels (consommation), en milliards de m³/an —
  // échelle et nature différentes des ressources disponibles, donc un graphique séparé
  // plutôt qu'un troisième axe illisible sur le même repère.
  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;
    const hasWithdrawal = data.some((d) => d.withdrawal_m3 !== null && d.withdrawal_m3 !== undefined);
    if (!hasWithdrawal) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !withdrawalCanvasRef.current) return;
      if (withdrawalChartRef.current) withdrawalChartRef.current.destroy();

      withdrawalChartRef.current = new Chart(withdrawalCanvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              label: "Prélèvements d'eau réels (milliards de m³/an)",
              data: data.map((d) => (d.withdrawal_m3 ? d.withdrawal_m3 / 1e9 : null)),
              backgroundColor: "#8e44ad",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { title: { display: true, text: "Milliards de m³/an" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, view, loading, error]);

  // Troisième graphique : % des ressources renouvelables réellement prélevé
  // (stress hydrique), comparé à la moyenne mondiale — c'est la vraie
  // comparaison possible ici, contrairement aux prélèvements bruts qui
  // demanderaient une donnée de population qu'on n'a pas.
  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;
    const hasStress = data.some((d) => d.withdrawal_share_percent !== null && d.withdrawal_share_percent !== undefined);
    if (!hasStress) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !stressCanvasRef.current) return;
      if (stressChartRef.current) stressChartRef.current.destroy();

      const datasets = [
        {
          label: "Part de l'eau disponible réellement utilisée (%)",
          data: data.map((d) => d.withdrawal_share_percent),
          borderColor: "#8e44ad",
          backgroundColor: "rgba(142,68,173,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ];
      if (worldBenchmarks?.water_stress_share) {
        datasets.push({
          label: "Moyenne mondiale",
          data: data.map(() => worldBenchmarks.water_stress_share.value),
          borderColor: "#95a5a6",
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false,
        });
      }

      stressChartRef.current = new Chart(stressCanvasRef.current, {
        type: "line",
        data: { labels: data.map((d) => d.year), datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { title: { display: true, text: "% de l'eau disponible utilisée" } } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, view, loading, error, worldBenchmarks]);

  const selectedCountryName =
    localizedCountryName(countryCode, preferredLang);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Ressources en eau — {selectedCountryName}</h1>

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

      {!loading && !error && view === "chart" && (
        <>
          <div style={{ position: "relative", height: 340 }}>
            <canvas ref={canvasRef} role="img" aria-label={`Ressources en eau et pluviométrie pour ${selectedCountryName}`} />
          </div>
          {data.some((d) => d.withdrawal_m3) && (
            <div style={{ position: "relative", height: 220, marginTop: "1rem" }}>
              <canvas ref={withdrawalCanvasRef} role="img" aria-label={`Prélèvements d'eau réels pour ${selectedCountryName}`} />
            </div>
          )}
          {data.some((d) => d.withdrawal_share_percent) && (
            <>
              <p style={{ fontSize: 13, color: "#666", marginTop: "1rem", marginBottom: "0.25rem" }}>
                <strong>En clair :</strong> sur 100 litres d&apos;eau qui se renouvellent
                naturellement chaque année dans le pays, combien sont réellement utilisés
                (agriculture, usines, foyers) ? En dessous de 100 %, il en reste. Bien au-dessus,
                le pays puise plus vite que l&apos;eau ne se renouvelle — souvent dans des nappes
                non renouvelables ou via le dessalement.
              </p>
              <div style={{ position: "relative", height: 220 }}>
                <canvas ref={stressCanvasRef} role="img" aria-label={`Part de l'eau disponible utilisée pour ${selectedCountryName}, comparé à la moyenne mondiale`} />
              </div>
            </>
          )}
        </>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Eau pour {selectedCountryName}, par année
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Année</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Eau disponible (m³/hab.)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Pluviométrie (mm)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Prélèvements (Md m³)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>% de l&apos;eau utilisée</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{d.year}</th>
                <td style={{ textAlign: "right", padding: 8 }}>
                  {d.renewable_freshwater_m3_per_capita ? Math.round(d.renewable_freshwater_m3_per_capita).toLocaleString("fr-FR") : "—"}
                </td>
                <td style={{ textAlign: "right", padding: 8 }}>
                  {d.precipitation_mm ? Math.round(d.precipitation_mm).toLocaleString("fr-FR") : "—"}
                </td>
                <td style={{ textAlign: "right", padding: 8 }}>
                  {d.withdrawal_m3 ? (d.withdrawal_m3 / 1e9).toFixed(2) : "—"}
                </td>
                <td style={{ textAlign: "right", padding: 8 }}>
                  {d.withdrawal_share_percent ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details style={{ marginTop: "1rem", fontSize: 13, color: "#555" }}>
        <summary style={{ cursor: "pointer" }}>Que couvrent ces chiffres exactement ?</summary>
        <p style={{ marginTop: 8 }}>
          La courbe bleue montre les <strong>ressources renouvelables en eau douce</strong>
          disponibles par habitant (rivières internes, recharge des nappes, plus les apports
          venant de pays voisins) — un indicateur de rareté relative de l&apos;eau, pas de
          consommation réelle. C&apos;est une estimation de long terme, recalculée chaque année
          surtout pour tenir compte de l&apos;évolution démographique : la ressource physique
          sous-jacente change rarement d&apos;une année sur l&apos;autre.
        </p>
        <p>
          La courbe verte en pointillés montre la <strong>pluviométrie annuelle</strong> mesurée
          par satellite (réanalyse Copernicus ERA5) — celle-ci varie réellement chaque année.
          Pour les très petits pays, cette mesure peut être moins fiable (résolution de la grille
          climatique).
        </p>
        <p>
          Le graphique violet montre les <strong>prélèvements d&apos;eau réels</strong>
          (consommation agricole, industrielle et domestique confondues) — la comparaison directe
          avec la courbe bleue : si les prélèvements dépassent durablement les ressources
          renouvelables, c&apos;est le signe d&apos;un recours à des nappes non renouvelables ou au
          dessalement.
        </p>
      </details>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Sources : AQUASTAT/FAO via Banque mondiale (ressources renouvelables et prélèvements),
        Copernicus ERA5 (pluviométrie), via Our World in Data (CC-BY)
        {lastUpdated?.water?.latestYear && (
          <> — dernière année couverte : {lastUpdated.water.latestYear}</>
        )}
        {lastUpdated?.water?.lastIngested && (
          <> · dernière mise à jour de notre base : {formatDate(lastUpdated.water.lastIngested)}</>
        )}
        . Rafraîchissement automatique mensuel.
      </p>
    </main>
  );
}
