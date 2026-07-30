import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "pdpb-admin-token";

export default function AdminFutureIdeasList() {
  const [token, setToken] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function loadIdeas(currentToken) {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/admin/future-ideas`, { headers: { "x-ingest-token": currentToken } })
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

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      setToken(stored);
      loadIdeas(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTokenSubmit(e) {
    e.preventDefault();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    loadIdeas(token);
  }

  function togglePublished(idea) {
    fetch(`${API_URL}/api/admin/future-ideas/${idea.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": token },
      body: JSON.stringify({ published: !idea.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadIdeas(token))
      .catch((err) => setError(err.message));
  }

  function removeIdea(slug) {
    fetch(`${API_URL}/api/admin/future-ideas/${slug}`, {
      method: "DELETE",
      headers: { "x-ingest-token": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadIdeas(token))
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — Les enfants d&apos;aujourd&apos;hui et de demain</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Même jeton que pour les autres rubriques éditoriales.</p>

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
                {ideas.map((idea) => (
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
        </>
      )}
    </div>
  );
}
