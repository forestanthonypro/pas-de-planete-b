import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconSearch } from "../../components/icons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TYPE_ICONS = { video: "▶", article: "📄", podcast: "🎙" };

export default function InterviewsPage() {
  const { t } = useT();
  const [entries, setEntries] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/science-relays`)
      .then((res) => {
        if (!res.ok) throw new Error(t("interviews.error_no_data"));
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

  const categories = useMemo(() => {
    const set = new Set(entries.map((e) => e.category).filter(Boolean));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (typeFilter && e.content_type !== typeFilter) return false;
      return true;
    });
  }, [entries, categoryFilter, typeFilter]);

  function typeLabel(type) {
    if (type === "video") return t("interviews.type_video");
    if (type === "podcast") return t("interviews.type_podcast");
    return t("interviews.type_article");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconSearch} tint="teal" title={t("interviews.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", maxWidth: 600, margin: 0 }}>{t("interviews.intro")}</p>
      </PageHeader>

      <ShareButtons title={t("interviews.share_title")} />

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "var(--color-fond)", color: "var(--color-texte)" }}
          >
            <option value="">{t("interviews.category_all")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "var(--color-fond)", color: "var(--color-texte)" }}
        >
          <option value="">{t("interviews.type_all")}</option>
          <option value="video">{t("interviews.type_video")}</option>
          <option value="article">{t("interviews.type_article")}</option>
          <option value="podcast">{t("interviews.type_podcast")}</option>
        </select>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && entries.length === 0 && <p>{t("interviews.no_entries")}</p>}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {filtered.map((e) => (
            <Link
              key={e.slug}
              href={`/interviews/${e.slug}`}
              className="pdpb-card"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <span style={{ fontSize: 11, color: "var(--color-texte-clair)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {TYPE_ICONS[e.content_type]} {typeLabel(e.content_type)}
              </span>
              <p style={{ fontSize: 15, fontWeight: 600, margin: "6px 0 4px" }}>{e.title}</p>
              {e.scientist_name && (
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 4px" }}>
                  {e.scientist_name}{e.scientist_field ? ` — ${e.scientist_field}` : ""}
                </p>
              )}
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>{e.category}</p>
            </Link>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        <Link href="/">{t("interviews.back_to_home")}</Link>
      </p>
    </div>
  );
}
