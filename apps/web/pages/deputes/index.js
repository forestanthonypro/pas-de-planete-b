import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";

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
  const [departmentFilter, setDepartmentFilter] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof router.query.groupe === "string") setGroupFilter(router.query.groupe);
  }, [router.query.groupe]);

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
    const set = new Set(deputies.map((d) => d.group_abbreviation).filter(Boolean));
    return [...set].sort();
  }, [deputies]);

  const departments = useMemo(() => {
    const set = new Set(deputies.map((d) => d.department).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [deputies]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return deputies.filter((d) => {
      if (groupFilter && d.group_abbreviation !== groupFilter) return false;
      if (departmentFilter && d.department !== departmentFilter) return false;
      if (!q) return true;
      return normalize(d.full_name).includes(q) || normalize(d.department).includes(q);
    });
  }, [deputies, query, groupFilter, departmentFilter]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Députés — Assemblée nationale (17e législature)</h1>
      <ShareButtons title="Députés — Assemblée nationale (17e législature)" />

      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Liste des {deputies.length || "…"} députés. Informations factuelles (nom, groupe
        politique, circonscription) sans aucun jugement de valeur — à toi de te faire ton propre
        avis.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un nom, un département..."
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
        <label>
          Département{" "}
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">Tous</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
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
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Département / circo.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.acteur_uid}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                  <Link href={`/deputes/${d.acteur_uid}`}>{d.full_name}</Link>
                </th>
                <td style={{ padding: 8 }}>{d.group_abbreviation || "—"}</td>
                <td style={{ padding: 8 }}>
                  {d.department ? `${d.department}${d.circo_number ? ` (${d.circo_number}e circo.)` : ""}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 13, color: "#666", marginTop: "1.5rem" }}>
        Cette page couvre uniquement les députés en mandat lors de la{" "}
        <strong>17e législature</strong>, en cours depuis juillet 2024. Pour les législatures
        précédentes (closes), direction les archives officielles sur{" "}
        <a href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
          data.assemblee-nationale.fr
        </a>.
      </p>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : CIVIX, à partir des données open data de l&apos;Assemblée nationale (Licence
        Ouverte / Open Licence 2.0).{" "}
        <Link href="/deputes/participation">Classement de participation →</Link> ·{" "}
        <Link href="/scrutins">Voir les derniers scrutins →</Link>
      </p>
    </main>
  );
}
