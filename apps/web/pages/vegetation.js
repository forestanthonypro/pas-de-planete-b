import { useEffect, useMemo, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VegetationPage() {
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
        if (!res.ok) throw new Error("Données indisponibles pour ce pays");
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
  }, [countryCode]);

  // Résumé chiffré du cumul (indépendant du graphique) — pour donner un chiffre
  // net et vérifiable plutôt que de faire deviner la valeur finale en lisant une
  // courbe sur un axe partagé avec d'autres échelles.
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
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      // La surface forestière (FAO) n'est mesurée que tous les quelques années,
      // alors que la perte est annuelle — sans ça, la plupart des années n'ont
      // pas de forest_area_ha et les % (annuel comme cumulé) seraient faux ou
      // absents. On comble les années manquantes avec la valeur connue la plus
      // proche (la surface forestière ne bouge pas assez vite d'une année sur
      // l'autre pour que ce soit un problème).
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

      // Perte cumulée depuis le début des données disponibles, en % de la
      // surface forestière de la première année connue — pour montrer que même
      // une petite perte chaque année finit par représenter beaucoup une fois
      // additionnée sur toute la période.
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
              label: "Perte de couverture arborée (ha)",
              data: data.map((d) => d.tree_cover_loss_ha),
              backgroundColor: "#e67e22",
              yAxisID: "y",
            },
            {
              type: "line",
              label: "% du couvert forestier perdu cette année-là",
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
              label: "% cumulé perdu depuis le début des données",
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
                    label: "Moyenne mondiale (%)",
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
            y: { type: "linear", position: "left", title: { display: true, text: "Perte (ha)" } },
            y1: {
              type: "linear",
              position: "right",
              title: { display: true, text: "% du couvert perdu" },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, view, loading, error, worldBenchmarks]);

  const selectedCountryName =
    localizedCountryName(countryCode, preferredLang);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Perte de couverture arborée — {selectedCountryName}</h1>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={countryCode}
          onChange={setCountryCode}
          preferredLang={preferredLang}
        />
        <button onClick={() => setView(view === "chart" ? "table" : "chart")}>
          Voir en {view === "chart" ? "tableau" : "graphique"}
        </button>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      <h2 style={{ fontSize: 18, marginBottom: "0.25rem" }}>Que montre ce graphique ?</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
        Imagine la forêt du pays comme une grande réserve. Chaque année, une partie disparaît
        (coupée, brûlée, défrichée) — c&apos;est la barre orange, en hectares (1 hectare ≈ 1
        terrain de foot). Mais un même nombre d&apos;hectares perdus ne pèse pas pareil selon la
        taille de la réserve : perdre 10 000 hectares dans un petit pays très boisé, c&apos;est une
        part énorme de sa forêt ; perdre les mêmes 10 000 hectares dans un pays immense comme le
        Brésil, c&apos;est presque rien. La courbe rouge (%) corrige ça : elle dit vraiment
        &laquo; quelle part de sa forêt le pays perd cette année-là &raquo;.
      </p>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
        La courbe violette en pointillés montre autre chose : la perte <strong>additionnée</strong>{" "}
        depuis la première année disponible, rapportée à la taille de la forêt à cette
        époque-là. Perdre 1 % par an semble peu, mais additionné sur 20 ans, ça peut
        représenter une bonne partie de la forêt initiale — cette courbe donne l&apos;ampleur
        réelle sur toute la période couverte par les données.
      </p>
      <p style={{ fontSize: 12, color: "#999", marginBottom: "0.75rem" }}>
        Note technique : la surface forestière totale (FAO) n&apos;est mesurée que tous les
        quelques années, alors que la perte est annuelle. Entre deux mesures, on utilise la
        valeur connue la plus proche plutôt que de laisser les courbes en % vides.
      </p>

      {!loading && !error && view === "chart" && (
        <div style={{ position: "relative", height: 320 }}>
          <canvas ref={canvasRef} role="img" aria-label={`Perte de couverture arborée pour ${selectedCountryName}`} />
        </div>
      )}

      {cumulativeSummary && (
        <p style={{ fontSize: 14, marginTop: "0.75rem" }}>
          Au total, entre <strong>{cumulativeSummary.startYear}</strong> et{" "}
          <strong>{cumulativeSummary.endYear}</strong>, {selectedCountryName} a perdu{" "}
          <strong>{Math.round(cumulativeSummary.totalLossHa).toLocaleString("fr-FR")} ha</strong>,
          soit environ <strong>{cumulativeSummary.percent.toFixed(2)} %</strong> de la forêt
          telle qu&apos;elle existait en <strong>{cumulativeSummary.startYear}</strong> (première
          année où on a une donnée de perte) — ce chiffre continue d&apos;augmenter chaque année,
          il ne s&apos;arrête pas.
        </p>
      )}

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            Perte de couverture arborée pour {selectedCountryName}, par année
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Année</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Perte (ha)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Surface forestière totale (ha)</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>% perdu</th>
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

      <details style={{ marginTop: "1rem", fontSize: 13, color: "#555" }}>
        <summary style={{ cursor: "pointer" }}>Que couvrent ces chiffres exactement ?</summary>
        <p style={{ marginTop: 8 }}>
          Il s&apos;agit de <strong>perte de couverture arborée</strong> détectée par satellite
          (résolution 30m, Hansen et al.), toutes causes confondues — coupe rase, incendie,
          exploitation forestière, agriculture. Ce n&apos;est pas nécessairement de la
          déforestation permanente : une parcelle peut repousser après coupe forestière gérée.
          Les données de perte couvrent 2001-2024.
        </p>
        <p>
          La courbe rouge (% perdu) rapporte cette perte annuelle à la{" "}
          <strong>surface forestière totale</strong> du pays cette année-là (FAO, référentiel
          recalculé tous les 5 ans et interpolé entre-temps) — pour donner un ordre de grandeur
          relatif plutôt qu&apos;un chiffre brut en hectares sans contexte.
        </p>
      </details>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : Global Forest Watch, via Our World in Data (CC-BY)
        {lastUpdated?.vegetation?.latestYear && (
          <> — dernière année couverte par la source : {lastUpdated.vegetation.latestYear}</>
        )}
        {lastUpdated?.vegetation?.lastIngested && (
          <> · dernière mise à jour de notre base : {formatDate(lastUpdated.vegetation.lastIngested)}</>
        )}
        . Rafraîchissement automatique mensuel.
      </p>
    </main>
  );
}
