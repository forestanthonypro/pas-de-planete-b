import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { formatDate } from "../../lib/useLastUpdated";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const VERDICT_COLORS = {
  faux: "#d63e2a",
  trompeur: "#f4b400",
  confirme: "#1baf7a",
};

export default function DebunkEntryPage() {
  const { t } = useT();
  const router = useRouter();
  const { slug } = router.query;
  const [entry, setEntry] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/debunk/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error(t("debunk.entry_not_found"));
        return res.json();
      })
      .then((data) => {
        setEntry(data.entry);
        setSources(data.sources || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function verdictLabel(verdict) {
    if (verdict === "trompeur") return t("debunk.verdict_trompeur");
    if (verdict === "confirme") return t("debunk.verdict_confirme");
    return t("debunk.verdict_faux");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/debunk">{t("debunk.back_to_list")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && entry && (
        <>
          <span style={{ display: "inline-block", background: VERDICT_COLORS[entry.verdict] || VERDICT_COLORS.faux, color: entry.verdict === "trompeur" ? "#1b1f23" : "white", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>
            {verdictLabel(entry.verdict).toUpperCase()}
          </span>
          <h1 style={{ margin: "12px 0 6px" }}>{entry.myth}</h1>
          <p style={{ fontSize: 12, color: "#666", marginBottom: "1rem" }}>
            {entry.category && `${entry.category} · `}
            {t("debunk.published_on", { date: formatDate(entry.created_at) })}
            {entry.updated_at && entry.updated_at !== entry.created_at && (
              <>{t("debunk.updated_on", { date: formatDate(entry.updated_at) })}</>
            )}
          </p>

          <ShareButtons title={entry.myth} />

          {entry.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.image_url}
              alt=""
              style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12, margin: "1rem 0" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}

          {entry.claim_quote && (
            <div style={{ background: "#f7f7f5", borderLeft: "3px solid #647076", borderRadius: "0 8px 8px 0", padding: "0.75rem 1rem", margin: "1.25rem 0" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "#666", margin: "0 0 4px", fontWeight: 600 }}>
                {t("debunk.claim_title")}
              </p>
              <p style={{ fontSize: 14, fontStyle: "italic", margin: 0 }}>« {entry.claim_quote} »</p>
            </div>
          )}

          <h2 style={{ fontSize: 16, marginTop: "1.5rem", color: "#1b5e20" }}>{t("debunk.reality_title")}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{entry.reality}</p>

          {sources.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, marginTop: "1.5rem" }}>{t("debunk.sources_title")}</h2>
              <ul>
                {sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
