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
  // Proxy /api/* vers le backend, en interne au réseau Docker.
  //
  // Pourquoi : le navigateur ne doit JAMAIS appeler l'API directement en
  // cross-site (ex. site sur localhost:3000, API sur 192.168.1.18:4000,
  // ou en prod pasdeplaneteb.com / api.pasdeplaneteb.com selon la
  // config réseau). Le cookie de session admin (SameSite=Strict/Lax,
  // voir apps/api/src/lib/auth.js) est alors silencieusement rejeté par
  // le navigateur — ce n'est pas un bug de configuration, c'est le
  // navigateur qui applique la protection anti-CSRF correctement.
  //
  // La solution : le navigateur appelle toujours `/api/...` en relatif,
  // sur la même origine que la page. C'est Next.js (côté serveur, dans
  // ce conteneur) qui relaie vers l'API réelle via le nom de service
  // Docker `api` — jamais via l'IP publique/LAN. Fonctionne quel que
  // soit l'hôte utilisé pour atteindre le site (localhost, IP réseau,
  // domaine de prod), sans jamais toucher .env selon le contexte de test.
  //
  // API_INTERNAL_URL (sans préfixe NEXT_PUBLIC_) n'est lue que côté
  // serveur, jamais exposée au navigateur — contrairement à
  // NEXT_PUBLIC_API_URL qui reste nécessaire pour les appels effectués
  // pendant le rendu serveur (getStaticProps), lesquels n'ont pas de
  // notion d'origine navigateur et ne posent donc pas ce problème.
  async rewrites() {
    const apiInternalUrl = process.env.API_INTERNAL_URL || "http://api:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
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
