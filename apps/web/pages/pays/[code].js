import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { detectDefaultCountry } from "../../lib/detectCountry";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const CATEGORY_LABELS = {
  EX: "Éteinte",
  EW: "Éteinte à l'état sauvage",
  CR: "En danger critique",
  EN: "En danger",
  VU: "Vulnérable",
  NT: "Quasi menacée",
  LC: "Préoccupation mineure",
  DD: "Données insuffisantes",
};
const KINGDOM_LABELS = { Animalia: "Animal", Plantae: "Végétal", Fungi: "Champignon" };

export default function PaysDashboard() {
  const router = useRouter();
  const { code } = router.query;

  const [countries, setCountries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Si aucun code n'est encore dans l'URL, redirige vers le pays détecté.
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
    fetch(`${API_URL}/api/country-summary/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles pour ce pays");
        return res.json();
      })
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [code]);

  useEffect(() => {
    if (!summary || summary.co2.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then((Chart) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart.default(canvasRef.current, {
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
                <canvas ref={canvasRef} role="img" aria-label={`Émissions de CO2 pour ${countryName}`} />
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
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                        <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{r.fuel_type}</th>
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
            {summary.speciesBreakdown.length > 0 ? (
              <>
                <p><strong>{totalSpecies}</strong> espèces de l&apos;échantillon observées dans ce pays.</p>
                <ul>
                  {summary.speciesBreakdown.map((r, i) => (
                    <li key={i}>
                      {CATEGORY_LABELS[r.category] || r.category} —{" "}
                      {KINGDOM_LABELS[r.kingdom] || r.kingdom || "règne inconnu"} : {r.species_count}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Aucune espèce de l&apos;échantillon liée à ce pays pour l&apos;instant.</p>
            )}
            <p><Link href="/especes">Voir la liste complète →</Link></p>
          </section>
        </>
      )}
    </main>
  );
}
