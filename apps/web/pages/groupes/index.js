import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function GroupesPage() {
  const { t } = useT();
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
        if (!res.ok) throw new Error(t("groupes.error_no_data"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (groups.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const sorted = [...groups].sort((a, b) => (b.avg_participation_pct || 0) - (a.avg_participation_pct || 0));

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: sorted.map((g) => g.abbreviation),
          datasets: [
            {
              label: t("groupes.chart_participation_label"),
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
          scales: { x: { title: { display: true, text: t("groupes.axis_participation") }, max: 100 } },
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
              label: t("groupes.chart_cohesion_label"),
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
          scales: { x: { title: { display: true, text: t("groupes.axis_cohesion") }, max: 100 } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, cohesion]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>{t("groupes.title")}</h1>
      <ShareButtons title={t("groupes.title")} />

      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>{t("groupes.intro")}</p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && groups.length > 0 && (
        <>
          <div style={{ position: "relative", height: Math.max(240, groups.length * 34) }}>
            <canvas ref={canvasRef} role="img" aria-label={t("groupes.chart_alt_participation")} />
          </div>

          <h2 style={{ fontSize: 18, marginTop: "2rem" }}>{t("groupes.cohesion_title")}</h2>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>{t("groupes.cohesion_explain")}</p>
          <div style={{ position: "relative", height: Math.max(200, Object.keys(cohesion).length * 34) }}>
            <canvas ref={cohesionCanvasRef} role="img" aria-label={t("groupes.chart_alt_cohesion")} />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("groupes.table_group")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_effectif")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_avg_participation")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_median_participation")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_cohesion")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_eligible_scrutins")}</th>
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

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("groupes.source")}{" "}
        <Link href="/deputes">{t("groupes.back_to_deputies")}</Link>
      </p>
    </div>
  );
}
