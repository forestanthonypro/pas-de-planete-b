const {
  REPORTING_ENDPOINT,
  serializeContentSecurityPolicy,
} = require("./lib/contentSecurityPolicy");

const contentSecurityPolicy = serializeContentSecurityPolicy();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Phase 1 : observe et collecte sans bloquer. Ne remplacer par
            // Content-Security-Policy qu'après validation des rapports et
            // un parcours réel des pages publiques/admin sur plusieurs jours.
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy,
          },
          {
            key: "Reporting-Endpoints",
            value: `csp-endpoint=\"${REPORTING_ENDPOINT}\"`,
          },
        ],
      },
    ];
  },
  // Génération statique forcée en mono-thread (workerThreads: false, cpus: 1).
  // Sans ça, avec plusieurs workers en parallèle, un bug de concurrence dans
  // le pipeline de rendu interne de _document (contexte React HtmlContext non
  // propagé correctement entre workers) fait planter le build sur /404 avec
  // "<Html> should not be imported outside of pages/_document" — voir
  // KNOWN_ISSUES_build.md pour le détail complet de l'investigation.
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  i18n: {
    // Phase 1 : français + anglais. Phase 2 : espagnol + italien (langues
    // romanes proches du français, meilleure qualité de traduction
    // garantie). Phase 3 : russe, japonais, chinois, hindi — relecture par
    // un locuteur natif recommandée avant publication, en particulier sur
    // les pages légales et le vocabulaire civique spécifique.
    locales: ["fr", "en", "es", "it", "ru", "ja", "zh", "hi"],
    defaultLocale: "fr",
    localeDetection: false,
  },
};
module.exports = nextConfig;
