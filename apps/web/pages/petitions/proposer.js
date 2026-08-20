import { useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import ScopeMultiSelect from "../../components/ScopeMultiSelect";
import { useT } from "../../lib/useT";
import { IconLandmark } from "../../components/icons";


export default function ProposerPetition() {
  const { t, locale } = useT();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [petitionUrl, setPetitionUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [scopeCodes, setScopeCodes] = useState([]);
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    fetch(`/api/petitions/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, petitionUrl, sourceName: sourceName || null, scopeCodes, submitterEmail: submitterEmail || null, submissionNotes: submissionNotes || null, website }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Erreur")));
        return res.json();
      })
      .then(() => setStatus("done"))
      .catch((err) => {
        setError(err.message);
        setStatus("idle");
      });
  }

  if (status === "done") {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 20 }}>{t("common.thanks_title")}</h2>
        <p>{t("petitions.submit_done")}</p>
        <p style={{ fontSize: 13 }}>
          <Link href="/petitions">{t("petitions.back_to_list")}</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/petitions">{t("petitions.back_to_list")}</Link>
      </p>
      <PageHeader Icon={IconLandmark} tint="green" title={t("petitions.proposer_title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>
          {t("petitions.proposer_intro")}
        </p>
      </PageHeader>

      <form onSubmit={handleSubmit}>
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label htmlFor="website-petition">{t("common.honeypot_label")}</label>
          <input id="website-petition" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("petitions.title_label")}</span>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("petitions.description_label")}</span>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("petitions.petition_url_label")}</span>
          <input type="url" required value={petitionUrl} onChange={(e) => setPetitionUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("petitions.source_name_label")}</span>
          <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder={t("petitions.source_name_placeholder")} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <div style={{ marginBottom: "1rem" }}>
          <ScopeMultiSelect
            value={scopeCodes}
            onChange={setScopeCodes}
            locale={locale}
            label={t("common.scope_selector_label")}
            placeholder={t("common.scope_selector_placeholder")}
          />
        </div>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("common.optional_email_label")}</span>
          <input type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder={t("common.optional_email_placeholder")} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("common.optional_message_label")}</span>
          <textarea value={submissionNotes} onChange={(e) => setSubmissionNotes(e.target.value)} rows={2} placeholder={t("common.optional_message_placeholder")} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? t("common.sending") : t("common.send_proposal_button")}
        </button>
      </form>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
