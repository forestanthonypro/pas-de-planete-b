import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../components/AdminAuthGate";
import SimpleWysiwygEditor from "../../components/SimpleWysiwygEditor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const LEGAL_PAGES = [
  { key: "mentions_legales_content", label: "Mentions légales", href: "/mentions-legales" },
  { key: "confidentialite_content", label: "Politique de confidentialité", href: "/confidentialite" },
];

const LANGUAGE_TABS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
];

function LegalContentEditor({ baseKey, label, href, sessionToken }) {
  const [lang, setLang] = useState("fr");
  const [value, setValue] = useState("");
  const [initialValue, setInitialValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saved | error
  const [viewMode, setViewMode] = useState("visual"); // visual | code

  const pageKey = lang === "fr" ? baseKey : `${baseKey}_${lang}`;

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/settings/legal-content/${pageKey}`)
      .then((res) => (res.ok ? res.json() : { content: "" }))
      .then((data) => {
        setValue(data.content || "");
        setInitialValue(data.content || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pageKey]);

  function handleSave() {
    setSaving(true);
    setStatus("idle");
    fetch(`${API_URL}/api/admin/settings/legal-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ key: pageKey, content: value }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setInitialValue(value);
        setStatus("saved");
        setSaving(false);
      })
      .catch(() => {
        setStatus("error");
        setSaving(false);
      });
  }

  const hasChanges = value !== initialValue;

  return (
    <section
      style={{
        background: "var(--color-carte)",
        border: "1px solid var(--color-bordure)",
        borderRadius: 12,
        padding: "1.25rem",
        marginTop: "1.25rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{label}</p>
        <Link href={href} target="_blank" style={{ fontSize: 12 }}>
          Voir la page publique ↗
        </Link>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {LANGUAGE_TABS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            style={{
              fontSize: 12,
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid var(--color-bordure)",
              background: lang === l.code ? "var(--color-carte-verte)" : "var(--color-fond)",
              color: "var(--color-texte)",
              fontWeight: lang === l.code ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {!loading && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setViewMode("visual")}
            style={{
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 20,
              border: "1px solid var(--color-bordure)",
              background: viewMode === "visual" ? "var(--color-carte-verte)" : "var(--color-fond)",
              color: "var(--color-texte)",
              fontWeight: viewMode === "visual" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Éditeur visuel
          </button>
          <button
            type="button"
            onClick={() => setViewMode("code")}
            style={{
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 20,
              border: "1px solid var(--color-bordure)",
              background: viewMode === "code" ? "var(--color-carte-verte)" : "var(--color-fond)",
              color: "var(--color-texte)",
              fontWeight: viewMode === "code" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Code
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13 }}>Chargement...</p>
      ) : viewMode === "visual" ? (
        <SimpleWysiwygEditor value={value} onChange={setValue} />
      ) : (
        <>
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: 0, marginBottom: 8 }}>
            Contenu en HTML — pour les retouches fines seulement, l&apos;éditeur visuel suffit pour l&apos;usage courant.
          </p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={14}
            style={{
              width: "100%",
              padding: "10px",
              fontFamily: "monospace",
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid var(--color-bordure)",
            }}
          />
        </>
      )}

      {!loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <button type="button" onClick={handleSave} disabled={saving || !hasChanges} style={{ fontSize: 13, fontWeight: 600 }}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          {status === "saved" && <span style={{ fontSize: 12, color: "#1baf7a" }}>Enregistré ✓</span>}
          {status === "error" && <span style={{ fontSize: 12, color: "#d63e2a" }}>Échec de l&apos;enregistrement</span>}
        </div>
      )}
    </section>
  );
}

function AdminSettingsInner({ session }) {
  const [newsletterEnabled, setNewsletterEnabled] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${session.sessionToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((data) => {
        setNewsletterEnabled(data.newsletter_enabled === "true");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [session.sessionToken]);

  function toggleNewsletter() {
    const next = !newsletterEnabled;
    setSaving(true);
    setError(null);
    fetch(`${API_URL}/api/admin/settings/newsletter-enabled`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
      body: JSON.stringify({ enabled: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then((data) => {
        setNewsletterEnabled(data.enabled);
        setSaving(false);
      })
      .catch((err) => {
        setError(err.message);
        setSaving(false);
      });
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Réglages du site</h1>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {!loading && !error && (
        <section
          style={{
            background: "var(--color-carte)",
            border: "1px solid var(--color-bordure)",
            borderRadius: 12,
            padding: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Newsletter</p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0, maxWidth: 480 }}>
              Affiche ou masque le bouton d&apos;inscription à la newsletter sur tout le site.
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
            <input type="checkbox" checked={Boolean(newsletterEnabled)} onChange={toggleNewsletter} disabled={saving} />
            <span style={{ fontSize: 13, fontWeight: 600, color: newsletterEnabled ? "#1baf7a" : "var(--color-texte-clair)" }}>
              {newsletterEnabled ? "Activée" : "Désactivée"}
            </span>
          </label>
        </section>
      )}

      <h2 style={{ fontSize: 17, marginTop: "2rem" }}>Pages légales</h2>
      {LEGAL_PAGES.map((p) => (
        <LegalContentEditor key={p.key} baseKey={p.key} label={p.label} href={p.href} sessionToken={session.sessionToken} />
      ))}
    </div>
  );
}

export default function AdminSettings() {
  return <AdminAuthGate>{(session) => <AdminSettingsInner session={session} />}</AdminAuthGate>;
}

export async function getServerSideProps() {
  return { props: {} };
}
