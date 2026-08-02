import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { useT } from "../../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function InterviewDetailPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const { slug } = router.query;
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/science-relays/${slug}?locale=${locale}`)
      .then((res) => {
        if (!res.ok) throw new Error(t("interviews.entry_not_found"));
        return res.json();
      })
      .then((data) => {
        setEntry(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, locale]);

  function typeLabel(type) {
    if (type === "video") return t("interviews.type_video");
    if (type === "podcast") return t("interviews.type_podcast");
    return t("interviews.type_article");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/interviews">{t("interviews.back_to_list")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && entry && (
        <>
          <span style={{ fontSize: 11, color: "var(--color-texte-clair)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {typeLabel(entry.content_type)}{entry.category_name ? ` · ${entry.category_name}` : ""}
          </span>
          <h1 style={{ margin: "6px 0" }}>{entry.title}</h1>
          {entry.scientist_name && (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
              {entry.scientist_name}{entry.scientist_field ? ` — ${entry.scientist_field}` : ""}
            </p>
          )}

          <ShareButtons title={entry.title} />

          {entry.content_type === "video" && entry.embed_url && (
            <div style={{ position: "relative", paddingTop: "56.25%", margin: "1.25rem 0", borderRadius: 12, overflow: "hidden" }}>
              <iframe
                src={entry.embed_url}
                title={entry.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          )}

          {entry.content_type === "podcast" && entry.embed_url && (
            <div style={{ margin: "1.25rem 0" }}>
              <iframe
                src={entry.embed_url}
                title={entry.title}
                style={{ width: "100%", height: 152, border: "none", borderRadius: 12 }}
                allow="encrypted-media"
              />
            </div>
          )}

          <p style={{ fontSize: 15, lineHeight: 1.6, margin: "1rem 0" }}>{entry.description}</p>

          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
            {t("interviews.source_label")} {entry.source_name || "—"} —{" "}
            <a href={entry.source_url} target="_blank" rel="noopener noreferrer">
              {t("interviews.watch_source")}
            </a>
          </p>

          {entry.related_debunk_slug && (
            <p style={{ fontSize: 13, marginTop: "0.5rem" }}>
              {t("interviews.related_debunk")}{" "}
              <Link href={`/debunk/${entry.related_debunk_slug}`}>{entry.related_debunk_slug}</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
