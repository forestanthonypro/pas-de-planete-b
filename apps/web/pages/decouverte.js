import Link from "next/link";
import { useT } from "../lib/useT";
import { useWorldBenchmarks } from "../lib/useWorldBenchmarks";

// Page "mode découverte" — parcours en une seule page, pensé pour un public
// novice/sceptique plutôt que pour quelqu'un déjà sensibilisé au climat.
// Voir TODO.md, point 7, pour le contexte de ce chantier.
//
// Construite section par section (voir les commentaires ci-dessous) plutôt
// que d'un bloc — chaque section est testée et livrée séparément.
export default function DecouvertePage() {
  const { t } = useT();
  const worldBenchmarks = useWorldBenchmarks();
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

      {/* --- Section 2 : Objections (à venir) --- */}
      {/* --- Section 3 : Comparaisons par thème (à venir) --- */}
      {/* --- Section 4 : Et maintenant ? (à venir) --- */}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
