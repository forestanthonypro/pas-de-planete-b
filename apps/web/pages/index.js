import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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
  IconPlay,
  IconScroll,
} from "../components/icons";

// Couleur de la pastille par catégorie — la couleur porte du sens (nature,
// énergie, eau...), pas juste une alternance décorative. Cohérent avec le
// modèle "Nature épurée" retenu.
const TINTS = {
  green: { bg: "#eaf3de", color: "#1b5e20" },
  amber: { bg: "#fdf1d6", color: "#a86b0a" },
  blue: { bg: "#e3eef7", color: "#0b3c5d" },
  tan: { bg: "#f3e9dd", color: "#8a5a2b" },
  red: { bg: "#fbe4de", color: "#b0401f" },
  mauve: { bg: "#ece5f2", color: "#5c3d7a" },
  teal: { bg: "#dcf2ee", color: "#0f6e56" },
};

function useCardGroups(t) {
  const environment = [
    { href: "/co2", Icon: IconCloud, label: t("home.card_co2_label"), desc: t("home.card_co2_desc"), tint: "green" },
    { href: "/energie", Icon: IconBolt, label: t("home.card_energie_label"), desc: t("home.card_energie_desc"), tint: "amber" },
    { href: "/eau", Icon: IconDroplet, label: t("home.card_eau_label"), desc: t("home.card_eau_desc"), tint: "blue" },
    { href: "/vegetation", Icon: IconTree, label: t("home.card_vegetation_label"), desc: t("home.card_vegetation_desc"), tint: "green" },
    { href: "/especes", Icon: IconPaw, label: t("home.card_especes_label"), desc: t("home.card_especes_desc"), tint: "tan" },
    { href: "/incendies", Icon: IconFlame, label: t("home.card_incendies_label"), desc: t("home.card_incendies_desc"), tint: "red" },
    { href: "/pollution", Icon: IconSmog, label: t("home.card_pollution_label"), desc: t("home.card_pollution_desc"), tint: "mauve" },
  ];
  const democracy = [
  { href: "/france", Icon: IconLandmark, label: t("home.card_france_label"), desc: t("home.card_france_desc"), tint: "blue" },
  { href: "/international", Icon: IconLandmark, label: t("home.card_international_label"), desc: t("home.card_international_desc"), tint: "blue" },
  ];
  return { environment, democracy };
}

function Card({ href, Icon, label, desc, tint }) {
  const { sobriety } = useSobriety();
  const colors = TINTS[tint] || TINTS.green;
  return (
    <Link href={href} prefetch={false} className="pdpb-card" style={{ display: "block", textDecoration: "none", color: "var(--color-texte)" }}>
      {!sobriety && (
        <div className="pdpb-icon-badge" style={{ background: colors.bg }}>
          <Icon size={18} style={{ color: colors.color }} />
        </div>
      )}
      <p style={{ fontSize: 14, fontWeight: 600, margin: sobriety ? 0 : "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>{desc}</p>
    </Link>
  );
}

export default function Home() {
  const [country, setCountry] = useState("FRA");
  const { t } = useT();
  const router = useRouter();
  const { sobriety } = useSobriety();
  const { environment, democracy } = useCardGroups(t);

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  // Filtrage par section : /?section=environnement|democratie|sengager —
  // ne montre que la section demandée, avec un lien pour revenir à la vue
  // complète. Sans paramètre, l'accueil affiche tout comme avant.
  const section = typeof router.query.section === "string" ? router.query.section : null;
  const showEnvironment = !section || section === "environnement";
  const showDemocratie = !section || section === "democratie";
  const showEngager = !section || section === "sengager";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      {!section && (
        sobriety ? (
          <div className="pdpb-hero">
            <p style={{ fontSize: 14, color: "var(--color-texte-clair)", margin: "0 0 1rem" }}>
              {t("home.intro")}
            </p>
            <p style={{ margin: 0 }}>
              <Link href={`/pays/${country}`} prefetch={false} style={{ fontWeight: 600 }}>{t("home.see_my_country")}</Link>
            </p>
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0.5rem 0 0" }}>{t("home.see_my_country_desc")}</p>
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              borderRadius: 16,
              padding: "2rem 1.75rem",
              overflow: "hidden",
              background: "var(--color-hero-bg)",
            }}
          >
            
            
            
            <p style={{ fontSize: 16, color: "white", margin: "0 0 1.25rem", position: "relative" }}>
              {t("home.intro")}
            </p>
            <div
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                width: "100%",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              {environment.map((item) => {
                const colors = TINTS[item.tint] || TINTS.green;
                return (
                  <Link
                    key={item.href}
                    className="pdpb-hero-icon"
                    href={item.href}
                    prefetch={false}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      textDecoration: "none",
                      color: "white",
                      width: 70,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: colors.bg,
                      }}
                    >
                      <item.Icon size={22} style={{ color: colors.color }} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, textAlign: "center" }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.3)", position: "relative", margin: "0 0 1.25rem" }} />
            
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", margin: "0.75rem 0 0", position: "relative" }}>{t("home.hero_desc_v2")}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: "white", margin: "1.25rem 0 0", position: "relative", textAlign: "center" }}>{t("home.hero_punchline")}</p>
          </div>
        )
      )}

      {!section && (
        <div style={{ marginTop: "1.25rem" }}>
          <ActionCTA />
        </div>
      )}

      {section && (
        <p style={{ fontSize: 13, marginBottom: "1rem" }}>
          <Link href="/" prefetch={false}>← {t("home.see_all_sections")}</Link>
        </p>
      )}

      {showDemocratie && (
        <>
          <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>{t("home.section_democracy")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {democracy.map((c) => (
              <Card key={c.href} {...c} />
            ))}
          </div>
        </>
      )}

      {showEngager && (
        <>
          <h2 style={{ fontSize: 18, margin: "1.5rem 0 0.75rem" }}>{t("home.section_engage")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <Card href="/debunk" Icon={IconSearch} label={t("home.card_debunk_label")} desc={t("home.card_debunk_desc")} tint="teal" />
            <Card href="/interviews" Icon={IconPlay} label={t("home.card_interviews_label")} desc={t("home.card_interviews_desc")} tint="mauve" />
            <Card href="/paysans" Icon={IconTree} label={t("home.card_paysans_label")} desc={t("home.card_paysans_desc")} tint="green" />
            <Card href="/ressources" Icon={IconLandmark} label={t("home.card_ressources_label")} desc={t("home.card_ressources_desc")} tint="blue" />
            <Card href="/petitions" Icon={IconScroll} label={t("home.card_petitions_label")} desc={t("home.card_petitions_desc")} tint="mauve" />
        <Card href="/idees-enfants" Icon={IconCheck} label={t("home.card_futureideas_label")} desc={t("home.card_futureideas_desc")} tint="blue" />
          </div>
        </>
      )}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
