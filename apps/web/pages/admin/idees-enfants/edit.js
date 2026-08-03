import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TRANSLATION_FIELDS = [
  { name: "title", label: "Titre de l'idée", multiline: false },
  { name: "description", label: "Description", multiline: true },
];

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function AdminFutureIdeaEditInner({ session }) {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!editSlug) return;
    setLoading(true);
    fetch(`${API_URL}/api/admin/future-ideas/${editSlug}`, { headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) } })
      .then((res) => {
        if (!res.ok) throw new Error("Idée non trouvée");
        return res.json();
      })
      .then((data) => {
        setSlug(data.slug);
        setSlugTouched(true);
        setTitle(data.title);
        setDescription(data.description || "");
        setPublished(data.published);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [editSlug, session]);

  function handleTitleChange(value) {
    setTitle(value);
    if (!isEditing && !slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    fetch(`${API_URL}/api/admin/future-ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({ slug, title, description: description || null, published }),
    })
      .then((res) => {
        if (res.status === 401) throw new Error("Jeton invalide");
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
      <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
        <p>Idée enregistrée.</p>
        <p>
          <Link href="/admin/idees-enfants">← Retour à la liste</Link> ·{" "}
          <Link href="/idees-enfants">Voir la page publique →</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin/idees-enfants">← Retour à la liste</Link>
      </p>
      <h1>{isEditing ? "Modifier l'idée" : "Nouvelle idée"}</h1>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre de l&apos;idée</span>
          <input type="text" required value={title} onChange={(e) => handleTitleChange(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Identifiant (slug) — non modifiable après création
          </span>
          <input
            type="text"
            required
            value={slug}
            disabled={isEditing}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            style={{ width: "100%", padding: "8px 10px", background: isEditing ? "var(--color-carte)" : "var(--color-fond)" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description (optionnel)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: 14 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publier (visible sur la page publique)
        </label>

        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      <ContentTranslationsEditor
        contentType="future_idea"
        contentId={isEditing ? slug : null}
        fields={TRANSLATION_FIELDS}
        baseValues={{ title, description }}
        sessionToken={session.sessionToken}
      />
    </div>
  );
}

export default function AdminFutureIdeaEdit() {
  return <AdminAuthGate>{(session) => <AdminFutureIdeaEditInner session={session} />}</AdminAuthGate>;
}

export async function getServerSideProps() {
  return { props: {} };
}
