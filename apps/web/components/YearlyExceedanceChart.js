import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/useT";
import { useSobriety } from "../lib/SobrietyContext";

// Même palette que CityNormalsChart, pour rester visuellement cohérent
// entre les deux graphiques de cette même section.
const CITY_COLORS = [
  "#2a78d6", "#1baf7a", "#eda100", "#eb6834", "#b0401f",
  "#5c3d7a", "#0f6e56", "#8a5a2b", "#e87ba4", "#4a3aa7",
];

function ExceedanceCanvas({ curves, t }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const datasets = curves.map((curve, i) => ({
        label: curve.cityLabel,
        data: curve.points.map((p) => ({ x: p.year, y: p.percentHotDays })),
        borderColor: CITY_COLORS[i % CITY_COLORS.length],
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.2,
      }));

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 14, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (item) => {
                  const point = curves[item.datasetIndex].points[item.dataIndex];
                  return `${item.dataset.label} : ${point.percentHotDays}% (${point.hotDays}/${point.totalDays} jours)`;
                },
              },
            },
          },
          scales: {
            x: { type: "linear", ticks: { stepSize: 1, callback: (v) => Math.round(v) }, title: { display: true, text: t("referenceWeather.exceedance_x_axis") } },
            y: { min: 0, max: 100, title: { display: true, text: "%" } },
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
  }, [curves, t]);

  return (
    <div style={{ position: "relative", height: 300 }}>
      <canvas ref={canvasRef} role="img" aria-label="Pourcentage de jours par an où la température maximale a dépassé la normale, par ville" />
    </div>
  );
}

function ExceedanceTable({ curves, t }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("referenceWeather.curve_table_city")}</th>
          <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("referenceWeather.exceedance_table_first")}</th>
          <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("referenceWeather.exceedance_table_last")}</th>
        </tr>
      </thead>
      <tbody>
        {curves.map((curve) => {
          const first = curve.points[0];
          const last = curve.points[curve.points.length - 1];
          return (
            <tr key={curve.stationCode}>
              <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{curve.cityLabel}</th>
              <td style={{ textAlign: "right", padding: 6 }}>{first ? `${first.percentHotDays}% (${first.year})` : "—"}</td>
              <td style={{ textAlign: "right", padding: 6 }}>{last ? `${last.percentHotDays}% (${last.year})` : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function YearlyExceedanceChart() {
  const { t } = useT();
  const { sobriety } = useSobriety();
  const [curves, setCurves] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/reference-weather/exceedance-by-year")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCurves)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return null;
  if (!curves) return null;
  // Il faut au moins 2 années complètes pour qu'une courbe/tendance ait un
  // sens — sous ce seuil, mieux vaut ne rien montrer que quelque chose de
  // trop maigre pour être lisible.
  const usableCurves = curves.filter((c) => c.points.length >= 2);
  if (usableCurves.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", fontStyle: "italic" }}>
        {t("referenceWeather.collecting")}
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
        {t("referenceWeather.exceedance_intro")}
      </p>
      {sobriety ? <ExceedanceTable curves={usableCurves} t={t} /> : <ExceedanceCanvas curves={usableCurves} t={t} />}
    </div>
  );
}
