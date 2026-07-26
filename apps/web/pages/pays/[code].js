import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { detectDefaultCountry } from "../../lib/detectCountry";
import { FUEL_COLORS, DEFAULT_FUEL_COLOR, translateFuel } from "../../lib/fuelTypes";

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
const KINGDOM_LABELS = { Animalia: "Animal", Plantae: "Végétal", Fungi: "Champignon" };
const SPECIES_PREVIEW_LIMIT = 12;

export default function PaysDashboard() {
  const router = useRouter();
  const { code } = router.query;

  const [countries, setCountries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [speciesPreview, setSpeciesPreview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const co2CanvasRef = useRef(null);
  const co2ChartRef = useRef(null);
  const energyCanvasRef = useRef(null);
  const energyChartRef = useRef(null);

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
    ])
      .then(([summaryData, speciesData]) => {
        setSummary(summaryData);
        setSpeciesPreview(Array.isArray(speciesData) ? speciesData : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [code]);

  // Graphique CO2.
  useEffect(() => {
    if (!summary || summary.co2.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !co2CanvasRef.current) return;
      if (co2ChartRef.current) co2ChartRef.current.destroy();
      co2ChartRef.current = new Chart.default(co2CanvasRef.current, {
        type: "line",
        data: {
          labels: summary.co2.map((d) => d.year),
          datasets: [
            {
              data: summary.co2.map((d) => d.emissions_mt),
              borderColor: "#2a78d6",
              backgroundColor: "rgba(42,120,214,0.1)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  // Histogramme du mix énergétique, traduit et coloré comme la carte énergie.
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
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
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

  const countryName = countries.find((c) => c.country_code === code)?.country_name || code;
  const latestCo2 = summary?.co2?.[summary.co2.length - 1];
  const totalCapacity = summary?.energyMix?.reduce(
    (sum, r) => sum + Number(r.total_capacity_mw || 0),
    0
  );
  const totalSpecies = summary?.speciesBreakdown?.reduce(
    (sum, r) => sum + Number(r.species_count || 0),
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
            <p><Link href="/co2">Voir le détail et comparer d&apos;autres pays →</Link></p>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2>Mix énergétique</h2>
            {summary.energyMix.length > 0 ? (
              <>
                <p>
                  <strong>{summary.energyMix.length}</strong> types de production,{" "}
                  <strong>{Math.round(totalCapacity).toLocaleString("fr-FR")} MW</strong> de capacité totale connue.
                </p>
                <div style={{ position: "relative", height: Math.max(200, summary.energyMix.length * 32) }}>
                  <canvas ref={energyCanvasRef} role="img" aria-label={`Mix énergétique de ${countryName}, capacité par type`} />
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                  <caption style={{ textAlign: "left", fontSize: 12, color: "#666", marginBottom: 8 }}>
                    Détail chiffré du mix énergétique
                  </caption>
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
              </>
            ) : (
              <p>Aucune centrale répertoriée pour ce pays.</p>
            )}
            <p><Link href="/energie">Voir la carte détaillée →</Link></p>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2>Biodiversité (échantillon)</h2>
            {speciesPreview.length > 0 ? (
              <>
                <p><strong>{totalSpecies}</strong> espèces de l&apos;échantillon observées dans ce pays.</p>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {speciesPreview.slice(0, SPECIES_PREVIEW_LIMIT).map((s) => {
                    const info = CATEGORY_INFO[s.category] || { label: s.category, color: "#999" };
                    const commonName = s.common_names?.fr;
                    return (
                      <li key={s.scientific_name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #eee" }}>
                        <span
                          style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, color: "white", backgroundColor: info.color, whiteSpace: "nowrap" }}
                        >
                          {info.label}
                        </span>
                        <span>
                          <em>{s.scientific_name}</em>
                          {commonName && <> — {commonName}</>}
                          {" "}
                          <span style={{ color: "#999", fontSize: 12 }}>({KINGDOM_LABELS[s.kingdom] || s.kingdom || "?"})</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {speciesPreview.length > SPECIES_PREVIEW_LIMIT && (
                  <p style={{ fontSize: 13, color: "#666" }}>
                    Et {speciesPreview.length - SPECIES_PREVIEW_LIMIT} autres dans cet échantillon...
                  </p>
                )}
              </>
            ) : (
              <p>Aucune espèce de l&apos;échantillon liée à ce pays pour l&apos;instant.</p>
            )}
            <p><Link href="/especes">Voir la liste complète avec filtres →</Link></p>
          </section>
        </>
      )}
    </main>
  );
}
