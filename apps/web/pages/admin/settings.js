import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../components/AdminAuthGate";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Réglages généraux du site — pour l'instant uniquement l'activation de la
// newsletter, mais pensé pour accueillir d'autres interrupteurs plus tard
// sans restructurer la page.
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
              Affiche ou masque le bouton d&apos;inscription à la newsletter (&laquo;&nbsp;Il est temps
              d&apos;agir&nbsp;&raquo;) sur tout le site. À garder désactivé tant que l&apos;envoi réel des
              emails n&apos;est pas configuré avec un service tiers.
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={Boolean(newsletterEnabled)}
              onChange={toggleNewsletter}
              disabled={saving}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: newsletterEnabled ? "#1baf7a" : "var(--color-texte-clair)" }}>
              {newsletterEnabled ? "Activée" : "Désactivée"}
            </span>
          </label>
        </section>
      )}
    </div>
  );
}

export default function AdminSettings() {
  return <AdminAuthGate>{(session) => <AdminSettingsInner session={session} />}</AdminAuthGate>;
}

export async function getServerSideProps() {
  return { props: {} };
}
