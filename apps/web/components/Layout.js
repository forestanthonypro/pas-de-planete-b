import Link from "next/link";
import { useRouter } from "next/router";
import { useSobriety } from "../lib/SobrietyContext";
import { useT } from "../lib/useT";
import { IconLeaf } from "./icons";

const LANGUAGE_LABELS = { fr: "Français", en: "English" };

function LanguageSwitcher() {
  const router = useRouter();

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
  const { t } = useT();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.85rem 1.5rem",
          borderBottom: "1px solid var(--color-bordure)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--color-texte)" }}>
          {!sobriety && <IconLeaf size={22} style={{ color: "var(--color-forest)" }} />}
          <strong style={{ fontSize: 16 }}>Pas de planète B</strong>
        </Link>

        <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: 14 }}>
          <Link href="/co2">{t("common.nav_environment")}</Link>
          <Link href="/deputes">{t("common.nav_democracy")}</Link>
          <Link href="/debunk">{t("common.nav_engage")}</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <LanguageSwitcher />

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

      <main style={{ flex: 1, width: "100%" }}>{children}</main>

      <footer
        style={{
          borderTop: "1px solid var(--color-bordure)",
          padding: "1rem 1.5rem",
          fontSize: 12,
          color: "var(--color-texte-clair)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {!sobriety && <IconLeaf size={15} style={{ color: "var(--color-forest)" }} />}
        {t("common.footer_ecoconception")}
      </footer>
    </div>
  );
}
