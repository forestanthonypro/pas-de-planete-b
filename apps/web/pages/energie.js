import { useEffect, useMemo, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { FUEL_COLORS, DEFAULT_FUEL_COLOR, translateFuel } from "../lib/fuelTypes";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import PageHeader from "../components/PageHeader";
import { IconBolt } from "../components/icons";
import ShareButtons from "../components/ShareButtons";
import { useSobriety } from "../lib/SobrietyContext";
import { barEndLabelsPlugin } from "../lib/barEndLabelsPlugin";
import { useT } from "../lib/useT";
import ScrollableTable from "../components/ScrollableTable";
import { useApiFetch } from "../lib/useApiFetch";

export default function EnergiePage() {
  const { t, locale } = useT();
  const lastUpdated = useLastUpdated();
  const [country, setCountry] = useState("FRA");
  const [fuelType, setFuelType] = useState("");
  const [view, setView] = useState("map"); // "map" ou "table"
  const [mapError, setMapError] = useState(null);
  const { sobriety } = useSobriety();

  useEffect(() => {
    if (sobriety) setView("table");
  }, [sobriety]);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const mixCanvasRef = useRef(null);
  const mixChartRef = useRef(null);
  const generationCanvasRef = useRef(null);
  const generationChartRef = useRef(null);

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  const { data: countryRows } = useApiFetch("/api/power-plants/countries", {
    transform: (rows) => (Array.isArray(rows) ? rows.map((r) => r.country_code) : []),
  });
  const countries = countryRows ?? [];

  const { data: fuelTypeRows } = useApiFetch("/api/power-plants/fuel-types", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const fuelTypes = fuelTypeRows ?? [];

  const plantsParams = new URLSearchParams({ country });
  if (fuelType) plantsParams.set("fuel_type", fuelType);
  const { data: plantRows, loading, error: fetchError } = useApiFetch(`/api/power-plants?${plantsParams}`, {
    errorMessage: t("energie.error_no_data"),
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const plants = useMemo(() => plantRows ?? [], [plantRows]);
  const error = fetchError || mapError;

  const energyMix = useMemo(() => {
    const byFuel = {};
    for (const p of plants) {
      const key = p.fuel_type || "Autre";
      if (!byFuel[key]) byFuel[key] = { fuel_type: key, total_capacity_mw: 0, plant_count: 0 };
      byFuel[key].total_capacity_mw += parseFloat(p.capacity_mw) || 0;
      byFuel[key].plant_count += 1;
    }
    return Object.values(byFuel).sort((a, b) => b.total_capacity_mw - a.total_capacity_mw);
  }, [plants]);

  useEffect(() => {
    if (energyMix.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !mixCanvasRef.current) return;
      if (mixChartRef.current) mixChartRef.current.destroy();

      mixChartRef.current = new Chart(mixCanvasRef.current, {
        type: "bar",
        data: {
          labels: energyMix.map((r) => translateFuel(r.fuel_type, locale)),
          datasets: [
            {
              label: t("energie.chart_capacity_axis"),
              data: energyMix.map((r) => r.total_capacity_mw),
              backgroundColor: energyMix.map((r) => FUEL_COLORS[r.fuel_type] || DEFAULT_FUEL_COLOR),
              plantLabels: energyMix.map((r) => t("energie.plant_count", { count: r.plant_count, s: r.plant_count > 1 ? "s" : "" })),
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
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energyMix, locale]);

  const { data: generationRows } = useApiFetch(`/api/electricity/${country}`, {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const generation = generationRows ?? [];

  useEffect(() => {
    if (generation.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !generationCanvasRef.current) return;
      if (generationChartRef.current) generationChartRef.current.destroy();

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

      generationChartRef.current = new Chart(generationCanvasRef.current, {
        type: "bar",
        data: {
          labels: generation.map((d) => d.year),
          datasets: [
            ...sources.map((s) => ({
              label: s.label,
              data: generation.map((d) => d[s.key] || 0),
              backgroundColor: s.color || DEFAULT_FUEL_COLOR,
              stack: "generation",
            })),
            {
              type: "line",
              label: t("energie.chart_demand"),
              data: generation.map((d) => d.demand_twh),
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
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, locale]);

  useEffect(() => {
    if (view !== "map" || sobriety || !mapContainerRef.current) return;

    let cancelled = false;
    import("leaflet")
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; contributeurs OpenStreetMap",
            maxZoom: 18,
          }).addTo(mapRef.current);
          markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
        }

        markersLayerRef.current.clearLayers();
        plants.forEach((p) => {
          const color = FUEL_COLORS[p.fuel_type] || DEFAULT_FUEL_COLOR;
          const radius = p.capacity_mw ? Math.max(4, Math.min(20, Math.sqrt(p.capacity_mw))) : 5;

          L.circleMarker([p.latitude, p.longitude], {
            radius,
            color,
            fillColor: color,
            fillOpacity: 0.7,
            weight: 1,
          })
            .bindPopup(
              `<strong>${p.name}</strong><br/>${translateFuel(p.fuel_type, locale)} — ${p.capacity_mw ?? "?"} MW`
            )
            .addTo(markersLayerRef.current);
        });

        if (plants.length > 0) {
          const bounds = L.latLngBounds(plants.map((p) => [p.latitude, p.longitude]));
          mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
        }
      })
      .catch((err) => {
        console.error("Échec de l'initialisation de la carte Leaflet :", err);
        setMapError(t("energie.map_init_error", { message: err.message }));
      });

    return () => {
      cancelled = true;
    };
  }, [view, sobriety, plants, t, locale]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconBolt} tint="amber" title={t("energie.title")} />
      <ShareButtons title={t("energie.title")} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={country}
          onChange={setCountry}
          locale={locale}
        />

        <label>
          {t("energie.fuel_type_label")}{" "}
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
            <option value="">{t("energie.all")}</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>{translateFuel(f, locale)}</option>
            ))}
          </select>
        </label>

        <button onClick={() => setView(view === "map" ? "table" : "map")} disabled={sobriety}>
          {view === "map" ? t("common.view_as_table") : t("common.view_as_chart")}
        </button>
        {sobriety && (
          <span style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>{t("energie.map_sobriety_disabled")}</span>
        )}
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && plants.length === 0 && <p>{t("energie.no_plants")}</p>}

      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("energie.map_explain")}</p>

      <div style={{ display: view === "map" ? "block" : "none" }}>
        <div ref={mapContainerRef} style={{ height: 480, borderRadius: 8 }} />
      </div>

      {!loading && !error && view === "table" && (
        <ScrollableTable>
<table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
            {t("energie.table_caption", { country: localizedCountryName(country, locale), fuelType: fuelType ? `(${fuelType})` : "" })}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("energie.table_name")}</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("energie.table_type")}</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("energie.table_capacity")}</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p, i) => (
              <tr key={i}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{p.name}</th>
                <td style={{ textAlign: "left", padding: 8 }}>{translateFuel(p.fuel_type, locale)}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{p.capacity_mw ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
</ScrollableTable>
      )}

      {energyMix.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>{t("energie.mix_title")}</h2>
          <p>
            {t("energie.mix_summary", {
              count: energyMix.length,
              capacity: Math.round(energyMix.reduce((sum, r) => sum + r.total_capacity_mw, 0)).toLocaleString("fr-FR"),
            })}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("energie.mix_explain")}</p>
          <div style={{ position: "relative", height: Math.max(200, energyMix.length * 34) }}>
            <canvas ref={mixCanvasRef} role="img" aria-label={t("energie.mix_title")} />
          </div>
        </section>
      )}

      {generation.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>{t("energie.generation_title")}</h2>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("energie.generation_explain")}</p>
          <div style={{ position: "relative", height: 320 }}>
            <canvas ref={generationCanvasRef} role="img" aria-label={t("energie.generation_title")} />
          </div>
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "0.5rem" }}>
            {t("energie.generation_source")}
            {lastUpdated?.electricity?.latestYear && (
              <> {t("energie.generation_source_year", { year: lastUpdated.electricity.latestYear })}</>
            )}
            {t("energie.generation_source_refresh")}
          </p>
        </section>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("energie.source")}
        {lastUpdated?.powerPlants?.lastIngested && (
          <> {t("energie.source_last_updated", { date: formatDate(lastUpdated.powerPlants.lastIngested) })}</>
        )}
        {" "}{t("energie.source_refresh")}
      </p>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
