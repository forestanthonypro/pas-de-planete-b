import { useEffect, useState } from "react";
import Link from "next/link";
import { detectDefaultCountry } from "../lib/detectCountry";
import ActionCTA from "../components/ActionCTA";
import { useSobriety } from "../lib/SobrietyContext";
import { useT } from "../lib/useT";
import {
  IconCloud,
  IconBolt,
  IconDroplet,
  IconTree,
  IconPaw,
  IconFlame,
  IconSmog,
  IconUsers,
  IconLandmark,
  IconScale,
  IconSearch,
  IconCheck,
} from "../components/icons";

function useCardGroups(t) {
  const environment = [
    { href: "/co2", Icon: IconCloud, label: t("home.card_co2_label"), desc: t("home.card_co2_desc") },
    { href: "/energie", Icon: IconBolt, label: t("home.card_energie_label"), desc: t("home.card_energie_desc") },
    { href: "/eau", Icon: IconDroplet, label: t("home.card_eau_label"), desc: t("home.card_eau_desc") },
    { href: "/vegetation", Icon: IconTree, label: t("home.card_vegetation_label"), desc: t("home.card_vegetation_desc") },
    { href: "/especes", Icon: IconPaw, label: t("home.card_especes_label"), desc: t("home.card_especes_desc") },
    { href: "/incendies", Icon: IconFlame, label: t("home.card_incendies_label"), desc: t("home.card_incendies_desc") },
    { href: "/pollution", Icon: IconSmog, label: t("home.card_pollution_label"), desc: t("home.card_pollution_desc") },
  ];
  const democracy = [
    { href: "/deputes", Icon: IconUsers, label: t("home.card_deputes_label"), desc: t("home.card_deputes_desc") },
    { href: "/groupes", Icon: IconLandmark, label: t("home.card_groupes_label"), desc: t("home.card_groupes_desc") },
    { href: "/scrutins", Icon: IconScale, label: t("home.card_scrutins_label"), desc: t("home.card_scrutins_desc") },
    { href: "/mes-votes", Icon: IconCheck, label: t("home.card_mesvotes_label"), desc: t("home.card_mesvotes_desc") },
  ];
  return { environment, democracy };
}

function Card({ href, Icon, label, desc }) {
  const { sobriety } = useSobriety();
  return (
    <Link href={href} className="pdpb-card" style={{ display: "block", textDecoration: "none", color: "var(--color-texte)" }}>
      {!sobriety && <Icon size={22} style={{ color: "var(--color-forest)" }} />}
      <p style={{ fontSize: 14, fontWeight: 600, margin: sobriety ? 0 : "8px 0 2px" }}>{label}</p>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>{desc}</p>
    </Link>
  );
}

export default function Home() {
  const [country, setCountry] = useState("FRA");
  const { t } = useT();
  const { environment, democracy } = useCardGroups(t);

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <p style={{ fontSize: 14, color: "var(--color-texte-clair)", margin: "0 0 1rem" }}>
        {t("home.intro")}
      </p>

      <ActionCTA />

      <p>
        <Link href={`/pays/${country}`} style={{ fontWeight: 600 }}>{t("home.see_my_country")}</Link>
      </p>

      <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>{t("home.section_environment")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {environment.map((c) => (
          <Card key={c.href} {...c} />
        ))}
      </div>

      <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>{t("home.section_democracy")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {democracy.map((c) => (
          <Card key={c.href} {...c} />
        ))}
      </div>

      <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>{t("home.section_engage")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Card href="/debunk" Icon={IconSearch} label={t("home.card_debunk_label")} desc={t("home.card_debunk_desc")} />
      </div>
    </div>
  );
}
