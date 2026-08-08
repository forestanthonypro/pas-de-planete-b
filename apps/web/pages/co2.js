import { useEffect, useRef, useState } from "react";
import { useCountrySelector } from "../lib/useCountrySelector";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { useT } from "../lib/useT";
import { useApiFetch } from "../lib/useApiFetch";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconCloud } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import ScrollableTable from "../components/ScrollableTable";

export default function Co2Page() {
  const { t, locale } = useT();
  const lastUpdated = useLastUpdated();
  const { countryCode, setCountryCode, countries, selectedCountryName } = useCountrySelector("/api/co2/countries", { locale });
  const [metric, setMetric] = useState("emissions_mt"); // ou "emissions_per_capita"
  const [view, setView] = useState("chart"); // "chart" ou "table"

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Recharge la série à chaque changement de pays.
  const { data: co2Data, loading, error } = useApiFetch(countryCode ? `/api/co2/${countryCode}` : null, {
    errorMessage: t("co2.error_no_data"),
    deps: [countryCode],
  });
  const data = co2Data || [];

  // Dessine/redessine le graphique quand les données, le métrique ou la vue changent.
  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0) return;

    const consumptionField = metric === "emissions_mt" ? "consumption_co2" : "consumption_co2_per_capita";
    const hasConsumptionData = data.some((d) => d[consumptionField] !== null && d[consumptionField] !== undefined);

    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const datasets = [
        {
          label: metric === "emissions_mt" ? t("co2.chart_label_territorial_total") : t("co2.chart_label_territorial_per_capita"),
          data: data.map((d) => d[metric]),
          borderColor: "#2a78d6",
          backgroundColor: "rgba(42,120,214,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ];

      if (hasConsumptionData) {
        datasets.push({
          label: metric === "emissions_mt" ? t("co2.chart_label_consumption_total") : t("co2.chart_label_consumption_per_capita"),
          data: data.map((d) => d[consumptionField]),
          borderColor: "#e67e22",
          backgroundColor: "rgba(230,126,34,0.1)",
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [5, 4],
        });
      }

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: data.map((d) => d.year),
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: hasConsumptionData } },
        },
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric, view, loading, error]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconCloud} tint="green" title={`${t("co2.title")} — ${selectedCountryName}`} />
      <ShareButtons title={`${t("co2.title")} — ${selectedCountryName}`} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={countryCode}
          onChange={setCountryCode}
          preferredLang={locale}
        />

        <label>
          {t("co2.unit_label")}{" "}
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="emissions_mt">{t("co2.unit_total")}</option>
            <option value="emissions_per_capita">{t("co2.unit_per_capita")}</option>
          </select>
        </label>

        <button onClick={() => setView(view === "chart" ? "table" : "chart")}>
          {view === "chart" ? t("common.view_as_table") : t("common.view_as_chart")}
        </button>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      <h2 style={{ fontSize: 18, marginBottom: "0.25rem" }}>{t("co2.what_shows_title")}</h2>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("co2.explain_p1")}</p>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("co2.explain_p2")}</p>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: "0.75rem" }}>{t("co2.explain_p3")}</p>

      {!loading && !error && view === "chart" && (
        <div style={{ position: "relative", height: 320 }}>
          <canvas ref={canvasRef} role="img" aria-label={`${t("co2.title")} — ${selectedCountryName}`} />
        </div>
      )}

      {!loading && !error && view === "table" && (
        <ScrollableTable>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
              {t("co2.table_caption", { country: selectedCountryName })}
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("co2.table_year")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("co2.table_territorial_mt")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("co2.table_territorial_per_capita")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("co2.table_consumption_mt")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.year}>
                  <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{d.year}</th>
                  <td style={{ textAlign: "right", padding: 8 }}>{d.emissions_mt ?? "—"}</td>
                  <td style={{ textAlign: "right", padding: 8 }}>{d.emissions_per_capita ?? "—"}</td>
                  <td style={{ textAlign: "right", padding: 8 }}>{d.consumption_co2 ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      <details style={{ marginBottom: "1rem", fontSize: 13, color: "var(--color-texte-clair)" }}>
        <summary style={{ cursor: "pointer" }}>{t("co2.details_summary")}</summary>
        <p style={{ marginTop: 8 }}>{t("co2.details_p1")}</p>
        <p>{t("co2.details_p2")}</p>
        <p>{t("co2.details_p3")}</p>
      </details>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
        {t("co2.source")}
        {lastUpdated?.co2?.latestYear && (
          <> {t("co2.source_latest_year", { year: lastUpdated.co2.latestYear })}</>
        )}
        {lastUpdated?.co2?.lastIngested && (
          <> {t("co2.source_last_updated", { date: formatDate(lastUpdated.co2.lastIngested, locale) })}</>
        )}
        {t("co2.source_refresh")}
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
