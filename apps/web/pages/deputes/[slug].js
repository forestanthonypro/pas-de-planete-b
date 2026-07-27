import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const POSITION_LABELS = {
  pour: { label: "Pour", color: "#1baf7a" },
  contre: { label: "Contre", color: "#d63e2a" },
  abstention: { label: "Abstention", color: "#f4b400" },
  absent: { label: "Absent / non-votant", color: "#95a5a6" },
};

export default function DeputyPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [deputy, setDeputy] = useState(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/deputies/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Député non trouvé");
        return res.json();
      })
      .then((data) => {
        setDeputy(data.deputy);
        setVotes(data.votes || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  const tally = votes.reduce(
    (acc, v) => {
      acc[v.position] = (acc[v.position] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/deputes">← Retour à la liste des députés</Link>
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && deputy && (
        <>
          <h1>{deputy.full_name}</h1>
          <p style={{ color: "#666" }}>
            {deputy.group_acronym && <>Groupe : <strong>{deputy.group_acronym}</strong> — </>}
            {deputy.circo_name && <>{deputy.circo_name}{deputy.circo_number ? ` (${deputy.circo_number}e circonscription)` : ""}</>}
          </p>
          {deputy.profession && (
            <p style={{ fontSize: 13, color: "#666" }}>Profession déclarée : {deputy.profession}</p>
          )}

          <p style={{ fontSize: 13, color: "#666", marginTop: "1rem" }}>
            Sur les <strong>{votes.length}</strong> derniers scrutins où on a une donnée pour ce
            député :{" "}
            {Object.entries(tally)
              .map(([pos, count]) => `${POSITION_LABELS[pos]?.label || pos} : ${count}`)
              .join(" · ")}
          </p>
          <p style={{ fontSize: 13, color: "#666" }}>
            Ceci ne couvre que les scrutins publics les plus récents (la 17e législature a
            largement dépassé 8000 scrutins au total, on se limite volontairement aux plus
            récents) — ce n&apos;est donc pas un bilan complet du mandat.
          </p>

          {votes.length === 0 ? (
            <p>Aucune donnée de vote disponible pour ce député sur la période couverte.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Date</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Scrutin</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Position</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v) => (
                  <tr key={v.scrutin_numero}>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      {v.scrutin_date ? new Date(v.scrutin_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <Link href={`/scrutins/17/${v.scrutin_numero}`}>
                        {v.title || `Scrutin n°${v.scrutin_numero}`}
                      </Link>
                    </td>
                    <td style={{ padding: 8, color: POSITION_LABELS[v.position]?.color || "#333", fontWeight: 600 }}>
                      {POSITION_LABELS[v.position]?.label || v.position}
                    </td>
                    <td style={{ padding: 8 }}>{v.result || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
            Source : NosDéputés.fr (Regards Citoyens), à partir des données de l&apos;Assemblée
            nationale et du Journal Officiel (CC-BY-SA / ODbL).
          </p>
        </>
      )}
    </main>
  );
}
