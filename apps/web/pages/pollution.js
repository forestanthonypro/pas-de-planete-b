import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { localizedCountryName } from "../lib/countryNames";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";
import { useT } from "../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PollutionPage() {
  const { t } = useT();
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
        if (!res.ok) throw new Error(t("pollution.error_no_data"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode]);

  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const datasets = [
        {
          label: t("pollution.chart_pm25"),
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
          label: t("pollution.chart_who_threshold"),
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
          label: t("pollution.chart_world_avg"),
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
          scales: { y: { title: { display: true, text: t("pollution.axis_ug_m3") } } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, loading, error, benchmarks]);

  const selectedCountryName = localizedCountryName(countryCode, preferredLang);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>{t("pollution.title")} — {selectedCountryName}</h1>
      <ShareButtons title={`${t("pollution.title")} — ${selectedCountryName}`} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={countryCode}
          onChange={setCountryCode}
          preferredLang={preferredLang}
        />
        <button onClick={() => setView(view === "chart" ? "table" : "chart")}>
          {view === "chart" ? t("common.view_as_table") : t("common.view_as_chart")}
        </button>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      <h2 style={{ fontSize: 18, marginBottom: "0.25rem" }}>{t("pollution.what_shows_title")}</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>{t("pollution.explain_p1")}</p>

      {!loading && !error && view === "chart" && (
        <div style={{ position: "relative", height: 340 }}>
          <canvas ref={canvasRef} role="img" aria-label={`${t("pollution.title")} — ${selectedCountryName}`} />
        </div>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            {t("pollution.table_caption", { country: selectedCountryName })}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("pollution.table_year")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("pollution.table_pm25")}</th>
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
        <summary style={{ cursor: "pointer" }}>{t("pollution.details_summary")}</summary>
        <p style={{ marginTop: 8 }}>{t("pollution.details_p1")}</p>
      </details>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        {t("pollution.source")}
        {lastUpdated?.pollution?.latestYear && (
          <> {t("pollution.source_latest_year", { year: lastUpdated.pollution.latestYear })}</>
        )}
        {lastUpdated?.pollution?.lastIngested && (
          <> {t("pollution.source_last_updated", { date: formatDate(lastUpdated.pollution.lastIngested) })}</>
        )}
        {t("pollution.source_refresh")}
      </p>
    </div>
  );
}
