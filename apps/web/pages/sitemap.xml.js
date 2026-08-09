// Sitemap XML dynamique — pages principales du site uniquement (pas les
// milliers de sous-pages dynamiques comme chaque scrutin ou chaque
// député individuellement, hors périmètre pour l'instant). Pour ajouter
// une page, il suffit de l'ajouter à PAGES ci-dessous.
//
// Le français est la langue par défaut (voir next.config.js,
// defaultLocale: "fr") : ses URLs n'ont pas de préfixe de langue, les
// 7 autres langues en ont un (/en/..., /es/..., etc.) — comportement
// standard du routage i18n de Next.js, reproduit ici à l'identique.

const DOMAIN = "https://pasdeplaneteb.com";
const LOCALES = ["fr", "en", "es", "it", "ru", "ja", "zh", "hi"];
const DEFAULT_LOCALE = "fr";

const PAGES = [
  "/",
  "/co2",
  "/eau",
  "/energie",
  "/especes",
  "/incendies",
  "/pollution",
  "/vegetation",
  "/deputes",
  "/groupes",
  "/scrutins",
  "/ressources",
  "/petitions",
  "/petitions/proposer",
  "/debunk",
  "/interviews",
  "/paysans",
  "/idees-enfants",
  "/charte",
  "/impact",
  "/etat-des-donnees",
  "/mes-votes",
  "/confidentialite",
  "/mentions-legales",
  "/france",
  "/international",
  "/international/us",
  "/international/us/elus",
  "/international/us/groupes",
  "/international/us/scrutins",
  "/international/us/mes-votes",
];

function urlForLocale(page, locale) {
  const path = page === "/" ? "" : page;
  return locale === DEFAULT_LOCALE ? `${DOMAIN}${path || "/"}` : `${DOMAIN}/${locale}${path}`;
}

function buildSitemapXml() {
  const urlEntries = PAGES.flatMap((page) =>
    LOCALES.map((locale) => {
      const loc = urlForLocale(page, locale);
      const alternates = LOCALES.map(
        (altLocale) => `      <xhtml:link rel="alternate" hreflang="${altLocale}" href="${urlForLocale(page, altLocale)}" />`
      ).join("\n");
      const xDefault = `      <xhtml:link rel="alternate" hreflang="x-default" href="${urlForLocale(page, DEFAULT_LOCALE)}" />`;
      return `  <url>\n    <loc>${loc}</loc>\n${alternates}\n${xDefault}\n  </url>`;
    })
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join("\n")}
</urlset>`;
}

export default function Sitemap() {
  // Le rendu réel se fait entièrement côté serveur (voir getServerSideProps
  // ci-dessous) — ce composant ne s'affiche jamais.
  return null;
}

export async function getServerSideProps({ res }) {
  const xml = buildSitemapXml();
  res.setHeader("Content-Type", "application/xml");
  res.write(xml);
  res.end();
  return { props: {} };
}
