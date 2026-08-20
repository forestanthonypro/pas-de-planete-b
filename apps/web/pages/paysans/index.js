import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconTree } from "../../components/icons";
import { useT } from "../../lib/useT";
import { useSobriety } from "../../lib/SobrietyContext";
import { toYoutubeThumbnailUrl } from "../../lib/youtube";

const TYPE_ICONS = { video: "▶", article: "📄", podcast: "🎙", document: "📎" };

export default function PaysansPage() {
  const { t, locale } = useT();
  const { sobriety } = useSobriety();
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/paysan-resources?locale=${locale}`).then((res) => {
        if (!res.ok) throw new Error(t("paysans.error_no_data"));
        return res.json();
      }),
      fetch(`/api/paysan-categories`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([entryRows, categoryRows]) => {
        setEntries(Array.isArray(entryRows) ? entryRows : []);
        setCategories(Array.isArray(categoryRows) ? categoryRows : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (categoryFilter && e.category_slug !== categoryFilter) return false;
      if (typeFilter && e.content_type !== typeFilter) return false;
      return true;
    });
  }, [entries, categoryFilter, typeFilter]);

  function typeLabel(type) {
    if (type === "video") return t("paysans.type_video");
    if (type === "podcast") return t("paysans.type_podcast");
    if (type === "document") return t("paysans.type_document");
    return t("paysans.type_article");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconTree} tint="green" title={t("paysans.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", maxWidth: 600, margin: 0 }}>{t("paysans.intro")}</p>
      </PageHeader>

      <ShareButtons title={t("paysans.share_title")} />

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "var(--color-fond)", color: "var(--color-texte)" }}
          >
            <option value="">{t("paysans.category_all")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "var(--color-fond)", color: "var(--color-texte)" }}
        >
          <option value="">{t("paysans.type_all")}</option>
          <option value="video">{t("paysans.type_video")}</option>
          <option value="article">{t("paysans.type_article")}</option>
          <option value="podcast">{t("paysans.type_podcast")}</option>
          <option value="document">{t("paysans.type_document")}</option>
        </select>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && entries.length === 0 && <p>{t("paysans.no_entries")}</p>}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {filtered.map((e) => {
            const thumbnail = e.content_type === "video" && e.embed_url
              ? toYoutubeThumbnailUrl(e.embed_url)
              : e.image_url;
            return (
              <Link
                key={e.slug}
                href={`/paysans/${e.slug}`}
                className="pdpb-card"
                style={{ display: "block", textDecoration: "none", color: "inherit", padding: 0, overflow: "hidden" }}
              >
                {thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnail}
                    alt=""
                    style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                    onError={(ev) => { ev.target.style.display = "none"; }}
                  />
                )}
                <div style={{ padding: "1rem" }}>
                  <span style={{ fontSize: 11, color: "var(--color-texte-clair)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    {TYPE_ICONS[e.content_type]} {typeLabel(e.content_type)}
                  </span>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "6px 0 4px" }}>{e.title}</p>
                  <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>{e.category_name}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 12, marginTop: "1.5rem" }}>
        <Link
          href="/paysans/proposer"
          style={
            sobriety
              ? { color: "var(--color-forest)", textDecoration: "underline" }
              : {
                  display: "inline-block",
                  background: "var(--color-forest)",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: 20,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 13,
                }
          }
        >
          {t("paysans.propose_link")}
        </Link>
      </p>

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "0.5rem" }}>
        <Link href="/">{t("paysans.back_to_home")}</Link>
      </p>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
