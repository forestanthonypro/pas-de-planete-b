import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "pdpb-admin-token";
const TYPE_LABELS = { video: "Vidéo", article: "Article", podcast: "Podcast", document: "Document" };

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminPaysansList() {
  const [token, setToken] = useState("");
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function loadAll(currentToken) {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_URL}/api/admin/paysan-resources`, { headers: { "x-ingest-token": currentToken } }),
      fetch(`${API_URL}/api/paysan-categories`),
    ])
      .then(async ([resResources, resCategories]) => {
        if (resResources.status === 401) throw new Error("Jeton invalide");
        if (!resResources.ok) throw new Error("Erreur de chargement");
        setEntries(await resResources.json());
        setCategories(resCategories.ok ? await resCategories.json() : []);
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      setToken(stored);
      loadAll(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTokenSubmit(e) {
    e.preventDefault();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    loadAll(token);
  }

  function togglePublished(entry) {
    fetch(`${API_URL}/api/admin/paysan-resources/${entry.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": token },
      body: JSON.stringify({ published: !entry.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadAll(token))
      .catch((err) => setError(err.message));
  }

  function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    fetch(`${API_URL}/api/admin/paysan-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": token },
      body: JSON.stringify({ name: newCategory.trim(), slug: slugify(newCategory.trim()) }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de l'ajout");
        return res.json();
      })
      .then(() => {
        setNewCategory("");
        loadAll(token);
      })
      .catch((err) => setError(err.message));
  }

  function removeCategory(id) {
    fetch(`${API_URL}/api/admin/paysan-categories/${id}`, {
      method: "DELETE",
      headers: { "x-ingest-token": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadAll(token))
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — On devient tous paysans</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Même jeton que pour Débunk et le relais scientifique.</p>

      <form onSubmit={handleTokenSubmit} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Jeton d'administration"
          style={{ padding: "6px 10px", flex: 1 }}
        />
        <button type="submit">Se connecter</button>
      </form>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {loaded && !error && (
        <>
          <section style={{ background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Catégories</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "0.75rem" }}>
              {categories.map((c) => (
                <span key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--color-fond)", border: "1px solid var(--color-bordure)", borderRadius: 20, padding: "3px 6px 3px 12px", fontSize: 13 }}>
                  {c.name}
                  <button type="button" onClick={() => removeCategory(c.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#d63e2a", fontSize: 13 }} title="Supprimer">
                    ×
                  </button>
                </span>
              ))}
              {categories.length === 0 && <span style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune catégorie pour l&apos;instant.</span>}
            </div>
            <form onSubmit={addCategory} style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nouvelle catégorie (ex : Potager, Compostage...)"
                style={{ flex: 1, padding: "6px 10px" }}
              />
              <button type="submit">Ajouter</button>
            </form>
          </section>

          <p style={{ marginBottom: "0.75rem" }}>
            <Link href="/admin/paysans/edit">+ Nouvelle ressource</Link>
          </p>
          {entries.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune ressource pour l&apos;instant.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Type</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Catégorie</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.slug}>
                    <td style={{ padding: 8 }}>{e.title}</td>
                    <td style={{ padding: 8 }}>{TYPE_LABELS[e.content_type] || e.content_type}</td>
                    <td style={{ padding: 8 }}>{e.category_name || "—"}</td>
                    <td style={{ padding: 8, fontSize: 13, color: e.published ? "#1baf7a" : "var(--color-texte-clair)" }}>
                      {e.published ? "Publié" : "Brouillon"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <button type="button" onClick={() => togglePublished(e)} style={{ fontSize: 12, marginRight: 8 }}>
                        {e.published ? "Dépublier" : "Publier"}
                      </button>
                      <Link href={`/admin/paysans/edit?slug=${e.slug}`}>Modifier</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
