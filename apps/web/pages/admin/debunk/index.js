import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "pdpb-admin-token";

const VERDICT_LABELS = { faux: "Faux", trompeur: "Trompeur", confirme: "Confirmé" };
const VERDICT_COLORS = { faux: "#d63e2a", trompeur: "#f4b400", confirme: "#1baf7a" };

// Interface d'administration minimale — pas de vrai système de comptes,
// juste le même jeton partagé que les routes d'ingestion (cohérent avec le
// reste du projet). Le jeton est saisi une fois puis mémorisé dans le
// navigateur (localStorage) pour ne pas avoir à le retaper à chaque visite.
// Ce n'est pas une vraie authentification sécurisée — à ne pas exposer
// publiquement sans réflexion plus poussée sur les accès.
export default function AdminDebunkList() {
  const [token, setToken] = useState("");
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      setToken(stored);
      loadEntries(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadEntries(currentToken) {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/admin/debunk`, {
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

  function handleTokenSubmit(e) {
    e.preventDefault();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    loadEntries(token);
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Administration — Débunk</h1>
      <p style={{ fontSize: 13, color: "#666" }}>
        Réservé à la rédaction du site. Colle le jeton d&apos;ingestion (le même que pour les
        imports de données, disponible dans <code>apps/api/.env</code>).
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
            <Link href="/admin/debunk/edit">+ Nouvelle entrée</Link>
          </p>
          {entries.length === 0 ? (
            <p style={{ fontSize: 13, color: "#666" }}>Aucune entrée pour l&apos;instant.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Verdict</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.slug}>
                    <td style={{ padding: 8 }}>{e.myth}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ background: VERDICT_COLORS[e.verdict] || "#999", color: e.verdict === "trompeur" ? "#1b1f23" : "white", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>
                        {(VERDICT_LABELS[e.verdict] || e.verdict).toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: 8, fontSize: 13, color: e.published ? "#1baf7a" : "#999" }}>
                      {e.published ? "Publié" : "Brouillon"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <Link href={`/admin/debunk/edit?slug=${e.slug}`}>Modifier</Link>
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
