import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "pdpb-admin-token";

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminFutureIdeaEdit() {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);

  const [token, setToken] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!editSlug || !token) return;
    setLoading(true);
    fetch(`${API_URL}/api/admin/future-ideas/${editSlug}`, { headers: { "x-ingest-token": token } })
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
  }, [editSlug, token]);

  function handleTitleChange(value) {
    setTitle(value);
    if (!isEditing && !slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);

    fetch(`${API_URL}/api/admin/future-ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": token },
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

      {!token && (
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
          Aucun jeton mémorisé — retourne d&apos;abord sur{" "}
          <Link href="/admin/idees-enfants">la liste</Link> pour te connecter.
        </p>
      )}

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

        <button type="submit" disabled={status === "saving" || !token}>
          {status === "saving" ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
