import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import ScopeMultiSelect from "../../components/ScopeMultiSelect";
import { useT } from "../../lib/useT";
import { IconLandmark } from "../../components/icons";


function LocationForm({ locale, t }) {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [links, setLinks] = useState([{ label: "", url: "" }]);
  const [scopeCodes, setScopeCodes] = useState([]);
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/resource-categories?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [locale]);

  function updateLink(index, field, value) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }
  function addLink() {
    setLinks((prev) => [...prev, { label: "", url: "" }]);
  }
  function removeLink(index) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    fetch(`/api/resource-locations/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, description, address: address || null, latitude, longitude,
        categoryId: categoryId || null, links: links.filter((l) => l.label && l.url), scopeCodes,
        submitterEmail: submitterEmail || null, submissionNotes: submissionNotes || null, website,
      }),
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
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <h2 style={{ fontSize: 20 }}>{t("common.thanks_title")}</h2>
        <p>{t("ressources.location_submit_done")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label htmlFor="website-location">{t("common.honeypot_label")}</label>
        <input id="website-location" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.name_label")}</span>
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.description_label")}</span>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.address_label")}</span>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
      </label>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
        <label style={{ flex: 1, minWidth: 140 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.latitude_label")}</span>
          <input type="number" step="any" required value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder={t("ressources.latitude_placeholder")} style={{ width: "100%", padding: "8px 10px" }} />
        </label>
        <label style={{ flex: 1, minWidth: 140 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.longitude_label")}</span>
          <input type="number" step="any" required value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder={t("ressources.longitude_placeholder")} style={{ width: "100%", padding: "8px 10px" }} />
        </label>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: 0, marginBottom: "0.75rem" }}>
        {t("ressources.coords_hint_prefix")}{" "}
        <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>{" "}
        {t("ressources.coords_hint_suffix")}
      </p>

      {categories.length > 0 && (
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.category_label")}</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">{t("ressources.category_none")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

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

      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.links_label")}</p>
      {links.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input type="text" placeholder={t("ressources.link_label_placeholder")} value={l.label} onChange={(e) => updateLink(i, "label", e.target.value)} style={{ flex: 1, padding: "6px 10px" }} />
          <input type="url" placeholder="https://..." value={l.url} onChange={(e) => updateLink(i, "url", e.target.value)} style={{ flex: 1, padding: "6px 10px" }} />
          <button type="button" onClick={() => removeLink(i)} disabled={links.length === 1}>{t("ressources.remove_link_button")}</button>
        </div>
      ))}
      <button type="button" onClick={addLink} style={{ marginBottom: "1.5rem" }}>{t("ressources.add_link_button")}</button>

      <div>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? t("common.sending") : t("common.send_proposal_button")}
        </button>
      </div>
    </form>
  );
}

function OnlineForm({ locale, t }) {
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [scopeCodes, setScopeCodes] = useState([]);
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/resource-categories?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [locale]);

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    fetch(`/api/resource-online/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, url, categoryId: categoryId || null, scopeCodes, submitterEmail: submitterEmail || null, submissionNotes: submissionNotes || null, website }),
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
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <h2 style={{ fontSize: 20 }}>{t("common.thanks_title")}</h2>
        <p>{t("ressources.online_submit_done")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label htmlFor="website-online">{t("common.honeypot_label")}</label>
        <input id="website-online" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.title_label")}</span>
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.description_label")}</span>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.url_label")}</span>
        <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
      </label>

      {categories.length > 0 && (
        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("ressources.category_label")}</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">{t("ressources.category_none")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

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
  );
}

export default function ProposerRessource() {
  const { t, locale } = useT();
  const [tab, setTab] = useState("location");

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/ressources">{t("ressources.back_to_list")}</Link>
      </p>
      <PageHeader Icon={IconLandmark} tint="green" title={t("ressources.proposer_title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>
          {t("ressources.proposer_intro")}
        </p>
      </PageHeader>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          onClick={() => setTab("location")}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: tab === "location" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: tab === "location" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)", fontWeight: tab === "location" ? 600 : 400, cursor: "pointer",
          }}
        >
          {t("ressources.proposer_tab_location")}
        </button>
        <button
          type="button"
          onClick={() => setTab("online")}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: tab === "online" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: tab === "online" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)", fontWeight: tab === "online" ? 600 : 400, cursor: "pointer",
          }}
        >
          {t("ressources.proposer_tab_online")}
        </button>
      </div>

      {tab === "location" ? <LocationForm locale={locale} t={t} /> : <OnlineForm locale={locale} t={t} />}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
