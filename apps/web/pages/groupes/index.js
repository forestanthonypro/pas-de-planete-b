import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function GroupesPage() {
  const [groups, setGroups] = useState([]);
  const [cohesion, setCohesion] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const cohesionCanvasRef = useRef(null);
  const cohesionChartRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/an-groups`).then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      }),
      fetch(`${API_URL}/api/an-groups/cohesion`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([groupRows, cohesionRows]) => {
        setGroups(Array.isArray(groupRows) ? groupRows : []);
        const byAbbrev = {};
        for (const c of cohesionRows || []) {
          const total = parseInt(c.total_count, 10);
          const unanimous = parseInt(c.unanimous_count, 10);
          byAbbrev[c.group_abbreviation] = total > 0 ? Math.round((unanimous / total) * 1000) / 10 : null;
        }
        setCohesion(byAbbrev);
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

      if (!cohesionCanvasRef.current) return;
      if (cohesionChartRef.current) cohesionChartRef.current.destroy();
      const withCohesion = groups.filter((g) => cohesion[g.abbreviation] != null);
      const sortedCohesion = [...withCohesion].sort((a, b) => (cohesion[b.abbreviation] || 0) - (cohesion[a.abbreviation] || 0));

      cohesionChartRef.current = new Chart(cohesionCanvasRef.current, {
        type: "bar",
        data: {
          labels: sortedCohesion.map((g) => g.abbreviation),
          datasets: [
            {
              label: "% de scrutins votés à l'unanimité du groupe",
              data: sortedCohesion.map((g) => cohesion[g.abbreviation]),
              backgroundColor: "#2a78d6",
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { title: { display: true, text: "% des scrutins où tout le groupe a voté pareil" }, max: 100 } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [groups, cohesion]);

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

          <h2 style={{ fontSize: 18, marginTop: "2rem" }}>Cohésion de vote</h2>
          <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
            Sur les scrutins où au moins 2 membres du groupe ont exprimé un vote (pour, contre ou
            abstention — les absents ne comptent pas comme un désaccord), quelle part voit
            l&apos;ensemble du groupe choisir la même position. Un chiffre élevé ne veut pas dire
            &laquo; meilleur &raquo; ou &laquo; pire &raquo; — juste plus ou moins de débat interne
            au groupe. Calculé sur la fenêtre de scrutins avec détail nominatif disponible (pas
            l&apos;historique complet).
          </p>
          <div style={{ position: "relative", height: Math.max(200, Object.keys(cohesion).length * 34) }}>
            <canvas ref={cohesionCanvasRef} role="img" aria-label="Cohésion de vote par groupe politique" />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Effectif</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Participation moy.</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Participation médiane</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Cohésion</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>Scrutins éligibles</th>
              </tr>
            </thead>
            <tbody>
              {groups
                .sort((a, b) => (b.effectif || 0) - (a.effectif || 0))
                .map((g) => (
                  <tr key={g.abbreviation}>
                    <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                      <Link href={`/groupes/${g.abbreviation}`}>{g.name}</Link> ({g.abbreviation})
                    </th>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.effectif ?? "—"}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.avg_participation_pct != null ? `${g.avg_participation_pct} %` : "—"}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.median_participation_pct != null ? `${g.median_participation_pct} %` : "—"}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>{cohesion[g.abbreviation] != null ? `${cohesion[g.abbreviation]} %` : "—"}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>{g.scrutins_eligibles ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : CIVIX et Assemblée nationale (open data officiel) (Licence Ouverte / Open Licence
        2.0).{" "}
        <Link href="/deputes">Voir la liste des députés →</Link>
      </p>
    </main>
  );
}
