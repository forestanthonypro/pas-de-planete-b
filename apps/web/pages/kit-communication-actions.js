import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { useT } from "../lib/useT";
import { useCountriesList } from "../lib/useCountriesList";
import { localizedCountryName } from "../lib/countryNames";
import { detectDefaultCountry } from "../lib/detectCountry";
import { useSobriety } from "../lib/SobrietyContext";
import CountrySelect from "../components/CountrySelect";
import ShareButtons from "../components/ShareButtons";
import { IconScroll } from "../components/icons";

const WEB_URL = "https://pasdeplaneteb.com";

// Mêmes 8 langues, mêmes libellés que le sélecteur du header (Layout.js) —
// dupliqué ici en constante plutôt qu'importé, Layout.js ne les exporte
// pas actuellement.
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

export default function KitCommunicationActionsPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const { sobriety } = useSobriety();
  const countries = useCountriesList("/api/co2/countries");
  const [countryCode, setCountryCode] = useState("FRA");
  const [docLang, setDocLang] = useState("fr");
  const [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | generating | ready | error
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const selectedCountryName = localizedCountryName(countryCode, locale);

  // Seule source de vérité pour l'état initial — pays/langue de l'URL en
  // priorité (lien partagé), sinon détection habituelle du site. Tout géré
  // ici en un seul endroit pour éviter toute course avec un autre effet
  // qui écraserait la valeur juste après (bug rencontré : useCountrySelector
  // a son propre effet de détection au montage, qui pouvait s'exécuter
  // après celui-ci et écraser silencieusement le pays venu de l'URL).
  useEffect(() => {
    if (!router.isReady || initialized) return;
    const { country, lang } = router.query;
    if (typeof country === "string" && country.length === 3) {
      setCountryCode(country.toUpperCase());
    } else {
      setCountryCode(detectDefaultCountry("FRA"));
    }
    if (typeof lang === "string" && LANGUAGE_LABELS[lang]) {
      setDocLang(lang);
    } else if (LANGUAGE_LABELS[locale]) {
      setDocLang(locale);
    }
    setInitialized(true);
  }, [router.isReady, initialized, locale, router.query]);

  // Pré-remplit pays/langue depuis l'URL si on arrive via un lien partagé
  // (?country=FRA&lang=ja) — sans ça, un lien partagé rouvre toujours sur
  // le pays par défaut, ce qui viderait le partage de son intérêt.
  const pdfEndpoint = `/api/kit-communication-actions/pdf/${countryCode}?lang=${docLang}`;
  // Lien à partager : la page elle-même (jolie URL, aperçu correct sur les
  // réseaux sociaux), jamais le PDF brut de l'API — un PDF binaire n'a pas
  // de titre/description/aperçu et ferait un lien peu engageant à partager.
  // Lien à partager : la nouvelle page de contenu /kit-communication/{code}
  // (rendue côté serveur, toujours à jour), avec le vrai préfixe de langue
  // Next.js (i18n natif : pas de préfixe pour le français, "/xx/" pour les
  // 7 autres) — jamais cette page-sélecteur elle-même, ni le PDF brut.
  const localePrefix = docLang === "fr" ? "" : `/${docLang}`;
  // Deux usages différents : og:url / ShareButtons doivent toujours
  // pointer vers le vrai domaine public (un lien partagé doit fonctionner
  // pour n'importe qui, peu importe où on le génère) — mais le bouton "Voir
  // la version web" ci-dessous, lui, doit rester relatif pour fonctionner
  // aussi en local/preview, pas seulement en production. Corrigé le 22
  // août (repéré en testant en local : le bouton renvoyait à tort vers
  // pasdeplaneteb.com même en développement).
  const localSharePath = `${localePrefix}/kit-communication-actions/${countryCode.toLowerCase()}`;
  const sharePageUrl = `${WEB_URL}${localSharePath}`;

  function resetResult() {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
    setStatus("idle");
    setErrorMsg(null);
  }

  function handleCountryChange(code) {
    setCountryCode(code);
    resetResult();
  }

  function handleLangChange(e) {
    setDocLang(e.target.value);
    resetResult();
  }

  async function handleGenerate() {
    setStatus("generating");
    setErrorMsg(null);
    try {
      const res = await fetch(pdfEndpoint);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || t("kit.error_generic"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.message || t("kit.error_generic"));
      setStatus("error");
    }
  }

  const cardStyle = sobriety
    ? { border: "none", borderBottom: "1px solid var(--color-bordure)", borderRadius: 0, padding: "1rem 0" }
    : { background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: 12, padding: "1.25rem" };

  const buttonStyle = (disabled) =>
    sobriety
      ? { background: "none", border: "none", padding: 0, color: disabled ? "var(--color-texte-clair)" : "var(--color-forest)", textDecoration: disabled ? "none" : "underline", fontWeight: 600, fontSize: 14, cursor: disabled ? "default" : "pointer" }
      : {
          display: "inline-block",
          background: disabled ? "var(--color-bordure)" : "var(--color-forest)",
          color: disabled ? "var(--color-texte-clair)" : "white",
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
          fontWeight: 600,
          fontSize: 14,
          cursor: disabled ? "default" : "pointer",
        };

  const pageTitle = `${t("kit.title_actions")} — ${selectedCountryName} | Pas de planète B`;
  const pageDescription = t("kit.subtitle_actions");
  const ogImageUrl = `/api/kit-communication-actions/og-image/${countryCode}?lang=${docLang}`;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={sharePageUrl} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {!sobriety && <IconScroll size={22} style={{ color: "var(--color-forest)" }} />}
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t("kit.title_actions")}</h1>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: "1.75rem" }}>{t("kit.subtitle_actions")}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: "1.75rem" }}>
        <Link
          href="/kit-communication"
          style={{
            display: "block",
            border: "2px solid var(--color-bordure)",
            background: "var(--color-carte)",
            borderRadius: 12,
            padding: "1rem 1.25rem",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--color-texte)", margin: "0 0 4px" }}>
            ← {t("kit.card_constats_title")}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{t("kit.card_constats_desc")}</p>
        </Link>
        <div
          style={{
            border: "2px solid var(--color-forest)",
            background: "var(--color-carte)",
            borderRadius: 12,
            padding: "1rem 1.25rem",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--color-forest)", margin: "0 0 4px" }}>
            {t("kit.card_actions_title")} · {t("kit.currently_here")}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>{t("kit.card_actions_desc")}</p>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <CountrySelect
            countries={countries}
            value={countryCode}
            onChange={handleCountryChange}
            preferredLang={locale}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-texte)", marginBottom: 6 }}>
            {t("kit.language_label")}
          </label>
          <select
            value={docLang}
            onChange={handleLangChange}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid var(--color-bordure)",
              background: "var(--color-fond)",
              color: "var(--color-texte)",
            }}
          >
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" onClick={handleGenerate} disabled={status === "generating"} style={buttonStyle(status === "generating")}>
        {status === "generating" ? t("kit.generating") : t("kit.generate_button")}
      </button>

      {status === "generating" && (
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", marginTop: 10 }}>{t("kit.generating_hint")}</p>
      )}

      {status === "error" && (
        <p style={{ fontSize: 13, color: "#d63e2a", marginTop: 10 }}>{errorMsg}</p>
      )}

      {status === "ready" && pdfBlobUrl && (
        <div style={{ ...cardStyle, marginTop: "1.5rem" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", margin: "0 0 12px" }}>
            {t("kit.ready_intro", { country: selectedCountryName })}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <a href={pdfBlobUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle(false), textDecoration: "none" }}>
              {t("kit.open_print")}
            </a>
            <a
              href={pdfBlobUrl}
              download={`pasdeplaneteb-actions-${countryCode.toLowerCase()}-${docLang}.pdf`}
              style={{
                display: "inline-block",
                background: "none",
                border: "1.5px solid var(--color-forest)",
                color: "var(--color-forest)",
                padding: "9px 19px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {t("kit.download")}
            </a>
            <a
              href={localSharePath}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", background: "none", border: "none", color: "var(--color-forest)", padding: "9px 4px", fontWeight: 600, fontSize: 14, textDecoration: "underline" }}
            >
              {t("kit.view_web_version")}
            </a>
          </div>
          <ShareButtons title={pageTitle} url={sharePageUrl} />
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: 10, marginBottom: 0 }}>{t("kit.regenerate_hint")}</p>
        </div>
      )}
    </div>
  );
}
