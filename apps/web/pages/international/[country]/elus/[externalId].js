import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../../../components/ShareButtons";
import PageHeader from "../../../../components/PageHeader";
import FollowMemberForm from "../../../../components/FollowMemberForm";
import { IconUsers } from "../../../../components/icons";
import { useT } from "../../../../lib/useT";
import { localeTag } from "../../../../lib/dateLocale";
import ScrollableTable from "../../../../components/ScrollableTable";
import Pagination from "../../../../components/Pagination";
import { useApiFetch } from "../../../../lib/useApiFetch";
import { chamberLabelKey } from "../../../../lib/parliamentChamberLabels";
import { translatePartyName } from "../../../../lib/partyNameLabels";

const POSITION_LABELS = {
  yes: { key: "international.pos_yes", color: "#1baf7a" },
  no: { key: "international.pos_no", color: "#d63e2a" },
  abstain: { key: "international.pos_abstain", color: "#f4b400" },
  not_voting: { key: "international.pos_not_voting", color: "#95a5a6" },
};

export default function InternationalMemberDetailPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const { country, externalId } = router.query;
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const { data, loading, error } = useApiFetch(
    country && externalId ? `/api/parliament/${country}/members/${externalId}` : null,
    { errorMessage: t("international.member_not_found") }
  );
  const member = data?.member ?? null;
  const votes = data?.votes ?? [];

  const tally = votes.reduce((acc, v) => {
    acc[v.position] = (acc[v.position] || 0) + 1;
    return acc;
  }, {});

  const totalPages = Math.max(1, Math.ceil(votes.length / PAGE_SIZE));
  const pageItems = votes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (votes.length === 0) return;
    let cancelled = false;
    import("../../../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();
      const positions = ["yes", "no", "abstain", "not_voting"];
      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: positions.map((p) => t(POSITION_LABELS[p].key)),
          datasets: [{ data: positions.map((p) => tally[p] || 0), backgroundColor: positions.map((p) => POSITION_LABELS[p].color) }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes]);

  if (!country || !externalId) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href={`/international/${country}/elus`}>{t("international.back_to_members")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && member && (
        <>
          <PageHeader Icon={IconUsers} tint="blue" title={member.full_name} />
          <ShareButtons title={member.full_name} />

          <FollowMemberForm country={country} externalId={externalId} memberName={member.full_name} />

          <p style={{ color: "var(--color-texte-clair)" }}>
            {member.group_name && <>{t("deputes.group_label")} : <strong style={{ color: member.group_color }}>{translatePartyName(member.group_name, t)}</strong> — </>}
            {member.state_or_region}
            {" — "}
            {t(chamberLabelKey(country, member.chamber))}
          </p>

          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
            {t("international.votes_summary", { count: votes.length })}
          </p>

          {votes.length > 0 && (
            <div style={{ position: "relative", height: 220, maxWidth: 400 }}>
              <canvas ref={canvasRef} role="img" aria-label={member.full_name} />
            </div>
          )}

          {votes.length === 0 ? (
            <p>{t("international.no_votes")}</p>
          ) : (
            <>
              <ScrollableTable>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", marginTop: "1rem" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_date")}</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_object")}</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_position")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((v) => (
                      <tr key={v.vote_id}>
                        <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                          {v.vote_date ? new Date(v.vote_date).toLocaleDateString(localeTag(locale)) : "—"}
                        </td>
                        <td style={{ padding: 8 }}>
                          <Link href={`/international/${country}/scrutins/${v.vote_id}`}>{v.question}</Link>
                        </td>
                        <td style={{ padding: 8, color: POSITION_LABELS[v.position]?.color || "var(--color-texte)", fontWeight: 600 }}>
                          {t(POSITION_LABELS[v.position]?.key) || v.position}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
