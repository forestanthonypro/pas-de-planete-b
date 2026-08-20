import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { detectDefaultCountry } from "../lib/detectCountry";
import { useSobriety } from "../lib/SobrietyContext";
import { useDiscoveryMode } from "../lib/DiscoveryModeContext";
import { useTheme } from "../lib/ThemeContext";
import { useT } from "../lib/useT";
import { IconLeaf, IconSun, IconMoon, IconScroll, IconHome, IconBulb } from "./icons";
import BackgroundScene from "./BackgroundScene";
import ScrollTopButton from "./ScrollTopButton";

const LANGUAGE_LABELS = {
  fr: "Français",
  en: "English",
  es: "Español",
  it: "Italiano",
  ru: "Русский",
  ja: "日本語",
  zh: "中文",
  hi: "हिन्दी",
};

// useRouter() renvoie null quand aucun contexte routeur n'est disponible
// (page d'erreur générée automatiquement par Next.js pendant le build) —
// on gère ce cas normalement après l'appel du Hook, jamais en enveloppant
// le Hook lui-même dans un try/catch : ça viole les Rules of Hooks de
// React (voir react.dev/warnings/invalid-hook-call-warning) et perturbe le
// suivi interne de l'ordre des Hooks, avec des effets de bord difficiles
// à diagnostiquer (a été la cause d'un bug de build sur /404 qui semblait
// pourtant n'avoir aucun rapport avec ce fichier — voir KNOWN_ISSUES_build.md).
function LanguageSwitcher() {
  const router = useRouter();
  if (!router) return null;

  function handleChange(e) {
    const newLocale = e.target.value;
    router.push(router.pathname, router.asPath, { locale: newLocale });
  }

  return (
    <select
      value={router.locale}
      onChange={handleChange}
      aria-label="Choisir la langue / Choose language"
      style={{ border: "1px solid var(--color-bordure)", borderRadius: "var(--radius)", padding: "6px 8px", fontSize: 13 }}
    >
      {router.locales.map((loc) => (
        <option key={loc} value={loc}>{LANGUAGE_LABELS[loc] || loc}</option>
      ))}
    </select>
  );
}

