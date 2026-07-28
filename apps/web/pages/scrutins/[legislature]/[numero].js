import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const POSITION_LABELS = {
  pour: { label: "Pour", color: "#1baf7a" },
  contre: { label: "Contre", color: "#d63e2a" },
  abstention: { label: "Abstention", color: "#f4b400" },
  absent: { label: "Absent / non-votant", color: "#95a5a6" },
  "non-votant": { label: "Absent / non-votant", color: "#95a5a6" },
};
const POSITIONS = ["pour", "contre", "abstention", "absent"];

export default function ScrutinPage() {
  const router = useRouter();
  const { legislature, numero } = router.query;
  const [scrutin, setScrutin] = useState(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupFilter, setGroupFilter] = useState("");
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!legislature || !numero) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/scrutins/${legislature}/${numero}`)
      .then((res) => {
        if (!res.ok) throw new Error("Scrutin non trouvé");
        return res.json();
      })
      .then((data) => {
        setScrutin(data.scrutin);
        setVotes(data.votes || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [legislature, numero]);

  const groups = [...new Set(votes.map((v) => v.group_abbreviation).filter(Boolean))].sort();
  const filteredVotes = groupFilter ? votes.filter((v) => v.group_abbreviation === groupFilter) : votes;
  const tally = votes.reduce((acc, v) => {
    acc[v.position] = (acc[v.position] || 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    if (votes.length === 0 || groups.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      // Une barre empilée par groupe politique : combien de "pour"/"contre"/
      // "abstention"/"absent" en son sein, pour visualiser d'un coup d'œil si
      // un groupe a voté de façon homogène ou partagée.
      const byGroup = {};
      for (const v of votes) {
        const g = v.group_abbreviation || "?";
        if (!byGroup[g]) byGroup[g] = { pour: 0, contre: 0, abstention: 0, absent: 0 };
        const pos = POSITIONS.includes(v.position) ? v.position : "absent";
        byGroup[g][pos] += 1;
      }
      const groupLabels = Object.keys(byGroup).sort(
        (a, b) => Object.values(byGroup[b]).reduce((s, n) => s + n, 0) - Object.values(byGroup[a]).reduce((s, n) => s + n, 0)
      );

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: groupLabels,
          datasets: POSITIONS.map((pos) => ({
            label: POSITION_LABELS[pos].label,
            data: groupLabels.map((g) => byGroup[g][pos]),
            backgroundColor: POSITION_LABELS[pos].color,
          })),
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true }, y: { stacked: true } },
          plugins: { legend: { position: "bottom" } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/scrutins">← Retour à la liste des scrutins</Link>
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && scrutin && (
        <>
          <h1>{scrutin.title || scrutin.objet || `Scrutin n°${scrutin.numero}`}</h1>
          <p style={{ color: "#666" }}>
            {scrutin.scrutin_date && (
              <>Voté le {new Date(scrutin.scrutin_date).toLocaleDateString("fr-FR")} — </>
            )}
            {scrutin.type_vote_label && <>{scrutin.type_vote_label} — </>}
            Résultat : <strong>{scrutin.result_label || scrutin.result_code || "—"}</strong>
          </p>

          {votes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#666" }}>
              Le détail nominatif des votes n&apos;est pas disponible pour ce scrutin (le jeu de
              données public utilisé ne couvre qu&apos;un sous-ensemble des scrutins — voir{" "}
              <Link href="/scrutins">la liste des scrutins</Link>).
            </p>
          ) : (
            <>
              <p style={{ fontSize: 14 }}>
                {Object.entries(tally)
                  .map(([pos, count]) => `${POSITION_LABELS[pos]?.label || pos} : ${count}`)
                  .join(" · ")}
              </p>
              <div style={{ position: "relative", height: Math.max(160, groups.length * 40) }}>
                <canvas ref={canvasRef} role="img" aria-label="Répartition des votes par groupe politique" />
              </div>
              <label style={{ display: "block", marginTop: "1rem", marginBottom: "0.5rem" }}>
                Filtrer par groupe{" "}
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                  <option value="">Tous</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Député</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVotes.map((v) => (
                    <tr key={v.acteur_uid}>
                      <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                        <Link href={`/deputes/${v.acteur_uid}`}>{v.full_name}</Link>
                      </th>
                      <td style={{ padding: 8 }}>{v.group_abbreviation || "—"}</td>
                      <td style={{ padding: 8, color: POSITION_LABELS[v.position]?.color || "#333", fontWeight: 600 }}>
                        {POSITION_LABELS[v.position]?.label || v.position}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
            Source : CIVIX, à partir des données open data de l&apos;Assemblée nationale (Licence
            Ouverte / Open Licence 2.0).
          </p>
        </>
      )}
    </main>
  );
}
