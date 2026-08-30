import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/useT";
import { useSobriety } from "../lib/SobrietyContext";

// Palette à 10 couleurs distinctes, dans l'esprit sobre déjà utilisé pour
// les autres graphiques du site (GenerationalWarmingChart, DebunkCharts) —
// pas de couleurs saturées/criardes.
const CITY_COLORS = [
  "#2a78d6", "#1baf7a", "#eda100", "#eb6834", "#b0401f",
  "#5c3d7a", "#0f6e56", "#8a5a2b", "#e87ba4", "#4a3aa7",
];

// Convertit "MM-DD" en un numéro de jour dans l'année (base non
// bissextile arbitraire, 2001) — juste pour donner un axe X numérique à
// Chart.js, l'année elle-même n'a pas de sens ici (normale = moyenne sur
// 1991-2020, pas une année précise).
function monthDayToDayNumber(monthDay) {
  const [month, day] = monthDay.split("-").map(Number);
  const d = new Date(Date.UTC(2001, month - 1, day));
  const start = new Date(Date.UTC(2001, 0, 1));
  return Math.round((d - start) / 86400000) + 1;
}

function CurveCanvas({ curves }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const datasets = curves.map((curve, i) => ({
        label: curve.cityLabel,
        data: curve.points.map((p) => ({ x: monthDayToDayNumber(p.monthDay), y: p.normalTempMax })),
        borderColor: CITY_COLORS[i % CITY_COLORS.length],
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
      }));

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { boxWidth: 14, font: { size: 11 } } } },
          scales: {
            x: {
              type: "linear",
              min: 1,
              max: 366,
              ticks: {
                stepSize: 30,
                callback: (v) => {
                  const d = new Date(Date.UTC(2001, 0, 1));
                  d.setUTCDate(d.getUTCDate() + Math.round(v) - 1);
                  return d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
                },
              },
            },
            y: { title: { display: true, text: "°C (normale)" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [curves]);

  return (
    <div style={{ position: "relative", height: 300 }}>
      <canvas ref={canvasRef} role="img" aria-label="Courbes des normales de température maximale par ville, sur l'année" />
    </div>
  );
}

function CurveTable({ curves, t }) {
  // Mode sobre : pas de Chart.js — un tableau avec quelques repères
  // (hiver/été) plutôt que 366 valeurs par ville.
  const winterPoint = (points) => points.find((p) => p.monthDay === "01-15");
  const summerPoint = (points) => points.find((p) => p.monthDay === "07-15");
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("referenceWeather.curve_table_city")}</th>
          <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("referenceWeather.curve_table_winter")}</th>
          <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("referenceWeather.curve_table_summer")}</th>
        </tr>
      </thead>
      <tbody>
        {curves.map((curve) => {
          const w = winterPoint(curve.points);
          const s = summerPoint(curve.points);
          return (
            <tr key={curve.stationCode}>
              <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{curve.cityLabel}</th>
              <td style={{ textAlign: "right", padding: 6 }}>{w ? `${w.normalTempMax.toLocaleString("fr-FR")} °C` : "—"}</td>
              <td style={{ textAlign: "right", padding: 6 }}>{s ? `${s.normalTempMax.toLocaleString("fr-FR")} °C` : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function CityNormalsChart() {
  const { t } = useT();
  const { sobriety } = useSobriety();
  const [curves, setCurves] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/reference-weather/normals-curve")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCurves)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return null;
  if (!curves) return null;
  if (curves.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", fontStyle: "italic" }}>
        {t("referenceWeather.collecting")}
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
        {t("referenceWeather.curve_intro")}
      </p>
      {sobriety ? <CurveTable curves={curves} t={t} /> : <CurveCanvas curves={curves} />}
    </div>
  );
}
