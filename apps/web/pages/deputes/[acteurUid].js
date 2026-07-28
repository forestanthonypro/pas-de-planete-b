import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const POSITION_LABELS = {
  pour: { label: "Pour", color: "#1baf7a" },
  contre: { label: "Contre", color: "#d63e2a" },
  abstention: { label: "Abstention", color: "#f4b400" },
  absent: { label: "Absent / non-votant", color: "#95a5a6" },
  "non-votant": { label: "Absent / non-votant", color: "#95a5a6" },
};

export default function DeputyPage() {
  const router = useRouter();
  const { acteurUid } = router.query;
  const [deputy, setDeputy] = useState(null);
  const [votes, setVotes] = useState([]);
  const [groupStats, setGroupStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [positionFilter, setPositionFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!acteurUid) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/deputies/${acteurUid}`)
      .then((res) => {
        if (!res.ok) throw new Error("Député non trouvé");
        return res.json();
      })
      .then((data) => {
        setDeputy(data.deputy);
        setVotes(data.votes || []);
        setGroupStats(data.groupStats || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [acteurUid]);

  const tally = votes.reduce((acc, v) => {
    acc[v.position] = (acc[v.position] || 0) + 1;
    return acc;
  }, {});

  const filteredVotes = votes.filter((v) => {
    if (positionFilter && v.position !== positionFilter) return false;
    if (resultFilter && v.result_code !== resultFilter) return false;
    return true;
  });

  useEffect(() => {
    if (votes.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const positions = ["pour", "contre", "abstention", "absent"];
      const counts = positions.map((p) => tally[p] || 0);

      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: positions.map((p) => POSITION_LABELS[p].label),
          datasets: [
            {
              data: counts,
              backgroundColor: positions.map((p) => POSITION_LABELS[p].color),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/deputes">← Retour à la liste des députés</Link>
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && deputy && (
        <>
          <h1>{deputy.full_name}</h1>
      <ShareButtons title={`Député — ${deputy.full_name}`} />

          <p style={{ color: "#666" }}>
            {deputy.group_abbreviation && <>Groupe : <strong>{deputy.group_abbreviation}</strong> ({deputy.group_name}) — </>}
            {deputy.department && <>{deputy.department}{deputy.circo_number ? ` (${deputy.circo_number}e circonscription)` : ""}</>}
          </p>

          <p style={{ fontSize: 13, color: "#666", marginTop: "1rem" }}>
            Sur les <strong>{votes.length}</strong> scrutins où on a une donnée de vote pour ce
            député :{" "}
            {Object.keys(tally).length > 0
              ? Object.entries(tally)
                  .map(([pos, count]) => `${POSITION_LABELS[pos]?.label || pos} : ${count}`)
                  .join(" · ")
              : "aucune donnée."}
          </p>
          <p style={{ fontSize: 13, color: "#666" }}>
            Couvre l&apos;ensemble des scrutins de la 17e législature (depuis juillet 2024) pour
            lesquels ce député était en mandat — pas les législatures précédentes.
          </p>

          {votes.length > 0 && groupStats?.avg_participation_pct != null && (() => {
            const absentCount = votes.filter((v) => v.position === "absent" || v.position === "non-votant").length;
            const ownParticipation = Math.round(((votes.length - absentCount) / votes.length) * 1000) / 10;
            const groupAvg = parseFloat(groupStats.avg_participation_pct);
            const diff = Math.round((ownParticipation - groupAvg) * 10) / 10;
            return (
              <p style={{ fontSize: 13, color: "#666" }}>
                Sur cette même fenêtre, {deputy.full_name} a exprimé un vote (hors absences) dans{" "}
                <strong>{ownParticipation} %</strong> des scrutins, contre une moyenne de{" "}
                <strong>{groupAvg} %</strong> pour son groupe ({diff >= 0 ? "+" : ""}
                {diff} point{Math.abs(diff) >= 2 ? "s" : ""}). Ces deux chiffres ne sont pas
                calculés exactement de la même façon (fenêtres de scrutins différentes), à prendre
                comme un ordre de grandeur plutôt qu&apos;une comparaison au point près.
              </p>
            );
          })()}

          {votes.length > 0 && (
            <div style={{ position: "relative", height: 220, maxWidth: 400 }}>
              <canvas ref={canvasRef} role="img" aria-label={`Répartition des votes de ${deputy.full_name}`} />
            </div>
          )}

          {votes.length === 0 ? (
            <p>Aucune donnée de vote disponible pour ce député sur la période couverte.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem", marginBottom: "0.5rem" }}>
                <label>
                  Position{" "}
                  <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
                    <option value="">Toutes</option>
                    <option value="pour">Pour</option>
                    <option value="contre">Contre</option>
                    <option value="abstention">Abstention</option>
                    <option value="absent">Absent / non-votant</option>
                  </select>
                </label>
                <label>
                  Résultat du scrutin{" "}
                  <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
                    <option value="">Tous</option>
                    <option value="adopté">Adopté</option>
                    <option value="rejeté">Rejeté</option>
                  </select>
                </label>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Date</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Scrutin</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Position</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVotes.map((v) => (
                    <tr key={v.numero_scrutin}>
                      <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                        {v.scrutin_date ? new Date(v.scrutin_date).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td style={{ padding: 8 }}>
                        <Link href={`/scrutins/17/${v.numero_scrutin}`}>
                          {v.title || v.objet || `Scrutin n°${v.numero_scrutin}`}
                        </Link>
                      </td>
                      <td style={{ padding: 8, color: POSITION_LABELS[v.position]?.color || "#333", fontWeight: 600 }}>
                        {POSITION_LABELS[v.position]?.label || v.position}
                      </td>
                      <td style={{ padding: 8 }}>{v.result_label || v.result_code || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredVotes.length === 0 && (
                <p style={{ fontSize: 13, color: "#666" }}>Aucun scrutin ne correspond à ce filtre.</p>
              )}
            </>
          )}

          <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
            Source : CIVIX, à partir des données open data de l&apos;Assemblée nationale (Licence
            Ouverte / Open Licence 2.0).
          </p>
        </>
      )}
    </div>
  );
}
