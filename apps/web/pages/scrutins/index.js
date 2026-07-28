import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ScrutinsPage() {
  const [scrutins, setScrutins] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [resultFilter, setResultFilter] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setSearchError("Tape au moins 3 caractères.");
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    fetch(`${API_URL}/api/scrutins/search?q=${encodeURIComponent(q)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur lors de la recherche");
        return res.json();
      })
      .then((rows) => {
        setSearchResults(rows);
        setSearching(false);
      })
      .catch((err) => {
        setSearchError(err.message);
        setSearching(false);
      });
  }

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/scrutins?limit=200`).then((res) => {
        if (!res.ok) throw new Error("Données indisponibles");
        return res.json();
      }),
      fetch(`${API_URL}/api/scrutins/stats`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([scrutinRows, statsData]) => {
        setScrutins(Array.isArray(scrutinRows) ? scrutinRows : []);
        setStats(statsData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!stats || !stats.byResult || stats.byResult.length === 0) return;
    let cancelled = false;
    import("../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const COLORS = { "adopté": "#1baf7a", "rejeté": "#d63e2a" };
      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: stats.byResult.map((r) => r.result_code || "inconnu"),
          datasets: [
            {
              data: stats.byResult.map((r) => parseInt(r.count, 10)),
              backgroundColor: stats.byResult.map((r) => COLORS[r.result_code] || "#95a5a6"),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "right" } },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [stats]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Scrutins — Assemblée nationale (17e législature)</h1>
      <ShareButtons title="Scrutins — Assemblée nationale (17e législature)" />


      <form onSubmit={handleSearch} style={{ marginBottom: "1rem" }}>
        <label htmlFor="scrutin-search" style={{ display: "block", marginBottom: "0.25rem" }}>
          Rechercher un scrutin par mot-clé (ex : &laquo; cadmium &raquo;, &laquo; acétamipride &raquo;)
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="scrutin-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans le titre et l'objet du scrutin..."
            style={{ padding: "6px 10px", minWidth: 320, flex: 1 }}
          />
          <button type="submit">Rechercher</button>
        </div>
        <p style={{ fontSize: 12, color: "#666", marginTop: "0.25rem" }}>
          Cherche sur les 8000+ scrutins de la législature, pas seulement les 200 plus récents
          affichés plus bas.
        </p>
      </form>

      {searching && <p>Recherche en cours...</p>}
      {searchError && <p role="alert">{searchError}</p>}

      {searchResults && (
        <section style={{ marginBottom: "2rem", padding: "1rem", background: "#f7f7f7", borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>
            {searchResults.length} résultat{searchResults.length !== 1 ? "s" : ""} pour &laquo; {query} &raquo;
          </h2>
          {searchResults.length === 0 ? (
            <p style={{ fontSize: 13, color: "#666" }}>Aucun scrutin trouvé pour ce mot-clé.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Date</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Objet</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((s) => (
                  <tr key={s.numero}>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      {s.scrutin_date ? new Date(s.scrutin_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: 8 }}>
                      <Link href={`/scrutins/${s.legislature}/${s.numero}`}>
                        {s.title || s.objet || `Scrutin n°${s.numero}`}
                      </Link>
                    </td>
                    <td style={{ padding: 8 }}>{s.result_label || s.result_code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {stats && (
        <>
          <p style={{ fontSize: 14 }}>
            Sur l&apos;ensemble des <strong>{stats.total.toLocaleString("fr-FR")}</strong> scrutins
            de la législature :
          </p>
          <div style={{ position: "relative", height: 200, maxWidth: 400 }}>
            <canvas ref={canvasRef} role="img" aria-label="Répartition adopté / rejeté sur l'ensemble des scrutins" />
          </div>
        </>
      )}

      <h2 style={{ fontSize: 18, marginTop: "2rem" }}>Les 200 scrutins les plus récents</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>
        Avec leur résultat officiel. Le détail nominatif (qui a voté quoi) est disponible pour
        chacun via sa fiche — sauf les rares scrutins qui ne font pas l&apos;objet d&apos;un
        décompte nominatif individuel.
      </p>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        Filtrer par résultat{" "}
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="">Tous</option>
          <option value="adopté">Adopté</option>
          <option value="rejeté">Rejeté</option>
        </select>
      </label>

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
            {scrutins
              .filter((s) => !resultFilter || s.result_code === resultFilter)
              .map((s) => (
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

      <p style={{ fontSize: 13, color: "#666", marginTop: "1.5rem" }}>
        Cette page couvre uniquement la <strong>17e législature</strong>, en cours depuis juillet
        2024 — la seule qui continue de changer. Les législatures précédentes sont closes et ne
        bougeront plus ; pour les consulter, direction les archives officielles sur{" "}
        <a href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
          data.assemblee-nationale.fr
        </a>.
      </p>

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        Source : CIVIX et Assemblée nationale (open data officiel) (Licence Ouverte / Open Licence
        2.0).{" "}
        <Link href="/deputes">Voir la liste des députés →</Link>
      </p>
    </div>
  );
}
