import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../../components/AdminAuthGate";
import Pagination from "../../../components/Pagination";
import ScrollableTable from "../../../components/ScrollableTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

function AdminRessourcesListInner({ session }) {
  const [locations, setLocations] = useState([]);
  const [online, setOnline] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationsPage, setLocationsPage] = useState(1);
  const [onlinePage, setOnlinePage] = useState(1);

  useEffect(() => {
    loadAll(session.sessionToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadAll(currentToken) {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_URL}/api/admin/resource-locations`, { headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) } }),
      fetch(`${API_URL}/api/admin/resource-online`, { headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) } }),
      fetch(`${API_URL}/api/resource-categories`),
    ])
      .then(async ([resLocations, resOnline, resCategories]) => {
        if (resLocations.status === 401) throw new Error("Jeton invalide");
        if (!resLocations.ok || !resOnline.ok) throw new Error("Erreur de chargement");
        setLocations(await resLocations.json());
        setOnline(await resOnline.json());
        setCategories(resCategories.ok ? await resCategories.json() : []);
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  function deleteLocation(entry) {
    if (!window.confirm("Supprimer définitivement le lieu \"" + entry.name + "\" ? Cette action est irréversible.")) return;
    fetch(API_URL + "/api/admin/resource-locations/" + entry.slug, {
      method: "DELETE",
      headers: { ...(session ? { Authorization: "Bearer " + session.sessionToken } : {}) },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadAll(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  function toggleLocationPublished(entry) {
    fetch(`${API_URL}/api/admin/resource-locations/${entry.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({ published: !entry.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadAll(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  function deleteOnline(entry) {
    if (!window.confirm("Supprimer définitivement \"" + entry.title + "\" ? Cette action est irréversible.")) return;
    fetch(API_URL + "/api/admin/resource-online/" + entry.slug, {
      method: "DELETE",
      headers: { ...(session ? { Authorization: "Bearer " + session.sessionToken } : {}) },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadAll(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  function toggleOnlinePublished(entry) {
    fetch(`${API_URL}/api/admin/resource-online/${entry.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({ published: !entry.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadAll(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    fetch(`${API_URL}/api/admin/resource-categories`, {
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
        loadAll(session.sessionToken);
      })
      .catch((err) => setError(err.message));
  }

  function removeCategory(id) {
    fetch(`${API_URL}/api/admin/resource-categories/${id}`, {
      method: "DELETE",
      headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadAll(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — Ressources</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Même jeton que pour les autres rubriques éditoriales.</p>

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
                placeholder="Nouvelle catégorie (ex : Jardin partagé, AMAP...)"
                style={{ flex: 1, padding: "6px 10px" }}
              />
              <button type="submit">Ajouter</button>
            </form>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Lieux (carte)</h2>
              <Link href="/admin/ressources/location-edit">+ Nouveau lieu</Link>
            </div>
            {locations.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucun lieu pour l&apos;instant.</p>
            ) : (
              <ScrollableTable>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Nom</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Catégorie</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.slice((locationsPage - 1) * PAGE_SIZE, locationsPage * PAGE_SIZE).map((l) => (
                      <tr key={l.slug}>
                        <td style={{ padding: 8 }}>
                          {l.name}
                          {l.submitted_publicly && <PublicSubmissionBadge />}
                        </td>
                        <td style={{ padding: 8 }}>{l.category_name || "—"}</td>
                        <td style={{ padding: 8, fontSize: 13, color: l.published ? "#1baf7a" : l.submitted_publicly ? "#8a6d00" : "var(--color-texte-clair)" }}>
                          {l.published ? "Publié" : l.submitted_publicly ? "⏳ Proposition à examiner" : "Brouillon"}
                        </td>
                        <td style={{ padding: 8 }}>
                          <button type="button" onClick={() => toggleLocationPublished(l)} style={{ fontSize: 12, marginRight: 8 }}>
                            {l.published ? "Dépublier" : "Publier"}
                          </button>
                          <Link href={`/admin/ressources/location-edit?slug=${l.slug}`}>Modifier</Link>
                          <button
                            type="button"
                            onClick={() => deleteLocation(l)}
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
            {locations.length > PAGE_SIZE && (
              <Pagination page={locationsPage} totalPages={Math.max(1, Math.ceil(locations.length / PAGE_SIZE))} onChange={setLocationsPage} />
            )}
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>En ligne</h2>
              <Link href="/admin/ressources/online-edit">+ Nouvelle ressource</Link>
            </div>
            {online.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune ressource en ligne pour l&apos;instant.</p>
            ) : (
              <ScrollableTable>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {online.slice((onlinePage - 1) * PAGE_SIZE, onlinePage * PAGE_SIZE).map((o) => (
                      <tr key={o.slug}>
                        <td style={{ padding: 8 }}>
                          {o.title}
                          {o.submitted_publicly && <PublicSubmissionBadge />}
                        </td>
                        <td style={{ padding: 8, fontSize: 13, color: o.published ? "#1baf7a" : o.submitted_publicly ? "#8a6d00" : "var(--color-texte-clair)" }}>
                          {o.published ? "Publié" : o.submitted_publicly ? "⏳ Proposition à examiner" : "Brouillon"}
                        </td>
                        <td style={{ padding: 8 }}>
                          <button type="button" onClick={() => toggleOnlinePublished(o)} style={{ fontSize: 12, marginRight: 8 }}>
                            {o.published ? "Dépublier" : "Publier"}
                          </button>
                          <Link href={`/admin/ressources/online-edit?slug=${o.slug}`}>Modifier</Link>
                          <button
                            type="button"
                            onClick={() => deleteOnline(o)}
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
            {online.length > PAGE_SIZE && (
              <Pagination page={onlinePage} totalPages={Math.max(1, Math.ceil(online.length / PAGE_SIZE))} onChange={setOnlinePage} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function AdminRessourcesList() {
  return <AdminAuthGate>{(session) => <AdminRessourcesListInner session={session} />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
