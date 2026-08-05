import { useRouter } from "next/router";
import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import { useT } from "../../lib/useT";
import { useApiFetch } from "../../lib/useApiFetch";

export default function PaysanDetailPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const { slug } = router.query;

  const { data: entry, loading, error } = useApiFetch(slug ? `/api/paysan-resources/${slug}?locale=${locale}` : null, {
    errorMessage: t("paysans.entry_not_found"),
    deps: [locale],
  });

  function typeLabel(type) {
    if (type === "video") return t("paysans.type_video");
    if (type === "podcast") return t("paysans.type_podcast");
    if (type === "document") return t("paysans.type_document");
    return t("paysans.type_article");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/paysans">{t("paysans.back_to_list")}</Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && entry && (
        <>
          <span style={{ fontSize: 11, color: "var(--color-texte-clair)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {typeLabel(entry.content_type)}{entry.category_name ? ` · ${entry.category_name}` : ""}
          </span>
          <h1 style={{ margin: "6px 0 1rem" }}>{entry.title}</h1>

          <ShareButtons title={entry.title} />

          {(entry.content_type === "video" || entry.content_type === "podcast") && entry.embed_url && (
            <div
              style={
                entry.content_type === "video"
                  ? { position: "relative", paddingTop: "56.25%", margin: "1.25rem 0", borderRadius: 12, overflow: "hidden" }
                  : { margin: "1.25rem 0" }
              }
            >
              <iframe
                src={entry.embed_url}
                title={entry.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={
                  entry.content_type === "video"
                    ? { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }
                    : { width: "100%", height: 152, border: "none", borderRadius: 12 }
                }
              />
            </div>
          )}

          <p style={{ fontSize: 15, lineHeight: 1.6, margin: "1rem 0" }}>{entry.description}</p>

          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: "1.5rem" }}>
            {t("paysans.source_label")} {entry.source_name || "—"} —{" "}
            <a href={entry.source_url} target="_blank" rel="noopener noreferrer">
              {t("paysans.watch_source")}
            </a>
          </p>
        </>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
