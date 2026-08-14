import { useEffect, useRef } from "react";
import { useCountrySelector } from "../lib/useCountrySelector";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { useT } from "../lib/useT";
import { useApiFetch } from "../lib/useApiFetch";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconThermometer } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import ScrollableTable from "../components/ScrollableTable";
import { useSobriety } from "../lib/SobrietyContext";

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

  const stripesCanvasRef = useRef(null);
  const stripesChartRef = useRef(null);
  const wavesCanvasRef = useRef(null);
  const wavesChartRef = useRef(null);

  const { data: tempData, loading, error } = useApiFetch(
    countryCode ? `/api/temperatures/${countryCode}` : null,
    {
      errorMessage: t("temperatures.error_no_data"),
      transform: (rows) => (Array.isArray(rows) ? rows : []),
      deps: [countryCode],
    }
  );
  const data = tempData ?? [];

  // Warming stripes.
  useEffect(() => {
    if (sobriety || loading || error || data.length === 0 || !stripesCanvasRef.current) return;
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
            x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
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
  }, [data, loading, error, sobriety, locale]);

  // Vagues de chaleur / de froid.
  useEffect(() => {
    if (sobriety || loading || error || data.length === 0 || !wavesCanvasRef.current) return;
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
            x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
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
  }, [data, loading, error, sobriety, locale]);

  const referencePeriod = data.length > 0 ? data[data.length - 1].reference_period : null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <PageHeader Icon={IconThermometer} tint="teal" title={`${t("temperatures.title")} — ${selectedCountryName}`} />
      <ShareButtons title={`${t("temperatures.title")} — ${selectedCountryName}`} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect countries={countries} value={countryCode} onChange={setCountryCode} preferredLang={locale} />
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && (
        <p role="alert">
          {t("common.error_prefix")} {error}
        </p>
      )}

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

      {!loading && !error && !sobriety && data.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>{t("temperatures.chart_stripes_title")}</h3>
          <div style={{ position: "relative", height: 140, marginBottom: "1.5rem" }}>
            <canvas
              ref={stripesCanvasRef}
              role="img"
              aria-label={`${t("temperatures.chart_stripes_title")} — ${selectedCountryName}`}
            />
          </div>

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

      {!loading && !error && data.length > 0 && (
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
              {data.map((d) => (
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
      )}

      <details style={{ marginBottom: "1rem", fontSize: 13, color: "var(--color-texte-clair)" }}>
        <summary style={{ cursor: "pointer" }}>{t("temperatures.details_summary")}</summary>
        <p style={{ marginTop: 8 }}>{t("temperatures.details_p1")}</p>
        <p>{t("temperatures.details_p2")}</p>
        <p>{t("temperatures.details_p3")}</p>
      </details>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
        {t("temperatures.source")}
        {lastUpdated?.temperatures?.latestYear && (
          <> {t("temperatures.source_latest_year", { year: lastUpdated.temperatures.latestYear })}</>
        )}
        {lastUpdated?.temperatures?.lastIngested && (
          <> {t("temperatures.source_last_updated", { date: formatDate(lastUpdated.temperatures.lastIngested, locale) })}</>
        )}
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
