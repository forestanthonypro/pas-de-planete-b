import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/debunk">{t("debunk.back_to_list")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && entry && (
        <>
          <h1>{entry.myth}</h1>
          <ShareButtons title={entry.myth} />

          <h2 style={{ fontSize: 16, marginTop: "1.5rem" }}>{t("debunk.reality_title")}</h2>
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
