import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../../components/AdminAuthGate";
import Pagination from "../../../components/Pagination";
import ScrollableTable from "../../../components/ScrollableTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;

const VERDICT_LABELS = { faux: "Faux", trompeur: "Trompeur", confirme: "Confirmé" };
const VERDICT_COLORS = { faux: "#d63e2a", trompeur: "#f4b400", confirme: "#1baf7a" };

// Interface d'administration protégée par un code TOTP (Google
// Authenticator, Authy...) — voir components/AdminAuthGate.js. Une session
// valable 12h est créée après vérification du code, stockée côté serveur.
function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function AdminDebunkListInner({ session }) {
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);


  useEffect(() => {
    loadEntries(session.sessionToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function loadEntries(currentToken) {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_URL}/api/admin/debunk`, { headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) } }),
      fetch(`${API_URL}/api/debunk-categories`),
    ])
      .then(async ([resEntries, resCategories]) => {
        if (resEntries.status === 401) throw new Error("Jeton invalide");
        if (!resEntries.ok) throw new Error("Erreur de chargement");
        setEntries(await resEntries.json());
        setCategories(resCategories.ok ? await resCategories.json() : []);
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    fetch(`${API_URL}/api/admin/debunk-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({ name: newCategory.trim(), slug: slugify(newCategory.trim()) }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de l'ajout");
        return res.json();
      })
      .then(() => {
        setNewCategory("");
        loadEntries(session.sessionToken);
      })
      .catch((err) => setError(err.message));
  }

  function removeCategory(id) {
    fetch(`${API_URL}/api/admin/debunk-categories/${id}`, {
      method: "DELETE",
      headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadEntries(session.sessionToken))
      .catch((err) => setError(err.message));
  }


  function togglePublished(entry) {
    fetch(`${API_URL}/api/admin/debunk/${entry.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({ published: !entry.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadEntries(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — Débunk</h1>

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
                placeholder="Nouvelle catégorie (ex : Climat, Énergie...)"
                style={{ flex: 1, padding: "6px 10px" }}
              />
              <button type="submit">Ajouter</button>
            </form>
          </section>

          <p style={{ marginBottom: "0.75rem" }}>
            <Link href="/admin/debunk/edit">+ Nouvelle entrée</Link>
          </p>
          {entries.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune entrée pour l&apos;instant.</p>
          ) : (
            <ScrollableTable>
<table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Catégorie</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Verdict</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => (
                  <tr key={e.slug}>
                    <td style={{ padding: 8 }}>{e.myth}</td>
                    <td style={{ padding: 8 }}>{e.category_name || "—"}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ background: VERDICT_COLORS[e.verdict] || "var(--color-texte-clair)", color: e.verdict === "trompeur" ? "var(--color-texte)" : "white", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>
                        {(VERDICT_LABELS[e.verdict] || e.verdict).toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: 8, fontSize: 13, color: e.published ? "#1baf7a" : "var(--color-texte-clair)" }}>
                      {e.published ? "Publié" : "Brouillon"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <button type="button" onClick={() => togglePublished(e)} style={{ fontSize: 12, marginRight: 8 }}>
                        {e.published ? "Dépublier" : "Publier"}
                      </button>
                      <Link href={`/admin/debunk/edit?slug=${e.slug}`}>Modifier</Link>
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

export default function AdminDebunkList() {
  return <AdminAuthGate>{(session) => <AdminDebunkListInner session={session} />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
