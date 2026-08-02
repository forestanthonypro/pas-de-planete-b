import { useEffect, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconDroplet } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";
import { useT } from "../lib/useT";
import ScrollableTable from "../components/ScrollableTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function EauPage() {
  const { t, locale } = useT();
  const lastUpdated = useLastUpdated();
  const worldBenchmarks = useWorldBenchmarks();
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
        if (!res.ok) throw new Error(t("eau.error_no_data"));
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

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              label: t("eau.chart_freshwater"),
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
              label: t("eau.chart_precipitation"),
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
            y: { type: "linear", position: "left", title: { display: true, text: t("eau.axis_per_capita") } },
            y1: { type: "linear", position: "right", title: { display: true, text: t("eau.axis_mm_year") }, grid: { drawOnChartArea: false } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, loading, error]);

  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;
    const hasWithdrawal = data.some((d) => d.withdrawal_m3 !== null && d.withdrawal_m3 !== undefined);
    if (!hasWithdrawal) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !withdrawalCanvasRef.current) return;
      if (withdrawalChartRef.current) withdrawalChartRef.current.destroy();

      withdrawalChartRef.current = new Chart(withdrawalCanvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              label: t("eau.chart_withdrawal"),
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
            y: { title: { display: true, text: t("eau.axis_billion_m3") } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, loading, error]);

  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;
    const hasStress = data.some((d) => d.withdrawal_share_percent !== null && d.withdrawal_share_percent !== undefined);
    if (!hasStress) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !stressCanvasRef.current) return;
      if (stressChartRef.current) stressChartRef.current.destroy();

      const datasets = [
        {
          label: t("eau.chart_stress"),
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
          label: t("eau.chart_world_avg"),
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
          scales: { y: { title: { display: true, text: t("eau.axis_share_used") } } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, loading, error, worldBenchmarks]);

  const selectedCountryName = localizedCountryName(countryCode, locale);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconDroplet} tint="blue" title={`${t("eau.title")} — ${selectedCountryName}`} />
      <ShareButtons title={`${t("eau.title")} — ${selectedCountryName}`} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={countryCode}
          onChange={setCountryCode}
          locale={locale}
        />
        <button onClick={() => setView(view === "chart" ? "table" : "chart")}>
          {view === "chart" ? t("common.view_as_table") : t("common.view_as_chart")}
        </button>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && view === "chart" && (
        <>
          <div style={{ position: "relative", height: 340 }}>
            <canvas ref={canvasRef} role="img" aria-label={`${t("eau.title")} — ${selectedCountryName}`} />
          </div>
          {data.some((d) => d.withdrawal_m3) && (
            <div style={{ position: "relative", height: 220, marginTop: "1rem" }}>
              <canvas ref={withdrawalCanvasRef} role="img" aria-label={t("eau.chart_withdrawal")} />
            </div>
          )}
          {data.some((d) => d.withdrawal_share_percent) && (
            <>
              <h2 style={{ fontSize: 18, marginTop: "2rem", marginBottom: "0.25rem" }}>
                {t("eau.second_chart_title")}
              </h2>
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("eau.explain_p1")}</p>
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("eau.explain_p2")}</p>
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("eau.explain_p3")}</p>
              <div style={{ position: "relative", height: 220 }}>
                <canvas ref={stressCanvasRef} role="img" aria-label={t("eau.chart_stress")} />
              </div>
            </>
          )}
        </>
      )}

      {!loading && !error && view === "table" && (
        <ScrollableTable>
<table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
            {t("eau.table_caption", { country: selectedCountryName })}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("eau.table_year")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("eau.table_available")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("eau.table_precipitation")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("eau.table_withdrawal")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("eau.table_share")}</th>
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
</ScrollableTable>
      )}

      <details style={{ marginTop: "1rem", fontSize: 13, color: "var(--color-texte-clair)" }}>
        <summary style={{ cursor: "pointer" }}>{t("eau.details_summary")}</summary>
        <p style={{ marginTop: 8 }}>{t("eau.details_p1")}</p>
        <p>{t("eau.details_p2")}</p>
        <p>{t("eau.details_p3")}</p>
      </details>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("eau.source")}
        {lastUpdated?.water?.latestYear && (
          <> {t("eau.source_latest_year", { year: lastUpdated.water.latestYear })}</>
        )}
        {lastUpdated?.water?.lastIngested && (
          <> {t("eau.source_last_updated", { date: formatDate(lastUpdated.water.lastIngested) })}</>
        )}
        {t("eau.source_refresh")}
      </p>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
