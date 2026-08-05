/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
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
