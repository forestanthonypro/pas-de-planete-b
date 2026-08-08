import Link from "next/link";
import { useRouter } from "next/router";
import ShareButtons from "../../../components/ShareButtons";
import PageHeader from "../../../components/PageHeader";
import { IconUsers, IconLandmark, IconScale, IconCheck } from "../../../components/icons";
import { useT } from "../../../lib/useT";

export default function InternationalCountryHub() {
  const { t } = useT();
  const router = useRouter();
  const { country } = router.query;

  if (!country) return null;

  const cards = [
    { href: `/international/${country}/elus`, Icon: IconUsers, label: t("international.card_members_label"), desc: t("international.card_members_desc"), tint: "blue" },
    { href: `/international/${country}/groupes`, Icon: IconLandmark, label: t("international.card_groups_label"), desc: t("international.card_groups_desc"), tint: "blue" },
    { href: `/international/${country}/scrutins`, Icon: IconScale, label: t("international.card_votes_label"), desc: t("international.card_votes_desc"), tint: "blue" },
    { href: `/international/${country}/mes-votes`, Icon: IconCheck, label: t("international.card_myvotes_label"), desc: t("international.card_myvotes_desc"), tint: "blue" },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/international">{t("international.back_to_countries")}</Link>
      </p>
      <PageHeader Icon={IconLandmark} tint="blue" title={t(`international.country_${country}`)} />
      <ShareButtons title={t(`international.country_${country}`)} />
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

export async function getServerSideProps() {
  return { props: {} };
}
