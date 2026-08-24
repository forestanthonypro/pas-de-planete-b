import { useEffect, useMemo, useRef, useState } from "react";
import { useCountrySelector } from "../lib/useCountrySelector";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconTree } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";
import { useT } from "../lib/useT";
import ScrollableTable from "../components/ScrollableTable";
import { useApiFetch } from "../lib/useApiFetch";

function ObservedSpeciesChart({ topSpecies, canvasRef, chartRef, t, locale, titleKey }) {
  useEffect(() => {
    if (!topSpecies || topSpecies.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();
      const rows = topSpecies.slice(0, 10);
      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: rows.map((s) => s.scientific_name),
          datasets: [
            {
              label: t("vegetation.observedSpecies.chart_count"),
              data: rows.map((s) => s.observation_count),
              backgroundColor: rows.map((s) => (s.in_global_tree_search ? "#1baf7a" : "#4285f4")),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: t("vegetation.observedSpecies.axis_count") } },
            y: { ticks: { font: { style: "italic" } } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topSpecies, locale, titleKey]);

  if (!topSpecies || topSpecies.length === 0) return null;
  return (
    <div style={{ position: "relative", height: 260, marginBottom: "0.75rem" }}>
      <canvas ref={canvasRef} role="img" aria-label={t("vegetation.observedSpecies.chart_count")} />
    </div>
  );
}

function CoverageNote({ coverage, t }) {
  if (!coverage || !coverage.total_occurrences) return null;
  const total = Number(coverage.total_occurrences);
  const em = Number(coverage.establishment_means_count || 0);
  const de = Number(coverage.degree_of_establishment_count || 0);
  const emPct = total ? ((em / total) * 100).toFixed(1) : "0";
  const dePct = total ? ((de / total) * 100).toFixed(1) : "0";
  return (
    <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "0.5rem" }}>
      {t("vegetation.observedSpecies.coverage_note", { total: total.toLocaleString("fr-FR"), emPct, dePct })}
    </p>
  );
}

