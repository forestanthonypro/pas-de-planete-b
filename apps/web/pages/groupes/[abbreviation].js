import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function GroupDetailPage() {
  const router = useRouter();
  const { abbreviation } = router.query;
  const [group, setGroup] = useState(null);
  const [resultBreakdown, setResultBreakdown] = useState([]);
  const [recentScrutins, setRecentScrutins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!abbreviation) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/an-groups/${abbreviation}`)
      .then((res) => {
        if (!res.ok) throw new Error("Groupe non trouvé");
        return res.json();
      })
      .then((data) => {
        setGroup(data.group);
        setResultBreakdown(data.resultBreakdown || []);
        setRecentScrutins(data.recentScrutins || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [abbreviation]);

  const totalScrutins = resultBreakdown.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

  useEffect(() => {
    if (resultBreakdown.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const COLORS = { "adopté": "#1baf7a", "rejeté": "#d63e2a" };
      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: resultBreakdown.map((r) => r.result_code || "inconnu"),
          datasets: [
            {
              data: resultBreakdown.map((r) => parseInt(r.count, 10)),
              backgroundColor: resultBreakdown.map((r) => COLORS[r.result_code] || "#95a5a6"),
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [resultBreakdown]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/groupes">← Retour à la liste des groupes</Link>
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && group && (
        <>
          <h1>{group.name} ({group.abbreviation})</h1>
      <ShareButtons title={`${group.name} (${group.abbreviation})`} />

          <p style={{ color: "#666" }}>
            {group.effectif} membre{group.effectif > 1 ? "s" : ""} · Participation moyenne :{" "}
            {group.avg_participation_pct != null ? `${group.avg_participation_pct} %` : "—"}
          </p>

          <h2 style={{ fontSize: 18, marginTop: "1.5rem" }}>
            Scrutins adoptés ou rejetés, parmi ceux où le groupe a voté
          </h2>
          <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
            Les votes sont individuels — les membres d&apos;un même groupe ne votent pas toujours
            de la même façon. Ce chiffre montre, parmi les <strong>{totalScrutins}</strong>{" "}
            scrutins où au moins un membre du groupe a exprimé un vote, quelle part a été adoptée
            ou rejetée par l&apos;Assemblée — ce n&apos;est pas une mesure de ce que le groupe
            voulait obtenir.
          </p>
          {totalScrutins > 0 && (
            <div style={{ position: "relative", height: 200, maxWidth: 400 }}>
              <canvas ref={canvasRef} role="img" aria-label="Scrutins adoptés vs rejetés pour ce groupe" />
            </div>
          )}
          <p style={{ fontSize: 13 }}>
            {resultBreakdown.map((r) => (
              <span key={r.result_code} style={{ marginRight: "1rem" }}>
                {r.result_code || "inconnu"} :{" "}
                <strong>
                  {totalScrutins > 0 ? Math.round((parseInt(r.count, 10) / totalScrutins) * 1000) / 10 : 0} %
                </strong>{" "}
                ({r.count})
              </span>
            ))}
          </p>

          <h2 style={{ fontSize: 18, marginTop: "1.5rem" }}>Scrutins les plus récents</h2>
          {recentScrutins.length === 0 ? (
            <p style={{ fontSize: 13, color: "#666" }}>Aucun scrutin trouvé pour ce groupe.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Date</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Objet</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Vote du groupe</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {recentScrutins.map((s) => (
                  <tr key={s.numero}>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      {s.scrutin_date ? new Date(s.scrutin_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <Link href={`/scrutins/${s.legislature}/${s.numero}`}>
                        {s.title || s.objet || `Scrutin n°${s.numero}`}
                      </Link>
                    </td>
                    <td style={{ padding: 8, fontSize: 13, color: "#666" }}>
                      Pour : {s.pour} · Contre : {s.contre} · Abstention : {s.abstention}
                    </td>
                    <td style={{ padding: 8 }}>{s.result_label || s.result_code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
            Source : CIVIX et Assemblée nationale (open data officiel) (Licence Ouverte / Open
            Licence 2.0).{" "}
            <Link href={`/deputes?groupe=${group.abbreviation}`}>Voir les députés de ce groupe →</Link>
          </p>
        </>
      )}
    </div>
  );
}
