import Link from "next/link";
import ShareButtons from "../../components/ShareButtons";
import PageHeader from "../../components/PageHeader";
import { IconLandmark } from "../../components/icons";
import { useSobriety } from "../../lib/SobrietyContext";
import { useT } from "../../lib/useT";
import { useApiFetch } from "../../lib/useApiFetch";
import { useState } from "react";

export default function PetitionsPage() {
  const { t, locale } = useT();
  const { sobriety } = useSobriety();
  const [statusFilter, setStatusFilter] = useState("ongoing");

  const { data, loading, error } = useApiFetch(
    `/api/petitions?status=${statusFilter}&locale=${locale}`,
    { errorMessage: t("petitions.error_no_data"), deps: [statusFilter] }
  );
  const petitions = data ?? [];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconLandmark} tint="green" title={t("petitions.title")}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", maxWidth: 600, margin: 0 }}>{t("petitions.intro")}</p>
      </PageHeader>

      <ShareButtons title={t("petitions.share_title")} />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => setStatusFilter("ongoing")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: statusFilter === "ongoing" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: statusFilter === "ongoing" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)",
            fontWeight: statusFilter === "ongoing" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {t("petitions.tab_ongoing")}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("closed")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: statusFilter === "closed" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: statusFilter === "closed" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)",
            fontWeight: statusFilter === "closed" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {t("petitions.tab_closed")}
        </button>
      </div>

      <p style={{ fontSize: 12, marginBottom: "1rem" }}>
        <Link
          href="/petitions/proposer"
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
          {t("petitions.propose_link")}
        </Link>
      </p>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p role="alert">{t("common.error_prefix")} {error}</p>}

      {!loading && !error && (
        petitions.length === 0 ? (
          <p>{statusFilter === "ongoing" ? t("petitions.no_ongoing") : t("petitions.no_closed")}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {petitions.map((p) => (
              <div key={p.slug} className="pdpb-card">
                {p.image_url && !sobriety && (
                  <img
                    src={p.image_url}
                    alt=""
                    style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                  />
                )}
                <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{p.title}</p>
                {p.source_name && (
                  <p style={{ fontSize: 11, color: "var(--color-texte-clair)", textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 6px" }}>
                    {p.source_name}
                  </p>
                )}
                <p style={{ fontSize: 13, margin: "0 0 8px" }}>{p.description}</p>
                <a href={p.petition_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>
                  {p.status === "closed" ? t("petitions.view_link") : t("petitions.sign_link")}
                </a>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
