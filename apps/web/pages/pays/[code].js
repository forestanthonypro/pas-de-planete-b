import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { detectDefaultCountry } from "../../lib/detectCountry";
import { detectPreferredLanguage } from "../../lib/detectLanguage";
import { FUEL_COLORS, DEFAULT_FUEL_COLOR, translateFuel } from "../../lib/fuelTypes";
import { speciesGroupLabel } from "../../lib/speciesGroups";
import { formatCommonNames } from "../../lib/commonNames";
import { useLastUpdated, formatDate } from "../../lib/useLastUpdated";

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

  const [countries, setCountries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [speciesList, setSpeciesList] = useState([]);
  const [fires, setFires] = useState([]);
  const [preferredLang, setPreferredLang] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const co2CanvasRef = useRef(null);
  const co2ChartRef = useRef(null);
  const energyCanvasRef = useRef(null);
  const energyChartRef = useRef(null);
  const fireMapContainerRef = useRef(null);
  const fireMapRef = useRef(null);
  const fireMarkersLayerRef = useRef(null);

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

  useEffect(() => {
    if (!summary || summary.co2.length === 0) return;
    const hasConsumptionData = summary.co2.some((d) => d.consumption_co2 !== null && d.consumption_co2 !== undefined);

    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !co2CanvasRef.current) return;
      if (co2ChartRef.current) co2ChartRef.current.destroy();

      const datasets = [
        {
          label: "Territoriales (Mt)",
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
          label: "Basées conso. (Mt)",
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

  const countryName = countries.find((c) => c.country_code === code)?.country_name || code;
  const latestCo2 = summary?.co2?.[summary.co2.length - 1];
  const totalCapacity = summary?.energyMix?.reduce(
    (sum, r) => sum + Number(r.total_capacity_mw || 0),
    0
  );

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <h1>{countryName}</h1>
        <label>
          Changer de pays{" "}
          <select value={code || ""} onChange={(e) => router.push(`/pays/${e.target.value}`)}>
            {countries.map((c) => (
              <option key={c.country_code} value={c.country_code}>{c.country_name}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

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
            {summary.co2.length > 0 && (
              <div style={{ position: "relative", height: 220 }}>
                <canvas ref={co2CanvasRef} role="img" aria-label={`Émissions de CO2 pour ${countryName}`} />
              </div>
            )}
            <p style={{ fontSize: 12, color: "#666" }}>
              Courbe bleue : émissions territoriales (production), n&apos;incluent pas les
              produits importés. Courbe orange en pointillés (si présente) : basées sur la
              consommation (importations comprises, exportations déduites). Aviation et transport
              maritime internationaux non comptés dans aucune des deux.
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
        <div ref={fireMapContainerRef} style={{ height: 360, borderRadius: 8 }} />
        <p style={{ fontSize: 12, color: "#666", marginTop: "0.5rem" }}>
          NASA FIRMS (MODIS_NRT) — une détection n&apos;est pas nécessairement un feu de forêt
          incontrôlé (brûlis agricoles inclus). Couverture limitée à une liste de pays courants.
          Rafraîchissement automatique toutes les 6 heures.{" "}
          <Link href="/incendies">Voir en plein écran →</Link>
        </p>
      </section>
    </main>
  );
}
