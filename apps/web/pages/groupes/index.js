import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconLandmark } from "../../components/icons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function GroupesPage() {
  const { t } = useT();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/an-groups`)
      .then((res) => {
        if (!res.ok) throw new Error(t("groupes.error_no_data"));
        return res.json();
      })
      .then((groupRows) => {
        setGroups(Array.isArray(groupRows) ? groupRows : []);
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
          scales: {
            x: { title: { display: true, text: t("groupes.axis_participation") }, max: 100 },
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconLandmark} tint="blue" title={t("groupes.title")} />
      <ShareButtons title={t("groupes.title")} />

      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>{t("groupes.intro")}</p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && groups.length > 0 && (
        <>
          <div style={{ position: "relative", height: Math.max(240, groups.length * 34) }}>
            <canvas ref={canvasRef} role="img" aria-label={t("groupes.chart_alt_participation")} />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("groupes.table_group")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_effectif")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_avg_participation")}</th>
                <th scope="col" style={{ textAlign: "right", padding: 8 }}>{t("groupes.table_median_participation")}</th>
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
