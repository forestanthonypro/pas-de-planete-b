import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconScale } from "../../components/icons";
import { useT } from "../../lib/useT";
import { getConsent, getAnonymousId } from "../../lib/anonymousId";
import { fetchCitizenVotes } from "../../lib/citizenVotes";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ScrutinsPage() {
  const { t } = useT();
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
  const [votedScrutins, setVotedScrutins] = useState(new Set());

  useEffect(() => {
    if (getConsent() !== "yes") return;
    const id = getAnonymousId();
    fetchCitizenVotes(id)
      .then((rows) => {
        setVotedScrutins(new Set(rows.map((v) => `${v.legislature}-${v.numero_scrutin}`)));
      })
      .catch(() => setVotedScrutins(new Set()));
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setSearchError(t("scrutins.search_min_chars"));
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    fetch(`${API_URL}/api/scrutins/search?q=${encodeURIComponent(q)}`)
      .then((res) => {
        if (!res.ok) throw new Error(t("scrutins.search_error"));
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
        if (!res.ok) throw new Error(t("scrutins.error_no_data"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          labels: stats.byResult.map((r) => r.result_code || t("scrutins.not_found")),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconScale} tint="blue" title={t("scrutins.title")} />
      <ShareButtons title={t("scrutins.title")} />

      <form onSubmit={handleSearch} style={{ marginBottom: "1rem" }}>
        <label htmlFor="scrutin-search" style={{ display: "block", marginBottom: "0.25rem" }}>
          {t("scrutins.search_label")}
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="scrutin-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("scrutins.search_placeholder")}
            style={{ padding: "6px 10px", minWidth: 320, flex: 1 }}
          />
          <button type="submit">{t("scrutins.search_button")}</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "0.25rem" }}>{t("scrutins.search_scope_note")}</p>
      </form>

      {searching && <p>{t("scrutins.searching")}</p>}
      {searchError && <p role="alert">{searchError}</p>}

      {searchResults && (
        <section style={{ marginBottom: "2rem", padding: "1rem", background: "#f7f7f7", borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>
            {t("scrutins.results_count", { count: searchResults.length, s: searchResults.length !== 1 ? "s" : "", query })}
          </h2>
          {searchResults.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("scrutins.no_results")}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_date")}</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_object")}</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_result")}</th>
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
            {t("scrutins.stats_intro", { total: stats.total.toLocaleString("fr-FR") })}
          </p>
          <div style={{ position: "relative", height: 200, maxWidth: 400 }}>
            <canvas ref={canvasRef} role="img" aria-label={t("scrutins.chart_alt_stats")} />
          </div>
        </>
      )}

      <h2 style={{ fontSize: 18, marginTop: "2rem" }}>{t("scrutins.recent_title")}</h2>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>{t("scrutins.recent_explain")}</p>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        {t("scrutins.filter_result")}{" "}
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="">{t("scrutins.all")}</option>
          <option value="adopté">{t("scrutins.adopted")}</option>
          <option value="rejeté">{t("scrutins.rejected")}</option>
        </select>
      </label>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_date")}</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_object")}</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_type")}</th>
              <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_result")}</th>
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
                    {votedScrutins.has(`${s.legislature}-${s.numero}`) && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#1baf7a", fontWeight: 600 }} title={t("scrutins.already_voted")}>
                        ✓ {t("scrutins.already_voted")}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>{s.type_vote_label || "—"}</td>
                  <td style={{ padding: 8 }}>{s.result_label || s.result_code || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        {t("scrutins.coverage_note")}{" "}
        <a href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
          data.assemblee-nationale.fr
        </a>.
      </p>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
        {t("scrutins.source")}{" "}
        <Link href="/deputes">{t("scrutins.back_to_deputies")}</Link>
      </p>
    </div>
  );
}
