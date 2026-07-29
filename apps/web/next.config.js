/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  i18n: {
    // Phase 1 du multilingue : français + anglais d'abord, pour valider
    // l'infrastructure sur un cas réel avant d'étendre aux autres langues
    // prévues (allemand, espagnol, portugais du Brésil, russe, chinois
    // simplifié, japonais).
    locales: ["fr", "en"],
    defaultLocale: "fr",
    localeDetection: true,
  },
};
module.exports = nextConfig;
