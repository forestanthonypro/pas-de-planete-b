import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../components/AdminAuthGate";
import SimpleWysiwygEditor from "../../components/SimpleWysiwygEditor";
import { useApiFetch } from "../../lib/useApiFetch";

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
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saved | error
  const [viewMode, setViewMode] = useState("visual"); // visual | code

  const pageKey = lang === "fr" ? baseKey : `${baseKey}_${lang}`;
  const [translating, setTranslating] = useState(false); // false | "current" | "all"
  const [translateError, setTranslateError] = useState(null);

  const { data: legalContent, loading } = useApiFetch(`/api/settings/legal-content/${pageKey}`, {
    transform: (data) => (data && data.content) || "",
  });

  // Le texte français (baseKey, sans suffixe) sert de source pour la
  // traduction automatique, quelle que soit la langue actuellement
  // affichée à l'écran. On le duplique dans un état local mis à jour
  // immédiatement après un enregistrement réussi en français, car
  // useApiFetch ne charge frenchContent qu'une fois au montage — sans ça,
  // traduire juste après avoir modifié le français utiliserait encore
  // l'ancienne version tant que la page n'est pas rechargée.
  const { data: frenchContent } = useApiFetch(`/api/settings/legal-content/${baseKey}`, {
    transform: (data) => (data && data.content) || "",
  });
  const [latestFrenchContent, setLatestFrenchContent] = useState("");

  useEffect(() => {
    if (frenchContent !== undefined) setLatestFrenchContent(frenchContent || "");
  }, [frenchContent]);

  useEffect(() => {
    setValue(legalContent || "");
    setInitialValue(legalContent || "");
  }, [legalContent]);

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
        if (lang === "fr") setLatestFrenchContent(value);
        setStatus("saved");
        setSaving(false);
      })
      .catch(() => {
        setStatus("error");
        setSaving(false);
      });
  }

  const hasChanges = value !== initialValue;

  // Traduction automatique (Google Cloud Translation) — pré-remplit
  // l'éditeur pour relecture, n'enregistre jamais seule.
  function handleTranslateCurrent() {
    if (lang === "fr") return;
    setTranslating("current");
    setTranslateError(null);
    fetch(`${API_URL}/api/admin/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ texts: { content: latestFrenchContent || "" }, targetLangs: [lang], format: "html" }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Erreur")));
        return res.json();
      })
      .then((result) => {
        setValue(result[lang].content);
        setTranslating(false);
      })
      .catch((err) => {
        setTranslateError(err.message);
        setTranslating(false);
      });
  }

  // Traduit ET enregistre directement les 7 langues d'un coup, contrairement
  // au bouton ci-dessus qui ne fait que pré-remplir la langue affichée pour
  // relecture — mêmes raisons qu'expliquées dans ContentTranslationsEditor.js.
  function handleTranslateAll() {
    setTranslating("all");
    setTranslateError(null);
    const allLangs = LANGUAGE_TABS.filter((l) => l.code !== "fr").map((l) => l.code);
    fetch(`${API_URL}/api/admin/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ texts: { content: latestFrenchContent || "" }, targetLangs: allLangs, format: "html" }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Erreur")));
        return res.json();
      })
      .then((result) =>
        Promise.all(
          allLangs.map((l) =>
            fetch(`${API_URL}/api/admin/settings/legal-content`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
              body: JSON.stringify({ key: `${baseKey}_${l}`, content: result[l].content }),
            })
          )
        ).then(() => result)
      )
      .then((result) => {
        if (lang !== "fr") {
          setValue(result[lang].content);
          setInitialValue(result[lang].content);
        }
        setTranslating(false);
        setStatus("saved");
      })
      .catch((err) => {
        setTranslateError(err.message);
        setTranslating(false);
      });
  }

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

      {lang !== "fr" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <button type="button" onClick={handleTranslateCurrent} disabled={!!translating} style={{ fontSize: 12 }}>
            {translating === "current" ? "Traduction..." : "Traduire automatiquement cette langue"}
          </button>
          <button type="button" onClick={handleTranslateAll} disabled={!!translating} style={{ fontSize: 12 }}>
            {translating === "all" ? "Traduction des 7 langues..." : "Traduire et enregistrer dans les 7 langues"}
          </button>
          {translateError && <span style={{ fontSize: 12, color: "#d63e2a" }}>{translateError}</span>}
        </div>
      )}

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
  const [videoUrl, setVideoUrl] = useState("");
  const [videoUrlInitial, setVideoUrlInitial] = useState("");
  const [videoUrlSaving, setVideoUrlSaving] = useState(false);
  const [videoUrlStatus, setVideoUrlStatus] = useState("idle"); // idle | saved | error
  const [revoking, setRevoking] = useState(false);
  const [revokeConfirming, setRevokeConfirming] = useState(false);
  const [revokeStatus, setRevokeStatus] = useState("idle"); // idle | done
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data: settingsData, loading, error: fetchError } = useApiFetch("/api/admin/settings", {
    headers: { Authorization: `Bearer ${session.sessionToken}` },
  });
  const { data: videoUrlData } = useApiFetch("/api/settings/decouverte-video-url");

  useEffect(() => {
    if (settingsData) setNewsletterEnabled(settingsData.newsletter_enabled === "true");
  }, [settingsData]);

  useEffect(() => {
    if (videoUrlData?.url !== undefined) {
      setVideoUrl(videoUrlData.url);
      setVideoUrlInitial(videoUrlData.url);
    }
  }, [videoUrlData]);

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  function handleRevokeAll() {
    if (!revokeConfirming) {
      setRevokeConfirming(true);
      return;
    }
    setRevoking(true);
    fetch(`${API_URL}/api/admin/auth/revoke-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.sessionToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la révocation");
        return res.json();
      })
      .then(() => {
        setRevokeStatus("done");
        setRevoking(false);
        // La session courante vient elle aussi d'être invalidée côté
        // serveur — on recharge pour redéclencher l'écran de connexion TOTP.
        setTimeout(() => window.location.reload(), 1500);
      })
      .catch((err) => {
        setError(err.message);
        setRevoking(false);
        setRevokeConfirming(false);
      });
  }

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

  function saveVideoUrl() {
    setVideoUrlSaving(true);
    setVideoUrlStatus("idle");
    fetch(`${API_URL}/api/admin/settings/decouverte-video-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
      body: JSON.stringify({ url: videoUrl }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Échec de l'enregistrement")));
        return res.json();
      })
      .then(() => {
        setVideoUrlInitial(videoUrl);
        setVideoUrlStatus("saved");
        setVideoUrlSaving(false);
      })
      .catch((err) => {
        setError(err.message);
        setVideoUrlStatus("error");
        setVideoUrlSaving(false);
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

      <section
        style={{
          background: "var(--color-carte)",
          border: "1px solid var(--color-bordure)",
          borderRadius: 12,
          padding: "1.25rem",
          marginTop: "1rem",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Vidéo — page découverte</p>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 10px", maxWidth: 520 }}>
          Lien YouTube affiché au clic sur le bouton &quot;Comprendre en 4 minutes&quot; de la page{" "}
          <Link href="/decouverte" target="_blank">/decouverte</Link>.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{ flex: 1, minWidth: 280, padding: "6px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--color-bordure)" }}
          />
          <button
            type="button"
            onClick={saveVideoUrl}
            disabled={videoUrlSaving || videoUrl === videoUrlInitial}
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            {videoUrlSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
        {videoUrlStatus === "saved" && <p style={{ fontSize: 12, color: "#1baf7a", marginTop: 8 }}>Enregistré ✓</p>}
        {videoUrlStatus === "error" && <p style={{ fontSize: 12, color: "#d63e2a", marginTop: 8 }}>Échec de l&apos;enregistrement</p>}
      </section>

      <section
        style={{
          background: "var(--color-carte)",
          border: "1px solid var(--color-bordure)",
          borderRadius: 12,
          padding: "1.25rem",
          marginTop: "1rem",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Sécurité</p>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 10px", maxWidth: 520 }}>
          En cas de doute sur la sécurité d&apos;un appareil (poste partagé, ordinateur perdu ou volé...),
          déconnecte immédiatement toutes les sessions admin actives — y compris la tienne, qui te sera
          redemandée juste après.
        </p>
        <button
          type="button"
          onClick={handleRevokeAll}
          disabled={revoking}
          style={{ fontSize: 13, fontWeight: 600, color: revokeConfirming ? "white" : "#d63e2a", background: revokeConfirming ? "#d63e2a" : "var(--color-fond)", borderColor: "#d63e2a" }}
        >
          {revoking ? "Révocation..." : revokeConfirming ? "Confirmer : déconnecter tout le monde" : "Révoquer toutes les sessions"}
        </button>
        {revokeStatus === "done" && <p style={{ fontSize: 12, color: "#1baf7a", marginTop: 8 }}>Sessions révoquées — reconnexion nécessaire.</p>}
      </section>

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

export async function getStaticProps() {
  return { props: {} };
}