export default function Layout({ children }) {
  const { sobriety, setSobriety } = useSobriety();
  const { isDiscovery, setIsDiscovery } = useDiscoveryMode();
  const { theme, setTheme } = useTheme();
  const { t } = useT();
  const [countrySummary, setCountrySummary] = useState("FRA");

  useEffect(() => {
    setCountrySummary(detectDefaultCountry());
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <BackgroundScene />

      <header
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.6rem",
          padding: "0.85rem 1.25rem",
          borderBottom: "1px solid var(--color-bordure)",
          background: "var(--color-fond)",
        }}
      >
        <Link href="/" prefetch={false} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--color-texte)" }}>
          {!sobriety && <IconLeaf size={22} style={{ color: "var(--color-forest)" }} />}
          <strong style={{ fontSize: 16 }}>Pas de planète B</strong>
        </Link>

        <Link
          href="/"
          prefetch={false}
          title={t("common.nav_home_title")}
          aria-label={t("common.nav_home_title")}
          style={
            sobriety
              ? { color: "var(--color-forest)", fontWeight: 600, textDecoration: "underline" }
              : {
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--color-forest)",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: 20,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 13,
                }
          }
        >
          {!sobriety && <IconHome size={16} />}
          {t("common.nav_home")}
        </Link>

        <div
          role="group"
          aria-label={t("common.mode_switch_aria")}
          style={{ display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid #ba7517" }}
        >
          <Link
            href="/decouverte"
            prefetch={false}
            onClick={() => setIsDiscovery(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              background: isDiscovery ? "var(--color-forest)" : "#faeeda",
              color: isDiscovery ? "white" : "#633806",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                flexShrink: 0,
                background: isDiscovery ? "#c0dd97" : "#ba7517",
              }}
            />
            {t("common.mode_switch_to_discovery")}
          </Link>
          <Link
            href="/"
            prefetch={false}
            onClick={() => setIsDiscovery(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              background: !isDiscovery ? "var(--color-forest)" : "#faeeda",
              color: !isDiscovery ? "white" : "#633806",
            }}
          >
            <IconBulb size={14} />
            {t("common.mode_switch_to_expert")}
          </Link>
        </div>

        {!isDiscovery && (
          <>
            <Link
              href={`/pays/${countrySummary}`}
              prefetch={false}
              title={t("common.nav_country_summary")}
              aria-label={t("common.nav_country_summary")}
              style={
                sobriety
                  ? { color: "var(--color-forest)", fontWeight: 600, textDecoration: "underline" }
                  : {
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--color-forest)",
                      color: "white",
                      padding: "6px 14px",
                      borderRadius: 20,
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 13,
                    }
              }
            >
              {!sobriety && <IconLeaf size={16} />}
              {t("common.nav_country_summary")}
            </Link>

            <nav style={{ display: "flex", gap: sobriety ? "1rem" : "0.5rem", flexWrap: "wrap", fontSize: 14 }}>
              {[
                { href: "/?section=democratie", label: t("common.nav_democracy") },
                { href: "/?section=sengager", label: t("common.nav_engage") },
                { href: "/mes-votes", label: t("common.nav_myvotes") },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  style={
                    sobriety
                      ? { color: "var(--color-bleu-clair)" }
                      : {
                          background: "var(--color-carte)",
                          border: "1px solid var(--color-bordure)",
                          borderRadius: 20,
                          padding: "6px 14px",
                          color: "var(--color-texte)",
                          textDecoration: "none",
                          fontWeight: 500,
                        }
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </>
        )}

        <Link
          href="/kit-communication"
          prefetch={false}
          style={
            sobriety
              ? { color: "var(--color-forest)", fontWeight: 600, textDecoration: "underline" }
              : {
                  background: "var(--color-carte)",
                  border: "1px solid var(--color-bordure)",
                  borderRadius: 20,
                  padding: "6px 14px",
                  color: "var(--color-texte)",
                  textDecoration: "none",
                  fontWeight: 500,
                  fontSize: 14,
                }
          }
        >
          {t("common.nav_kit")}
        </Link>

        <Link
          href="/charte"
          prefetch={false}
          title={t("common.nav_charter_title")}
          aria-label={t("common.nav_charter_title")}
          style={
            sobriety
              ? { color: "var(--color-forest)", fontWeight: 600, textDecoration: "underline" }
              : {
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--color-forest)",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: 20,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 13,
                }
          }
        >
          {!sobriety && <IconScroll size={16} />}
          {t("common.nav_charter")}
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <LanguageSwitcher />

          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={t("common.dark_mode_aria")}
            title={t("common.dark_mode_toggle")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              background: "var(--color-carte)",
              border: "1px solid var(--color-bordure)",
              borderRadius: "var(--radius)",
              padding: "6px 10px",
              cursor: "pointer",
              color: "var(--color-texte)",
            }}
          >
            {theme === "dark" ? <IconMoon size={16} /> : <IconSun size={16} />}
          </button>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              background: "var(--color-carte)",
              border: "1px solid var(--color-bordure)",
              borderRadius: "var(--radius)",
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            {!sobriety && <IconLeaf size={16} style={{ color: "var(--color-forest)" }} />}
            {t("common.sobriety_toggle")}
            <input
              type="checkbox"
              checked={sobriety}
              onChange={(e) => setSobriety(e.target.checked)}
              aria-label={t("common.sobriety_aria")}
            />
          </label>
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 1, flex: 1, width: "100%" }}>{children}</main>

      <footer
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid var(--color-bordure)",
          padding: "1rem 1.5rem",
          fontSize: 12,
          color: "var(--color-texte-clair)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          background: "var(--color-fond)",
        }}
      >
        {!sobriety && <IconLeaf size={15} style={{ color: "var(--color-forest)" }} />}
        {t("common.footer_ecoconception")}
        <span aria-hidden="true">·</span>
        <Link href="/impact" prefetch={false} style={{ color: "inherit" }}>{t("common.footer_impact")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/etat-des-donnees" prefetch={false} style={{ color: "inherit" }}>{t("common.footer_data_status")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/mentions-legales" prefetch={false} style={{ color: "inherit" }}>{t("common.footer_legal")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/confidentialite" prefetch={false} style={{ color: "inherit" }}>{t("common.footer_privacy")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/notifications" prefetch={false} style={{ color: "inherit" }}>Notifications</Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact" prefetch={false} style={{ color: "inherit" }}>{t("common.footer_contact")}</Link>
      </footer>

      <ScrollTopButton />
    </div>
  );
}
