import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "pdpb-admin-token";

const TYPE_LABELS = { video: "Vidéo", article: "Article", podcast: "Podcast" };

export default function AdminInterviewsList() {
  const [token, setToken] = useState("");
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function loadEntries(currentToken) {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/admin/science-relays`, {
      headers: { "x-ingest-token": currentToken },
    })
      .then((res) => {
        if (res.status === 401) throw new Error("Jeton invalide");
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((rows) => {
        setEntries(Array.isArray(rows) ? rows : []);
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
      loadEntries(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTokenSubmit(e) {
    e.preventDefault();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    loadEntries(token);
  }

  function togglePublished(entry) {
    fetch(`${API_URL}/api/admin/science-relays/${entry.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": token },
      body: JSON.stringify({ published: !entry.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadEntries(token))
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Administration — Relais scientifique</h1>
      <p style={{ fontSize: 13, color: "#666" }}>
        Réservé à la rédaction du site. Même jeton que pour Débunk et les imports de données.
      </p>

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
            <Link href="/admin/interviews/edit">+ Nouvelle entrée</Link>
          </p>
          {entries.length === 0 ? (
            <p style={{ fontSize: 13, color: "#666" }}>Aucune entrée pour l&apos;instant.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Type</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.slug}>
                    <td style={{ padding: 8 }}>{e.title}</td>
                    <td style={{ padding: 8 }}>{TYPE_LABELS[e.content_type] || e.content_type}</td>
                    <td style={{ padding: 8, fontSize: 13, color: e.published ? "#1baf7a" : "#999" }}>
                      {e.published ? "Publié" : "Brouillon"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <button type="button" onClick={() => togglePublished(e)} style={{ fontSize: 12, marginRight: 8 }}>
                        {e.published ? "Dépublier" : "Publier"}
                      </button>
                      <Link href={`/admin/interviews/edit?slug=${e.slug}`}>Modifier</Link>
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