function ObservedSpeciesTable({ topSpecies, t }) {
  if (!topSpecies || topSpecies.length === 0) return null;
  return (
    <ScrollableTable>
      <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("vegetation.observedSpecies.table_species")}</th>
            <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("vegetation.observedSpecies.table_count")}</th>
            <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("vegetation.observedSpecies.table_gts")}</th>
          </tr>
        </thead>
        <tbody>
          {topSpecies.map((s) => (
            <tr key={s.scientific_name}>
              <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400, fontStyle: "italic" }}>
                {s.scientific_name}
              </th>
              <td style={{ textAlign: "right", padding: 6 }}>{Number(s.observation_count).toLocaleString("fr-FR")}</td>
              <td style={{ padding: 6 }}>
                {s.in_global_tree_search ? (
                  <span style={{ color: "#1baf7a", fontSize: 12 }}>{t("vegetation.observedSpecies.gts_yes")}</span>
                ) : (
                  <span style={{ color: "var(--color-texte-clair)", fontSize: 12 }}>{t("vegetation.observedSpecies.gts_no")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

export default function VegetationPage() {
  const { t, locale } = useT();
  const lastUpdated = useLastUpdated();
  const worldBenchmarks = useWorldBenchmarks();
  const { countryCode, setCountryCode, countries, selectedCountryName } = useCountrySelector("/api/vegetation/countries", { locale });
  const [view, setView] = useState("chart");

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const { data: countrySpeciesData } = useApiFetch(`/api/species-observations/${countryCode}`, {
    transform: (d) => d || { coverage: null, topSpecies: [] },
  });
  const countrySpeciesChartRef = useRef(null);
  const countrySpeciesCanvasRef = useRef(null);

  const { data: placesList } = useApiFetch("/api/species-observations/places/list", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const [placeSlug, setPlaceSlug] = useState("");
  useEffect(() => {
    if (!placeSlug && placesList && placesList.length > 0) setPlaceSlug(placesList[0].slug);
  }, [placesList, placeSlug]);
  const { data: placeSpeciesData } = useApiFetch(placeSlug ? `/api/species-observations/places/${placeSlug}` : null, {
    transform: (d) => d || { coverage: null, topSpecies: [] },
  });
  const placeSpeciesChartRef = useRef(null);
  const placeSpeciesCanvasRef = useRef(null);

  const { data: vegetationRows, loading, error } = useApiFetch(`/api/vegetation/${countryCode}`, {
    errorMessage: t("vegetation.error_no_data"),
  });
  const data = useMemo(() => vegetationRows ?? [], [vegetationRows]);

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
          order: 0,
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
              order: -100,
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
              order: -100,
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
              order: -100,
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
            x: {
              ticks: { maxRotation: 0, autoSkip: false },
              afterBuildTicks: (axis) => {
                const total = axis.ticks.length;
                const step = Math.max(1, Math.ceil(total / 10));
                axis.ticks = axis.ticks.filter((t, i) => i % step === 0 || i === total - 1);
              },
            },
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
  }, [data, view, loading, error, worldBenchmarks, locale]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconTree} tint="green" title={`${t("vegetation.title")} — ${selectedCountryName}`} />
      <ShareButtons title={`${t("vegetation.title")} — ${selectedCountryName}`} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={countryCode}
          onChange={setCountryCode}
          preferredLang={locale}
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
        <ScrollableTable>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
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
        </ScrollableTable>
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

      <section style={{ marginTop: "2.5rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
        <h2 style={{ fontSize: 18 }}>{t("vegetation.observedSpecies.title")}</h2>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
          {t("vegetation.observedSpecies.intro")}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
          {t("vegetation.observedSpecies.gts_disclaimer")}
        </p>

        <h3 style={{ fontSize: 15 }}>{t("vegetation.observedSpecies.by_country_title", { country: selectedCountryName })}</h3>
        {countrySpeciesData?.topSpecies?.length > 0 ? (
          <>
            <ObservedSpeciesChart
              topSpecies={countrySpeciesData.topSpecies}
              canvasRef={countrySpeciesCanvasRef}
              chartRef={countrySpeciesChartRef}
              t={t}
              locale={locale}
              titleKey={`country-${countryCode}`}
            />
            <details style={{ fontSize: 13 }}>
              <summary style={{ cursor: "pointer" }}>{t("vegetation.observedSpecies.table_toggle")}</summary>
              <ObservedSpeciesTable topSpecies={countrySpeciesData.topSpecies} t={t} />
            </details>
            <CoverageNote coverage={countrySpeciesData.coverage} t={t} />
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("vegetation.observedSpecies.no_data")}</p>
        )}

        <h3 style={{ fontSize: 15, marginTop: "1.5rem" }}>{t("vegetation.observedSpecies.by_place_title")}</h3>
        {placesList && placesList.length > 0 && (
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            {t("vegetation.observedSpecies.place_label")}{" "}
            <select value={placeSlug} onChange={(e) => setPlaceSlug(e.target.value)}>
              {placesList.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {placeSpeciesData?.place?.contexte && (
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontStyle: "italic", marginBottom: "0.5rem" }}>
            {placeSpeciesData.place.contexte}
          </p>
        )}
        {placeSpeciesData?.topSpecies?.length > 0 ? (
          <>
            <ObservedSpeciesChart
              topSpecies={placeSpeciesData.topSpecies}
              canvasRef={placeSpeciesCanvasRef}
              chartRef={placeSpeciesChartRef}
              t={t}
              locale={locale}
              titleKey={`place-${placeSlug}`}
            />
            <details style={{ fontSize: 13 }}>
              <summary style={{ cursor: "pointer" }}>{t("vegetation.observedSpecies.table_toggle")}</summary>
              <ObservedSpeciesTable topSpecies={placeSpeciesData.topSpecies} t={t} />
            </details>
            <CoverageNote coverage={placeSpeciesData.coverage} t={t} />
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("vegetation.observedSpecies.no_data")}</p>
        )}

        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
          {t("vegetation.observedSpecies.source")}
          {lastUpdated?.speciesObservations?.lastIngested && (
            <> {t("vegetation.observedSpecies.source_last_updated", { date: formatDate(lastUpdated.speciesObservations.lastIngested, locale) })}</>
          )}
        </p>
      </section>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
