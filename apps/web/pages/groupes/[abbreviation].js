import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconLandmark } from "../../components/icons";
import { useT } from "../../lib/useT";
import { localeTag } from "../../lib/dateLocale";
import ScrollableTable from "../../components/ScrollableTable";
import Pagination from "../../components/Pagination";
import { useApiFetch } from "../../lib/useApiFetch";

export default function GroupDetailPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const { abbreviation } = router.query;
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const { data, loading, error } = useApiFetch(abbreviation ? `/api/an-groups/${abbreviation}` : null, {
    errorMessage: t("groupes.group_not_found"),
  });
  const group = data?.group ?? null;
  const resultBreakdown = data?.resultBreakdown ?? [];
  const recentScrutins = data?.recentScrutins ?? [];
  const [scrutinsPage, setScrutinsPage] = useState(1);
  const SCRUTINS_PAGE_SIZE = 20;
  const scrutinsTotalPages = Math.max(1, Math.ceil(recentScrutins.length / SCRUTINS_PAGE_SIZE));
  const pagedScrutins = recentScrutins.slice((scrutinsPage - 1) * SCRUTINS_PAGE_SIZE, scrutinsPage * SCRUTINS_PAGE_SIZE);

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
          labels: resultBreakdown.map((r) => r.result_code || t("groupes.unknown")),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultBreakdown]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/groupes">{t("groupes.back_to_list")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && group && (
        <>
          <PageHeader Icon={IconLandmark} tint="blue" title={`${group.name} (${group.abbreviation})`} />
          <ShareButtons title={`${group.name} (${group.abbreviation})`} />

          <p style={{ color: "var(--color-texte-clair)" }}>
            {group.effectif} {t("groupes.members", { s: group.effectif > 1 ? "s" : "" })} · {t("groupes.avg_participation")}{" "}
            {group.avg_participation_pct != null ? `${group.avg_participation_pct} %` : "—"}
          </p>

          <h2 style={{ fontSize: 18, marginTop: "1.5rem" }}>{t("groupes.results_title")}</h2>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "0.75rem" }}>
            {t("groupes.results_explain", { total: totalScrutins })}
          </p>
          {totalScrutins > 0 && (
            <div style={{ position: "relative", height: 200, maxWidth: 400 }}>
              <canvas ref={canvasRef} role="img" aria-label={t("groupes.chart_alt_results")} />
            </div>
          )}
          <p style={{ fontSize: 13 }}>
            {resultBreakdown.map((r) => (
              <span key={r.result_code} style={{ marginRight: "1rem" }}>
                {r.result_code || t("groupes.unknown")} :{" "}
                <strong>
                  {totalScrutins > 0 ? Math.round((parseInt(r.count, 10) / totalScrutins) * 1000) / 10 : 0} %
                </strong>{" "}
                ({r.count})
              </span>
            ))}
          </p>

          <h2 style={{ fontSize: 18, marginTop: "1.5rem" }}>{t("groupes.recent_scrutins_title")}</h2>
          {recentScrutins.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("groupes.no_scrutins")}</p>
          ) : (
            <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("groupes.table_date")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("groupes.table_object")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("groupes.table_group_vote")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("groupes.table_result")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedScrutins.map((s) => (
                    <tr key={s.numero}>
                      <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                        {s.scrutin_date ? new Date(s.scrutin_date).toLocaleDateString(localeTag(locale)) : "—"}
                      </td>
                      <td style={{ padding: 8 }}>
                        <Link href={`/scrutins/${s.legislature}/${s.numero}`}>
                          {s.title || s.objet || `Scrutin n°${s.numero}`}
                        </Link>
                      </td>
                      <td style={{ padding: 8, fontSize: 13, color: "var(--color-texte-clair)" }}>
                        {t("groupes.vote_breakdown", { pour: s.pour, contre: s.contre, abstention: s.abstention })}
                      </td>
                      <td style={{ padding: 8 }}>{s.result_label || s.result_code || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          )}
          <Pagination page={scrutinsPage} totalPages={scrutinsTotalPages} onChange={setScrutinsPage} />

          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
            {t("groupes.detail_source")}{" "}
            <Link href={`/deputes?groupe=${group.abbreviation}`}>{t("groupes.see_group_deputies")}</Link>
          </p>
        </>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
