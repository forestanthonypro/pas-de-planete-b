import { useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import ScopeMultiSelect from "../../components/ScopeMultiSelect";
import { useT } from "../../lib/useT";
import { IconSearch } from "../../components/icons";


export default function ProposerDebunk() {
  const { t, locale } = useT();
  const [myth, setMyth] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [scopeCodes, setScopeCodes] = useState([]);
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    fetch(`/api/debunk/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ myth, sourceUrl: sourceUrl || null, notes: notes || null, scopeCodes, submitterEmail: submitterEmail || null, website }),
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
        <p>{t("debunk.submit_done")}</p>
        <p style={{ fontSize: 13 }}>
          <Link href="/debunk">{t("debunk.back_to_list")}</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/debunk">{t("debunk.back_to_list")}</Link>
      </p>
      <PageHeader Icon={IconSearch} tint="teal" title={t("debunk.proposer_title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>
          {t("debunk.proposer_intro")}
        </p>
      </PageHeader>

      <form onSubmit={handleSubmit}>
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label htmlFor="website-debunk">{t("common.honeypot_label")}</label>
          <input id="website-debunk" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("debunk.myth_label")}</span>
          <textarea required value={myth} onChange={(e) => setMyth(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("debunk.source_url_label")}</span>
          <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder={t("debunk.source_url_placeholder")} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("debunk.notes_label")}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
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

        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("common.optional_email_label")}</span>
          <input type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder={t("common.optional_email_placeholder")} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <button type="submit" disabled={status === "sending" || !myth.trim()}>
          {status === "sending" ? t("common.sending") : t("common.send_proposal_button")}
        </button>
      </form>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
