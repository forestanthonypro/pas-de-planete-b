import { useState } from "react";
import Link from "next/link";
import { useT } from "../lib/useT";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";
import { useApiFetch } from "../lib/useApiFetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const VERDICT_COLORS = { faux: "#d63e2a", trompeur: "#f4b400", confirme: "#1baf7a" };

function ObjectionCard({ entry, locale, t }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  function toggle() {
    if (!expanded && !detail && !loadingDetail) {
      setLoadingDetail(true);
      fetch(`${API_URL}/api/debunk/${entry.slug}?locale=${locale}`)
        .then((res) => (res.ok ? res.json() : null))
        .then(setDetail)
        .finally(() => setLoadingDetail(false));
    }
    setExpanded((v) => !v);
  }

  function verdictLabel(verdict) {
    if (verdict === "trompeur") return t("debunk.verdict_trompeur");
    if (verdict === "confirme") return t("debunk.verdict_confirme");
    return t("debunk.verdict_faux");
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          width: "100%",
          textAlign: "left",
          background: "var(--color-carte)",
          border: "1px solid var(--color-bordure)",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)" }}>« {entry.myth} »</span>
        <span style={{ fontSize: 16, color: "var(--color-texte-clair)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ background: "var(--color-fond)", borderRadius: 12, padding: "1rem 1.25rem", marginTop: 4 }}>
          {loadingDetail && <p style={{ fontSize: 13 }}>{t("common.loading")}</p>}
          {detail?.entry && (
            <>
              <span
                style={{
                  display: "inline-block",
                  background: VERDICT_COLORS[detail.entry.verdict] || VERDICT_COLORS.faux,
                  color: detail.entry.verdict === "trompeur" ? "var(--color-texte)" : "white",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 20,
                  marginBottom: 8,
                }}
              >
                {verdictLabel(detail.entry.verdict).toUpperCase()}
              </span>
              <p style={{ fontSize: 13, color: "var(--color-texte)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: "8px 0" }}>
                {detail.entry.reality}
              </p>
              {detail.sources?.length > 0 && (
                <p style={{ margin: 0 }}>
                  <a href={detail.sources[0].url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--color-forest)" }}>
                    {t("decouverte.objections_see_sources")} ↗
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Page "mode découverte" — parcours en une seule page, pensé pour un public
// novice/sceptique plutôt que pour quelqu'un déjà sensibilisé au climat.
// Voir TODO.md, point 7, pour le contexte de ce chantier.
//
// Construite section par section (voir les commentaires ci-dessous) plutôt
// que d'un bloc — chaque section est testée et livrée séparément.
export default function DecouvertePage() {
  const { t, locale } = useT();
  const worldBenchmarks = useWorldBenchmarks();
  const { data: objections } = useApiFetch(`/api/debunk?featured=true&locale=${locale}`, {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
    deps: [locale],
  });
  const deviation = worldBenchmarks?.temperature_deviation_world?.value;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "1.5rem" }}>
      {/* --- Section 1 : Accroche --- */}
      <section style={{ textAlign: "center", padding: "3rem 1rem 2.5rem" }}>
        <p style={{ fontSize: 16, fontWeight: 500, color: "var(--color-texte)", margin: "0 0 1.5rem" }}>
          {t("home.hero_punchline")}
        </p>

        {deviation !== null && deviation !== undefined ? (
          <>
            <div style={{ fontSize: 56, fontWeight: 500, color: "var(--color-forest)", lineHeight: 1 }}>
              {deviation > 0 ? "+" : ""}
              {deviation.toFixed(2)}°C
            </div>
            <p style={{ fontSize: 14, color: "var(--color-texte-clair)", margin: "6px 0 1.5rem" }}>
              {t("decouverte.hero_label")}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: "var(--color-texte-clair)", margin: "0 0 1.5rem" }}>{t("common.loading")}</p>
        )}

        <div
          style={{
            background: "var(--color-carte)",
            border: "1px solid var(--color-bordure)",
            borderRadius: 8,
            padding: "12px 16px",
            maxWidth: 420,
            margin: "0 auto 1.5rem",
          }}
        >
          <p style={{ fontSize: 14, color: "var(--color-texte)", margin: 0 }}>{t("decouverte.hero_question")}</p>
        </div>

        <Link
          href="#objections"
          style={{
            display: "inline-block",
            background: "var(--color-forest)",
            color: "white",
            padding: "10px 20px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {t("decouverte.hero_cta")} →
        </Link>
      </section>

      {/* --- Section 2 : Objections --- */}
      {objections && objections.length > 0 && (
        <section id="objections" style={{ padding: "2rem 0" }}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t("decouverte.objections_title")}</h2>
          <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: "1.25rem" }}>
            {t("decouverte.objections_intro")}
          </p>
          {objections.map((entry) => (
            <ObjectionCard key={entry.slug} entry={entry} locale={locale} t={t} />
          ))}
        </section>
      )}
      {/* --- Section 3 : Comparaisons par thème (à venir) --- */}
      {/* --- Section 4 : Et maintenant ? (à venir) --- */}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
