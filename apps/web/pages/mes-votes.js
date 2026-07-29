import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnonymousId, getConsent, resetConsentChoice, forgetLocalIdentity } from "../lib/anonymousId";
import { fetchCitizenVotes, fetchCitizenAlignment, deleteAllCitizenVotes } from "../lib/citizenVotes";
import { useT } from "../lib/useT";

const POSITION_LABELS_KEYS = { pour: "scrutins.pos_pour", contre: "scrutins.pos_contre", abstention: "scrutins.pos_abstention" };

export default function MesVotesPage() {
  const { t } = useT();
  const [votes, setVotes] = useState([]);
  const [alignment, setAlignment] = useState(null);
  const [consent, setConsentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const currentConsent = getConsent();
    setConsentState(currentConsent);
    if (currentConsent !== "yes") {
      setLoading(false);
      return;
    }
    const id = getAnonymousId();
    Promise.all([fetchCitizenVotes(id), fetchCitizenAlignment(id)])
      .then(([votesData, alignmentData]) => {
        setVotes(votesData);
        setAlignment(alignmentData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  function handleDelete() {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    const id = getAnonymousId();
    deleteAllCitizenVotes(id)
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

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>{t("citizenVote.page_title")}</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1.5rem" }}>{t("citizenVote.page_intro")}</p>

      <section style={{ background: "#f7f7f5", border: "1px solid #e5e7e0", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>{t("citizenVote.manage_data_title")}</h2>
        <p style={{ fontSize: 13, color: "#666" }}>
          {consent === "yes" && t("citizenVote.consent_status_yes")}
          {consent === "no" && t("citizenVote.consent_status_no")}
          {consent === null && !deleted && t("citizenVote.consent_status_unset")}
          {deleted && t("citizenVote.delete_done")}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {consent !== null && (
            <button type="button" onClick={handleResetConsent} style={{ fontSize: 13 }}>
              Réinitialiser mon choix
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

      {!loading && !error && consent === "yes" && votes.length === 0 && (
        <p>{t("citizenVote.no_votes_yet")}</p>
      )}

      {!loading && consent !== "yes" && !deleted && (
        <p style={{ fontSize: 13, color: "#666" }}>{t("citizenVote.no_votes_yet")}</p>
      )}

      {!loading && !error && votes.length > 0 && (
        <>
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: 18 }}>{t("citizenVote.history_title")}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  <tr key={`${v.legislature}-${v.numero_scrutin}`}>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      {v.scrutin_date ? new Date(v.scrutin_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <Link href={`/scrutins/${v.legislature}/${v.numero_scrutin}`}>
                        {v.title || v.objet || `Scrutin n°${v.numero_scrutin}`}
                      </Link>
                    </td>
                    <td style={{ padding: 8 }}>{t(POSITION_LABELS_KEYS[v.position] || v.position)}</td>
                    <td style={{ padding: 8 }}>{v.result_label || v.result_code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {alignment && (
            <section>
              <h2 style={{ fontSize: 18 }}>{t("citizenVote.alignment_title")}</h2>
              <p style={{ fontSize: 13, color: "#666" }}>
                {t("citizenVote.alignment_explain", { min: alignment.minCommonVotes })}
              </p>

              {alignment.deputies.length === 0 && alignment.groups.length === 0 ? (
                <p style={{ fontSize: 13, color: "#666" }}>{t("citizenVote.no_alignment_yet")}</p>
              ) : (
                <>
                  {alignment.groups.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 15 }}>{t("citizenVote.alignment_groups_title")}</h3>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
                        <thead>
                          <tr>
                            <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("citizenVote.table_group")}</th>
                            <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_agreement")}</th>
                            <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_common_votes")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alignment.groups.map((g) => (
                            <tr key={g.group_abbreviation}>
                              <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>
                                <Link href={`/groupes/${g.group_abbreviation}`}>{g.group_abbreviation}</Link>
                              </th>
                              <td style={{ textAlign: "right", padding: 6, fontWeight: 600 }}>
                                {Math.round((g.matches / g.total) * 1000) / 10} %
                              </td>
                              <td style={{ textAlign: "right", padding: 6 }}>{g.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {alignment.deputies.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 15 }}>{t("citizenVote.alignment_deputies_title")}</h3>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("citizenVote.table_deputy")}</th>
                            <th scope="col" style={{ textAlign: "left", padding: 6 }}>{t("citizenVote.table_group")}</th>
                            <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_agreement")}</th>
                            <th scope="col" style={{ textAlign: "right", padding: 6 }}>{t("citizenVote.table_common_votes")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alignment.deputies.map((d) => (
                            <tr key={d.acteur_uid}>
                              <th scope="row" style={{ textAlign: "left", padding: 6, fontWeight: 400 }}>
                                <Link href={`/deputes/${d.acteur_uid}`}>{d.full_name}</Link>
                              </th>
                              <td style={{ padding: 6 }}>{d.group_abbreviation || "—"}</td>
                              <td style={{ textAlign: "right", padding: 6, fontWeight: 600 }}>
                                {Math.round((d.matches / d.total) * 1000) / 10} %
                              </td>
                              <td style={{ textAlign: "right", padding: 6 }}>{d.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "2rem" }}>
        <Link href="/scrutins">← Retour aux scrutins</Link>
      </p>
    </div>
  );
}
