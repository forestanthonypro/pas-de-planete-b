import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function GroupesPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/an-groups`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      })
      .then((rows) => {
        setGroups(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (groups.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const sorted = [...groups].sort((a, b) => (b.avg_participation_pct || 0) - (a.avg_participation_pct || 0));

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: sorted.map((g) => g.abbreviation),
          datasets: [
            {
              label: "Taux de participation moyen (%)",
              data: sorted.map((g) => g.avg_participation_pct),
              backgroundColor: "#6c3483",
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { title: { display: true, text: "% de participation moyenne aux scrutins" }, max: 100 } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [groups]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Groupes politiques — Assemblée nationale (17e législature)</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Taux de participation moyen aux scrutins par groupe. La participation ne dit rien sur le
        sens des votes — un groupe peut avoir une participation élevée tout en votant de façons
        très différentes en son sein. Données factuelles, aucun jugement de valeur.
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && groups.length > 0 && (
        <>
          <div style={{ position: "relative", height: Math.max(240, groups.length * 34) }}>
            <canvas ref={canvasRef} role="img" aria-label="Taux de participation moyen par groupe politique" />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Effectif</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Participation moy.</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Participation médiane</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Scrutins éligibles</th>
              </tr>
            </thead>
            <tbody>
              {groups
                .sort((a, b) => (b.effectif || 0) - (a.effectif || 0))
                .map((g) => (
                  <tr key={g.abbreviation}>
                    <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                      <Link href={`/deputes?groupe=${g.abbreviation}`}>{g.name}</Link> ({g.abbreviation})
                    </th>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.effectif ?? "—"}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.avg_participation_pct != null ? `${g.avg_participation_pct} %` : "—"}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.median_participation_pct != null ? `${g.median_participation_pct} %` : "—"}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.scrutins_eligibles ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : CIVIX, à partir des données open data de l&apos;Assemblée nationale (Licence
        Ouverte / Open Licence 2.0).{" "}
        <Link href="/deputes">Voir la liste des députés →</Link>
      </p>
    </main>
  );
}
