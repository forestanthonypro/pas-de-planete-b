import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../../components/ShareButtons";
import PageHeader from "../../../components/PageHeader";
import Pagination from "../../../components/Pagination";
import { IconScale } from "../../../components/icons";
import { useT } from "../../../lib/useT";
import { localeTag } from "../../../lib/dateLocale";
import ScrollableTable from "../../../components/ScrollableTable";
import { useApiFetch } from "../../../lib/useApiFetch";
import { chamberLabelKey } from "../../../lib/parliamentChamberLabels";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 30;

const SOURCE_LINKS = {
  us: [
    { label: "Congress.gov", href: "https://www.congress.gov/" },
    { label: "GovTrack.us", href: "https://www.govtrack.us/" },
  ],
};

export default function InternationalVotesPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const { country } = router.query;
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const [chamberFilter, setChamberFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchPage, setSearchPage] = useState(1);

  const { data, loading, error } = useApiFetch(country ? `/api/parliament/${country}/votes?limit=200` : null, {
    errorMessage: t("international.error_no_data"),
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const votes = useMemo(() => data ?? [], [data]);

  const { data: stats } = useApiFetch(country ? `/api/parliament/${country}/votes/stats` : null);

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
    fetch(`${API_URL}/api/parliament/${country}/votes/search?q=${encodeURIComponent(q)}`)
      .then((res) => {
        if (!res.ok) throw new Error(t("scrutins.search_error"));
        return res.json();
      })
      .then((rows) => {
        setSearchResults(rows);
        setSearchPage(1);
        setSearching(false);
      })
      .catch((err) => {
        setSearchError(err.message);
        setSearching(false);
      });
  }

  useEffect(() => {
    setPage(1);
  }, [chamberFilter, resultFilter]);

  const filtered = useMemo(() => {
    return votes.filter((v) => {
      if (chamberFilter && v.chamber !== chamberFilter) return false;
      if (resultFilter && v.result !== resultFilter) return false;
      return true;
    });
  }, [votes, chamberFilter, resultFilter]);

  const results = useMemo(() => {
    const set = new Set(votes.map((v) => v.result).filter(Boolean));
    return [...set];
  }, [votes]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!stats || !stats.byResult || stats.byResult.length === 0) return;
    let cancelled = false;
    import("../../../lib/chartSetup").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: stats.byResult.map((r) => r.result || t("scrutins.not_found")),
          datasets: [
            {
              data: stats.byResult.map((r) => parseInt(r.count, 10)),
              backgroundColor: ["#1baf7a", "#d63e2a", "#f4b400", "#6c3483", "#95a5a6"],
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  if (!country) return null;
  const sourceLink = SOURCE_LINKS[country];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href={`/international/${country}`}>{t("international.back_to_hub")}</Link>
      </p>
      <PageHeader Icon={IconScale} tint="blue" title={t("international.card_votes_label")} />
      <ShareButtons title={t("international.card_votes_label")} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
        {t(`international.country_${country}`)}
      </p>

      <form onSubmit={handleSearch} style={{ marginBottom: "1rem" }}>
        <label htmlFor="vote-search" style={{ display: "block", marginBottom: "0.25rem" }}>
          {t("scrutins.search_label")}
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id="vote-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("scrutins.search_placeholder")}
            style={{ padding: "6px 10px", flex: "1 1 200px" }}
          />
          <button type="submit">{t("scrutins.search_button")}</button>
        </div>
      </form>

      {searching && <p>{t("scrutins.searching")}</p>}
      {searchError && <p role="alert">{searchError}</p>}

      {searchResults && (
        <section style={{ marginBottom: "2rem", padding: "1rem", background: "var(--color-carte)", borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>
            {t("scrutins.results_count", { count: searchResults.length, s: searchResults.length !== 1 ? "s" : "", query })}
          </h2>
          {searchResults.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>{t("scrutins.no_results")}</p>
          ) : (() => {
            const searchTotalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
            const searchPageItems = searchResults.slice((searchPage - 1) * PAGE_SIZE, searchPage * PAGE_SIZE);
            return (
              <>
                <ScrollableTable>
                  <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_date")}</th>
                        <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_object")}</th>
                        <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_result")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchPageItems.map((s) => (
                        <tr key={s.id}>
                          <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                            {s.vote_date ? new Date(s.vote_date).toLocaleDateString(localeTag(locale)) : "—"}
                          </td>
                          <td style={{ padding: 8 }}>
                            <Link href={`/international/${country}/scrutins/${s.id}`}>{s.question}</Link>
                          </td>
                          <td style={{ padding: 8 }}>{s.result || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
                <Pagination page={searchPage} totalPages={searchTotalPages} onChange={setSearchPage} />
              </>
            );
          })()}
        </section>
      )}

      {stats && (
        <>
          <p style={{ fontSize: 14 }}>{t("scrutins.stats_intro", { total: stats.total.toLocaleString(localeTag(locale)) })}</p>
          <div style={{ position: "relative", height: 200, maxWidth: 400 }}>
            <canvas ref={canvasRef} role="img" aria-label={t("scrutins.chart_alt_stats")} />
          </div>
        </>
      )}

      <h2 style={{ fontSize: 18, marginTop: "2rem" }}>{t("scrutins.recent_title")}</h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>
          {t("international.chamber_label")}{" "}
          <select value={chamberFilter} onChange={(e) => setChamberFilter(e.target.value)}>
            <option value="">{t("deputes.all")}</option>
            <option value="lower">{t(chamberLabelKey(country, "lower"))}</option>
            <option value="upper">{t(chamberLabelKey(country, "upper"))}</option>
          </select>
        </label>
        {results.length > 0 && (
          <label>
            {t("scrutins.filter_result")}{" "}
            <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
              <option value="">{t("scrutins.all")}</option>
              {results.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && filtered.length === 0 && <p>{t("scrutins.no_results")}</p>}

      {!loading && !error && filtered.length > 0 && (
        <ScrollableTable>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_date")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_object")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("international.chamber_label")}</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>{t("scrutins.table_result")}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((v) => (
                <tr key={v.id}>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                    {v.vote_date ? new Date(v.vote_date).toLocaleDateString(localeTag(locale)) : "—"}
                  </td>
                  <td style={{ padding: 8 }}>
                    <Link href={`/international/${country}/scrutins/${v.id}`}>{v.question}</Link>
                  </td>
                  <td style={{ padding: 8 }}>{t(chamberLabelKey(country, v.chamber))}</td>
                  <td style={{ padding: 8 }}>{v.result || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}
      {!loading && !error && filtered.length > PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}

      {sourceLink && sourceLink.length > 0 && (
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
          {t("international.source_prefix")}{" "}
          {sourceLink.map((s, i) => (
            <span key={s.href}>
              <a href={s.href} target="_blank" rel="noreferrer">{s.label}</a>
              {i < sourceLink.length - 1 ? " · " : ""}
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
