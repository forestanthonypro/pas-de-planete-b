import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { detectDefaultCountry } from "../../lib/detectCountry";
import { detectPreferredLanguage } from "../../lib/detectLanguage";
import { FUEL_COLORS, DEFAULT_FUEL_COLOR, translateFuel } from "../../lib/fuelTypes";
import { speciesGroupLabel } from "../../lib/speciesGroups";
import { formatCommonNames } from "../../lib/commonNames";
import { useLastUpdated, formatDate } from "../../lib/useLastUpdated";
import { localizedCountryName } from "../../lib/countryNames";
import { useWorldBenchmarks } from "../../lib/useWorldBenchmarks";
import CountrySelect from "../../components/CountrySelect";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const CATEGORY_INFO = {
  EX: { label: "Éteinte", color: "#000000" },
  EW: { label: "Éteinte à l'état sauvage", color: "#3d3d3d" },
  CR: { label: "En danger critique", color: "#d63e2a" },
  EN: { label: "En danger", color: "#e67e22" },
  VU: { label: "Vulnérable", color: "#f4b400" },
  NT: { label: "Quasi menacée", color: "#cbd423" },
  LC: { label: "Préoccupation mineure", color: "#1baf7a" },
  DD: { label: "Données insuffisantes", color: "#95a5a6" },
};

const barEndLabelsPlugin = {
  id: "barEndLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, index) => {
        const count = dataset.plantCounts?.[index];
        if (count == null) return;
        ctx.save();
        ctx.fillStyle = "#444";
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(`${count} centrale${count > 1 ? "s" : ""}`, bar.x + 6, bar.y);
        ctx.restore();
      });
    });
  },
};

