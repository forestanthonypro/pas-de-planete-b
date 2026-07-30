import { useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../components/AdminAuthGate";
import Pagination from "../../components/Pagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;

function AdminFutureIdeasListInner({ session }) {
  const [ideas, setIdeas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    loadIdeas(session.sessionToken);
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadSuggestions() {
    fetch(`${API_URL}/api/admin/future-idea-suggestions`, { headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) } })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setSuggestions(Array.isArray(rows) ? rows : []))
      .catch(() => setSuggestions([]));
  }

  function updateSuggestionStatus(id, status) {
    fetch(`${API_URL}/api/admin/future-idea-suggestions/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadSuggestions())
      .catch((err) => setError(err.message));
  }


  function loadIdeas(currentToken) {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/admin/future-ideas`, { headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) } })
      .then((res) => {
        if (res.status === 401) throw new Error("Jeton invalide");
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((rows) => {
        setIdeas(Array.isArray(rows) ? rows : []);
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }



  function togglePublished(idea) {
    fetch(`${API_URL}/api/admin/future-ideas/${idea.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({ published: !idea.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadIdeas(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  function removeIdea(slug) {
    fetch(`${API_URL}/api/admin/future-ideas/${slug}`, {
      method: "DELETE",
      headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadIdeas(session.sessionToken))
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — Les enfants d&apos;aujourd&apos;hui et de demain</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Protégé par code d&apos;authentification à 6 chiffres.</p>


      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {loaded && !error && (
        <>
          <p style={{ marginBottom: "0.75rem" }}>
            <Link href="/admin/idees-enfants/edit">+ Nouvelle idée</Link>
          </p>
          {ideas.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune idée pour l&apos;instant.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                  <th scope="col" style={{ textAlign: "right", padding: 8 }}>Soutiens</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {ideas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((idea) => (
                  <tr key={idea.slug}>
                    <td style={{ padding: 8 }}>{idea.title}</td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{idea.support_count}</td>
                    <td style={{ padding: 8, fontSize: 13, color: idea.published ? "#1baf7a" : "var(--color-texte-clair)" }}>
                      {idea.published ? "Publiée" : "Brouillon"}
                    </td>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => togglePublished(idea)} style={{ fontSize: 12, marginRight: 8 }}>
                        {idea.published ? "Dépublier" : "Publier"}
                      </button>
                      <Link href={`/admin/idees-enfants/edit?slug=${idea.slug}`} style={{ marginRight: 8 }}>Modifier</Link>
                      <button type="button" onClick={() => removeIdea(idea.slug)} style={{ fontSize: 12, color: "#d63e2a" }}>Suppr.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {ideas.length > PAGE_SIZE && (
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(ideas.length / PAGE_SIZE))} onChange={setPage} />
          )}
        </>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: 16 }}>Boîte à idées — modération</h2>
        {suggestions.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune suggestion pour l&apos;instant.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  <td style={{ padding: 8, fontSize: 13 }}>
                    {{ pending: "En attente", published: "Publiée", draft: "Brouillon", rejected: "Rejetée" }[s.status] || s.status}
                  </td>
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
        )}
      </section>
    </div>
  );
}

export default function AdminFutureIdeasList() {
  return <AdminAuthGate>{(session) => <AdminFutureIdeasListInner session={session} />}</AdminAuthGate>;
}
