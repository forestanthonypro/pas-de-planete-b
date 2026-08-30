import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../lib/useT";
import { useSobriety } from "../lib/SobrietyContext";
import { HISTORICAL_ANOMALY, SCENARIOS, estimateWarmingAtYear } from "../lib/climateScenarios";
import { IconThermometer } from "./icons";

const AGES = [0, 30, 50, 70];
const MIN_BIRTH_YEAR = 1930;
const MAX_BIRTH_YEAR = 2020;
const DEFAULT_BIRTH_YEAR = 2015;

function formatDelta(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("fr-FR")} °C`;
}

// Version graphique (Chart.js) — chargée à la demande, comme les autres
// graphiques du site (voir DebunkContentWithCharts.js), pour ne jamais
// alourdir le chargement initial d'une page avec Chart.js si le visiteur
// ne fait que passer.
function WarmingChartCanvas({ birthYear, selectedScenarioId, t }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const historicalDataset = {
        label: "observed",
        data: HISTORICAL_ANOMALY.map((p) => ({ x: p.year, y: p.anomalyC })),
        borderColor: "#8a8a8a",
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      };
      const scenarioDatasets = SCENARIOS.map((s) => {
        // Quand un scénario est sélectionné (clic dans la légende), sa
        // courbe ressort nettement (plus épaisse, pleine opacité) et les
        // autres s'estompent — pour relier visuellement le texte
        // pédagogique affiché en dessous à la bonne ligne du graphique,
        // repère important pour un public non averti.
        const isSelected = selectedScenarioId === s.id;
        const isDimmed = selectedScenarioId && !isSelected;
        return {
          label: s.id,
          data: s.points.map((p) => ({ x: p.year, y: p.anomalyC })),
          borderColor: isDimmed ? `${s.color}40` : s.color, // "40" = ~25% d'opacité en hexadécimal
          backgroundColor: "transparent",
          borderWidth: isSelected ? 4 : 2,
          pointRadius: 0,
          tension: 0.2,
        };
      });

      // Marqueur de l'année de naissance choisie — une ligne verticale fine,
      // dessinée via un dataset "invisible" à deux points plutôt qu'un
      // plugin séparé, pour rester simple.
      const birthMarkerDataset = {
        label: "birth-marker",
        data: [
          { x: birthYear, y: -0.5 },
          { x: birthYear, y: 5 },
        ],
        borderColor: "#4a4a4a",
        borderDash: [4, 4],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      };

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { datasets: [historicalDataset, ...scenarioDatasets, birthMarkerDataset] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              // La ligne pointillée d'année de naissance n'a pas de valeur
              // de température à montrer (juste deux points techniques
              // -0,5 et 5 pour dessiner un trait vertical) — on l'exclut
              // entièrement de l'infobulle plutôt que d'afficher un chiffre
              // qui n'a pas de sens.
              filter: (item) => item.dataset.label !== "birth-marker",
              callbacks: {
                label: (context) => {
                  const id = context.dataset.label;
                  const scenario = SCENARIOS.find((s) => s.id === id);
                  const name = scenario ? t(scenario.labelKey) : t("generationalWarming.legend_observed");
                  return `${name} : ${formatDelta(context.parsed.y)}`;
                },
                // Met en avant, juste en dessous de la valeur, les choix
                // collectifs (trajectoire socio-économique) qui
                // correspondent à ce scénario — pas affiché pour la courbe
                // "Observé", qui est un fait mesuré, pas un scénario.
                afterLabel: (context) => {
                  const scenario = SCENARIOS.find((s) => s.id === context.dataset.label);
                  return scenario ? t(scenario.choicesKey) : "";
                },
              },
            },
          },
          scales: {
            x: {
              type: "linear",
              min: 1900,
              max: 2100,
              ticks: { stepSize: 20, callback: (v) => Math.round(v) },
            },
            y: {
              min: -0.5,
              max: 5,
              title: { display: true, text: "°C par rapport à 1850-1900" },
            },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthYear, selectedScenarioId]);

  return (
    <div style={{ position: "relative", height: 280, marginBottom: "0.75rem" }}>
      <canvas ref={canvasRef} role="img" aria-label="Réchauffement mondial observé et scénarios futurs" />
    </div>
  );
}

// Version sobre : un simple tableau, comme les autres graphiques du site
// en mode sobriété (voir temperatures.js) — aucun canvas, aucun Chart.js.
function WarmingTable({ t }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: "0.75rem" }}>
      <thead>
        <tr>
          <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("generationalWarming.table_scenario")}</th>
          <th scope="col" style={{ textAlign: "right", padding: 6 }}>2050</th>
          <th scope="col" style={{ textAlign: "right", padding: 6 }}>2090</th>
        </tr>
      </thead>
      <tbody>
        {SCENARIOS.map((s) => {
          const at2050 = s.points.find((p) => p.year === 2050)?.anomalyC;
          const at2090 = s.points.find((p) => p.year === 2090)?.anomalyC;
          return (
            <tr key={s.id}>
              <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{t(s.labelKey)}</th>
              <td style={{ textAlign: "right", padding: 6 }}>{formatDelta(at2050)}</td>
              <td style={{ textAlign: "right", padding: 6 }}>{formatDelta(at2090)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function GenerationalWarmingChart() {
  const { t } = useT();
  const { sobriety } = useSobriety();
  const [birthYear, setBirthYear] = useState(DEFAULT_BIRTH_YEAR);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const selectedScenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || null;

  const ageEstimates = useMemo(
    () => AGES.map((age) => ({ age, year: birthYear + age, estimate: estimateWarmingAtYear(birthYear + age) })),
    [birthYear]
  );

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
        {t("generationalWarming.intro")}
      </p>

      {sobriety ? (
        <WarmingTable t={t} />
      ) : (
        <WarmingChartCanvas birthYear={birthYear} selectedScenarioId={selectedScenarioId} t={t} />
      )}

      {!sobriety && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ width: 14, height: 3, background: "#8a8a8a", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{t("generationalWarming.legend_observed")}</span>
            </div>
            {SCENARIOS.map((s) => {
              const isSelected = selectedScenarioId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedScenarioId(isSelected ? null : s.id)}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    textAlign: "left",
                    background: isSelected ? "var(--color-carte-verte, #eaf3de)" : "transparent",
                    border: "none",
                    borderRadius: 6,
                    padding: "3px 6px",
                    marginLeft: -6,
                    cursor: "pointer",
                    font: "inherit",
                    color: "inherit",
                  }}
                  aria-pressed={isSelected}
                >
                  <span style={{ width: 14, height: 3, background: s.color, display: "inline-block", flexShrink: 0 }} />
                  <span>
                    <span style={{ fontWeight: 600 }}>{t(s.labelKey)}</span>
                    {" — "}
                    <span style={{ color: "var(--color-texte-clair)" }}>{t(s.choicesKey)}</span>
                    {s.overshootNoteKey && (
                      <>
                        {" "}
                        <span style={{ display: "block", fontStyle: "italic", color: "var(--color-texte-clair)", marginTop: 2 }}>
                          {t(s.overshootNoteKey)}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Panneau pédagogique : impact sur la nature du scénario
              sélectionné — invisible par défaut, pour ne jamais présenter
              un scénario particulier comme "celui à regarder" avant que la
              personne n'ait fait son propre choix. */}
          {selectedScenario ? (
            <div
              style={{
                borderLeft: `4px solid ${selectedScenario.color}`,
                background: "var(--color-fond)",
                borderRadius: 8,
                padding: "0.9rem 1rem",
                marginBottom: "1.25rem",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>
                🌿 {t("generationalWarming.nature_impact_title", { scenario: t(selectedScenario.labelKey) })}
              </p>
              <p style={{ fontSize: 13, margin: "0 0 8px", lineHeight: 1.5 }}>{t(selectedScenario.natureImpactKey)}</p>
              <p style={{ fontSize: 11, color: "var(--color-texte-clair)", margin: "0 0 8px", fontStyle: "italic" }}>
                {t("generationalWarming.nature_speed_note")}
              </p>
              <p style={{ fontSize: 10, color: "var(--color-texte-clair)", margin: 0 }}>
                {t("generationalWarming.nature_source")}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontStyle: "italic", marginBottom: "1.25rem" }}>
              {t("generationalWarming.nature_impact_prompt")}
            </p>
          )}
        </>
      )}

      <div style={{ background: "var(--color-carte-verte, #eaf3de)", borderRadius: 12, padding: "1.25rem" }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <IconThermometer size={18} />
          {t("generationalWarming.birth_year_prompt")}
        </p>
        <input
          type="range"
          min={MIN_BIRTH_YEAR}
          max={MAX_BIRTH_YEAR}
          value={birthYear}
          onChange={(e) => setBirthYear(parseInt(e.target.value, 10))}
          style={{ width: "100%", marginBottom: 8 }}
          aria-label={t("generationalWarming.birth_year_prompt")}
        />
        <p style={{ fontSize: 22, fontWeight: 700, textAlign: "center", margin: "0 0 1rem" }}>{birthYear}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {ageEstimates.map(({ age, year, estimate }) => (
            <div key={age} style={{ background: "var(--color-fond)", borderRadius: 8, padding: "0.75rem", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 4px" }}>
                {age === 0
                  ? t("generationalWarming.age_birth", { year })
                  : t("generationalWarming.age_n", { age, year })}
              </p>
              {estimate.type === "historical" ? (
                <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{formatDelta(estimate.value)}</p>
              ) : (
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  {formatDelta(Math.min(...Object.values(estimate.values)))}
                  {" – "}
                  {formatDelta(Math.max(...Object.values(estimate.values)))}
                </p>
              )}
              {estimate.type === "scenarios" && (
                <p style={{ fontSize: 10, color: "var(--color-texte-clair)", margin: "2px 0 0" }}>
                  {t("generationalWarming.depends_on_choices")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--color-texte-clair)", marginTop: "0.75rem" }}>
        {t("generationalWarming.source")}
      </p>
    </div>
  );
}
