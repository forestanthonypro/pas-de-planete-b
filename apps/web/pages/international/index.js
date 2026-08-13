import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { IconLandmark } from "../../components/icons";
import { useT } from "../../lib/useT";

// Pays pour lesquels une source de données ouvertes officielle a été
// identifiée et intégrée (voir schéma parliament_*, migration 040) — à
// compléter au fil des ingestions (Italie bloquée par CAPTCHA pour
// l'instant, voir TODO.md).
const AVAILABLE_COUNTRIES = [
  { code: "us", flag: "🇺🇸" },
  { code: "es", flag: "🇪🇸" },
  { code: "it", flag: "🇮🇹" },
];

// Pays sans source connue à ce jour, simplement pour donner un visage aux
// langues du site plutôt que de laisser deviner — la liste n'est pas
// exhaustive, l'objectif est d'inviter à signaler une source plutôt que de
// prétendre à une couverture complète.
const UNAVAILABLE_COUNTRIES = [
  { code: "ru", flag: "🇷🇺" },
  { code: "jp", flag: "🇯🇵" },
  { code: "cn", flag: "🇨🇳" },
  { code: "in", flag: "🇮🇳" },
];

export default function InternationalPage() {
  const { t } = useT();
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconLandmark} tint="blue" title={t("international.title")} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1.5rem" }}>
        {t("international.intro")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: "2rem" }}>
        {AVAILABLE_COUNTRIES.map((c) => (
          <Link
            key={c.code}
            href={`/international/${c.code}`}
            prefetch={false}
            className="pdpb-card"
            style={{ display: "block", textAlign: "center", padding: "1.25rem 0.75rem", textDecoration: "none", color: "var(--color-texte)" }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{c.flag}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t(`international.country_${c.code}`)}</div>
          </Link>
        ))}
      </div>
      <div
        style={{
          background: "var(--color-carte)",
          border: "1px solid var(--color-bordure)",
          borderRadius: 12,
          padding: "1.25rem",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 0.5rem" }}>{t("international.unavailable_title")}</p>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 1rem" }}>{t("international.unavailable_desc")}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {UNAVAILABLE_COUNTRIES.map((c) => (
            <span key={c.code} style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
              {c.flag} {t(`international.country_${c.code}`)}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: "1rem" }}>
          {t("international.suggest_source_prefix")}{" "}
          <a href="mailto:contact@pasdeplaneteb.com">contact@pasdeplaneteb.com</a>.
        </p>
      </div>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
