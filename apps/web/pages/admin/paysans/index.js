import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../../components/AdminAuthGate";
import Pagination from "../../../components/Pagination";
import ScrollableTable from "../../../components/ScrollableTable";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";

const PAGE_SIZE = 20;
const TYPE_LABELS = { video: "Vidéo", article: "Article", podcast: "Podcast", document: "Document" };

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Petit badge pour distinguer les entrées proposées via le formulaire
// public (en attente de relecture) de celles créées directement en admin.
function PublicSubmissionBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 600,
        color: "#a86b0a",
        background: "#fdf1d6",
        borderRadius: 10,
        padding: "2px 8px",
        marginLeft: 6,
        whiteSpace: "nowrap",
      }}
      title="Proposé via le formulaire public, en attente de relecture"
    >
      Proposé par le public
    </span>
  );
}

function AdminPaysansListInner() {
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [translatingCategoryId, setTranslatingCategoryId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadAll();
  }, []);

  function loadAll() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/admin/paysan-resources`, { credentials: "include" }),
      fetch(`/api/paysan-categories`),
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

  function deleteEntry(entry) {
    if (!window.confirm("Supprimer définitivement \"" + entry.title + "\" ? Cette action est irréversible.")) return;
    fetch("/api/admin/paysan-resources/" + entry.slug, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadAll())
      .catch((err) => setError(err.message));
  }

  function togglePublished(entry) {
    fetch(`/api/admin/paysan-resources/${entry.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ published: !entry.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadAll())
      .catch((err) => setError(err.message));
  }

  function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    fetch(`/api/admin/paysan-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newCategory.trim(), slug: slugify(newCategory.trim()) }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de l'ajout");
        return res.json();
      })
      .then(() => {
        setNewCategory("");
        loadAll();
      })
      .catch((err) => setError(err.message));
  }

  function removeCategory(id) {
    fetch(`/api/admin/paysan-categories/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadAll())
      .catch((err) => setError(err.message));
  }

  function renameCategory(id) {
    if (!editingCategoryName.trim()) return;
    fetch(`/api/admin/paysan-categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: editingCategoryName.trim() }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la modification");
        return res.json();
      })
      .then(() => {
        setEditingCategoryId(null);
        loadAll();
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — On devient tous paysans</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Même jeton que pour Débunk et le relais scientifique.</p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {loaded && !error && (
        <>
          <section style={{ background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Catégories</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "0.75rem" }}>
              {categories.map((c) => (
                <span key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--color-fond)", border: "1px solid var(--color-bordure)", borderRadius: 20, padding: "3px 6px 3px 12px", fontSize: 13 }}>
                  {editingCategoryId === c.id ? (
                    <input
                      type="text"
                      value={editingCategoryName}
                      autoFocus
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameCategory(c.id);
                        if (e.key === "Escape") setEditingCategoryId(null);
                      }}
                      onBlur={() => renameCategory(c.id)}
                      style={{ fontSize: 13, border: "1px solid var(--color-bordure)", borderRadius: 4, padding: "1px 4px", width: 120 }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingCategoryId(c.id);
                        setEditingCategoryName(c.name);
                      }}
                      style={{ cursor: "pointer" }}
                      title="Cliquer pour renommer"
                    >
                      {c.name}
                    </span>
                  )}
                                    <button
                    type="button"
                    onClick={() => setTranslatingCategoryId(translatingCategoryId === c.id ? null : c.id)}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-lien)", fontSize: 13 }}
                    title="Traduire"
                  >
                    🌐
                  </button>
                  <button type="button" onClick={() => removeCategory(c.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#d63e2a", fontSize: 13 }} title="Supprimer">
                    ×
                  </button>
                </span>
              ))}
              {categories.length === 0 && <span style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune catégorie pour l&apos;instant.</span>}
            </div>
            {translatingCategoryId && (() => {
              const c = categories.find((cat) => cat.id === translatingCategoryId);
              if (!c) return null;
              return (
                <div style={{ marginBottom: "0.75rem", padding: "0.75rem", background: "var(--color-fond)", borderRadius: 8 }}>
                  <ContentTranslationsEditor
                    contentType="paysan_category"
                    contentId={c.slug}
                    fields={[{ name: "name", label: "Nom", multiline: false }]}
                    baseValues={{ name: c.name }}
                  />
                </div>
              );
            })()}
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
            <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
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
                  {entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => (
                    <tr key={e.slug}>
                      <td style={{ padding: 8 }}>
                        {e.title}
                        {e.submitted_publicly && <PublicSubmissionBadge />}
                      </td>
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
                        <button
                          type="button"
                          onClick={() => deleteEntry(e)}
                          style={{ fontSize: 12, marginLeft: 8, color: "#d63e2a" }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          )}
          {entries.length > PAGE_SIZE && (
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(entries.length / PAGE_SIZE))} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

export default function AdminPaysansList() {
  return <AdminAuthGate>{() => <AdminPaysansListInner />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
