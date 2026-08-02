/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
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
