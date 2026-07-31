import Link from "next/link";
import { useRouter } from "next/router";
import { useSobriety } from "../lib/SobrietyContext";
import { useTheme } from "../lib/ThemeContext";
import { useT } from "../lib/useT";
import { IconLeaf, IconSun, IconMoon, IconScroll } from "./icons";
import BackgroundScene from "./BackgroundScene";
import ScrollTopButton from "./ScrollTopButton";

const LANGUAGE_LABELS = { fr: "Français", en: "English" };

// useRouter() lève une erreur quand aucun contexte routeur n'est disponible
// (page d'erreur générée automatiquement par Next.js pendant le build) —
// on n'affiche simplement rien dans ce cas précis plutôt que de planter.
// Le hook est bien appelé exactement une fois à chaque rendu (jamais sauté
// ni répété) : la règle react-hooks/rules-of-hooks se déclenche ici sur un
// faux positif propre à ce pattern try/catch, pas sur un vrai problème
// d'ordre des hooks.
function LanguageSwitcher() {
  let router = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    return null;
  }
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
  const { theme, setTheme } = useTheme();
  const { t } = useT();

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
          gap: "0.75rem",
          padding: "0.85rem 1.5rem",
          borderBottom: "1px solid var(--color-bordure)",
          background: "var(--color-fond)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--color-texte)" }}>
          {!sobriety && <IconLeaf size={22} style={{ color: "var(--color-forest)" }} />}
          <strong style={{ fontSize: 16 }}>Pas de planète B</strong>
        </Link>

        <nav style={{ display: "flex", gap: sobriety ? "1rem" : "0.5rem", flexWrap: "wrap", fontSize: 14 }}>
          {[
            { href: "/?section=environnement", label: t("common.nav_environment") },
            { href: "/?section=democratie", label: t("common.nav_democracy") },
            { href: "/?section=sengager", label: t("common.nav_engage") },
            { href: "/mes-votes", label: t("common.nav_myvotes") },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
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

        <Link
          href="/charte"
          title={t("common.nav_charter_title")}
          aria-label={t("common.nav_charter_title")}
          style={
            sobriety
              ? { color: "#1b5e20", fontWeight: 600, textDecoration: "underline" }
              : {
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#1b5e20",
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
      </footer>

      <ScrollTopButton />
    </div>
  );
}
