import { useEffect, useRef } from "react";
import { Chart } from "../lib/chartSetup";

// Rendu d'un seul graphique à partir d'une config déjà validée côté API
// (voir lib/chartValidation.js côté API — jamais de code exécutable, une
// structure de données). Utilisé à la fois dans l'aperçu admin
// (ContentTranslationsEditor-like) et sur la page publique d'une entrée
// debunk, pour garantir un rendu strictement identique aux deux endroits.
//
// Toutes les chaînes (title, labels, unit) passent uniquement par des
// props Chart.js/texte — jamais de dangerouslySetInnerHTML — donc aucun
// risque d'injection même si un admin colle un label malveillant : il
// s'affichera tel quel, comme texte inerte.

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

function toChartJsConfig(chart) {
  const isHorizontal = chart.type === "bar-horizontal";
  const chartJsType = isHorizontal ? "bar" : chart.type;
  const isPieLike = chart.type === "pie" || chart.type === "doughnut";

  const datasets = chart.datasets.map((ds, i) => {
    const base = { label: ds.label || chart.unit || "", data: ds.data };
    if (isPieLike) {
      base.backgroundColor = ds.colors || chart.labels.map((_, j) => PALETTE[j % PALETTE.length]);
    } else if (chart.type === "line") {
      const color = ds.color || PALETTE[i % PALETTE.length];
      base.borderColor = color;
      base.backgroundColor = color + "1a"; // légère transparence pour le remplissage
      base.fill = true;
      base.borderWidth = 2;
      base.pointRadius = 3;
      base.tension = 0;
    } else {
      base.backgroundColor = ds.colors || ds.color || PALETTE[i % PALETTE.length];
      base.borderRadius = 4;
    }
    return base;
  });

  const showLegend = chart.datasets.length > 1 || isPieLike;

  return {
    type: chartJsType,
    data: { labels: chart.labels, datasets },
    options: {
      indexAxis: isHorizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: showLegend, position: "bottom" },
        tooltip: {
          callbacks: chart.unit
            ? { label: (ctx) => `${ctx.dataset.label || ""}: ${ctx.formattedValue} ${chart.unit}`.trim() }
            : undefined,
        },
      },
      scales: isPieLike
        ? undefined
        : {
            [isHorizontal ? "x" : "y"]: { beginAtZero: true, title: chart.unit ? { display: true, text: chart.unit } : undefined },
          },
    },
  };
}

function SingleChart({ chart }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    chartInstanceRef.current = new Chart(canvasRef.current, toChartJsConfig(chart));
    return () => {
      chartInstanceRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(chart)]);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {chart.title && <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{chart.title}</p>}
      <div style={{ position: "relative", height: 260 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// charts : le tableau déjà validé (voir migration 054 / chartValidation.js
// côté API) — peut être null/undefined, auquel cas rien n'est affiché.
export default function DebunkCharts({ charts }) {
  if (!Array.isArray(charts) || charts.length === 0) return null;
  return (
    <div>
      {charts.map((chart, i) => (
        <SingleChart key={i} chart={chart} />
      ))}
    </div>
  );
}
