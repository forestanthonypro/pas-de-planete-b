import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ScrollableTable from "../../../components/ScrollableTable";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";


const STATUS_LABELS = { pending: "En attente", published: "Publiée", draft: "Brouillon", rejected: "Rejetée" };

const SECTION_TRANSLATION_FIELDS = [{ name: "name", label: "Nom de la section", multiline: false }];

function AdminCharterPageInner() {
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSectionId, setExpandedSectionId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  function loadAll() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/admin/charter-sections`, { credentials: "include" }),
      fetch(`/api/admin/charter-items`, { credentials: "include" }),
      fetch(`/api/admin/charter-suggestions`, { credentials: "include" }),
    ])
      .then(async ([resSections, resItems, resSuggestions]) => {
        if (resSections.status === 401) throw new Error("Jeton invalide");
        if (!resSections.ok || !resItems.ok || !resSuggestions.ok) throw new Error("Erreur de chargement");
        setSections(await resSections.json());
        setItems(await resItems.json());
        setSuggestions(await resSuggestions.json());
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  function addSection(e) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    fetch(`/api/admin/charter-sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newSectionName.trim() }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de l'ajout");
        return res.json();
      })
      .then(() => {
        setNewSectionName("");
        loadAll();
      })
      .catch((err) => setError(err.message));
  }

  function moveSection(id, direction) {
    fetch(`/api/admin/charter-sections/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ direction }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec du déplacement");
        return res.json();
      })
      .then(() => loadAll())
      .catch((err) => setError(err.message));
  }

  function removeSection(id) {
    fetch(`/api/admin/charter-sections/${id}`, {
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

  function moveItem(id, direction) {
    fetch(`/api/admin/charter-items/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ direction }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec du déplacement");
        return res.json();
      })
      .then(() => loadAll())
      .catch((err) => setError(err.message));
  }

  function toggleItemPublished(item) {
    fetch(`/api/admin/charter-items/${item.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ published: !item.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadAll())
      .catch((err) => setError(err.message));
  }

  function removeItem(id) {
    fetch(`/api/admin/charter-items/${id}`, {
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

  function updateSuggestionStatus(id, status) {
    fetch(`/api/admin/charter-suggestions/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadAll())
      .catch((err) => setError(err.message));
  }

  const itemsBySection = {};
  for (const item of items) {
    if (!itemsBySection[item.section_id]) itemsBySection[item.section_id] = [];
    itemsBySection[item.section_id].push(item);
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — Charte éthique</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Même jeton que pour les autres rubriques éditoriales.</p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {loaded && !error && (
        <>
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: 16 }}>Sections</h2>
            {sections.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune section pour l&apos;instant.</p>
            ) : (
              sections.map((s, i) => (
                <div key={s.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-bordure)" }}>
                    <button type="button" onClick={() => moveSection(s.id, "up")} disabled={i === 0} style={{ fontSize: 12 }}>↑</button>
                    <button type="button" onClick={() => moveSection(s.id, "down")} disabled={i === sections.length - 1} style={{ fontSize: 12 }}>↓</button>
                    <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
                    <button
                      type="button"
                      onClick={() => setExpandedSectionId(expandedSectionId === s.id ? null : s.id)}
                      style={{ fontSize: 12 }}
                    >
                      {expandedSectionId === s.id ? "Masquer traductions" : "Traductions"}
                    </button>
                    <Link href={`/admin/charte/item-edit?sectionId=${s.id}`} style={{ fontSize: 13 }}>+ Élément</Link>
                    <button type="button" onClick={() => removeSection(s.id)} style={{ fontSize: 12, color: "#d63e2a" }}>Supprimer</button>
                  </div>
                  {expandedSectionId === s.id && (
                    <ContentTranslationsEditor
                      contentType="charter_section"
                      contentId={String(s.id)}
                      fields={SECTION_TRANSLATION_FIELDS}
                      baseValues={{ name: s.name }}
                    />
                  )}
                </div>
              ))
            )}
            <form onSubmit={addSection} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Nouvelle section (ex : Éducation, Environnement...)"
                style={{ flex: 1, padding: "6px 10px" }}
              />
              <button type="submit">Ajouter</button>
            </form>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: 16 }}>Éléments</h2>
            {sections.length === 0 && <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Crée d&apos;abord une section.</p>}
            {sections.map((s) => (
              <div key={s.id} style={{ marginBottom: "1rem" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-texte-clair)", margin: "0.5rem 0 4px" }}>{s.name}</p>
                {(itemsBySection[s.id] || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucun élément dans cette section.</p>
                ) : (
                  (itemsBySection[s.id] || []).map((item, i) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-bordure)" }}>
                      <button type="button" onClick={() => moveItem(item.id, "up")} disabled={i === 0} style={{ fontSize: 12 }}>↑</button>
                      <button type="button" onClick={() => moveItem(item.id, "down")} disabled={i === itemsBySection[s.id].length - 1} style={{ fontSize: 12 }}>↓</button>
                      <span style={{ flex: 1 }}>{item.title}</span>
                      <span style={{ fontSize: 12, color: item.published ? "#1baf7a" : "var(--color-texte-clair)" }}>
                        {item.published ? "Publié" : "Brouillon"}
                      </span>
                      <button type="button" onClick={() => toggleItemPublished(item)} style={{ fontSize: 12 }}>
                        {item.published ? "Dépublier" : "Publier"}
                      </button>
                      <Link href={`/admin/charte/item-edit?id=${item.id}`} style={{ fontSize: 12 }}>Modifier</Link>
                      <button type="button" onClick={() => removeItem(item.id)} style={{ fontSize: 12, color: "#d63e2a" }}>Suppr.</button>
                    </div>
                  ))
                )}
              </div>
            ))}
          </section>

          <section>
            <h2 style={{ fontSize: 16 }}>Boîte à idées — modération</h2>
            {suggestions.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune suggestion pour l&apos;instant.</p>
            ) : (
              <ScrollableTable>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Texte</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => (
                      <tr key={s.id}>
                        <td style={{ padding: 8, fontSize: 13 }}>{s.text}</td>
                        <td style={{ padding: 8, fontSize: 13 }}>{STATUS_LABELS[s.status] || s.status}</td>
                        <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                          <select
                            value={s.status}
                            onChange={(e) => updateSuggestionStatus(s.id, e.target.value)}
                            style={{ fontSize: 12, padding: "4px 6px" }}
                          >
                            <option value="pending">En attente</option>
                            <option value="published">Publiée</option>
                            <option value="draft">Brouillon</option>
                            <option value="rejected">Rejetée</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function AdminCharterPage() {
  return <AdminAuthGate>{() => <AdminCharterPageInner />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
