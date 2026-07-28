import { useEffect, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function DebunkPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/debunk`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      })
      .then((rows) => {
        setEntries(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Débunk</h1>
      <ShareButtons title="Débunk — Pas de planète B" />
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Des idées reçues qui circulent sur le climat et l&apos;environnement, démontées avec des
        sources vérifiables — jamais l&apos;inverse. Chaque entrée cite au moins une source
        primaire ; si une affirmation ne peut pas être solidement sourcée, elle n&apos;apparaît
        pas ici.
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p>Aucune entrée publiée pour l&apos;instant — cette rubrique est en cours de construction.</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {entries.map((e) => (
            <li key={e.slug} style={{ borderBottom: "1px solid #eee", padding: "0.75rem 0" }}>
              <Link href={`/debunk/${e.slug}`} style={{ fontSize: 16 }}>
                {e.myth}
              </Link>
              {e.category && <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>({e.category})</span>}
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        <Link href="/">Retour à l&apos;accueil →</Link>
      </p>
    </main>
  );
}
