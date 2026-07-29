import { useEffect, useMemo, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";
import { useT } from "../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VegetationPage() {
  const { t } = useT();
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
        if (!res.ok) throw new Error(t("vegetation.error_no_data"));
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

  const cumulativeSummary = useMemo(() => {
    if (data.length === 0) return null;
    const filled = data.map((r) => ({ ...r }));
    let last = null;
    for (let i = 0; i < filled.length; i++) {
      if (filled[i].forest_area_ha != null) last = filled[i].forest_area_ha;
      else if (last != null) filled[i].forest_area_ha = last;
    }
    let next = null;
    for (let i = filled.length - 1; i >= 0; i--) {
      if (data[i].forest_area_ha != null) next = data[i].forest_area_ha;
      else if (filled[i].forest_area_ha == null && next != null) filled[i].forest_area_ha = next;
    }
    const firstLossRow = data.find((d) => d.tree_cover_loss_ha != null);
    const lastLossRow = [...data].reverse().find((d) => d.tree_cover_loss_ha != null);
    if (!firstLossRow || !lastLossRow) return null;
    const baselineRow = filled.find((d) => d.year === firstLossRow.year);
    const baselineArea = baselineRow?.forest_area_ha;
    if (!baselineArea) return null;
    const totalLoss = data.reduce((sum, d) => sum + (parseFloat(d.tree_cover_loss_ha) || 0), 0);
    return {
      startYear: firstLossRow.year,
      endYear: lastLossRow.year,
      totalLossHa: totalLoss,
      percent: (totalLoss / baselineArea) * 100,
    };
  }, [data]);

  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      function fillNearestForestArea(rows) {
        const filled = rows.map((r) => ({ ...r }));
        let last = null;
        for (let i = 0; i < filled.length; i++) {
          if (filled[i].forest_area_ha != null) last = filled[i].forest_area_ha;
          else if (last != null) filled[i].forest_area_ha = last;
        }
        let next = null;
        for (let i = filled.length - 1; i >= 0; i--) {
          if (rows[i].forest_area_ha != null) next = rows[i].forest_area_ha;
          else if (filled[i].forest_area_ha == null && next != null) filled[i].forest_area_ha = next;
        }
        return filled;
      }
      const filledData = fillNearestForestArea(data);

      const firstLossYear = data.find((d) => d.tree_cover_loss_ha != null)?.year;
      const baselineArea = filledData.find((d) => d.year === firstLossYear)?.forest_area_ha;
      let cumulativeLoss = 0;
      const cumulativeShareData = filledData.map((d) => {
        cumulativeLoss += parseFloat(d.tree_cover_loss_ha) || 0;
        return baselineArea ? (cumulativeLoss / baselineArea) * 100 : null;
      });

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              type: "bar",
              label: t("vegetation.chart_loss_ha"),
              data: data.map((d) => d.tree_cover_loss_ha),
              backgroundColor: "#e67e22",
              yAxisID: "y",
            },
            {
              type: "line",
              label: t("vegetation.chart_share_year"),
              data: filledData.map((d) =>
                d.forest_area_ha ? (d.tree_cover_loss_ha / d.forest_area_ha) * 100 : null
              ),
              borderColor: "#d63e2a",
              backgroundColor: "rgba(214,62,42,0.1)",
              yAxisID: "y1",
              tension: 0.3,
              pointRadius: 2,
              borderWidth: 2,
            },
            {
              type: "line",
              label: t("vegetation.chart_cumulative"),
              data: cumulativeShareData,
              borderColor: "#6c3483",
              backgroundColor: "rgba(108,52,131,0.08)",
              yAxisID: "y1",
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [2, 2],
              fill: true,
            },
            ...(worldBenchmarks?.forest_loss_share_world
              ? [
                  {
                    type: "line",
                    label: t("vegetation.chart_world_avg"),
                    data: data.map(() => worldBenchmarks.forest_loss_share_world.value),
                    borderColor: "#95a5a6",
                    borderDash: [4, 4],
                    yAxisID: "y1",
                    pointRadius: 0,
                    borderWidth: 1.5,
                    fill: false,
                  },
                ]
              : []),
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: {
            y: { type: "linear", position: "left", title: { display: true, text: t("vegetation.axis_loss_ha") } },
            y1: {
              type: "linear",
              position: "right",
              title: { display: true, text: t("vegetation.axis_share_lost") },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, loading, error, worldBenchmarks]);

  const selectedCountryName = localizedCountryName(countryCode, preferredLang);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>{t("vegetation.title")} — {selectedCountryName}</h1>
      <ShareButtons title={`${t("vegetation.title")} — ${selectedCountryName}`} />

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

      <h2 style={{ fontSize: 18, marginBottom: "0.25rem" }}>{t("vegetation.what_shows_title")}</h2>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("vegetation.explain_p1")}</p>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("vegetation.explain_p2")}</p>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("vegetation.note_technical")}</p>

      {!loading && !error && view === "chart" && (
        <div style={{ position: "relative", height: 320 }}>
          <canvas ref={canvasRef} role="img" aria-label={`${t("vegetation.title")} — ${selectedCountryName}`} />
        </div>
      )}

      {cumulativeSummary && (
        <p style={{ fontSize: 14, marginTop: "0.75rem" }}>
          {t("vegetation.cumulative_summary", {
            startYear: cumulativeSummary.startYear,
            endYear: cumulativeSummary.endYear,
            country: selectedCountryName,
            totalLoss: Math.round(cumulativeSummary.totalLossHa).toLocaleString("fr-FR"),
            percent: cumulativeSummary.percent.toFixed(2),
          })}
        </p>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
            {t("vegetation.table_caption", { country: selectedCountryName })}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("vegetation.table_year")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("vegetation.table_loss")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("vegetation.table_forest_area")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("vegetation.table_share_lost")}</th>
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

      <details style={{ marginTop: "1rem", fontSize: 13, color: "var(--color-texte-clair)" }}>
        <summary style={{ cursor: "pointer" }}>{t("vegetation.details_summary")}</summary>
        <p style={{ marginTop: 8 }}>{t("vegetation.details_p1")}</p>
        <p>{t("vegetation.details_p2")}</p>
      </details>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("vegetation.source")}
        {lastUpdated?.vegetation?.latestYear && (
          <> {t("vegetation.source_latest_year", { year: lastUpdated.vegetation.latestYear })}</>
        )}
        {lastUpdated?.vegetation?.lastIngested && (
          <> {t("vegetation.source_last_updated", { date: formatDate(lastUpdated.vegetation.lastIngested) })}</>
        )}
        {t("vegetation.source_refresh")}
      </p>
    </div>
  );
}
