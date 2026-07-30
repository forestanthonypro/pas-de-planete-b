import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnonymousId, getConsent, setConsent } from "../lib/anonymousId";
import { saveCitizenVote, fetchCitizenScrutinStats } from "../lib/citizenVotes";
import { useT } from "../lib/useT";

const POSITIONS = ["pour", "contre", "abstention"];

// Permet à la personne de voter (anonymement) sur ce scrutin et de comparer
// sa réponse à celle de l'Assemblée. Rien n'est envoyé au serveur tant
// qu'elle n'a pas explicitement confirmé vouloir garder un historique — le
// premier vote déclenche cette question, une seule fois.
export default function CitizenVote({ legislature, numero, resultCode, resultLabel, tally, onVoted }) {
  const { t } = useT();
  const [myVote, setMyVote] = useState(null);
  const [showConsentPrompt, setShowConsentPrompt] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [citizenStats, setCitizenStats] = useState(null);

  // Statistiques citoyennes agrégées — chargées seulement après le vote,
  // jamais avant (même logique que la révélation des résultats de
  // l'Assemblée : ça ne doit pas influencer le vote).
  useEffect(() => {
    if (!myVote) return;
    fetchCitizenScrutinStats(legislature, numero)
      .then(setCitizenStats)
      .catch(() => setCitizenStats(null));
  }, [myVote, legislature, numero]);

  function persistVote(position) {
    const id = getAnonymousId();
    saveCitizenVote(id, legislature, numero, position)
      .then(() => setSaved(true))
      .catch((err) => setError(err.message));
  }

  function handleVote(position) {
    setMyVote(position);
    setError(null);
    if (onVoted) onVoted(position);
    const consent = getConsent();
    if (consent === "yes") {
      persistVote(position);
    } else if (consent === null) {
      setShowConsentPrompt(true);
    }
  }

  function handleConsentDecision(yes) {
    setConsent(yes);
    setShowConsentPrompt(false);
    if (yes && myVote) persistVote(myVote);
  }

  const labels = {
    pour: t("scrutins.pos_pour"),
    contre: t("scrutins.pos_contre"),
    abstention: t("scrutins.pos_abstention"),
  };

  return (
    <div style={{ background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: 12, padding: "1rem", margin: "1.5rem 0" }}>
      <p style={{ fontWeight: 600, margin: "0 0 8px" }}>{t("citizenVote.question")}</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handleVote(p)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: myVote === p ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
              background: myVote === p ? "var(--color-carte-verte)" : "var(--color-carte)",
              color: "var(--color-texte)",
              fontWeight: myVote === p ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {labels[p]}
          </button>
        ))}
      </div>

      {myVote && (
        <div style={{ marginTop: "0.75rem", fontSize: 13, color: "var(--color-texte)" }}>
          <p style={{ margin: "0 0 4px" }}>
            {t("citizenVote.your_vote", { position: labels[myVote] })}
          </p>
          <p style={{ margin: 0, color: "var(--color-texte-clair)" }}>
            {t("citizenVote.assembly_result", {
              result: resultLabel || resultCode || "—",
              pour: tally?.pour || 0,
              contre: tally?.contre || 0,
              abstention: tally?.abstention || 0,
            })}
          </p>
          {citizenStats && (
            citizenStats.available ? (
              <p style={{ margin: "4px 0 0", color: "var(--color-texte-clair)" }}>
                {t("citizenVote.citizens_result", {
                  total: citizenStats.total,
                  pour: citizenStats.counts.pour || 0,
                  contre: citizenStats.counts.contre || 0,
                  abstention: citizenStats.counts.abstention || 0,
                })}
              </p>
            ) : (
              <p style={{ margin: "4px 0 0", color: "var(--color-texte-clair)", fontSize: 12 }}>
                {t("citizenVote.citizens_not_enough", { min: citizenStats.minRequired })}
              </p>
            )
          )}
        </div>
      )}

      {showConsentPrompt && (
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--color-fond)", border: "1px solid var(--color-bordure)", borderRadius: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 8px" }}>{t("citizenVote.consent_question")}</p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => handleConsentDecision(true)} style={{ fontSize: 13 }}>
              {t("citizenVote.consent_yes")}
            </button>
            <button type="button" onClick={() => handleConsentDecision(false)} style={{ fontSize: 13 }}>
              {t("citizenVote.consent_no")}
            </button>
          </div>
        </div>
      )}

      {saved && <p style={{ fontSize: 12, color: "#1baf7a", marginTop: 8 }}>{t("citizenVote.saved")}</p>}
      {error && <p role="alert" style={{ fontSize: 12, color: "#d63e2a", marginTop: 8 }}>{error}</p>}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "0.75rem" }}>
        <Link href="/mes-votes">{t("citizenVote.manage_link")}</Link>
      </p>
    </div>
  );
}
