import { useEffect, useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import { IconLeaf } from "../components/icons";
import { useT } from "../lib/useT";
import { formatDate } from "../lib/useLastUpdated";


const GRADE_COLORS = {
  A: "#1baf7a", "A+": "#1baf7a", B: "#7fc97f", C: "#cbd423",
  D: "#f4b400", E: "#e67e22", F: "#d63e2a", G: "#8b0000",
};

// Valeurs de référence officielles EcoIndex (médiane et cible constatées sur
// l'ensemble des pages analysées par ecoindex.fr) — pas spécifiques à ce
// site, ce sont les mêmes repères affichés sur https://www.ecoindex.fr pour
// n'importe quelle page testée. Sert de point de comparaison sous chaque
// carte concernée.
const ECOINDEX_REFERENCE = {
  page_weight_kb: { median: 2410, target: 1024 }, // Mo -> Ko
  dom_elements: { median: 693, target: 600 },
  requests_count: { median: 78, target: 40 },
};

// 1 kg CO2e ≈ 5 km en voiture, 1,5 L d'eau ≈ 1 bouteille d'eau minérale —
// équivalences utilisées par ecoindex.fr elle-même pour rendre l'empreinte
// concrète (voir leur page "Ça veut dire quoi ?").
const CAR_KM_PER_KG_CO2 = 5;
const WATER_BOTTLE_LITERS = 1.5;
const REFERENCE_MONTHLY_VISITS = 1000;

// Au niveau module (pas à l'intérieur du composant) : sinon une nouvelle
// fonction composant serait recréée à chaque rendu, ce que React ne peut
// pas réconcilier efficacement (démontage/remontage complet au lieu d'une
// simple mise à jour) — voir react-hooks/static-components.
function ReferenceHint({ metricKey, t, locale }) {
  const ref = ECOINDEX_REFERENCE[metricKey];
  if (!ref) return null;
  return (
    <p style={{ fontSize: 11, color: "var(--color-texte-clair)", margin: "4px 0 0" }}>
      {t("environmentalImpact.reference_hint", { median: ref.median.toLocaleString(locale), target: ref.target.toLocaleString(locale) })}
    </p>
  );
}

// Vert si le site fait mieux que la médiane EcoIndex (valeur plus basse =
// page plus légère/simple/moins de requêtes), rouge si moins bien, couleur
// de texte normale si égal ou si aucune référence n'existe pour ce critère.
function compareToMedianColor(metricKey, value) {
  const ref = ECOINDEX_REFERENCE[metricKey];
  if (!ref || value == null) return "var(--color-texte)";
  if (value < ref.median) return "#1baf7a";
  if (value > ref.median) return "#d63e2a";
  return "var(--color-texte)";
}

export default function EnvironmentalImpactPage() {
  const { t, locale } = useT();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    fetch(`/api/environmental-metrics`)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((rows) => {
        setMetrics(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const latest = metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const first = metrics && metrics.length > 0 ? metrics[0] : null;

  useEffect(() => {
    if (!metrics || metrics.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: metrics.map((m) => formatDate(m.measured_at, locale)),
          datasets: [
            {
              label: t("environmentalImpact.chart_axis"),
              data: metrics.map((m) => parseFloat(m.ecoindex_score)),
              borderColor: "#1baf7a",
              backgroundColor: "#1baf7a33",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100, title: { display: true, text: t("environmentalImpact.chart_axis") } } },
          plugins: { legend: { display: false } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, locale]);

  const scoreDiff = latest && first && metrics.length > 1
    ? Math.round((parseFloat(latest.ecoindex_score) - parseFloat(first.ecoindex_score)) * 10) / 10
    : null;

  // Équivalences concrètes (mêmes ratios que ceux affichés par ecoindex.fr) :
  // pour 1000 visites mensuelles, l'empreinte CO2/eau de cette seule page vue
  // exprimée en trajet voiture / bouteilles d'eau minérale.
  const monthlyCo2Kg = latest ? (parseFloat(latest.ghg_co2_g) * REFERENCE_MONTHLY_VISITS) / 1000 : null;
  const monthlyWaterL = latest ? (parseFloat(latest.water_cl) * REFERENCE_MONTHLY_VISITS) / 100 : null;
  const carKm = monthlyCo2Kg != null ? Math.round(monthlyCo2Kg * CAR_KM_PER_KG_CO2 * 10) / 10 : null;
  const waterBottles = monthlyWaterL != null ? Math.round(monthlyWaterL / WATER_BOTTLE_LITERS) : null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconLeaf} tint="green" title={t("environmentalImpact.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{t("environmentalImpact.intro")}</p>
      </PageHeader>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && !latest && <p>{t("environmentalImpact.no_data")}</p>}

      {!loading && !error && latest && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: "1.5rem" }}>
            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_ecoindex")}</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: GRADE_COLORS[latest.ecoindex_grade] || "var(--color-texte)" }}>
                {latest.ecoindex_grade} <span style={{ fontSize: 16, fontWeight: 400 }}>({Math.round(latest.ecoindex_score)}/100)</span>
              </p>
            </div>

            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_load_time")}</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
                {latest.load_time_ms != null ? `${(latest.load_time_ms / 1000).toFixed(1)} s` : "—"}
              </p>
            </div>

            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_page_weight")}</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: compareToMedianColor("page_weight_kb", latest.page_weight_kb) }}>{Math.round(latest.page_weight_kb)} Ko</p>
              <ReferenceHint metricKey="page_weight_kb" t={t} locale={locale} />
            </div>

            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_dom_elements")}</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: compareToMedianColor("dom_elements", latest.dom_elements) }}>{latest.dom_elements ?? "—"}</p>
              <ReferenceHint metricKey="dom_elements" t={t} locale={locale} />
            </div>

            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_requests")}</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: compareToMedianColor("requests_count", latest.requests_count) }}>{latest.requests_count ?? "—"}</p>
              <ReferenceHint metricKey="requests_count" t={t} locale={locale} />
            </div>

            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_emissions")}</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{latest.ghg_co2_g} g CO₂</p>
            </div>

            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_water")}</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{latest.water_cl} cl</p>
            </div>

            <div className="pdpb-card">
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("environmentalImpact.card_hosting")}</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1baf7a" }}>{t("environmentalImpact.card_hosting_value")}</p>
            </div>
          </div>

          <section className="pdpb-card" style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>{t("environmentalImpact.meaning_title")}</p>
            <p style={{ fontSize: 13, margin: "0 0 8px", color: "var(--color-texte-clair)" }}>
              {t("environmentalImpact.meaning_grade_explainer")}
            </p>
            {carKm !== null && waterBottles !== null && (
              <p style={{ fontSize: 13, margin: 0, color: "var(--color-texte-clair)" }}>
                {t("environmentalImpact.meaning_equivalence", {
                  visits: REFERENCE_MONTHLY_VISITS.toLocaleString(locale),
                  co2: (monthlyCo2Kg < 1 ? Math.round(monthlyCo2Kg * 1000) + " g" : monthlyCo2Kg.toFixed(1) + " kg"),
                  water: monthlyWaterL.toFixed(1),
                  carKm,
                  bottles: waterBottles,
                })}
              </p>
            )}
          </section>

          {(latest.lighthouse_performance != null) && (
            <div className="pdpb-card" style={{ marginTop: "1rem" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>{t("environmentalImpact.card_lighthouse")}</p>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: 14 }}>{t("environmentalImpact.lh_performance")} : <strong>{latest.lighthouse_performance}</strong></span>
                <span style={{ fontSize: 14 }}>{t("environmentalImpact.lh_accessibility")} : <strong>{latest.lighthouse_accessibility}</strong></span>
                <span style={{ fontSize: 14 }}>{t("environmentalImpact.lh_seo")} : <strong>{latest.lighthouse_seo}</strong></span>
                <span style={{ fontSize: 14 }}>{t("environmentalImpact.lh_best_practices")} : <strong>{latest.lighthouse_best_practices}</strong></span>
              </div>
            </div>
          )}

          {scoreDiff !== null && (
            <p style={{ fontSize: 14, marginTop: "1rem", fontWeight: 600, color: scoreDiff >= 0 ? "#1baf7a" : "#d63e2a" }}>
              {t("environmentalImpact.improvement_since_first", {
                date: formatDate(first.measured_at, locale),
                sign: scoreDiff >= 0 ? "+" : "",
                diff: scoreDiff,
              })}
            </p>
          )}

          {metrics.length > 1 && (
            <>
              <h2 style={{ fontSize: 17, marginTop: "2rem" }}>{t("environmentalImpact.chart_title")}</h2>
              <div style={{ position: "relative", height: 260 }}>
                <canvas ref={canvasRef} role="img" aria-label={t("environmentalImpact.chart_title")} />
              </div>
            </>
          )}

          <section style={{ marginTop: "2rem" }}>
            <h2 style={{ fontSize: 16 }}>{t("environmentalImpact.methodology_title")}</h2>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("environmentalImpact.methodology_text")}</p>
            <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
              {t("environmentalImpact.last_measured", { date: formatDate(latest.measured_at, locale) })}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
