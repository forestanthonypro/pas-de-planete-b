import { useEffect, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function DebunkPage() {
  const { t } = useT();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/debunk`)
      .then((res) => {
        if (!res.ok) throw new Error(t("debunk.error_no_data"));
        return res.json();
      })
      .then((rows) => {
        setEntries(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>{t("debunk.title")}</h1>
      <ShareButtons title={t("debunk.share_title")} />
      <p style={{ fontSize: 13, color: "#666", marginBottom: "1rem" }}>{t("debunk.intro")}</p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && entries.length === 0 && <p>{t("debunk.no_entries")}</p>}

      {!loading && !error && entries.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {entries.map((e) => (
            <li key={e.slug} style={{ borderBottom: "1px solid #eee", padding: "0.75rem 0" }}>
              <Link href={`/debunk/${e.slug}`} style={{ fontSize: 16 }}>
                {e.myth}
              </Link>
              {e.category && <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>({e.category})</span>}
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 12, color: "#666", marginTop: "1rem" }}>
        <Link href="/">{t("debunk.back_to_home")}</Link>
      </p>
    </div>
  );
}
