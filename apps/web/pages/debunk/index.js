import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconSearch } from "../../components/icons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const VERDICT_COLORS = {
  faux: "#d63e2a",
  trompeur: "#f4b400",
  confirme: "#1baf7a",
};

export default function DebunkPage() {
  const { t } = useT();
  const [entries, setEntries] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
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

  const categories = useMemo(() => {
    const set = new Set(entries.map((e) => e.category).filter(Boolean));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    if (!categoryFilter) return entries;
    return entries.filter((e) => e.category === categoryFilter);
  }, [entries, categoryFilter]);

  function verdictLabel(verdict) {
    if (verdict === "trompeur") return t("debunk.verdict_trompeur");
    if (verdict === "confirme") return t("debunk.verdict_confirme");
    return t("debunk.verdict_faux");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <PageHeader Icon={IconSearch} tint="teal" title={t("debunk.title")}>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", maxWidth: 600, margin: 0 }}>{t("debunk.intro")}</p>
        </PageHeader>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}
          >
            <option value="">{t("debunk.category_all")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <ShareButtons title={t("debunk.share_title")} />
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}
      {!loading && !error && entries.length === 0 && <p>{t("debunk.no_entries")}</p>}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: "1.5rem" }}>
          {filtered.map((e) => (
            <Link
              key={e.slug}
              href={`/debunk/${e.slug}`}
              style={{ display: "block", background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: 12, overflow: "hidden", textDecoration: "none", color: "inherit" }}
            >
              {e.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.image_url}
                  alt=""
                  style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                  onError={(ev) => { ev.target.style.display = "none"; }}
                />
              )}
              <div style={{ padding: "1rem" }}>
                <span style={{ display: "inline-block", background: VERDICT_COLORS[e.verdict] || VERDICT_COLORS.faux, color: e.verdict === "trompeur" ? "var(--color-texte)" : "white", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>
                  {verdictLabel(e.verdict).toUpperCase()}
                </span>
                <p style={{ fontSize: 15, fontWeight: 500, margin: "10px 0 6px", lineHeight: 1.4 }}>{e.myth}</p>
                <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>
                  {e.category ? `${e.category} · ` : ""}
                  {new Date(e.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
        <Link href="/">{t("debunk.back_to_home")}</Link>
      </p>
    </div>
  );
}
