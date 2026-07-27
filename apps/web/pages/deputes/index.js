import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Retire les accents pour une recherche insensible aux accents, cohérent avec
// le sélecteur de pays utilisé ailleurs dans l'app.
function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function DeputesPage() {
  const [deputies, setDeputies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/deputies`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      })
      .then((rows) => {
        setDeputies(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const groups = useMemo(() => {
    const set = new Set(deputies.map((d) => d.group_acronym).filter(Boolean));
    return [...set].sort();
  }, [deputies]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return deputies.filter((d) => {
      if (groupFilter && d.group_acronym !== groupFilter) return false;
      if (!q) return true;
      return (
        normalize(d.full_name).includes(q) ||
        normalize(d.circo_name).includes(q) ||
        normalize(d.department).includes(q)
      );
    });
  }, [deputies, query, groupFilter]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Députés — Assemblée nationale (17e législature)</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Liste des {deputies.length || "…"} députés actuellement en mandat. Cette page présente des
        informations factuelles (nom, groupe politique, circonscription) sans aucun jugement de
        valeur — à toi de te faire ton propre avis.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un nom, une circonscription..."
          style={{ padding: "6px 10px", minWidth: 260 }}
        />
        <label>
          Groupe{" "}
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Tous</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}
      {!loading && !error && filtered.length === 0 && <p>Aucun député trouvé pour ce filtre.</p>}

      {!loading && !error && filtered.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Nom</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Circonscription</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.slug}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                  <Link href={`/deputes/${d.slug}`}>{d.full_name}</Link>
                </th>
                <td style={{ padding: 8 }}>{d.group_acronym || "—"}</td>
                <td style={{ padding: 8 }}>
                  {d.circo_name ? `${d.circo_name}${d.circo_number ? ` (${d.circo_number}e circo.)` : ""}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : NosDéputés.fr (Regards Citoyens), à partir des données de l&apos;Assemblée
        nationale et du Journal Officiel (CC-BY-SA / ODbL).{" "}
        <Link href="/scrutins">Voir les derniers scrutins →</Link>
      </p>
    </main>
  );
}
