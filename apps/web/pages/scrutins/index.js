import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ScrutinsPage() {
  const [scrutins, setScrutins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/scrutins?limit=200`)
      .then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      })
      .then((rows) => {
        setScrutins(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Derniers scrutins — Assemblée nationale (17e législature)</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Les 200 scrutins publics les plus récents, avec leur résultat officiel. La 17e législature
        a déjà dépassé 8000 scrutins au total (probablement lié à l&apos;instabilité politique
        actuelle) — on se limite volontairement aux plus récents plutôt que tout l&apos;historique.
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Date</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Objet</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Résultat</th>
              <th scope="col" style={{ textAlign: "right", padding: 8 }}>Pour / Contre / Abst.</th>
            </tr>
          </thead>
          <tbody>
            {scrutins.map((s) => (
              <tr key={s.numero}>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                  {s.scrutin_date ? new Date(s.scrutin_date).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td style={{ padding: 8 }}>
                  <Link href={`/scrutins/${s.legislature}/${s.numero}`}>
                    {s.title || `Scrutin n°${s.numero}`}
                  </Link>
                </td>
                <td style={{ padding: 8 }}>{s.result || "—"}</td>
                <td style={{ padding: 8, textAlign: "right", whiteSpace: "nowrap" }}>
                  {s.votes_pour ?? "—"} / {s.votes_contre ?? "—"} / {s.votes_abstention ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : NosDéputés.fr (Regards Citoyens), à partir des données de l&apos;Assemblée
        nationale et du Journal Officiel (CC-BY-SA / ODbL).{" "}
        <Link href="/deputes">Voir la liste des députés →</Link>
      </p>
    </main>
  );
}
