import { useEffect, useMemo, useRef, useState } from "react";
import { detectDefaultCountry } from "../lib/detectCountry";
import { detectPreferredLanguage } from "../lib/detectLanguage";
import { FUEL_COLORS, DEFAULT_FUEL_COLOR, translateFuel } from "../lib/fuelTypes";
import { useLastUpdated, formatDate } from "../lib/useLastUpdated";
import { localizedCountryName } from "../lib/countryNames";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";
import { useSobriety } from "../lib/SobrietyContext";
import { barEndLabelsPlugin } from "../lib/barEndLabelsPlugin";
import { useT } from "../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function EnergiePage() {
  const { t } = useT();
  const lastUpdated = useLastUpdated();
  const [preferredLang, setPreferredLang] = useState(null);
  const [countries, setCountries] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [country, setCountry] = useState("FRA");
  const [fuelType, setFuelType] = useState("");
  const [plants, setPlants] = useState([]);
  const [generation, setGeneration] = useState([]);
  const [view, setView] = useState("map"); // "map" ou "table"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    setCountry(detectDefaultCountry());
    setPreferredLang(detectPreferredLanguage());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/power-plants/countries`)
      .then((res) => res.json())
      .then((rows) => setCountries(Array.isArray(rows) ? rows.map((r) => r.country_code) : []))
      .catch(() => setCountries([]));

    fetch(`${API_URL}/api/power-plants/fuel-types`)
      .then((res) => res.json())
      .then((rows) => setFuelTypes(Array.isArray(rows) ? rows : []))
      .catch(() => setFuelTypes([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ country });
    if (fuelType) params.set("fuel_type", fuelType);

    fetch(`${API_URL}/api/power-plants?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(t("energie.error_no_data"));
        return res.json();
      })
      .then((rows) => {
        setPlants(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, fuelType]);

  useEffect(() => {
    if (energyMix.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !mixCanvasRef.current) return;
      if (mixChartRef.current) mixChartRef.current.destroy();

      mixChartRef.current = new Chart(mixCanvasRef.current, {
        type: "bar",
        data: {
          labels: energyMix.map((r) => translateFuel(r.fuel_type)),
          datasets: [
            {
              label: t("energie.chart_capacity_axis"),
              data: energyMix.map((r) => r.total_capacity_mw),
              backgroundColor: energyMix.map((r) => FUEL_COLORS[r.fuel_type] || DEFAULT_FUEL_COLOR),
              plantCounts: energyMix.map((r) => r.plant_count),
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
  }, [energyMix]);

  useEffect(() => {
    fetch(`${API_URL}/api/electricity/${country}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setGeneration(Array.isArray(rows) ? rows : []))
      .catch(() => setGeneration([]));
  }, [country]);

  useEffect(() => {
    if (generation.length === 0) return;
    let cancelled = false;
    import("../lib/chartSetup").then(({ default: Chart }) => {
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
  }, [generation]);

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
              `<strong>${p.name}</strong><br/>${translateFuel(p.fuel_type)} — ${p.capacity_mw ?? "?"} MW`
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
        setError(t("energie.map_init_error", { message: err.message }));
      });

    return () => {
      cancelled = true;
    };
  }, [view, sobriety, plants, t]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>{t("energie.title")}</h1>
      <ShareButtons title={t("energie.title")} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <CountrySelect
          countries={countries}
          value={country}
          onChange={setCountry}
          preferredLang={preferredLang}
        />

        <label>
          {t("energie.fuel_type_label")}{" "}
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
            <option value="">{t("energie.all")}</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>{translateFuel(f)}</option>
            ))}
          </select>
        </label>

        <button onClick={() => setView(view === "map" ? "table" : "map")} disabled={sobriety}>
          {view === "map" ? t("common.view_as_table") : t("common.view_as_chart")}
        </button>
        {sobriety && (
          <span style={{ fontSize: 12, color: "#666" }}>{t("energie.map_sobriety_disabled")}</span>
        )}
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && plants.length === 0 && <p>{t("energie.no_plants")}</p>}

      <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>{t("energie.map_explain")}</p>

      <div style={{ display: view === "map" ? "block" : "none" }}>
        <div ref={mapContainerRef} style={{ height: 480, borderRadius: 8 }} />
      </div>

      {!loading && !error && view === "table" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
            {t("energie.table_caption", { country: localizedCountryName(country, preferredLang), fuelType: fuelType ? `(${fuelType})` : "" })}
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
                <td style={{ textAlign: "left", padding: 8 }}>{translateFuel(p.fuel_type)}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{p.capacity_mw ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <p style={{ fontSize: 13, color: "#666" }}>{t("energie.mix_explain")}</p>
          <div style={{ position: "relative", height: Math.max(200, energyMix.length * 34) }}>
            <canvas ref={mixCanvasRef} role="img" aria-label={t("energie.mix_title")} />
          </div>
        </section>
      )}

      {generation.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>{t("energie.generation_title")}</h2>
          <p style={{ fontSize: 13, color: "#666" }}>{t("energie.generation_explain")}</p>
          <div style={{ position: "relative", height: 320 }}>
            <canvas ref={generationCanvasRef} role="img" aria-label={t("energie.generation_title")} />
          </div>
          <p style={{ fontSize: 12, color: "#666", marginTop: "0.5rem" }}>
            {t("energie.generation_source")}
            {lastUpdated?.electricity?.latestYear && (
              <> {t("energie.generation_source_year", { year: lastUpdated.electricity.latestYear })}</>
            )}
            {t("energie.generation_source_refresh")}
          </p>
        </section>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        {t("energie.source")}
        {lastUpdated?.powerPlants?.lastIngested && (
          <> {t("energie.source_last_updated", { date: formatDate(lastUpdated.powerPlants.lastIngested) })}</>
        )}
        {" "}{t("energie.source_refresh")}
      </p>
    </div>
  );
}
