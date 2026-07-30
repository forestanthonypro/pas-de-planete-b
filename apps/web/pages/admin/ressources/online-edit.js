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

export default function AdminOnlineResourceEdit() {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);

  const [token, setToken] = useState("");
  const [categories, setCategories] = useState([]);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [published, setPublished] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/resource-categories`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [token]);

  useEffect(() => {
    if (!editSlug || !token) return;
    setLoading(true);
    fetch(`${API_URL}/api/admin/resource-online/${editSlug}`, {
      headers: { "x-ingest-token": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Entrée non trouvée");
        return res.json();
      })
      .then((data) => {
        setSlug(data.slug);
        setSlugTouched(true);
        setTitle(data.title);
        setDescription(data.description);
        setUrl(data.url);
        setCategoryId(data.category_id || "");
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

    fetch(`${API_URL}/api/admin/resource-online`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": token },
      body: JSON.stringify({ slug, title, description, url, categoryId: categoryId || null, published }),
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
        <p>Ressource enregistrée.</p>
        <p>
          <Link href="/admin/ressources">← Retour à la liste</Link> ·{" "}
          <Link href="/ressources">Voir la page publique →</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin/ressources">← Retour à la liste</Link>
      </p>
      <h1>{isEditing ? "Modifier la ressource" : "Nouvelle ressource en ligne"}</h1>

      {!token && (
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
          Aucun jeton mémorisé — retourne d&apos;abord sur{" "}
          <Link href="/admin/ressources">la liste</Link> pour te connecter.
        </p>
      )}

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre</span>
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
            style={{ width: "100%", padding: "8px 10px", background: isEditing ? "#f0f0f0" : "white" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</span>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>URL</span>
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Catégorie</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
