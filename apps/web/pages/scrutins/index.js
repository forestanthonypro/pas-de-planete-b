import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ScrutinsPage() {
  const [scrutins, setScrutins] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/scrutins?limit=200`).then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      }),
      fetch(`${API_URL}/api/scrutins/stats`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([scrutinRows, statsData]) => {
        setScrutins(Array.isArray(scrutinRows) ? scrutinRows : []);
        setStats(statsData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!stats || !stats.byResult || stats.byResult.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const COLORS = { "adopté": "#1baf7a", "rejeté": "#d63e2a" };
      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: stats.byResult.map((r) => r.result_code || "inconnu"),
          datasets: [
            {
              data: stats.byResult.map((r) => parseInt(r.count, 10)),
              backgroundColor: stats.byResult.map((r) => COLORS[r.result_code] || "#95a5a6"),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "right" } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [stats]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Scrutins — Assemblée nationale (17e législature)</h1>

      {stats && (
        <>
          <p style={{ fontSize: 14 }}>
            Sur l&apos;ensemble des <strong>{stats.total.toLocaleString("fr-FR")}</strong> scrutins
            de la législature :
          </p>
          <div style={{ position: "relative", height: 200, maxWidth: 400 }}>
            <canvas ref={canvasRef} role="img" aria-label="Répartition adopté / rejeté sur l'ensemble des scrutins" />
          </div>
        </>
      )}

      <h2 style={{ fontSize: 18, marginTop: "2rem" }}>Les 200 scrutins les plus récents</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Avec leur résultat officiel. Le détail nominatif (qui a voté quoi) n&apos;est disponible
        que pour un sous-ensemble de ces scrutins — voir la fiche de chaque scrutin.
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Date</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Objet</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Type</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Résultat</th>
            </tr>
          </thead>
          <tbody>
            {scrutins.map((s) => (
              <tr key={s.numero}>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                  {s.scrutin_date ? new Date(s.scrutin_date).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td style={{ padding: 8 }}>
                  <Link href={`/scrutins/${s.legislature}/${s.numero}`}>
                    {s.title || s.objet || `Scrutin n°${s.numero}`}
                  </Link>
                </td>
                <td style={{ padding: 8 }}>{s.type_vote_label || "—"}</td>
                <td style={{ padding: 8 }}>{s.result_label || s.result_code || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : CIVIX et Assemblée nationale (open data officiel) (Licence Ouverte / Open Licence
        2.0).{" "}
        <Link href="/deputes">Voir la liste des députés →</Link>
      </p>
    </main>
  );
}
