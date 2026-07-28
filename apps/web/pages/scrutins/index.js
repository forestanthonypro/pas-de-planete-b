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
        Les 200 scrutins les plus récents, avec leur résultat officiel. Le détail nominatif
        (qui a voté quoi) n&apos;est disponible que pour un sous-ensemble de ces scrutins — voir
        la fiche de chaque scrutin.
      </p>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert">Erreur : {error}</p>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Date</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Objet</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Type</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>Résultat</th>
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
                    {s.title || s.objet || `Scrutin n°${s.numero}`}
                  </Link>
                </td>
                <td style={{ padding: 8 }}>{s.type_vote_label || "—"}</td>
                <td style={{ padding: 8 }}>{s.result_label || s.result_code || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : CIVIX, à partir des données open data de l&apos;Assemblée nationale (Licence
        Ouverte / Open Licence 2.0).{" "}
        <Link href="/deputes">Voir la liste des députés →</Link>
      </p>
    </main>
  );
}
