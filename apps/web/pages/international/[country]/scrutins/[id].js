import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../../../components/ShareButtons";
import PageHeader from "../../../../components/PageHeader";
import Pagination from "../../../../components/Pagination";
import { IconScale } from "../../../../components/icons";
import { useT } from "../../../../lib/useT";
import { localeTag } from "../../../../lib/dateLocale";
import ScrollableTable from "../../../../components/ScrollableTable";
import { useApiFetch } from "../../../../lib/useApiFetch";
import { getAnonymousId, getConsent, setConsent } from "../../../../lib/anonymousId";
import { saveParliamentCitizenVote, fetchParliamentCitizenVoteStats } from "../../../../lib/parliamentCitizenVotes";
import { chamberLabelKey } from "../../../../lib/parliamentChamberLabels";
import { translatePartyName } from "../../../../lib/partyNameLabels";
import { translateVoteResult } from "../../../../lib/voteResultLabels";

const POSITIONS = ["yes", "no", "abstain", "not_voting"];

function normalize(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function usePositionLabels(t) {
  return {
    yes: { label: t("international.pos_yes"), color: "#1baf7a" },
    no: { label: t("international.pos_no"), color: "#d63e2a" },
    abstain: { label: t("international.pos_abstain"), color: "#f4b400" },
    not_voting: { label: t("international.pos_not_voting"), color: "#95a5a6" },
  };
}

export default function InternationalVoteDetailPage() {
  const { t, locale } = useT();
  const POSITION_LABELS = usePositionLabels(t);
  const router = useRouter();
  const { country, id } = router.query;

  const [groupFilter, setGroupFilter] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [positionsPage, setPositionsPage] = useState(1);
  const POSITIONS_PAGE_SIZE = 30;
  const [revealed, setRevealed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [myVote, setMyVote] = useState(null);
  const [voting, setVoting] = useState(false);
  const [citizenStats, setCitizenStats] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const { data, loading, error } = useApiFetch(country && id ? `/api/parliament/${country}/votes/${id}` : null, {
    errorMessage: t("international.error_no_data"),
  });
  const vote = data?.vote ?? null;
  const positions = data?.positions ?? [];

  useEffect(() => {
    setRevealed(false);
    setBannerDismissed(false);
    setMyVote(null);
    setPositionsPage(1);
  }, [country, id]);

  useEffect(() => {
    setPositionsPage(1);
  }, [groupFilter, nameQuery]);

  useEffect(() => {
    if (!country || !id) return;
    fetchParliamentCitizenVoteStats(country, id).then(setCitizenStats).catch(() => setCitizenStats(null));
  }, [country, id]);

  function handleVote(position) {
    if (getConsent() !== "yes") setConsent(true);
    setVoting(true);
    const anonymousId = getAnonymousId();
    saveParliamentCitizenVote(country, anonymousId, id, position)
      .then(() => {
        setMyVote(position);
        setVoting(false);
        setRevealed(true);
        return fetchParliamentCitizenVoteStats(country, id);
      })
      .then(setCitizenStats)
      .catch(() => setVoting(false));
  }

  const groups = [...new Set(positions.map((p) => p.group_slug).filter(Boolean))];
  const groupNames = Object.fromEntries(positions.map((p) => [p.group_slug, translatePartyName(p.group_name, t)]));
  const filteredPositions = positions.filter((p) => {
    if (groupFilter && p.group_slug !== groupFilter) return false;
    if (nameQuery && !normalize(p.full_name).includes(normalize(nameQuery))) return false;
    return true;
  });
  const tally = positions.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    if (positions.length === 0 || groups.length === 0 || !revealed) return;
    let cancelled = false;
    import("../../../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const byGroup = {};
      for (const p of positions) {
        const g = p.group_slug || "?";
        if (!byGroup[g]) byGroup[g] = { yes: 0, no: 0, abstain: 0, not_voting: 0 };
        const pos = POSITIONS.includes(p.position) ? p.position : "not_voting";
        byGroup[g][pos] += 1;
      }
      const groupLabels = Object.keys(byGroup).sort(
        (a, b) => Object.values(byGroup[b]).reduce((s, n) => s + n, 0) - Object.values(byGroup[a]).reduce((s, n) => s + n, 0)
      );

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: groupLabels.map((g) => groupNames[g] || g),
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
  }, [positions, revealed]);

  if (!country || !id) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href={`/international/${country}/scrutins`}>{t("international.back_to_votes")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && vote && (
        <>
          <PageHeader Icon={IconScale} tint="blue" title={vote.question} />
          {vote.source_url && (
            <p style={{ fontSize: 13, marginTop: -8, marginBottom: "0.75rem" }}>
              <a href={vote.source_url} target="_blank" rel="noopener noreferrer">
                {t("international.full_text_link")}
              </a>
            </p>
          )}
          <ShareButtons title={vote.question} />

          <section
            style={{
              background: "var(--color-carte)",
              border: "1px solid var(--color-bordure)",
              borderRadius: 12,
              padding: "1.25rem",
              margin: "1rem 0",
            }}
          >
            <h2 style={{ fontSize: 16, marginTop: 0 }}>{t("international.citizen_vote_title")}</h2>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("international.citizen_vote_explain")}</p>

            {myVote ? (
              <p style={{ fontSize: 13, fontWeight: 600 }}>{t("international.you_voted", { position: t(POSITION_LABELS[myVote]?.key) || POSITION_LABELS[myVote]?.label })}</p>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => handleVote("yes")} disabled={voting} style={{ fontSize: 13 }}>
                  {t("international.pos_yes")}
                </button>
                <button type="button" onClick={() => handleVote("no")} disabled={voting} style={{ fontSize: 13 }}>
                  {t("international.pos_no")}
                </button>
                <button type="button" onClick={() => handleVote("abstain")} disabled={voting} style={{ fontSize: 13 }}>
                  {t("international.pos_abstain")}
                </button>
              </div>
            )}

            {citizenStats && (
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: 12 }}>
                {citizenStats.available
                  ? t("international.citizen_stats_available", {
                      total: citizenStats.total,
                      yes: citizenStats.counts.yes || 0,
                      no: citizenStats.counts.no || 0,
                      abstain: citizenStats.counts.abstain || 0,
                    })
                  : t("international.citizen_stats_unavailable", { min: citizenStats.minRequired })}
              </p>
            )}
          </section>

          {!revealed && positions.length > 0 && !bannerDismissed && !myVote && (
            <div style={{ background: "#fff8e6", border: "1px solid #f4b400", borderRadius: 8, padding: "0.75rem 1rem", margin: "1rem 0" }}>
              <p style={{ fontSize: 13, margin: "0 0 8px", color: "#3d2c05" }}>{t("scrutins.results_hidden_explain")}</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setRevealed(true)} style={{ fontSize: 13 }}>{t("scrutins.reveal_now")}</button>
                <button type="button" onClick={() => setBannerDismissed(true)} style={{ fontSize: 13 }}>{t("scrutins.vote_first")}</button>
              </div>
            </div>
          )}

          <p style={{ color: "var(--color-texte-clair)" }}>
            {vote.vote_date && new Date(vote.vote_date).toLocaleDateString(localeTag(locale))}
            {" — "}
            {t(chamberLabelKey(country, vote.chamber))}
            {vote.bill_number && <> — {vote.bill_number}</>}
            {revealed && (
              <>
                {" — "}{t("scrutins.result_prefix")} <strong>{translateVoteResult(vote.result, t) || "—"}</strong>
              </>
            )}
          </p>

          {positions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("international.no_positions")}</p>
          ) : revealed || myVote ? (
            <>
              <p style={{ fontSize: 14 }}>
                {t("scrutins.assembly_result")} <strong>{translateVoteResult(vote.result, t) || "—"}</strong> —{" "}
                {Object.entries(tally).map(([pos, count]) => `${POSITION_LABELS[pos]?.label || pos} : ${count}`).join(" · ")}
              </p>
              <div style={{ position: "relative", height: Math.max(160, groups.length * 40) }}>
                <canvas ref={canvasRef} role="img" aria-label={t("scrutins.chart_alt_groups")} />
              </div>

              <h2 style={{ fontSize: 16, marginTop: "1.5rem" }}>{t("scrutins.group_positions_title")}</h2>
              <ScrollableTable>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", marginBottom: "1rem" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_group")}</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_majority_position")}</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_detail")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      const groupPositions = positions.filter((p) => p.group_slug === g);
                      const groupTally = groupPositions.reduce((acc, p) => {
                        const pos = POSITIONS.includes(p.position) ? p.position : "not_voting";
                        acc[pos] = (acc[pos] || 0) + 1;
                        return acc;
                      }, {});
                      const votingPositions = ["yes", "no", "abstain"];
                      const votingCounts = votingPositions.map((p) => groupTally[p] || 0);
                      const maxCount = Math.max(...votingCounts);
                      const winners = votingPositions.filter((p, i) => votingCounts[i] === maxCount && maxCount > 0);
                      const majority = winners.length === 1 ? winners[0] : null;
                      return (
                        <tr key={g}>
                          <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>{groupNames[g] || g}</th>
                          <td style={{ padding: 8, color: majority ? POSITION_LABELS[majority].color : "var(--color-texte-clair)", fontWeight: 600 }}>
                            {majority ? POSITION_LABELS[majority].label : t("scrutins.shared_no_majority")}
                          </td>
                          <td style={{ padding: 8, fontSize: 13, color: "var(--color-texte-clair)" }}>
                            {Object.entries(groupTally).map(([pos, count]) => `${POSITION_LABELS[pos]?.label || pos} : ${count}`).join(" · ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollableTable>

              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem", marginBottom: "0.5rem" }}>
                <label>
                  {t("scrutins.filter_group")}{" "}
                  <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                    <option value="">{t("scrutins.all")}</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>{groupNames[g] || g}</option>
                    ))}
                  </select>
                </label>
                <input
                  type="text"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder={t("international.search_member_placeholder")}
                  style={{ padding: "4px 8px" }}
                />
              </div>
              <ScrollableTable>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_name")}</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_group")}</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("deputes.table_position")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPositions
                      .slice((positionsPage - 1) * POSITIONS_PAGE_SIZE, positionsPage * POSITIONS_PAGE_SIZE)
                      .map((p) => (
                      <tr key={p.member_id}>
                        <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                          <Link href={`/international/${country}/elus/${p.external_id}`}>{p.full_name}</Link>
                        </th>
                        <td style={{ padding: 8, color: p.group_color || "var(--color-texte)" }}>{translatePartyName(p.group_name, t) || "—"}</td>
                        <td style={{ padding: 8, color: POSITION_LABELS[p.position]?.color || "var(--color-texte)", fontWeight: 600 }}>
                          {POSITION_LABELS[p.position]?.label || p.position}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
              {filteredPositions.length > POSITIONS_PAGE_SIZE && (
                <Pagination
                  page={positionsPage}
                  totalPages={Math.max(1, Math.ceil(filteredPositions.length / POSITIONS_PAGE_SIZE))}
                  onChange={setPositionsPage}
                />
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("scrutins.results_hidden_note")}</p>
          )}
        </>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