export default function PaysDashboard() {
  const router = useRouter();
  const { code } = router.query;
  const lastUpdated = useLastUpdated();
  const worldBenchmarks = useWorldBenchmarks();

  const [countries, setCountries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [speciesList, setSpeciesList] = useState([]);
  const [fires, setFires] = useState([]);
  const [preferredLang, setPreferredLang] = useState(null);
  const [compareCode, setCompareCode] = useState("");
  const [compareSummary, setCompareSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const co2CanvasRef = useRef(null);
  const co2ChartRef = useRef(null);
  const energyCanvasRef = useRef(null);
  const energyChartRef = useRef(null);
  const generationCanvasRef = useRef(null);
  const generationChartRef = useRef(null);
  const comparisonCanvasRef = useRef(null);
  const comparisonChartRef = useRef(null);
  const fireMapContainerRef = useRef(null);
  const fireMapRef = useRef(null);
  const fireMarkersLayerRef = useRef(null);
  const vegetationCanvasRef = useRef(null);
  const vegetationChartRef = useRef(null);
  const waterCanvasRef = useRef(null);
  const waterChartRef = useRef(null);
  const stressCanvasRef = useRef(null);
  const stressChartRef = useRef(null);

  useEffect(() => {
    setPreferredLang(detectPreferredLanguage());
  }, []);

  useEffect(() => {
    if (router.isReady && !code) {
      router.replace(`/pays/${detectDefaultCountry()}`);
    }
  }, [router, code]);

  useEffect(() => {
    fetch(`${API_URL}/api/co2/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API_URL}/api/country-summary/${code}`).then((res) => {
        if (!res.ok) throw new Error("Données indisponibles pour ce pays");
        return res.json();
      }),
      fetch(`${API_URL}/api/species?country=${code}`).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API_URL}/api/fires?country=${code}`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([summaryData, speciesData, firesData]) => {
        setSummary(summaryData);
        setSpeciesList(Array.isArray(speciesData) ? speciesData : []);
        setFires(Array.isArray(firesData) ? firesData : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [code]);

  // Réinitialise la comparaison si on change de pays principal, pour éviter
  // de comparer un pays avec lui-même par accident.
  useEffect(() => {
    setCompareCode("");
    setCompareSummary(null);
  }, [code]);

  useEffect(() => {
    if (!compareCode) {
      setCompareSummary(null);
      return;
    }
    fetch(`${API_URL}/api/country-summary/${compareCode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setCompareSummary)
      .catch(() => setCompareSummary(null));
  }, [compareCode]);

  useEffect(() => {
    if (!summary || summary.co2.length === 0) return;
    const hasConsumptionData = summary.co2.some((d) => d.consumption_co2 !== null && d.consumption_co2 !== undefined);

    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !co2CanvasRef.current) return;
      if (co2ChartRef.current) co2ChartRef.current.destroy();

      const datasets = [
        {
          label: "Émis dans le pays (Mt)",
          data: summary.co2.map((d) => d.emissions_mt),
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
          label: "Lié à ce qu'on achète (Mt)",
          data: summary.co2.map((d) => d.consumption_co2),
          borderColor: "#e67e22",
          backgroundColor: "rgba(230,126,34,0.1)",
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [5, 4],
        });
      }

      co2ChartRef.current = new Chart.default(co2CanvasRef.current, {
        type: "line",
        data: { labels: summary.co2.map((d) => d.year), datasets },
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
  }, [summary]);

  useEffect(() => {
    if (!summary || summary.energyMix.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !energyCanvasRef.current) return;
      if (energyChartRef.current) energyChartRef.current.destroy();

      const sorted = [...summary.energyMix].sort(
        (a, b) => Number(b.total_capacity_mw || 0) - Number(a.total_capacity_mw || 0)
      );

      energyChartRef.current = new Chart.default(energyCanvasRef.current, {
        type: "bar",
        data: {
          labels: sorted.map((r) => translateFuel(r.fuel_type)),
          datasets: [
            {
              label: "Capacité (MW)",
              data: sorted.map((r) => r.total_capacity_mw || 0),
              backgroundColor: sorted.map((r) => FUEL_COLORS[r.fuel_type] || DEFAULT_FUEL_COLOR),
              plantCounts: sorted.map((r) => r.plant_count),
            },
          ],
        },
        plugins: [barEndLabelsPlugin],
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 90 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: "Capacité (MW)" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  useEffect(() => {
    if (!summary || !summary.electricityGeneration || summary.electricityGeneration.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !generationCanvasRef.current) return;
      if (generationChartRef.current) generationChartRef.current.destroy();

      const sources = [
        { key: "coal_twh", label: translateFuel("Coal"), color: FUEL_COLORS.Coal },
        { key: "gas_twh", label: translateFuel("Gas"), color: FUEL_COLORS.Gas },
        { key: "oil_twh", label: translateFuel("Oil"), color: FUEL_COLORS.Oil },
        { key: "nuclear_twh", label: translateFuel("Nuclear"), color: FUEL_COLORS.Nuclear },
        { key: "hydro_twh", label: translateFuel("Hydro"), color: FUEL_COLORS.Hydro },
        { key: "wind_twh", label: translateFuel("Wind"), color: FUEL_COLORS.Wind },
        { key: "solar_twh", label: translateFuel("Solar"), color: FUEL_COLORS.Solar },
        { key: "biofuel_twh", label: translateFuel("Biomass"), color: FUEL_COLORS.Biomass },
        { key: "other_renewable_twh", label: "Autres renouvelables", color: DEFAULT_FUEL_COLOR },
      ];

      generationChartRef.current = new Chart.default(generationCanvasRef.current, {
        type: "bar",
        data: {
          labels: summary.electricityGeneration.map((d) => d.year),
          datasets: [
            ...sources.map((s) => ({
              label: s.label,
              data: summary.electricityGeneration.map((d) => d[s.key] || 0),
              backgroundColor: s.color || DEFAULT_FUEL_COLOR,
              stack: "generation",
            })),
            {
              type: "line",
              label: "Consommation réelle (demande)",
              data: summary.electricityGeneration.map((d) => d.demand_twh),
              borderColor: "#000000",
              borderWidth: 2,
              borderDash: [4, 3],
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: "bottom" } },
          scales: {
            x: { stacked: true },
            y: { stacked: true, title: { display: true, text: "TWh/an" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  // Comparaison mondiale : les métriques "indice" (CO2, électricité, eau, forêt,
  // pollution) sont ramenées à 100 = moyenne mondiale, colorées rouge/vert selon
  // qu'elles sont au-dessus ou en-dessous. La biodiversité est d'une autre nature
  // (part du total mondial, pas une moyenne à dépasser) — elle est donc affichée
  // avec une couleur neutre plutôt que de réutiliser à tort le rouge/vert.
  useEffect(() => {
    if (!summary || !worldBenchmarks) return;

    function computeRows(summaryData) {
      if (!summaryData) return [];
      const latestCo2 = summaryData.co2?.[summaryData.co2.length - 1];
      const latestElec = summaryData.electricityGeneration?.[summaryData.electricityGeneration.length - 1];
      const latestPollution = summaryData.pollution?.[summaryData.pollution.length - 1];
      const latestWater = summaryData.water?.[summaryData.water.length - 1];
      const latestVegetation = summaryData.vegetation?.[summaryData.vegetation.length - 1];
      const latestSpecies = summaryData.speciesThreatened?.[summaryData.speciesThreatened.length - 1];

      const rows = [];
      if (latestCo2?.emissions_per_capita && worldBenchmarks.co2_per_capita) {
        rows.push({
          label: "CO2 par habitant",
          value: (latestCo2.emissions_per_capita / worldBenchmarks.co2_per_capita.value) * 100,
          type: "index",
        });
      }
      if (latestElec?.demand_per_capita_kwh && worldBenchmarks.electricity_demand_per_capita) {
        rows.push({
          label: "Électricité consommée/hab",
          value: (latestElec.demand_per_capita_kwh / worldBenchmarks.electricity_demand_per_capita.value) * 100,
          type: "index",
        });
      }
      if (latestWater?.withdrawal_share_percent && worldBenchmarks.water_stress_share) {
        rows.push({
          label: "Eau utilisée (% du disponible)",
          value: (latestWater.withdrawal_share_percent / worldBenchmarks.water_stress_share.value) * 100,
          type: "index",
        });
      }
      if (latestVegetation?.forest_area_ha && latestVegetation?.tree_cover_loss_ha && worldBenchmarks.forest_loss_share_world) {
        const countryShare = (latestVegetation.tree_cover_loss_ha / latestVegetation.forest_area_ha) * 100;
        rows.push({
          label: "% forêt perdue/an",
          value: (countryShare / worldBenchmarks.forest_loss_share_world.value) * 100,
          type: "index",
        });
      }
      if (latestPollution?.pm25_ug_m3 && worldBenchmarks.pm25_world_average) {
        rows.push({
          label: "Pollution de l'air (PM2.5)",
          value: (latestPollution.pm25_ug_m3 / worldBenchmarks.pm25_world_average.value) * 100,
          type: "index",
        });
      }
      if (latestSpecies && worldBenchmarks.mammals_threatened_world) {
        const countryTotal = (latestSpecies.mammals_threatened || 0) + (latestSpecies.birds_threatened || 0) + (latestSpecies.fish_threatened || 0);
        const worldTotal =
          worldBenchmarks.mammals_threatened_world.value +
          (worldBenchmarks.birds_threatened_world?.value || 0) +
          (worldBenchmarks.fish_threatened_world?.value || 0);
        if (worldTotal > 0 && countryTotal > 0) {
          rows.push({
            label: "Espèces menacées (% du total mondial)",
            value: (countryTotal / worldTotal) * 100,
            type: "share",
          });
        }
      }
      return rows;
    }

    const mainRows = computeRows(summary);
    const compareRows = computeRows(compareSummary);
    if (mainRows.length === 0) return;

    const labels = mainRows.map((r) => r.label);
    const compareByLabel = Object.fromEntries(compareRows.map((r) => [r.label, r.value]));
    const hasIndexMetric = mainRows.some((r) => r.type === "index");

    // Ligne verticale à 100 = moyenne mondiale — la couleur des barres identifie
    // uniquement le pays, jamais si c'est "bon" ou "mauvais" : c'est la position
    // de la barre par rapport à cette ligne qui le montre.
    const referenceLinePlugin = {
      id: "referenceLine100",
      afterDraw(chart) {
        if (!hasIndexMetric) return;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const x = xScale.getPixelForValue(100);
        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = "#999";
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#999";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Moyenne mondiale", x + 4, yScale.top + 10);
        ctx.restore();
      },
    };

    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !comparisonCanvasRef.current) return;
      if (comparisonChartRef.current) comparisonChartRef.current.destroy();

      const datasets = [
        {
          label: localizedCountryName(code, preferredLang),
          data: mainRows.map((r) => Math.round(r.value * 100) / 100),
          backgroundColor: "#6c3483",
        },
      ];
      if (compareCode && compareSummary) {
        datasets.push({
          label: localizedCountryName(compareCode, preferredLang),
          data: labels.map((l) => (compareByLabel[l] !== undefined ? Math.round(compareByLabel[l] * 100) / 100 : null)),
          backgroundColor: "#c6a2d6",
        });
      }

      comparisonChartRef.current = new Chart.default(comparisonCanvasRef.current, {
        type: "bar",
        data: { labels, datasets },
        plugins: [referenceLinePlugin],
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
          },
          scales: {
            x: { title: { display: true, text: "Voir légende ci-dessous — échelles différentes selon la métrique" } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary, worldBenchmarks, code, preferredLang, compareCode, compareSummary]);

  useEffect(() => {
    if (!summary || !summary.vegetation || summary.vegetation.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !vegetationCanvasRef.current) return;
      if (vegetationChartRef.current) vegetationChartRef.current.destroy();
      vegetationChartRef.current = new Chart.default(vegetationCanvasRef.current, {
        type: "bar",
        data: {
          labels: summary.vegetation.map((d) => d.year),
          datasets: [
            {
              type: "bar",
              label: "Perte de couverture arborée (ha)",
              data: summary.vegetation.map((d) => d.tree_cover_loss_ha),
              backgroundColor: "#e67e22",
              yAxisID: "y",
            },
            {
              type: "line",
              label: "% du couvert perdu",
              data: summary.vegetation.map((d) =>
                d.forest_area_ha ? (d.tree_cover_loss_ha / d.forest_area_ha) * 100 : null
              ),
              borderColor: "#d63e2a",
              backgroundColor: "rgba(214,62,42,0.1)",
              yAxisID: "y1",
              tension: 0.3,
              pointRadius: 2,
              borderWidth: 2,
            },
            ...(worldBenchmarks?.forest_loss_share_world
              ? [
                  {
                    type: "line",
                    label: "Moyenne mondiale (%)",
                    data: summary.vegetation.map(() => worldBenchmarks.forest_loss_share_world.value),
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
            y1: { type: "linear", position: "right", title: { display: true, text: "% perdu" }, grid: { drawOnChartArea: false } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary, worldBenchmarks]);

  useEffect(() => {
    if (!summary || !summary.water || summary.water.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !waterCanvasRef.current) return;
      if (waterChartRef.current) waterChartRef.current.destroy();
      waterChartRef.current = new Chart.default(waterCanvasRef.current, {
        type: "line",
        data: {
          labels: summary.water.map((d) => d.year),
          datasets: [
            {
              label: "Eau douce disponible par habitant (m³/an)",
              data: summary.water.map((d) => d.renewable_freshwater_m3_per_capita),
              borderColor: "#2a78d6",
              backgroundColor: "rgba(42,120,214,0.1)",
              yAxisID: "y",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
            },
            {
              label: "Pluviométrie (mm/an)",
              data: summary.water.map((d) => d.precipitation_mm),
              borderColor: "#1baf7a",
              backgroundColor: "rgba(27,175,122,0.1)",
              yAxisID: "y1",
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [5, 4],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: {
            y: { type: "linear", position: "left", title: { display: true, text: "m³ par habitant et par an" } },
            y1: { type: "linear", position: "right", title: { display: true, text: "mm/an" }, grid: { drawOnChartArea: false } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  useEffect(() => {
    if (!summary || !summary.water || summary.water.length === 0) return;
    const hasStress = summary.water.some((d) => d.withdrawal_share_percent !== null && d.withdrawal_share_percent !== undefined);
    if (!hasStress) return;
    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !stressCanvasRef.current) return;
      if (stressChartRef.current) stressChartRef.current.destroy();

      const datasets = [
        {
          label: "Part de l'eau disponible réellement utilisée (%)",
          data: summary.water.map((d) => d.withdrawal_share_percent),
          borderColor: "#8e44ad",
          backgroundColor: "rgba(142,68,173,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ];
      if (worldBenchmarks?.water_stress_share) {
        datasets.push({
          label: "Moyenne mondiale",
          data: summary.water.map(() => worldBenchmarks.water_stress_share.value),
          borderColor: "#95a5a6",
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false,
        });
      }

      stressChartRef.current = new Chart.default(stressCanvasRef.current, {
        type: "line",
        data: { labels: summary.water.map((d) => d.year), datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { title: { display: true, text: "% de l'eau disponible utilisée" } } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary, worldBenchmarks]);

  useEffect(() => {
    if (!fireMapContainerRef.current || fireMapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !fireMapContainerRef.current) return;
      fireMapRef.current = L.map(fireMapContainerRef.current).setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; contributeurs OpenStreetMap",
        maxZoom: 18,
      }).addTo(fireMapRef.current);
      fireMarkersLayerRef.current = L.layerGroup().addTo(fireMapRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fireMapRef.current || !fireMarkersLayerRef.current) return;
    import("leaflet").then((L) => {
      fireMarkersLayerRef.current.clearLayers();
      fires.forEach((f) => {
        const frp = f.frp || 0;
        const color = frp > 50 ? "#d63e2a" : frp > 10 ? "#e67e22" : "#f4b400";
        L.circleMarker([f.latitude, f.longitude], {
          radius: 5,
          color,
          fillColor: color,
          fillOpacity: 0.7,
          weight: 1,
        })
          .bindPopup(
            `Détecté le ${new Date(f.detected_at).toLocaleString("fr-FR")}<br/>Puissance radiative : ${f.frp ?? "?"} MW`
          )
          .addTo(fireMarkersLayerRef.current);
      });
      if (fires.length > 0) {
        const bounds = L.latLngBounds(fires.map((f) => [f.latitude, f.longitude]));
        fireMapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
      } else {
        fireMapRef.current.setView([20, 0], 2);
      }
    });
  }, [fires]);

  const countryName = localizedCountryName(code, preferredLang);
  const latestCo2 = summary?.co2?.[summary.co2.length - 1];
  const totalCapacity = summary?.energyMix?.reduce(
    (sum, r) => sum + Number(r.total_capacity_mw || 0),
    0
  );

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <h1>{countryName}</h1>
        <CountrySelect
          countries={countries}
          value={code || ""}
          onChange={(newCode) => router.push(`/pays/${newCode}`)}
          preferredLang={preferredLang}
          label="Changer de pays"
        />
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && summary && (
        <>
          <section style={{ marginTop: "1rem", marginBottom: "2rem", padding: "1rem", background: "#f7f7f7", borderRadius: 8 }}>
            <h2 style={{ marginTop: 0 }}>Comparaison mondiale</h2>
            <p style={{ fontSize: 13, color: "#666" }}>
              La <strong>couleur identifie le pays</strong> (voir la légende au-dessus du
              graphique), rien d&apos;autre — elle ne veut jamais dire &laquo; bon &raquo; ou
              &laquo; mauvais &raquo;. Pour le CO2, l&apos;électricité, l&apos;eau, la forêt et la
              pollution, chaque métrique est ramenée à un indice où{" "}
              <strong>100 = moyenne mondiale</strong> (ligne grise en pointillés sur le graphique) :
              une barre qui dépasse la ligne est au-dessus de la moyenne mondiale sur cette
              métrique, une barre qui s&apos;arrête avant est en-dessous. Exemple : à 150, le pays
              est 50 % au-dessus de la moyenne mondiale ; à 50, il est deux fois en-dessous.
            </p>
            <p style={{ fontSize: 13, color: "#666" }}>
              La ligne &laquo; Espèces menacées (% du total mondial) &raquo; est différente : elle
              montre la part du total mondial que représente ce pays, pas une comparaison à une
              moyenne — aucun pays ne peut avoir &laquo; 100 % &raquo; des espèces menacées du
              monde, donc la ligne de référence à 100 n&apos;a pas de sens pour cette ligne-là.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <CountrySelect
                countries={countries.filter((c) => c.country_code !== code)}
                value={compareCode}
                onChange={setCompareCode}
                preferredLang={preferredLang}
                label="Comparer aussi avec"
              />
              {compareCode && (
                <button onClick={() => setCompareCode("")} style={{ fontSize: 13 }}>
                  Retirer la comparaison
                </button>
              )}
            </div>
            <div style={{ position: "relative", height: 140 }}>
              <canvas ref={comparisonCanvasRef} role="img" aria-label={`Comparaison de ${countryName} avec les moyennes mondiales`} />
            </div>
            {(() => {
              function speciesLine(summaryData, name) {
                if (!summaryData?.speciesThreatened?.length || !worldBenchmarks?.mammals_threatened_world) return null;
                const latest = summaryData.speciesThreatened[summaryData.speciesThreatened.length - 1];
                const countryTotal = (latest.mammals_threatened || 0) + (latest.birds_threatened || 0) + (latest.fish_threatened || 0);
                const worldTotal =
                  worldBenchmarks.mammals_threatened_world.value +
                  (worldBenchmarks.birds_threatened_world?.value || 0) +
                  (worldBenchmarks.fish_threatened_world?.value || 0);
                const share = worldTotal > 0 ? ((countryTotal / worldTotal) * 100).toFixed(2) : null;
                if (!share) return null;
                return (
                  <p key={`species-${name}`} style={{ fontSize: 13, color: "#666" }}>
                    {name} compte <strong>{countryTotal}</strong> espèces menacées (mammifères/oiseaux/poissons confondus),
                    soit environ <strong>{share} %</strong> du total mondial comptabilisé ({worldTotal}).
                  </p>
                );
              }

              function pollutionLine(summaryData, name) {
                if (!worldBenchmarks?.pm25_who_guideline || !summaryData?.pollution?.length) return null;
                const latest = summaryData.pollution[summaryData.pollution.length - 1];
                if (!latest.pm25_ug_m3) return null;
                const ratio = (latest.pm25_ug_m3 / worldBenchmarks.pm25_who_guideline.value).toFixed(1);
                return (
                  <p key={`pollution-${name}`} style={{ fontSize: 13, color: "#666" }}>
                    Pollution de l&apos;air à {name} : {latest.pm25_ug_m3} µg/m³, soit{" "}
                    <strong>{ratio}×</strong> le seuil recommandé par l&apos;OMS (5 µg/m³).
                  </p>
                );
              }

              return (
                <>
                  {speciesLine(summary, countryName)}
                  {compareCode && compareSummary && speciesLine(compareSummary, localizedCountryName(compareCode, preferredLang))}
                  {pollutionLine(summary, countryName)}
                  {compareCode && compareSummary && pollutionLine(compareSummary, localizedCountryName(compareCode, preferredLang))}
                </>
              );
            })()}
          </section>
        </>
      )}

      {!loading && !error && summary && (
        <>
          <section style={{ marginTop: "1.5rem" }}>
            <h2>Émissions de CO2</h2>
            {latestCo2 ? (
              <p>
                Dernière donnée disponible ({latestCo2.year}) :{" "}
                <strong>{latestCo2.emissions_mt} Mt</strong>
                {latestCo2.emissions_per_capita && (
                  <> — soit {latestCo2.emissions_per_capita} t par habitant</>
                )}
              </p>
            ) : (
              <p>Aucune donnée CO2 pour ce pays.</p>
            )}
            <p style={{ fontSize: 13, color: "#666" }}>
              La courbe bleue, c&apos;est ce qui est physiquement émis sur le sol du pays. La
              courbe orange en pointillés (si présente), c&apos;est ce qui est lié à ce que les
              gens du pays achètent — y compris les produits importés. Exemple : si l&apos;orange
              dépasse le bleu, le pays importe globalement plus d&apos;émissions qu&apos;il
              n&apos;en exporte.
            </p>
            {summary.co2.length > 0 && (
              <div style={{ position: "relative", height: 220 }}>
                <canvas ref={co2CanvasRef} role="img" aria-label={`Émissions de CO2 pour ${countryName}`} />
              </div>
            )}
            <p style={{ fontSize: 12, color: "#666" }}>
              Aviation et transport maritime internationaux non comptés dans aucune des deux.
              {lastUpdated?.co2?.latestYear && (
                <> Dernière année couverte : {lastUpdated.co2.latestYear}.</>
              )}
              {" "}Rafraîchissement automatique mensuel.{" "}
              <Link href="/co2">Détails et comparaison avec d&apos;autres pays →</Link>
            </p>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2>Mix énergétique</h2>
            {summary.energyMix.length > 0 ? (
              <>
                <p>
                  <strong>{summary.energyMix.length}</strong> types de production,{" "}
                  <strong>{Math.round(totalCapacity).toLocaleString("fr-FR")} MW</strong> de capacité totale connue.
                </p>
                <p style={{ fontSize: 13, color: "#666" }}>
                  Ce graphique montre la <strong>capacité installée</strong> — la puissance
                  maximale possible, pas ce qui est réellement produit (un panneau solaire ne
                  produit rien la nuit).
                </p>
                <div style={{ position: "relative", height: Math.max(200, summary.energyMix.length * 34) }}>
                  <canvas ref={energyCanvasRef} role="img" aria-label={`Mix énergétique de ${countryName}, capacité et nombre de centrales par type`} />
                </div>
                <details style={{ marginTop: "0.75rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, color: "#666" }}>
                    Voir le détail chiffré en tableau
                  </summary>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: "left", padding: 6 }}>Type</th>
                        <th scope="col" style={{ textAlign: "right", padding: 6 }}>Centrales</th>
                        <th scope="col" style={{ textAlign: "right", padding: 6 }}>Capacité (MW)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.energyMix.map((r) => (
                        <tr key={r.fuel_type}>
                          <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{translateFuel(r.fuel_type)}</th>
                          <td style={{ textAlign: "right", padding: 6 }}>{r.plant_count}</td>
                          <td style={{ textAlign: "right", padding: 6 }}>
                            {r.total_capacity_mw ? Math.round(r.total_capacity_mw).toLocaleString("fr-FR") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            ) : (
              <p>Aucune centrale répertoriée pour ce pays.</p>
            )}
            <p style={{ fontSize: 12, color: "#666" }}>
              Global Power Plant Database (WRI) — dernière version (v1.3.0), plus activement
              maintenue depuis 2021-2022.
              {lastUpdated?.powerPlants?.lastIngested && (
                <> Dernière mise à jour de notre base : {formatDate(lastUpdated.powerPlants.lastIngested)}.</>
              )}
              {" "}<Link href="/energie">Voir la carte détaillée →</Link>
            </p>
            {summary.electricityGeneration?.length > 0 && (
              <>
                <p style={{ fontSize: 13, color: "#666", marginTop: "1rem" }}>
                  À la différence du graphique ci-dessus (capacité installée, figée), voici ce qui
                  est réellement produit chaque année. La ligne noire en pointillés, c&apos;est la
                  consommation réelle : si elle est au-dessus des barres, le pays importe de
                  l&apos;électricité pour compenser.
                </p>
                <div style={{ position: "relative", height: 260 }}>
                  <canvas ref={generationCanvasRef} role="img" aria-label={`Génération électrique réelle par filière pour ${countryName}`} />
                </div>
                <p style={{ fontSize: 12, color: "#666" }}>
                  Ember / Energy Institute, via Our World in Data.
                  {lastUpdated?.electricity?.latestYear && (
                    <> Dernière année couverte : {lastUpdated.electricity.latestYear}.</>
                  )}
                </p>
              </>
            )}
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2>Biodiversité (échantillon)</h2>
            {speciesList.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
                  <strong>{speciesList.length}</strong> espèces de l&apos;échantillon observées dans ce pays
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 6 }}>Nom scientifique</th>
                    <th scope="col" style={{ textAlign: "left", padding: 6 }}>Noms communs</th>
                    <th scope="col" style={{ textAlign: "left", padding: 6 }}>Groupe</th>
                    <th scope="col" style={{ textAlign: "left", padding: 6 }}>Catégorie</th>
                  </tr>
                </thead>
                <tbody>
                  {speciesList.map((s) => {
                    const info = CATEGORY_INFO[s.category] || { label: s.category, color: "#999" };
                    const names = formatCommonNames(s.common_names, preferredLang);
                    return (
                      <tr key={s.scientific_name}>
                        <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400, fontStyle: "italic" }}>
                          {s.scientific_name}
                        </th>
                        <td style={{ textAlign: "left", padding: 6, fontSize: 13, color: names ? "inherit" : "#999" }}>
                          {names || "non disponible"}
                        </td>
                        <td style={{ textAlign: "left", padding: 6 }}>{speciesGroupLabel(s.kingdom, s.class, s.taxon_order)}</td>
                        <td style={{ padding: 6 }}>
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, color: "white", backgroundColor: info.color, whiteSpace: "nowrap" }}>
                            {info.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p>Aucune espèce de l&apos;échantillon liée à ce pays pour l&apos;instant.</p>
            )}
            <p style={{ fontSize: 12, color: "#666" }}>
              GBIF, occurrences classées par catégorie UICN via la collaboration GBIF-IUCN —
              échantillon, pas la liste complète des espèces évaluées.
              {lastUpdated?.species?.lastIngested && (
                <> Dernière mise à jour : {formatDate(lastUpdated.species.lastIngested)}.</>
              )}
              {" "}<Link href="/especes">Filtrer par groupe/catégorie →</Link>
            </p>
            {summary.speciesThreatened?.length > 0 && (() => {
              const latest = summary.speciesThreatened[summary.speciesThreatened.length - 1];
              return (
                <p style={{ fontSize: 12, color: "#666" }}>
                  Comptage officiel IUCN ({latest.year}) — <strong>{latest.mammals_threatened ?? "—"}</strong> mammifères,{" "}
                  <strong>{latest.birds_threatened ?? "—"}</strong> oiseaux et{" "}
                  <strong>{latest.fish_threatened ?? "—"}</strong> poissons menacés (nombres absolus, pas de %).
                  {" "}<Link href="/especes">Voir le détail →</Link>
                </p>
              );
            })()}
          </section>
        </>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2>Feux actifs</h2>
        {!loading && !error && (
          fires.length > 0 ? (
            <p>
              <strong>{summary?.fires?.fire_count ?? fires.length}</strong> détections satellite sur les 3 derniers jours
              {summary?.fires?.latest_detection && (
                <> — la plus récente le {new Date(summary.fires.latest_detection).toLocaleString("fr-FR")}</>
              )}
              .
            </p>
          ) : (
            <p>Aucune détection récente pour ce pays (ou pays non encore couvert par cette source).</p>
          )
        )}
        <p style={{ fontSize: 12, color: "#666", marginBottom: "0.5rem" }}>
          Couleur des points : <span style={{ color: "#f4b400", fontWeight: 600 }}>jaune</span>{" "}
          modéré (souvent un brûlis agricole), <span style={{ color: "#e67e22", fontWeight: 600 }}>orange</span>{" "}
          intermédiaire, <span style={{ color: "#d63e2a", fontWeight: 600 }}>rouge</span>{" "}
          intense (plus probablement un vrai feu de forêt).
        </p>
        <div ref={fireMapContainerRef} style={{ height: 360, borderRadius: 8 }} />
        <p style={{ fontSize: 12, color: "#666", marginTop: "0.5rem" }}>
          NASA FIRMS (MODIS_NRT) — une détection n&apos;est pas nécessairement un feu de forêt
          incontrôlé (brûlis agricoles inclus). Couverture limitée à une liste de pays courants.
          Rafraîchissement automatique toutes les 6 heures.{" "}
          <Link href="/incendies">Voir en plein écran →</Link>
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Perte de couverture arborée</h2>
        {summary?.vegetation?.length > 0 ? (
          <>
            <p>
              Dernière donnée disponible ({summary.vegetation[summary.vegetation.length - 1].year}) :{" "}
              <strong>
                {Math.round(summary.vegetation[summary.vegetation.length - 1].tree_cover_loss_ha).toLocaleString("fr-FR")} ha
              </strong>{" "}
              perdus.
            </p>
            <p style={{ fontSize: 13, color: "#666" }}>
              Les barres orange, c&apos;est le nombre d&apos;hectares perdus chaque année (un
              hectare ≈ un terrain de foot). La courbe rouge rapporte ce chiffre à la taille de la
              forêt du pays — un petit pays très boisé qui perd peu d&apos;hectares en valeur
              absolue peut quand même perdre un % important de sa forêt.
            </p>
            <div style={{ position: "relative", height: 220 }}>
              <canvas ref={vegetationCanvasRef} role="img" aria-label={`Perte de couverture arborée pour ${countryName}`} />
            </div>
          </>
        ) : (
          <p>Aucune donnée de végétation pour ce pays.</p>
        )}
        <p style={{ fontSize: 12, color: "#666" }}>
          Global Forest Watch (Hansen et al.), toutes causes confondues (coupe, incendie,
          agriculture) — pas nécessairement permanente.
          {lastUpdated?.vegetation?.latestYear && (
            <> Dernière année couverte : {lastUpdated.vegetation.latestYear}.</>
          )}
          {" "}<Link href="/vegetation">Voir le détail →</Link>
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Ressources en eau</h2>
        {summary?.water?.length > 0 ? (
          <p>
            Dernière donnée disponible ({summary.water[summary.water.length - 1].year}) :{" "}
            {summary.water[summary.water.length - 1].renewable_freshwater_m3_per_capita && (
              <>
                <strong>
                  {Math.round(summary.water[summary.water.length - 1].renewable_freshwater_m3_per_capita).toLocaleString("fr-FR")} m³
                </strong>{" "}
                de ressources renouvelables par habitant
              </>
            )}
            {summary.water[summary.water.length - 1].precipitation_mm && (
              <>
                {" "}— <strong>{Math.round(summary.water[summary.water.length - 1].precipitation_mm).toLocaleString("fr-FR")} mm</strong> de précipitations cette année-là
              </>
            )}
            {(() => {
              const lastWithdrawal = [...summary.water].reverse().find((d) => d.withdrawal_m3);
              return lastWithdrawal ? (
                <>
                  {" "}— <strong>{(lastWithdrawal.withdrawal_m3 / 1e9).toFixed(1)} Md m³</strong> prélevés réellement en {lastWithdrawal.year}
                </>
              ) : null;
            })()}
            .
          </p>
        ) : (
          <p>Aucune donnée eau pour ce pays.</p>
        )}
        {summary?.water?.length > 0 && (
          <div style={{ position: "relative", height: 260 }}>
            <canvas ref={waterCanvasRef} role="img" aria-label={`Ressources en eau et pluviométrie pour ${countryName}`} />
          </div>
        )}
        {summary?.water?.some((d) => d.withdrawal_share_percent) && (
          <>
            <h3 style={{ fontSize: 15, marginTop: "1.5rem", marginBottom: "0.25rem" }}>
              Ce deuxième graphique : combien de cette eau est-elle utilisée ?
            </h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
              Le graphique du dessus montre <strong>combien d&apos;eau existe</strong>. Celui-ci
              montre <strong>combien de cette eau est prélevée</strong> chaque année, en
              pourcentage. Exemple : à 25 %, le pays utilise un quart de l&apos;eau qui se
              renouvelle chaque année. À 120 %, il en utilise plus qu&apos;il ne s&apos;en
              renouvelle — souvent en puisant dans des réserves qui ne se rechargent pas.
            </p>
            <div style={{ position: "relative", height: 220 }}>
              <canvas ref={stressCanvasRef} role="img" aria-label={`Part de l'eau disponible utilisée pour ${countryName}, comparé à la moyenne mondiale`} />
            </div>
          </>
        )}
        <p style={{ fontSize: 12, color: "#666" }}>
          AQUASTAT/FAO via Banque mondiale (ressources renouvelables, estimation long terme) et
          Copernicus ERA5 (pluviométrie annuelle réelle), via Our World in Data.
          {lastUpdated?.water?.latestYear && (
            <> Dernière année couverte : {lastUpdated.water.latestYear}.</>
          )}
          {" "}<Link href="/eau">Voir le graphique détaillé →</Link>
        </p>
      </section>
    </main>
  );
}
