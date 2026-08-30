import { useEffect, useRef, useState } from "react";
import { useCountrySelector } from "../lib/useCountrySelector";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { useT } from "../lib/useT";
import { useApiFetch } from "../lib/useApiFetch";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconThermometer } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import ScrollableTable from "../components/ScrollableTable";
import Pagination from "../components/Pagination";
import { useSobriety } from "../lib/SobrietyContext";
import GenerationalWarmingChart from "../components/GenerationalWarmingChart";
import TodayWeatherDeviation from "../components/TodayWeatherDeviation";
import CityNormalsChart from "../components/CityNormalsChart";

const PAGE_SIZE = 20;

// Couleur d'une barre du graphique "warming stripes" à partir de l'écart à
// la référence — dégradé bleu (plus froid que la référence) -> blanc (proche
// de la référence) -> rouge (plus chaud), inspiré du warming stripes d'Ed
// Hawkins. L'écart est borné à ±2°C pour la mise à l'échelle des couleurs :
// au-delà, la barre reste au bleu/rouge le plus saturé plutôt que de
// continuer à s'éclaircir indéfiniment (peu d'années dépassent ±2°C d'écart
// annuel moyen, donc peu d'impact visuel à borner ici).
const STRIPE_COLD = [8, 48, 107]; // bleu foncé
const STRIPE_WHITE = [255, 255, 255];
const STRIPE_HOT = [103, 0, 13]; // rouge foncé
const STRIPE_CLAMP_C = 2;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function stripeColor(deviation) {
  if (deviation === null || deviation === undefined) return "rgba(150,150,150,0.4)";
  const clamped = Math.max(-STRIPE_CLAMP_C, Math.min(STRIPE_CLAMP_C, deviation));
  const t = clamped / STRIPE_CLAMP_C; // -1..1
  const [from, to] = t < 0 ? [STRIPE_COLD, STRIPE_WHITE] : [STRIPE_WHITE, STRIPE_HOT];
  const localT = t < 0 ? t + 1 : t; // remap vers 0..1 sur la moitié concernée
  const rgb = from.map((c, i) => Math.round(lerp(c, to[i], localT)));
  return `rgb(${rgb.join(",")})`;
}

