import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const POSITION_LABELS = {
  pour: { label: "Pour", color: "#1baf7a" },
  contre: { label: "Contre", color: "#d63e2a" },
  abstention: { label: "Abstention", color: "#f4b400" },
  absent: { label: "Absent / non-votant", color: "#95a5a6" },
  "non-votant": { label: "Absent / non-votant", color: "#95a5a6" },
};

export default function ScrutinPage() {
  const router = useRouter();
  const { legislature, numero } = router.query;
  const [scrutin, setScrutin] = useState(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupFilter, setGroupFilter] = useState("");

  useEffect(() => {
    if (!legislature || !numero) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/scrutins/${legislature}/${numero}`)
      .then((res) => {
        if (!res.ok) throw new Error("Scrutin non trouvé");
        return res.json();
      })
      .then((data) => {
        setScrutin(data.scrutin);
        setVotes(data.votes || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [legislature, numero]);

  const groups = [...new Set(votes.map((v) => v.group_abbreviation).filter(Boolean))].sort();
  const filteredVotes = groupFilter ? votes.filter((v) => v.group_abbreviation === groupFilter) : votes;
  const tally = votes.reduce((acc, v) => {
    acc[v.position] = (acc[v.position] || 0) + 1;
    return acc;
  }, {});

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/scrutins">← Retour à la liste des scrutins</Link>
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && scrutin && (
        <>
          <h1>{scrutin.title || scrutin.objet || `Scrutin n°${scrutin.numero}`}</h1>
          <p style={{ color: "#666" }}>
            {scrutin.scrutin_date && (
              <>Voté le {new Date(scrutin.scrutin_date).toLocaleDateString("fr-FR")} — </>
            )}
            {scrutin.type_vote_label && <>{scrutin.type_vote_label} — </>}
            Résultat : <strong>{scrutin.result_label || scrutin.result_code || "—"}</strong>
          </p>

          {votes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#666" }}>
              Le détail nominatif des votes n&apos;est pas disponible pour ce scrutin (le jeu de
              données public utilisé ne couvre qu&apos;un sous-ensemble des scrutins — voir{" "}
              <Link href="/scrutins">la liste des scrutins</Link>).
            </p>
          ) : (
            <>
              <p style={{ fontSize: 14 }}>
                {Object.entries(tally)
                  .map(([pos, count]) => `${POSITION_LABELS[pos]?.label || pos} : ${count}`)
                  .join(" · ")}
              </p>
              <label style={{ display: "block", marginTop: "1rem", marginBottom: "0.5rem" }}>
                Filtrer par groupe{" "}
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                  <option value="">Tous</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Député</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Groupe</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVotes.map((v) => (
                    <tr key={v.acteur_uid}>
                      <th scope="row" style={{ textAlign: "left", padding: 8, fontWeight: 400 }}>
                        <Link href={`/deputes/${v.acteur_uid}`}>{v.full_name}</Link>
                      </th>
                      <td style={{ padding: 8 }}>{v.group_abbreviation || "—"}</td>
                      <td style={{ padding: 8, color: POSITION_LABELS[v.position]?.color || "#333", fontWeight: 600 }}>
                        {POSITION_LABELS[v.position]?.label || v.position}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
            Source : CIVIX, à partir des données open data de l&apos;Assemblée nationale (Licence
            Ouverte / Open Licence 2.0).
          </p>
        </>
      )}
    </main>
  );
}
