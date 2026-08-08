import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { IconUsers, IconLandmark, IconScale, IconCheck } from "../../components/icons";
import { useT } from "../../lib/useT";

export default function FranceHub() {
  const { t } = useT();

  const cards = [
    { href: "/deputes", Icon: IconUsers, label: t("home.card_deputes_label"), desc: t("home.card_deputes_desc"), tint: "blue" },
    { href: "/groupes", Icon: IconLandmark, label: t("home.card_groupes_label"), desc: t("home.card_groupes_desc"), tint: "blue" },
    { href: "/scrutins", Icon: IconScale, label: t("home.card_scrutins_label"), desc: t("home.card_scrutins_desc"), tint: "blue" },
    { href: "/mes-votes", Icon: IconCheck, label: t("home.card_mesvotes_label"), desc: t("home.card_mesvotes_desc"), tint: "blue" },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader Icon={IconLandmark} tint="blue" title={t("international.country_fr")} />
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginBottom: "1.5rem" }}>
        {t("international.hub_intro")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            prefetch={false}
            className="pdpb-card"
            style={{ display: "block", padding: "1.25rem 1rem", textDecoration: "none", color: "var(--color-texte)" }}
          >
            <c.Icon style={{ width: 28, height: 28, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