export default function TemperaturesPage() {
  const { t, locale } = useT();
  const { sobriety } = useSobriety();
  const lastUpdated = useLastUpdated();
  const { countryCode, setCountryCode, countries, selectedCountryName } = useCountrySelector(
    "/api/temperatures/countries",
    { locale }
  );
  const [view, setView] = useState("chart"); // "chart" ou "table"
  const [page, setPage] = useState(1);
  // Vue simplifiée par défaut : masque le graphique vagues de chaleur/froid,
  // le détail méthodologique et le tableau, pour un premier contact rapide
  // plutôt qu'une exploration complète — le detail reste à un clic (bouton
  // "Voir plus de détails"). Repensé après un constat : la page d'origine
  // montrait tout d'un coup, plus proche d'un outil d'exploration pour
  // public déjà convaincu que d'un outil pensé pour convaincre vite un
  // novice sceptique.
  const [simplified, setSimplified] = useState(true);

  useEffect(() => {
    if (sobriety) setView("table");
  }, [sobriety]);

  useEffect(() => {
    setPage(1);
  }, [countryCode, view]);

  const stripesCanvasRef = useRef(null);
  const stripesChartRef = useRef(null);
  const wavesCanvasRef = useRef(null);
  const wavesChartRef = useRef(null);
  const worldStripesCanvasRef = useRef(null);
  const worldStripesChartRef = useRef(null);

  const { data: tempData, loading, error } = useApiFetch(
    countryCode ? `/api/temperatures/${countryCode}` : null,
    {
      errorMessage: t("temperatures.error_no_data"),
      transform: (rows) => (Array.isArray(rows) ? rows : []),
      deps: [countryCode],
    }
  );
  const data = tempData ?? [];

  // Moyenne mondiale — affichée par défaut, avant même le choix d'un pays,
  // pour donner un point de repère immédiat quel que soit le pays détecté
  // automatiquement. Chargée une seule fois (pas de dépendance à
  // countryCode), indépendante du pays affiché juste en dessous.
  const { data: worldTempData, loading: worldLoading } = useApiFetch("/api/temperatures/world", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const worldData = worldTempData ?? [];
  const worldLatest = worldData.length > 0 ? [...worldData].reverse().find((d) => d.deviation_from_reference_c !== null) : null;

  // Warming stripes mondial — affiché en premier, indépendant du pays.
  useEffect(() => {
    if (worldLoading || worldData.length === 0 || !worldStripesCanvasRef.current) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !worldStripesCanvasRef.current) return;
      if (worldStripesChartRef.current) worldStripesChartRef.current.destroy();

      worldStripesChartRef.current = new Chart(worldStripesCanvasRef.current, {
        type: "bar",
        data: {
          labels: worldData.map((d) => d.year),
          datasets: [
            {
              label: t("temperatures.chart_stripes_title_world"),
              data: worldData.map(() => 1),
              backgroundColor: worldData.map((d) => stripeColor(d.deviation_from_reference_c)),
              borderWidth: 0,
              categoryPercentage: 1.0,
              barPercentage: 1.0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 0, autoSkip: false },
            // Force l'affichage du dernier repère (voir même correctif co2.js,
            // 21 août — sinon Chart.js peut le sauter en espaçant les étiquettes).
              afterBuildTicks: (axis) => {
                const total = axis.ticks.length;
                const step = Math.max(1, Math.ceil(total / 10));
                axis.ticks = axis.ticks.filter((t, i) => i % step === 0 || i === total - 1);
              },
            },
            y: { display: false },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const d = worldData[ctx.dataIndex];
                  const dev = d.deviation_from_reference_c;
                  return dev === null || dev === undefined
                    ? t("temperatures.tooltip_no_deviation")
                    : `${dev > 0 ? "+" : ""}${dev.toFixed(2)}°C`;
                },
              },
            },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldData, worldLoading, locale]);

  // Warming stripes.
  useEffect(() => {
    if (view !== "chart" || loading || error || data.length === 0 || !stripesCanvasRef.current) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !stripesCanvasRef.current) return;
      if (stripesChartRef.current) stripesChartRef.current.destroy();

      stripesChartRef.current = new Chart(stripesCanvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              label: t("temperatures.chart_stripes_title"),
              data: data.map(() => 1), // hauteur uniforme : seule la couleur encode l'écart
              backgroundColor: data.map((d) => stripeColor(d.deviation_from_reference_c)),
              borderWidth: 0,
              categoryPercentage: 1.0,
              barPercentage: 1.0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 0, autoSkip: false },
            // Force l'affichage du dernier repère (voir même correctif co2.js,
            // 21 août — sinon Chart.js peut le sauter en espaçant les étiquettes).
              afterBuildTicks: (axis) => {
                const total = axis.ticks.length;
                const step = Math.max(1, Math.ceil(total / 10));
                axis.ticks = axis.ticks.filter((t, i) => i % step === 0 || i === total - 1);
              },
            },
            y: { display: false },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const d = data[ctx.dataIndex];
                  const dev = d.deviation_from_reference_c;
                  return dev === null || dev === undefined
                    ? t("temperatures.tooltip_no_deviation")
                    : `${dev > 0 ? "+" : ""}${dev.toFixed(2)}°C`;
                },
              },
            },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, error, view, locale]);

  // Vagues de chaleur / de froid.
  useEffect(() => {
    if (simplified || view !== "chart" || loading || error || data.length === 0 || !wavesCanvasRef.current) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !wavesCanvasRef.current) return;
      if (wavesChartRef.current) wavesChartRef.current.destroy();

      wavesChartRef.current = new Chart(wavesCanvasRef.current, {
        type: "bar",
        data: {
          labels: data.map((d) => d.year),
          datasets: [
            {
              label: t("temperatures.chart_label_heatwaves"),
              data: data.map((d) => d.heatwave_count ?? 0),
              backgroundColor: "#c0392b",
            },
            {
              label: t("temperatures.chart_label_coldwaves"),
              data: data.map((d) => d.coldwave_count ?? 0),
              backgroundColor: "#2a6fa8",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 0, autoSkip: false },
            // Force l'affichage du dernier repère (voir même correctif co2.js,
            // 21 août — sinon Chart.js peut le sauter en espaçant les étiquettes).
              afterBuildTicks: (axis) => {
                const total = axis.ticks.length;
                const step = Math.max(1, Math.ceil(total / 10));
                axis.ticks = axis.ticks.filter((t, i) => i % step === 0 || i === total - 1);
              },
            },
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
          plugins: { legend: { display: true } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, error, view, locale, simplified]);

  const referencePeriod = data.length > 0 ? data[data.length - 1].reference_period : null;
  const worldReferencePeriod = worldLatest?.reference_period || referencePeriod || "1991-2020";
  const countryLatest = data.length > 0 ? [...data].reverse().find((d) => d.deviation_from_reference_c !== null) : null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconThermometer} tint="teal" title={t("temperatures.title")} />

      {/* Accroche + repère mondial — toujours visible, avant même le choix
          d'un pays, pour donner un point d'entrée immédiat plutôt que
          d'obliger à choisir un pays avant de voir quoi que ce soit
          (le pays par défaut est de toute façon déjà détecté automatiquement
          juste en dessous, mais ce repère mondial reste vrai quel qu'il soit). */}
      <p style={{ fontSize: 17, fontWeight: 600, color: "var(--color-texte)", marginBottom: 4 }}>
        {t("temperatures.hook_headline")}
      </p>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>{t("temperatures.chart_stripes_title_world")}</h3>
      {!worldLoading && worldLatest && (
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: 8 }}>
          {t("temperatures.deviation_stat_label", {
            value: `${worldLatest.deviation_from_reference_c > 0 ? "+" : ""}${worldLatest.deviation_from_reference_c.toFixed(2)}`,
            period: worldReferencePeriod,
          })}
        </p>
      )}
      {/* Toujours visible (même en mode simplifié) : un chiffre de
          réchauffement isolé, sans sa période de référence, induit
          facilement en erreur — un visiteur qui a déjà vu un autre chiffre
          ailleurs (Météo-France, GIEC...) pourrait croire à une erreur ou à
          une minimisation de notre part, alors que c'est un choix de
          référence différent qui explique l'essentiel de l'écart. */}
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 12, fontStyle: "italic" }}>
        {t("temperatures.reference_period_note", { period: worldReferencePeriod })}
      </p>
      {!worldLoading && worldData.length > 0 && (
        <div style={{ position: "relative", height: 70, marginBottom: "1.5rem" }}>
          <canvas ref={worldStripesCanvasRef} role="img" aria-label={t("temperatures.chart_stripes_title_world")} />
        </div>
      )}

      <ShareButtons title={`${t("temperatures.title")} — ${selectedCountryName}`} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect countries={countries} value={countryCode} onChange={setCountryCode} preferredLang={locale} />
        {!simplified && (
          <button type="button" onClick={() => setView(view === "chart" ? "table" : "chart")} disabled={sobriety}>
            {view === "chart" ? t("common.view_as_table") : t("common.view_as_chart")}
          </button>
        )}
        {sobriety && !simplified && (
          <span style={{ fontSize: 12, color: "var(--color-texte-clair)", alignSelf: "center" }}>
            {t("temperatures.chart_sobriety_disabled")}
          </span>
        )}
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && (
        <p role="alert">
          {t("common.error_prefix")} {error}
        </p>
      )}

      {simplified ? (
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: "0.75rem" }}>
          {t("temperatures.explain_point")}
        </p>
      ) : (
        <>
          <h2 style={{ fontSize: 18, marginBottom: "0.25rem" }}>{t("temperatures.what_shows_title")}</h2>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
            {t("temperatures.explain_stripes", { period: referencePeriod || "1991-2020" })}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
            {t("temperatures.explain_waves")}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: "0.75rem" }}>
            {t("temperatures.explain_point")}
          </p>
        </>
      )}

      {!loading && !error && data.length > 0 && (view === "chart" || simplified) && (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>
            {t("temperatures.chart_stripes_title")} — {selectedCountryName}
          </h3>
          {countryLatest && (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: 6 }}>
              {t("temperatures.deviation_stat_label", {
                value: `${countryLatest.deviation_from_reference_c > 0 ? "+" : ""}${countryLatest.deviation_from_reference_c.toFixed(2)}`,
                period: referencePeriod || "1991-2020",
              })}
            </p>
          )}
          <div style={{ position: "relative", height: 140, marginBottom: "1.5rem" }}>
            <canvas
              ref={stripesCanvasRef}
              role="img"
              aria-label={`${t("temperatures.chart_stripes_title")} — ${selectedCountryName}`}
            />
          </div>

          {!simplified && (
            <>
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>{t("temperatures.chart_waves_title")}</h3>
              <div style={{ position: "relative", height: 260, marginBottom: "1rem" }}>
                <canvas
                  ref={wavesCanvasRef}
                  role="img"
                  aria-label={`${t("temperatures.chart_waves_title")} — ${selectedCountryName}`}
                />
              </div>
            </>
          )}
        </>
      )}

      <p style={{ marginBottom: "1rem" }}>
        <button type="button" onClick={() => setSimplified((s) => !s)} style={{ fontSize: 13, background: "none", border: "1px solid var(--color-bordure)", borderRadius: 20, padding: "6px 14px", cursor: "pointer", color: "var(--color-texte)" }}>
          {simplified ? t("temperatures.show_more_details") : t("temperatures.show_simplified")}
        </button>
      </p>

      {!simplified && !loading && !error && view === "table" && data.length > 0 && (() => {
        const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
        const pageItems = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
          <>
            <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
                  {t("temperatures.table_caption", { country: selectedCountryName })}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("temperatures.table_year")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("temperatures.table_avg")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("temperatures.table_max")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("temperatures.table_min")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("temperatures.table_deviation")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("temperatures.table_heatwaves")}</th>
                    <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("temperatures.table_coldwaves")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((d) => (
                    <tr key={d.year}>
                      <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{d.year}</th>
                      <td style={{ textAlign: "right", padding: 8 }}>{d.avg_temp_c ?? "—"}</td>
                      <td style={{ textAlign: "right", padding: 8 }}>{d.max_temp_c ?? "—"}</td>
                      <td style={{ textAlign: "right", padding: 8 }}>{d.min_temp_c ?? "—"}</td>
                      <td style={{ textAlign: "right", padding: 8 }}>
                        {d.deviation_from_reference_c !== null && d.deviation_from_reference_c !== undefined
                          ? `${d.deviation_from_reference_c > 0 ? "+" : ""}${d.deviation_from_reference_c}`
                          : "—"}
                      </td>
                      <td style={{ textAlign: "right", padding: 8 }}>{d.heatwave_count ?? 0}</td>
                      <td style={{ textAlign: "right", padding: 8 }}>{d.coldwave_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        );
      })()}

      {!simplified && (
        <details style={{ marginBottom: "1rem", fontSize: 13, color: "var(--color-texte-clair)" }}>
          <summary style={{ cursor: "pointer" }}>{t("temperatures.details_summary")}</summary>
          <p style={{ marginTop: 8 }}>{t("temperatures.details_p1")}</p>
          <p>{t("temperatures.details_p2")}</p>
          <p>{t("temperatures.details_p3")}</p>
        </details>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
        {t("temperatures.source")}
        {lastUpdated?.temperatures?.latestYear && (
          <> {t("temperatures.source_latest_year", { year: lastUpdated.temperatures.latestYear })}</>
        )}
        {lastUpdated?.temperatures?.lastIngested && (
          <> {t("temperatures.source_last_updated", { date: formatDate(lastUpdated.temperatures.lastIngested, locale) })}</>
        )}
      </p>

      <section style={{ marginTop: "2.5rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
        <h2 style={{ fontSize: 18 }}>{t("referenceWeather.title")}</h2>
        <TodayWeatherDeviation />
        <div style={{ marginTop: "1.5rem" }}>
          <CityNormalsChart />
        </div>
      </section>

      <section style={{ marginTop: "2.5rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
        <h2 style={{ fontSize: 18 }}>{t("generationalWarming.title")}</h2>
        <GenerationalWarmingChart />
      </section>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
