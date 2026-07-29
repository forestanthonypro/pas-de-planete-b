import { useEffect, useMemo, useRef, useState } from "react";
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
import { IconLeaf } from "../../components/icons";
import ShareButtons from "../../components/ShareButtons";
import { useSobriety } from "../../lib/SobrietyContext";
import { barEndLabelsPlugin } from "../../lib/barEndLabelsPlugin";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function useCategoryInfo(t) {
  return {
    EX: { label: t("especes.cat_ex"), color: "#000000" },
    EW: { label: t("especes.cat_ew"), color: "#3d3d3d" },
    CR: { label: t("especes.cat_cr"), color: "#d63e2a" },
    EN: { label: t("especes.cat_en"), color: "#e67e22" },
    VU: { label: t("especes.cat_vu"), color: "#f4b400" },
    NT: { label: t("especes.cat_nt"), color: "#cbd423" },
    LC: { label: t("especes.cat_lc"), color: "#1baf7a" },
    DD: { label: t("especes.cat_dd"), color: "#95a5a6" },
  };
}

export default function PaysDashboard() {
  const router = useRouter();
  const { code } = router.query;
  const { sobriety } = useSobriety();
  const { t, locale } = useT();
  const CATEGORY_INFO = useCategoryInfo(t);
  const lastUpdated = useLastUpdated();
  const worldBenchmarks = useWorldBenchmarks();

  const [countries, setCountries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [speciesList, setSpeciesList] = useState([]);
  const [fires, setFires] = useState([]);
  const [preferredLang, setPreferredLang] = useState(null);
  const [compareCode, setCompareCode] = useState("");
  const [compareSummary, setCompareSummary] = useState(null);

  const vegetationCumulativeSummary = useMemo(() => {
    const veg = summary?.vegetation;
    if (!veg || veg.length === 0) return null;
    const filled = veg.map((r) => ({ ...r }));
    let last = null;
    for (let i = 0; i < filled.length; i++) {
      if (filled[i].forest_area_ha != null) last = filled[i].forest_area_ha;
      else if (last != null) filled[i].forest_area_ha = last;
    }
    let next = null;
    for (let i = filled.length - 1; i >= 0; i--) {
      if (veg[i].forest_area_ha != null) next = veg[i].forest_area_ha;
      else if (filled[i].forest_area_ha == null && next != null) filled[i].forest_area_ha = next;
    }
    const firstLossRow = veg.find((d) => d.tree_cover_loss_ha != null);
    const lastLossRow = [...veg].reverse().find((d) => d.tree_cover_loss_ha != null);
    if (!firstLossRow || !lastLossRow) return null;
    const baselineRow = filled.find((d) => d.year === firstLossRow.year);
    const baselineArea = baselineRow?.forest_area_ha;
    if (!baselineArea) return null;
    const totalLoss = veg.reduce((sum, d) => sum + (parseFloat(d.tree_cover_loss_ha) || 0), 0);
    return {
      startYear: firstLossRow.year,
      endYear: lastLossRow.year,
      totalLossHa: totalLoss,
      percent: (totalLoss / baselineArea) * 100,
    };
  }, [summary]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const co2CanvasRef = useRef(null);
  const co2ChartRef = useRef(null);
  const co2CompareCanvasRef = useRef(null);
  const co2CompareChartRef = useRef(null);
  const energyCanvasRef = useRef(null);
  const energyChartRef = useRef(null);
  const energyCompareCanvasRef = useRef(null);
  const energyCompareChartRef = useRef(null);
  const generationCanvasRef = useRef(null);
  const generationChartRef = useRef(null);
  const generationCompareCanvasRef = useRef(null);
  const generationCompareChartRef = useRef(null);
  const comparisonCanvasRef = useRef(null);
  const comparisonChartRef = useRef(null);
  const fireMapContainerRef = useRef(null);
  const fireMapRef = useRef(null);
  const fireMarkersLayerRef = useRef(null);
  const fireMapCompareContainerRef = useRef(null);
  const fireMapCompareRef = useRef(null);
  const fireMarkersCompareLayerRef = useRef(null);
  const vegetationCanvasRef = useRef(null);
  const vegetationChartRef = useRef(null);
  const vegetationCompareCanvasRef = useRef(null);
  const vegetationCompareChartRef = useRef(null);
  const waterCanvasRef = useRef(null);
  const waterChartRef = useRef(null);
  const waterCompareCanvasRef = useRef(null);
  const waterCompareChartRef = useRef(null);
  const stressCanvasRef = useRef(null);
  const stressChartRef = useRef(null);
  const stressCompareCanvasRef = useRef(null);
  const stressCompareChartRef = useRef(null);

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
        if (!res.ok) throw new Error(t("pays.co2_no_data"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    setCompareCode("");
    setCompareSummary(null);
  }, [code]);

  const [compareSpeciesList, setCompareSpeciesList] = useState([]);
  const [compareFires, setCompareFires] = useState([]);

  useEffect(() => {
    if (!compareCode) {
      setCompareSummary(null);
      setCompareSpeciesList([]);
      setCompareFires([]);
      return;
    }
    Promise.all([
      fetch(`${API_URL}/api/country-summary/${compareCode}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`${API_URL}/api/species?country=${compareCode}`).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API_URL}/api/fires?country=${compareCode}`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([summaryData, speciesData, firesData]) => {
        setCompareSummary(summaryData);
        setCompareSpeciesList(Array.isArray(speciesData) ? speciesData : []);
        setCompareFires(Array.isArray(firesData) ? firesData : []);
      })
      .catch(() => {
        setCompareSummary(null);
        setCompareSpeciesList([]);
        setCompareFires([]);
      });
  }, [compareCode]);

  useEffect(() => {
    if (!summary || summary.co2.length === 0) return;
    const hasConsumptionData = summary.co2.some((d) => d.consumption_co2 !== null && d.consumption_co2 !== undefined);

    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !co2CanvasRef.current) return;
      if (co2ChartRef.current) co2ChartRef.current.destroy();

      const datasets = [
        {
          label: t("co2.chart_label_territorial_total"),
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
          label: t("co2.chart_label_consumption_total"),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, t]);

  useEffect(() => {
    if (!compareCode || !compareSummary || compareSummary.co2.length === 0) return;
    const hasConsumptionData = compareSummary.co2.some((d) => d.consumption_co2 !== null && d.consumption_co2 !== undefined);

    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !co2CompareCanvasRef.current) return;
      if (co2CompareChartRef.current) co2CompareChartRef.current.destroy();

      const datasets = [
        {
          label: t("co2.chart_label_territorial_total"),
          data: compareSummary.co2.map((d) => d.emissions_mt),
          borderColor: "#6c3483",
          backgroundColor: "rgba(108,52,131,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ];
      if (hasConsumptionData) {
        datasets.push({
          label: t("co2.chart_label_consumption_total"),
          data: compareSummary.co2.map((d) => d.consumption_co2),
          borderColor: "#e67e22",
          backgroundColor: "rgba(230,126,34,0.1)",
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [5, 4],
        });
      }

      co2CompareChartRef.current = new Chart.default(co2CompareCanvasRef.current, {
        type: "line",
        data: { labels: compareSummary.co2.map((d) => d.year), datasets },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCode, compareSummary, t]);

  function buildEnergyMixChart(energyMixData) {
    const sorted = [...energyMixData].sort(
      (a, b) => Number(b.total_capacity_mw || 0) - Number(a.total_capacity_mw || 0)
    );
    return {
      type: "bar",
      data: {
        labels: sorted.map((r) => translateFuel(r.fuel_type, locale)),
        datasets: [
          {
            label: t("energie.chart_capacity_axis"),
            data: sorted.map((r) => r.total_capacity_mw || 0),
            backgroundColor: sorted.map((r) => FUEL_COLORS[r.fuel_type] || DEFAULT_FUEL_COLOR),
            plantLabels: sorted.map((r) => t("energie.plant_count", { count: r.plant_count, s: r.plant_count > 1 ? "s" : "" })),
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
          x: { title: { display: true, text: t("energie.chart_capacity_axis") } },
        },
      },
    };
  }

  useEffect(() => {
    if (!summary || summary.energyMix.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !energyCanvasRef.current) return;
      if (energyChartRef.current) energyChartRef.current.destroy();
      energyChartRef.current = new Chart.default(energyCanvasRef.current, buildEnergyMixChart(summary.energyMix));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, locale]);

  useEffect(() => {
    if (!compareCode || !compareSummary || !compareSummary.energyMix || compareSummary.energyMix.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !energyCompareCanvasRef.current) return;
      if (energyCompareChartRef.current) energyCompareChartRef.current.destroy();
      energyCompareChartRef.current = new Chart.default(energyCompareCanvasRef.current, buildEnergyMixChart(compareSummary.energyMix));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCode, compareSummary, locale]);

  function buildGenerationChart(generationData) {
    const sources = [
      { key: "coal_twh", label: translateFuel("Coal", locale), color: FUEL_COLORS.Coal },
      { key: "gas_twh", label: translateFuel("Gas", locale), color: FUEL_COLORS.Gas },
      { key: "oil_twh", label: translateFuel("Oil", locale), color: FUEL_COLORS.Oil },
      { key: "nuclear_twh", label: translateFuel("Nuclear", locale), color: FUEL_COLORS.Nuclear },
      { key: "hydro_twh", label: translateFuel("Hydro", locale), color: FUEL_COLORS.Hydro },
      { key: "wind_twh", label: translateFuel("Wind", locale), color: FUEL_COLORS.Wind },
      { key: "solar_twh", label: translateFuel("Solar", locale), color: FUEL_COLORS.Solar },
      { key: "biofuel_twh", label: translateFuel("Biomass", locale), color: FUEL_COLORS.Biomass },
      { key: "other_renewable_twh", label: t("energie.other_renewable"), color: DEFAULT_FUEL_COLOR },
    ];
    return {
      type: "bar",
      data: {
        labels: generationData.map((d) => d.year),
        datasets: [
          ...sources.map((s) => ({
            label: s.label,
            data: generationData.map((d) => d[s.key] || 0),
            backgroundColor: s.color || DEFAULT_FUEL_COLOR,
            stack: "generation",
          })),
          {
            type: "line",
            label: t("energie.chart_demand"),
            data: generationData.map((d) => d.demand_twh),
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
          y: { stacked: true, title: { display: true, text: t("energie.axis_twh_year") } },
        },
      },
    };
  }

  useEffect(() => {
    if (!summary || !summary.electricityGeneration || summary.electricityGeneration.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !generationCanvasRef.current) return;
      if (generationChartRef.current) generationChartRef.current.destroy();
      generationChartRef.current = new Chart.default(generationCanvasRef.current, buildGenerationChart(summary.electricityGeneration));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, locale]);

  useEffect(() => {
    if (!compareCode || !compareSummary || !compareSummary.electricityGeneration || compareSummary.electricityGeneration.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !generationCompareCanvasRef.current) return;
      if (generationCompareChartRef.current) generationCompareChartRef.current.destroy();
      generationCompareChartRef.current = new Chart.default(generationCompareCanvasRef.current, buildGenerationChart(compareSummary.electricityGeneration));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCode, compareSummary, locale]);

  useEffect(() => {
    if (!summary || !worldBenchmarks) return;

    function latestWithField(array, field) {
      if (!array) return null;
      for (let i = array.length - 1; i >= 0; i--) {
        if (array[i][field] !== null && array[i][field] !== undefined) return array[i];
      }
      return null;
    }

    function computeRows(summaryData) {
      if (!summaryData) return [];
      const latestCo2 = summaryData.co2?.[summaryData.co2.length - 1];
      const latestElec = summaryData.electricityGeneration?.[summaryData.electricityGeneration.length - 1];
      const latestPollution = summaryData.pollution?.[summaryData.pollution.length - 1];
      const latestWaterStress = latestWithField(summaryData.water, "withdrawal_share_percent");
      const latestWaterWithdrawal = latestWithField(summaryData.water, "withdrawal_m3");
      const latestVegLoss = latestWithField(summaryData.vegetation, "tree_cover_loss_ha");
      const latestVegArea = latestWithField(summaryData.vegetation, "forest_area_ha");
      const latestSpecies = summaryData.speciesThreatened?.[summaryData.speciesThreatened.length - 1];

      const rows = [];
      if (latestCo2?.emissions_per_capita && worldBenchmarks.co2_per_capita) {
        rows.push({
          label: t("pays.metric_co2_per_capita"),
          value: (latestCo2.emissions_per_capita / worldBenchmarks.co2_per_capita.value) * 100,
          type: "index",
        });
      }
      if (latestElec?.demand_per_capita_kwh && worldBenchmarks.electricity_demand_per_capita) {
        rows.push({
          label: t("pays.metric_electricity_per_capita"),
          value: (latestElec.demand_per_capita_kwh / worldBenchmarks.electricity_demand_per_capita.value) * 100,
          type: "index",
        });
      }
      if (latestWaterStress?.withdrawal_share_percent && worldBenchmarks.water_stress_share) {
        rows.push({
          label: t("pays.metric_water_stress"),
          value: (latestWaterStress.withdrawal_share_percent / worldBenchmarks.water_stress_share.value) * 100,
          type: "index",
        });
      }
      const latestPopulation = latestCo2?.population;
      if (latestWaterWithdrawal?.withdrawal_m3 && latestPopulation && worldBenchmarks.water_withdrawal_per_capita) {
        const countryPerCapita = latestWaterWithdrawal.withdrawal_m3 / latestPopulation;
        rows.push({
          label: t("pays.metric_water_withdrawal_per_capita"),
          value: (countryPerCapita / worldBenchmarks.water_withdrawal_per_capita.value) * 100,
          type: "index",
        });
      }
      if (latestVegArea?.forest_area_ha && latestVegLoss?.tree_cover_loss_ha && worldBenchmarks.forest_loss_share_world) {
        const countryShare = (latestVegLoss.tree_cover_loss_ha / latestVegArea.forest_area_ha) * 100;
        rows.push({
          label: t("pays.metric_deforestation"),
          value: (countryShare / worldBenchmarks.forest_loss_share_world.value) * 100,
          type: "index",
        });
      }
      if (latestPollution?.pm25_ug_m3 && worldBenchmarks.pm25_world_average) {
        rows.push({
          label: t("pays.metric_pollution"),
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
            label: t("pays.metric_species_share"),
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
    const typeByLabel = Object.fromEntries(mainRows.map((r) => [r.label, r.type]));
    const hasIndexMetric = mainRows.some((r) => r.type === "index");
    const worldAverageLabel = t("pays.world_average_plain");

    const referenceLinePlugin = {
      id: "referenceLine100",
      afterDraw(chart) {
        if (!hasIndexMetric) return;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const x = xScale.getPixelForValue(100);
        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = "var(--color-texte-clair)";
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "var(--color-texte-clair)";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(worldAverageLabel, x + 4, yScale.top + 10);
        ctx.restore();
      },
    };

    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !comparisonCanvasRef.current) return;
      if (comparisonChartRef.current) comparisonChartRef.current.destroy();

      const datasets = [
        {
          label: localizedCountryName(code, preferredLang),
          data: mainRows.map((r) => Math.round(r.value * 100) / 100),
          backgroundColor: "#6c3483",
          barPercentage: 0.9,
          categoryPercentage: 0.8,
        },
      ];
      if (compareCode && compareSummary) {
        datasets.push({
          label: localizedCountryName(compareCode, preferredLang),
          data: labels.map((l) => (compareByLabel[l] !== undefined ? Math.round(compareByLabel[l] * 100) / 100 : null)),
          backgroundColor: "#c6a2d6",
          barPercentage: 0.9,
          categoryPercentage: 0.8,
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
            tooltip: {
              callbacks: {
                label(context) {
                  const rowLabel = context.label;
                  const datasetLabel = context.dataset.label;
                  const value = context.parsed.x;
                  if (value === null || value === undefined) return t("pays.tooltip_no_data", { dataset: datasetLabel });
                  const rounded = Math.round(value * 10) / 10;
                  if (typeByLabel[rowLabel] === "share") {
                    return t("pays.tooltip_share", { dataset: datasetLabel, value: rounded });
                  }
                  return t("pays.tooltip_index", { dataset: datasetLabel, value: rounded });
                },
              },
            },
          },
          scales: {
            x: { title: { display: true, text: t("pays.comparison_axis") } },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary, worldBenchmarks, code, preferredLang, compareCode, compareSummary, t]);

  function buildVegetationChart(canvasEl, chartRefObj, vegetationData, worldBenchmarksData, barColor, cumulativeColor) {
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
    const filledVegetation = fillNearestForestArea(vegetationData);

    const firstLossYear = vegetationData.find((d) => d.tree_cover_loss_ha != null)?.year;
    const baselineArea = filledVegetation.find((d) => d.year === firstLossYear)?.forest_area_ha;
    let cumulativeLoss = 0;
    const cumulativeShareData = filledVegetation.map((d) => {
      cumulativeLoss += parseFloat(d.tree_cover_loss_ha) || 0;
      return baselineArea ? (cumulativeLoss / baselineArea) * 100 : null;
    });

    return {
      type: "bar",
      data: {
        labels: vegetationData.map((d) => d.year),
        datasets: [
          {
            type: "bar",
            label: t("vegetation.chart_loss_ha"),
            data: vegetationData.map((d) => d.tree_cover_loss_ha),
            backgroundColor: barColor,
            yAxisID: "y",
          },
          {
            type: "line",
            label: t("vegetation.chart_share_year"),
            data: filledVegetation.map((d) =>
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
            label: t("vegetation.chart_cumulative"),
            data: cumulativeShareData,
            borderColor: cumulativeColor,
            backgroundColor: "rgba(108,52,131,0.08)",
            yAxisID: "y1",
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [2, 2],
            fill: true,
          },
          ...(worldBenchmarksData?.forest_loss_share_world
            ? [
                {
                  type: "line",
                  label: t("vegetation.chart_world_avg"),
                  data: vegetationData.map(() => worldBenchmarksData.forest_loss_share_world.value),
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
          y: { type: "linear", position: "left", title: { display: true, text: t("vegetation.axis_loss_ha") } },
          y1: { type: "linear", position: "right", title: { display: true, text: t("vegetation.axis_share_lost") }, grid: { drawOnChartArea: false } },
        },
      },
    };
  }

  useEffect(() => {
    if (!summary || !summary.vegetation || summary.vegetation.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !vegetationCanvasRef.current) return;
      if (vegetationChartRef.current) vegetationChartRef.current.destroy();
      vegetationChartRef.current = new Chart.default(
        vegetationCanvasRef.current,
        buildVegetationChart(vegetationCanvasRef.current, vegetationChartRef, summary.vegetation, worldBenchmarks, "#e67e22", "#6c3483")
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, worldBenchmarks, t]);

  useEffect(() => {
    if (!compareCode || !compareSummary || !compareSummary.vegetation || compareSummary.vegetation.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !vegetationCompareCanvasRef.current) return;
      if (vegetationCompareChartRef.current) vegetationCompareChartRef.current.destroy();
      vegetationCompareChartRef.current = new Chart.default(
        vegetationCompareCanvasRef.current,
        buildVegetationChart(vegetationCompareCanvasRef.current, vegetationCompareChartRef, compareSummary.vegetation, worldBenchmarks, "#6c3483", "#2a78d6")
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCode, compareSummary, worldBenchmarks, t]);

  function buildWaterChart(waterData, mainColor) {
    return {
      type: "line",
      data: {
        labels: waterData.map((d) => d.year),
        datasets: [
          {
            label: t("eau.chart_freshwater"),
            data: waterData.map((d) => d.renewable_freshwater_m3_per_capita),
            borderColor: mainColor,
            backgroundColor: "rgba(42,120,214,0.1)",
            yAxisID: "y",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: t("eau.chart_precipitation"),
            data: waterData.map((d) => d.precipitation_mm),
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
          y: { type: "linear", position: "left", title: { display: true, text: t("eau.axis_per_capita") } },
          y1: { type: "linear", position: "right", title: { display: true, text: t("eau.axis_mm_year") }, grid: { drawOnChartArea: false } },
        },
      },
    };
  }

  useEffect(() => {
    if (!summary || !summary.water || summary.water.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !waterCanvasRef.current) return;
      if (waterChartRef.current) waterChartRef.current.destroy();
      waterChartRef.current = new Chart.default(waterCanvasRef.current, buildWaterChart(summary.water, "#2a78d6"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, t]);

  useEffect(() => {
    if (!compareCode || !compareSummary || !compareSummary.water || compareSummary.water.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !waterCompareCanvasRef.current) return;
      if (waterCompareChartRef.current) waterCompareChartRef.current.destroy();
      waterCompareChartRef.current = new Chart.default(waterCompareCanvasRef.current, buildWaterChart(compareSummary.water, "#6c3483"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCode, compareSummary, t]);

  function buildStressChart(waterData, worldBenchmarksData, mainColor) {
    const datasets = [
      {
        label: t("eau.chart_stress"),
        data: waterData.map((d) => d.withdrawal_share_percent),
        borderColor: mainColor,
        backgroundColor: "rgba(142,68,173,0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ];
    if (worldBenchmarksData?.water_stress_share) {
      datasets.push({
        label: t("eau.chart_world_avg"),
        data: waterData.map(() => worldBenchmarksData.water_stress_share.value),
        borderColor: "#95a5a6",
        borderDash: [4, 4],
        pointRadius: 0,
        borderWidth: 1.5,
        fill: false,
      });
    }
    return {
      type: "line",
      data: { labels: waterData.map((d) => d.year), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { title: { display: true, text: t("eau.axis_share_used") } } },
      },
    };
  }

  useEffect(() => {
    if (!summary || !summary.water || summary.water.length === 0) return;
    const hasStress = summary.water.some((d) => d.withdrawal_share_percent !== null && d.withdrawal_share_percent !== undefined);
    if (!hasStress) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !stressCanvasRef.current) return;
      if (stressChartRef.current) stressChartRef.current.destroy();
      stressChartRef.current = new Chart.default(stressCanvasRef.current, buildStressChart(summary.water, worldBenchmarks, "#8e44ad"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, worldBenchmarks, t]);

  useEffect(() => {
    if (!compareCode || !compareSummary || !compareSummary.water || compareSummary.water.length === 0) return;
    const hasStress = compareSummary.water.some((d) => d.withdrawal_share_percent !== null && d.withdrawal_share_percent !== undefined);
    if (!hasStress) return;
    let cancelled = false;
    import("../../lib/chartSetup").then((Chart) => {
      if (cancelled || !stressCompareCanvasRef.current) return;
      if (stressCompareChartRef.current) stressCompareChartRef.current.destroy();
      stressCompareChartRef.current = new Chart.default(stressCompareCanvasRef.current, buildStressChart(compareSummary.water, worldBenchmarks, "#6c3483"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCode, compareSummary, worldBenchmarks, t]);

  useEffect(() => {
    if (sobriety || !fireMapContainerRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !fireMapContainerRef.current) return;

      if (!fireMapRef.current) {
        fireMapRef.current = L.map(fireMapContainerRef.current).setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; contributeurs OpenStreetMap",
          maxZoom: 18,
        }).addTo(fireMapRef.current);
        fireMarkersLayerRef.current = L.layerGroup().addTo(fireMapRef.current);
      }

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
    return () => {
      cancelled = true;
    };
  }, [sobriety, fires]);

  useEffect(() => {
    if (sobriety || !compareCode || !compareSummary || !fireMapCompareContainerRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !fireMapCompareContainerRef.current) return;

      if (!fireMapCompareRef.current) {
        fireMapCompareRef.current = L.map(fireMapCompareContainerRef.current).setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; contributeurs OpenStreetMap",
          maxZoom: 18,
        }).addTo(fireMapCompareRef.current);
        fireMarkersCompareLayerRef.current = L.layerGroup().addTo(fireMapCompareRef.current);
      }

      fireMarkersCompareLayerRef.current.clearLayers();
      compareFires.forEach((f) => {
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
          .addTo(fireMarkersCompareLayerRef.current);
      });
      if (compareFires.length > 0) {
        const bounds = L.latLngBounds(compareFires.map((f) => [f.latitude, f.longitude]));
        fireMapCompareRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
      } else {
        fireMapCompareRef.current.setView([20, 0], 2);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [compareCode, compareSummary, compareFires, sobriety]);

  const countryName = localizedCountryName(code, preferredLang);
  const latestCo2 = summary?.co2?.[summary.co2.length - 1];
  const totalCapacity = summary?.energyMix?.reduce(
    (sum, r) => sum + Number(r.total_capacity_mw || 0),
    0
  );

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!sobriety && (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#eaf3de", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconLeaf size={20} style={{ color: "#1b5e20" }} />
            </div>
          )}
          <h1 style={{ margin: 0 }}>{countryName}</h1>
        </div>
        <ShareButtons title={`Pas de planète B — ${countryName}`} />
        <CountrySelect
          countries={countries}
          value={code || ""}
          onChange={(newCode) => router.push(`/pays/${newCode}`)}
          preferredLang={preferredLang}
          label={t("pays.change_country")}
        />
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && summary && (
        <section style={{ marginTop: "1rem", marginBottom: "2rem", padding: "1rem", background: "#f7f7f7", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>{t("pays.world_comparison_title")}</h2>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("pays.world_comparison_p1")}</p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("pays.world_comparison_p2")}</p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("pays.world_comparison_p3")}</p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("pays.world_comparison_p4")}</p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("pays.world_comparison_p5")}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <CountrySelect
              countries={countries.filter((c) => c.country_code !== code)}
              value={compareCode}
              onChange={setCompareCode}
              preferredLang={preferredLang}
              label={t("pays.compare_with")}
            />
            {compareCode && (
              <button onClick={() => setCompareCode("")} style={{ fontSize: 13 }}>
                {t("pays.remove_comparison")}
              </button>
            )}
          </div>
          <div style={{ position: "relative", height: 320 }}>
            <canvas ref={comparisonCanvasRef} role="img" aria-label={`${t("pays.world_comparison_title")} — ${countryName}`} />
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
                <p key={`species-${name}`} style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
                  {t("pays.species_share_summary", { name, count: countryTotal, share, worldTotal })}
                </p>
              );
            }

            function pollutionLine(summaryData, name) {
              if (!worldBenchmarks?.pm25_who_guideline || !summaryData?.pollution?.length) return null;
              const latest = summaryData.pollution[summaryData.pollution.length - 1];
              if (!latest.pm25_ug_m3) return null;
              const ratio = (latest.pm25_ug_m3 / worldBenchmarks.pm25_who_guideline.value).toFixed(1);
              return (
                <p key={`pollution-${name}`} style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
                  {t("pays.pollution_summary", { name, value: latest.pm25_ug_m3, ratio })}
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
      )}

      {!loading && !error && summary && (
        <>
          <section style={{ marginTop: "1.5rem" }}>
            <h2>{t("co2.title")}</h2>
            {latestCo2 ? (
              <p>
                {t("pays.co2_latest", { year: latestCo2.year, value: latestCo2.emissions_mt })}
                {latestCo2.emissions_per_capita && (
                  <>{t("pays.co2_per_capita_suffix", { value: latestCo2.emissions_per_capita })}</>
                )}
              </p>
            ) : (
              <p>{t("pays.co2_no_data")}</p>
            )}
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("co2.explain_p1")}</p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("co2.explain_p2")}</p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", fontWeight: 600 }}>{t("co2.explain_p3")}</p>
            {summary.co2.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
                <div>
                  <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
                  <div style={{ position: "relative", height: 220 }}>
                    <canvas ref={co2CanvasRef} role="img" aria-label={`${t("co2.title")} — ${countryName}`} />
                  </div>
                </div>
                {compareCode && compareSummary && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{localizedCountryName(compareCode, preferredLang)}</p>
                    <div style={{ position: "relative", height: 220 }}>
                      <canvas ref={co2CompareCanvasRef} role="img" aria-label={`${t("co2.title")} — ${localizedCountryName(compareCode, preferredLang)}`} />
                    </div>
                  </div>
                )}
              </div>
            )}
            <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
              {t("pays.co2_footer_note")}
              {lastUpdated?.co2?.latestYear && (
                <>{t("pays.co2_footer_year", { year: lastUpdated.co2.latestYear })}</>
              )}
              {t("pays.co2_footer_refresh")}{" "}
              <Link href="/co2">{t("pays.co2_details_link")}</Link>
            </p>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2>{t("energie.mix_title")}</h2>
            {summary.energyMix.length > 0 ? (
              <>
                <p>
                  {t("pays.energie_summary", { count: summary.energyMix.length, capacity: Math.round(totalCapacity).toLocaleString("fr-FR") })}
                </p>
                <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("energie.map_explain")}</p>
                <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
                    <div style={{ position: "relative", height: Math.max(200, summary.energyMix.length * 34) }}>
                      <canvas ref={energyCanvasRef} role="img" aria-label={t("energie.mix_title")} />
                    </div>
                  </div>
                  {compareCode && compareSummary?.energyMix?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{localizedCountryName(compareCode, preferredLang)}</p>
                      <div style={{ position: "relative", height: Math.max(200, compareSummary.energyMix.length * 34) }}>
                        <canvas ref={energyCompareCanvasRef} role="img" aria-label={t("energie.mix_title")} />
                      </div>
                    </div>
                  )}
                </div>
                <details style={{ marginTop: "0.75rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--color-texte-clair)" }}>
                    {t("pays.energie_table_summary")}
                  </summary>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("pays.energie_table_type")}</th>
                        <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("pays.energie_table_plants")}</th>
                        <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("pays.energie_table_capacity")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.energyMix.map((r) => (
                        <tr key={r.fuel_type}>
                          <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{translateFuel(r.fuel_type, locale)}</th>
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
              <p>{t("pays.energie_no_plants")}</p>
            )}
            <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
              {t("pays.energie_source")}
              {lastUpdated?.powerPlants?.lastIngested && (
                <>{t("pays.energie_source_updated", { date: formatDate(lastUpdated.powerPlants.lastIngested) })}</>
              )}
              {" "}<Link href="/energie">{t("pays.energie_map_link")}</Link>
            </p>
            {summary.electricityGeneration?.length > 0 && (
              <>
                <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: "1rem" }}>{t("energie.generation_explain")}</p>
                <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
                    <div style={{ position: "relative", height: 260 }}>
                      <canvas ref={generationCanvasRef} role="img" aria-label={t("energie.generation_title")} />
                    </div>
                  </div>
                  {compareCode && compareSummary && (
                    <div>
                      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{localizedCountryName(compareCode, preferredLang)}</p>
                      <div style={{ position: "relative", height: 260 }}>
                        <canvas ref={generationCompareCanvasRef} role="img" aria-label={t("energie.generation_title")} />
                      </div>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
                  {t("pays.generation_source")}
                  {lastUpdated?.electricity?.latestYear && (
                    <>{t("pays.generation_source_year", { year: lastUpdated.electricity.latestYear })}</>
                  )}
                </p>
              </>
            )}
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2>{t("pays.biodiversity_title")}</h2>
            {(() => {
              function renderSpeciesTable(list) {
                if (list.length === 0) {
                  return <p>{t("pays.biodiversity_no_sample")}</p>;
                }
                return (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
                      {t("pays.biodiversity_sample_caption", { count: list.length })}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("especes.table_scientific_name")}</th>
                        <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("especes.table_common_names")}</th>
                        <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("especes.table_group")}</th>
                        <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("especes.table_category")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((s) => {
                        const info = CATEGORY_INFO[s.category] || { label: s.category, color: "var(--color-texte-clair)" };
                        const names = formatCommonNames(s.common_names, preferredLang);
                        return (
                          <tr key={s.scientific_name}>
                            <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400, fontStyle: "italic" }}>
                              {s.scientific_name}
                            </th>
                            <td style={{ textAlign: "left", padding: 6, fontSize: 13, color: names ? "inherit" : "var(--color-texte-clair)" }}>
                              {names || t("especes.name_unavailable")}
                            </td>
                            <td style={{ textAlign: "left", padding: 6 }}>{speciesGroupLabel(s.kingdom, s.class, s.taxon_order, locale)}</td>
                            <td style={{ padding: 6 }}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, color: "white", backgroundColor: info.color, lineHeight: 1.4 }}>
                                {info.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              }

              return (
                <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
                    {renderSpeciesTable(speciesList)}
                  </div>
                  {compareCode && compareSummary && (
                    <div>
                      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{localizedCountryName(compareCode, preferredLang)}</p>
                      {renderSpeciesTable(compareSpeciesList)}
                    </div>
                  )}
                </div>
              );
            })()}
            <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
              {t("pays.biodiversity_source")}
              {lastUpdated?.species?.lastIngested && (
                <>{t("pays.biodiversity_source_updated", { date: formatDate(lastUpdated.species.lastIngested) })}</>
              )}
              {" "}<Link href="/especes">{t("pays.biodiversity_filter_link")}</Link>
            </p>
            {summary.speciesThreatened?.length > 0 && (() => {
              const latest = summary.speciesThreatened[summary.speciesThreatened.length - 1];
              return (
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
                  {t("pays.biodiversity_official_count", { year: latest.year, mammals: latest.mammals_threatened ?? "—", birds: latest.birds_threatened ?? "—", fish: latest.fish_threatened ?? "—" })}
                  {" "}<Link href="/especes">{t("pays.biodiversity_detail_link")}</Link>
                </p>
              );
            })()}
            {compareCode && compareSummary && (
              <div style={{ background: "#f7f7f7", borderRadius: 8, padding: "0.75rem 1rem", marginTop: "0.75rem" }}>
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>
                  {localizedCountryName(compareCode, preferredLang)}
                </p>
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>
                  {t("pays.biodiversity_compare_sample", { count: compareSpeciesList.length })}
                  {compareSummary.speciesThreatened?.length > 0 && (() => {
                    const latestCompare = compareSummary.speciesThreatened[compareSummary.speciesThreatened.length - 1];
                    return (
                      <>
                        {" "}{t("pays.biodiversity_official_count_compare", { year: latestCompare.year, mammals: latestCompare.mammals_threatened ?? "—", birds: latestCompare.birds_threatened ?? "—", fish: latestCompare.fish_threatened ?? "—" })}
                      </>
                    );
                  })()}
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2>{t("pays.fires_title")}</h2>
        {!loading && !error && (
          fires.length > 0 ? (
            <p>
              {t("pays.fires_summary", { count: summary?.fires?.fire_count ?? fires.length })}
              {summary?.fires?.latest_detection && (
                <>{t("pays.fires_summary_latest", { date: new Date(summary.fires.latest_detection).toLocaleString("fr-FR") })}</>
              )}
              .
            </p>
          ) : (
            <p>{t("pays.fires_no_data")}</p>
          )
        )}
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: "0.5rem" }}>
          {t("pays.fires_color_legend", { yellow: "🟡", orange: "🟠", red: "🔴" })}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
            {sobriety ? (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
                {t("pays.fires_sobriety_disabled", { link: "" })}{" "}
                <Link href="/incendies">{t("pays.fires_dedicated_page")}</Link>
              </p>
            ) : (
              <div ref={fireMapContainerRef} style={{ height: 360, borderRadius: 8 }} />
            )}
          </div>
          {compareCode && compareSummary && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>
                {localizedCountryName(compareCode, preferredLang)} —{" "}
                {compareFires.length} {t("pays.fires_detections_count", { s: compareFires.length !== 1 ? "s" : "" })}
              </p>
              {sobriety ? (
                <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("pays.fires_sobriety_disabled_short")}</p>
              ) : (
                <div ref={fireMapCompareContainerRef} style={{ height: 360, borderRadius: 8 }} />
              )}
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "0.5rem" }}>
          {t("pays.fires_source")}{" "}
          <Link href="/incendies">{t("pays.fires_fullscreen_link")}</Link>
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>{t("vegetation.title")}</h2>
        {summary?.vegetation?.length > 0 ? (
          <>
            {(() => {
              const latestLoss = [...summary.vegetation].reverse().find((d) => d.tree_cover_loss_ha != null);
              return latestLoss ? (
                <p>
                  {t("pays.vegetation_latest", { year: latestLoss.year, value: Math.round(parseFloat(latestLoss.tree_cover_loss_ha)).toLocaleString("fr-FR") })}
                </p>
              ) : (
                <p>{t("pays.vegetation_no_year_data")}</p>
              );
            })()}
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("vegetation.explain_p1")}</p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("vegetation.explain_p2")}</p>
            <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
                <div style={{ position: "relative", height: 220 }}>
                  <canvas ref={vegetationCanvasRef} role="img" aria-label={`${t("vegetation.title")} — ${countryName}`} />
                </div>
              </div>
              {compareCode && compareSummary && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{localizedCountryName(compareCode, preferredLang)}</p>
                  <div style={{ position: "relative", height: 220 }}>
                    <canvas ref={vegetationCompareCanvasRef} role="img" aria-label={`${t("vegetation.title")} — ${localizedCountryName(compareCode, preferredLang)}`} />
                  </div>
                </div>
              )}
            </div>
            {vegetationCumulativeSummary && (
              <p style={{ fontSize: 13 }}>
                {t("vegetation.cumulative_summary", {
                  startYear: vegetationCumulativeSummary.startYear,
                  endYear: vegetationCumulativeSummary.endYear,
                  country: countryName,
                  totalLoss: Math.round(vegetationCumulativeSummary.totalLossHa).toLocaleString("fr-FR"),
                  percent: vegetationCumulativeSummary.percent.toFixed(2),
                })}
              </p>
            )}
          </>
        ) : (
          <p>{t("pays.vegetation_no_country_data")}</p>
        )}
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
          {t("pays.vegetation_source")}
          {lastUpdated?.vegetation?.latestYear && (
            <>{t("pays.vegetation_source_year", { year: lastUpdated.vegetation.latestYear })}</>
          )}
          {" "}<Link href="/vegetation">{t("pays.vegetation_detail_link")}</Link>
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>{t("eau.title")}</h2>
        {summary?.water?.length > 0 ? (
          <p>
            {t("pays.water_latest_prefix", { year: summary.water[summary.water.length - 1].year })}{" "}
            {summary.water[summary.water.length - 1].renewable_freshwater_m3_per_capita && (
              <>{t("pays.water_renewable", { value: Math.round(summary.water[summary.water.length - 1].renewable_freshwater_m3_per_capita).toLocaleString("fr-FR") })}</>
            )}
            {summary.water[summary.water.length - 1].precipitation_mm && (
              <>{t("pays.water_precipitation", { value: Math.round(summary.water[summary.water.length - 1].precipitation_mm).toLocaleString("fr-FR") })}</>
            )}
            {(() => {
              const lastWithdrawal = [...summary.water].reverse().find((d) => d.withdrawal_m3);
              return lastWithdrawal ? (
                <>{t("pays.water_withdrawal_actual", { value: (lastWithdrawal.withdrawal_m3 / 1e9).toFixed(1), year: lastWithdrawal.year })}</>
              ) : null;
            })()}
            .
          </p>
        ) : (
          <p>{t("pays.water_no_data")}</p>
        )}
        {summary?.water?.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
            <div>
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
              <div style={{ position: "relative", height: 260 }}>
                <canvas ref={waterCanvasRef} role="img" aria-label={`${t("eau.title")} — ${countryName}`} />
              </div>
            </div>
            {compareCode && compareSummary && (
              <div>
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{localizedCountryName(compareCode, preferredLang)}</p>
                <div style={{ position: "relative", height: 260 }}>
                  <canvas ref={waterCompareCanvasRef} role="img" aria-label={`${t("eau.title")} — ${localizedCountryName(compareCode, preferredLang)}`} />
                </div>
              </div>
            )}
          </div>
        )}
        {summary?.water?.some((d) => d.withdrawal_share_percent) && (
          <>
            <h3 style={{ fontSize: 15, marginTop: "1.5rem", marginBottom: "0.25rem" }}>{t("eau.second_chart_title")}</h3>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("eau.explain_p1")}</p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("eau.explain_p2")}</p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("eau.explain_p3")}</p>
            <div style={{ display: "grid", gridTemplateColumns: compareCode && compareSummary ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{countryName}</p>
                <div style={{ position: "relative", height: 220 }}>
                  <canvas ref={stressCanvasRef} role="img" aria-label={t("eau.chart_stress")} />
                </div>
              </div>
              {compareCode && compareSummary && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontWeight: 600, marginBottom: 4 }}>{localizedCountryName(compareCode, preferredLang)}</p>
                  <div style={{ position: "relative", height: 220 }}>
                    <canvas ref={stressCompareCanvasRef} role="img" aria-label={t("eau.chart_stress")} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
          {t("pays.water_source")}
          {lastUpdated?.water?.latestYear && (
            <>{t("pays.water_source_year", { year: lastUpdated.water.latestYear })}</>
          )}
          {" "}<Link href="/eau">{t("pays.water_detail_link")}</Link>
        </p>
      </section>
    </div>
  );
}
