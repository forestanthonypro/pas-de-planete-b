import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ParticipationPage() {
  const [deputies, setDeputies] = useState([]);
  const [minVotes, setMinVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/deputies/participation`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      })
      .then((data) => {
        setDeputies(data.deputies || []);
        setMinVotes(data.minVotes || 0);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const withRate = useMemo(
    () =>
      deputies.map((d) => ({
        ...d,
        rate: Math.round((parseInt(d.active_votes, 10) / parseInt(d.total_votes, 10)) * 1000) / 10,
      })),
    [deputies]
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return withRate;
    return withRate.filter((d) => normalize(d.full_name).includes(q) || normalize(d.group_abbreviation).includes(q));
  }, [withRate, query]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Participation aux votes — par député</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Sur la fenêtre de scrutins où on a le détail nominatif (pas l&apos;historique complet de
        la législature), part des scrutins où chaque député a exprimé un vote (pour, contre ou
        abstention) plutôt que d&apos;être absent. Limité aux députés avec au moins{" "}
        <strong>{minVotes}</strong> scrutins dans cette fenêtre, pour éviter qu&apos;un trop petit
        échantillon fausse le classement.
      </p>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Une absence peut avoir de multiples raisons (mission gouvernementale, maladie, autre
        engagement parlementaire en commission au même moment...) — ce chiffre ne dit rien sur la
        qualité du travail parlementaire d&apos;un député, seulement sa présence lors des votes en
        hémicycle sur cette période.
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un nom ou un groupe..."
        style={{ padding: "6px 10px", minWidth: 260, marginBottom: "1rem" }}
      />

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}
      {!loading && !error && filtered.length === 0 && <p>Aucun député trouvé pour ce filtre.</p>}

      {!loading && !error && filtered.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Député</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Scrutins observés</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Taux de participation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.acteur_uid}>
                <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                  <Link href={`/deputes/${d.acteur_uid}`}>{d.full_name}</Link>
                </th>
                <td style={{ padding: 8 }}>{d.group_abbreviation || "—"}</td>
                <td style={{ textAlign: "right", padding: 8 }}>{d.total_votes}</td>
                <td style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>{d.rate} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : Assemblée nationale (open data officiel) (Licence Ouverte / Open Licence 2.0).{" "}
        <Link href="/deputes">Voir la liste des députés →</Link>
      </p>
    </main>
  );
}
