import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function usePositionLabels(t) {
  return {
    pour: { label: t("deputes.pos_pour"), color: "#1baf7a" },
    contre: { label: t("deputes.pos_contre"), color: "#d63e2a" },
    abstention: { label: t("deputes.pos_abstention"), color: "#f4b400" },
    absent: { label: t("deputes.pos_absent"), color: "#95a5a6" },
    "non-votant": { label: t("deputes.pos_absent"), color: "#95a5a6" },
  };
}

export default function DeputyPage() {
  const { t } = useT();
  const POSITION_LABELS = usePositionLabels(t);
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
        if (!res.ok) throw new Error(t("deputes.deputy_not_found"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <Link href="/deputes">{t("deputes.back_to_list")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && deputy && (
        <>
          <h1>{deputy.full_name}</h1>
          <ShareButtons title={`${deputy.full_name}`} />

          <p style={{ color: "#666" }}>
            {deputy.group_abbreviation && <>{t("deputes.group_label")} : <strong>{deputy.group_abbreviation}</strong> ({deputy.group_name}) — </>}
            {deputy.department && <>{deputy.department}{deputy.circo_number ? t("deputes.circo_suffix_full", { n: deputy.circo_number }) : ""}</>}
          </p>

          <p style={{ fontSize: 13, color: "#666", marginTop: "1rem" }}>
            {t("deputes.votes_summary", { count: votes.length })}{" "}
            {Object.keys(tally).length > 0
              ? Object.entries(tally)
                  .map(([pos, count]) => `${POSITION_LABELS[pos]?.label || pos} : ${count}`)
                  .join(" · ")
              : t("deputes.no_data")}
          </p>
          <p style={{ fontSize: 13, color: "#666" }}>{t("deputes.legislature_note")}</p>

          {votes.length > 0 && groupStats?.avg_participation_pct != null && (() => {
            const absentCount = votes.filter((v) => v.position === "absent" || v.position === "non-votant").length;
            const ownParticipation = Math.round(((votes.length - absentCount) / votes.length) * 1000) / 10;
            const groupAvg = parseFloat(groupStats.avg_participation_pct);
            const diff = Math.round((ownParticipation - groupAvg) * 10) / 10;
            return (
              <p style={{ fontSize: 13, color: "#666" }}>
                {t("deputes.participation_compare", {
                  name: deputy.full_name,
                  own: ownParticipation,
                  groupAvg,
                  sign: diff >= 0 ? "+" : "",
                  diff,
                  plural: Math.abs(diff) >= 2 ? "s" : "",
                })}
              </p>
            );
          })()}

          {votes.length > 0 && (
            <div style={{ position: "relative", height: 220, maxWidth: 400 }}>
              <canvas ref={canvasRef} role="img" aria-label={deputy.full_name} />
            </div>
          )}

          {votes.length === 0 ? (
            <p>{t("deputes.no_votes")}</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem", marginBottom: "0.5rem" }}>
                <label>
                  {t("deputes.position_label")}{" "}
                  <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
                    <option value="">{t("deputes.all_positions")}</option>
                    <option value="pour">{t("deputes.pos_pour")}</option>
                    <option value="contre">{t("deputes.pos_contre")}</option>
                    <option value="abstention">{t("deputes.pos_abstention")}</option>
                    <option value="absent">{t("deputes.pos_absent")}</option>
                  </select>
                </label>
                <label>
                  {t("deputes.result_label")}{" "}
                  <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
                    <option value="">{t("deputes.all")}</option>
                    <option value="adopté">{t("deputes.adopted")}</option>
                    <option value="rejeté">{t("deputes.rejected")}</option>
                  </select>
                </label>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_date")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_scrutin")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_position")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_result")}</th>
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
                <p style={{ fontSize: 13, color: "#666" }}>{t("deputes.no_matching_votes")}</p>
              )}
            </>
          )}

          <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>{t("deputes.deputy_source")}</p>
        </>
      )}
    </div>
  );
}
