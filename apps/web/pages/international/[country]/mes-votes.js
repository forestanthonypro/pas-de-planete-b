import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getAnonymousId, getConsent, resetConsentChoice, forgetLocalIdentity } from "../../../lib/anonymousId";
import {
  fetchParliamentCitizenVotes,
  fetchParliamentCitizenAlignment,
  deleteAllParliamentCitizenVotes,
} from "../../../lib/parliamentCitizenVotes";
import { useT } from "../../../lib/useT";
import { localeTag } from "../../../lib/dateLocale";
import PageHeader from "../../../components/PageHeader";
import { IconCheck } from "../../../components/icons";
import ScrollableTable from "../../../components/ScrollableTable";
import { translateVoteResult } from "../../../lib/voteResultLabels";

const POSITION_LABELS = { yes: "international.pos_yes", no: "international.pos_no", abstain: "international.pos_abstain" };

export default function InternationalMesVotesPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const { country } = router.query;

  const [votes, setVotes] = useState([]);
  const [alignment, setAlignment] = useState(null);
  const [consent, setConsentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (!country) return;
    const currentConsent = getConsent();
    setConsentState(currentConsent);
    if (currentConsent !== "yes") {
      setLoading(false);
      return;
    }
    const id = getAnonymousId();
    Promise.all([fetchParliamentCitizenVotes(country, id), fetchParliamentCitizenAlignment(country, id)])
      .then(([votesData, alignmentData]) => {
        setVotes(votesData);
        setAlignment(alignmentData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [country]);

  function handleDelete() {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    const id = getAnonymousId();
    deleteAllParliamentCitizenVotes(country, id)
      .then(() => {
        forgetLocalIdentity();
        setVotes([]);
        setAlignment(null);
        setConsentState(null);
        setDeleted(true);
        setDeleteConfirming(false);
      })
      .catch((err) => setError(err.message));
  }

  function handleResetConsent() {
    resetConsentChoice();
    setConsentState(null);
  }

  if (!country) return null;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href={`/international/${country}`}>{t("international.back_to_hub")}</Link>
      </p>
      <PageHeader Icon={IconCheck} tint="blue" title={t("international.card_myvotes_label")} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1.5rem" }}>{t("citizenVote.page_intro")}</p>

      <section style={{ background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>{t("citizenVote.manage_data_title")}</h2>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
          {consent === "yes" && t("citizenVote.consent_status_yes")}
          {consent === "no" && t("citizenVote.consent_status_no")}
          {consent === null && !deleted && t("citizenVote.consent_status_unset")}
          {deleted && t("citizenVote.delete_done")}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {consent !== null && (
            <button type="button" onClick={handleResetConsent} style={{ fontSize: 13 }}>
              {t("citizenVote.reset_consent_button")}
            </button>
          )}
          {consent === "yes" && (
            <button
              type="button"
              onClick={handleDelete}
              style={{ fontSize: 13, color: deleteConfirming ? "white" : "#d63e2a", background: deleteConfirming ? "#d63e2a" : "white", borderColor: "#d63e2a" }}
            >
              {deleteConfirming ? t("citizenVote.delete_confirm") : t("citizenVote.delete_button")}
            </button>
          )}
        </div>
      </section>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && consent === "yes" && votes.length === 0 && <p>{t("citizenVote.no_votes_yet")}</p>}
      {!loading && consent !== "yes" && !deleted && (
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("citizenVote.no_votes_yet")}</p>
      )}

      {!loading && !error && votes.length > 0 && (
        <>
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: 18 }}>{t("citizenVote.history_title")}</h2>
            <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("citizenVote.table_date")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("citizenVote.table_scrutin")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("citizenVote.table_your_vote")}</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("citizenVote.table_result")}</th>
                  </tr>
                </thead>
                <tbody>
                  {votes.map((v) => (
                    <tr key={v.vote_id}>
                      <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                        {v.vote_date ? new Date(v.vote_date).toLocaleDateString(localeTag(locale)) : "—"}
                      </td>
                      <td style={{ padding: 8 }}>
                        <Link href={`/international/${country}/scrutins/${v.vote_id}`}>{v.question}</Link>
                      </td>
                      <td style={{ padding: 8 }}>{t(POSITION_LABELS[v.position] || v.position)}</td>
                      <td style={{ padding: 8 }}>{translateVoteResult(v.result, t) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </section>

          {alignment && (
            <section>
              <h2 style={{ fontSize: 18 }}>{t("citizenVote.alignment_title")}</h2>
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
                {t("citizenVote.alignment_explain", { min: alignment.minCommonVotes })}
              </p>

              {alignment.members.length === 0 && alignment.groups.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("citizenVote.no_alignment_yet")}</p>
              ) : (
                <>
                  {alignment.groups.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 15 }}>{t("citizenVote.alignment_groups_title")}</h3>
                      <ScrollableTable>
                        <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", marginBottom: "1.5rem" }}>
                          <thead>
                            <tr>
                              <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("citizenVote.table_group")}</th>
                              <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_agreement")}</th>
                              <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_common_votes")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {alignment.groups.map((g) => (
                              <tr key={g.slug}>
                                <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>{g.name}</th>
                                <td style={{ textAlign: "right", padding: 6, fontWeight: 600 }}>
                                  {Math.round((g.matches / g.total) * 1000) / 10} %
                                </td>
                                <td style={{ textAlign: "right", padding: 6 }}>{g.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollableTable>
                    </>
                  )}

                  {alignment.members.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 15 }}>{t("citizenVote.alignment_deputies_title")}</h3>
                      <ScrollableTable>
                        <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("citizenVote.table_deputy")}</th>
                              <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("citizenVote.table_group")}</th>
                              <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_agreement")}</th>
                              <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_common_votes")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {alignment.members.map((m) => (
                              <tr key={m.id}>
                                <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>
                                  <Link href={`/international/${country}/elus/${m.external_id}`}>{m.full_name}</Link>
                                </th>
                                <td style={{ padding: 6, color: "var(--color-texte-clair)" }}>{m.group_name || "—"}</td>
                                <td style={{ textAlign: "right", padding: 6, fontWeight: 600 }}>
                                  {Math.round((m.matches / m.total) * 1000) / 10} %
                                </td>
                                <td style={{ textAlign: "right", padding: 6 }}>{m.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollableTable>
                    </>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
