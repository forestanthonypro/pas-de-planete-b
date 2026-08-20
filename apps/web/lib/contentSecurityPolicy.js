const API_ORIGIN = "https://api.pasdeplaneteb.com";
const REPORTING_ENDPOINT = `${API_ORIGIN}/api/csp-report`;

// Les entrées localhost ne servent qu'au serveur de développement Next.js
// (HMR en WebSocket, API locale) — les inclure inconditionnellement les
// aurait expédiées telles quelles dans la CSP livrée aux vrais visiteurs en
// production, une CSP qui n'a rien à voir avec leur propre machine.
const isProduction = process.env.NODE_ENV === "production";

// Politique volontairement déployée d'abord en Report-Only. Le site utilise
// encore des styles React inline et Next.js injecte des scripts d'amorçage
// inline : les retirer de la CSP avant une migration vers des nonces
// casserait l'hydratation et une grande partie de la mise en page.
const directives = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "https://stats.pasdeplaneteb.com"],
  "script-src-attr": ["'none'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "style-src-attr": ["'unsafe-inline'"],
  // Les images éditoriales sont administrables et peuvent venir de sources
  // HTTPS variées. Les restreindre à une liste figée casserait des contenus
  // existants ; les violations collectées permettront de resserrer ensuite.
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    API_ORIGIN,
    "https://stats.pasdeplaneteb.com",
    ...(isProduction ? [] : ["http://localhost:4000", "ws://localhost:3000"]),
  ],
  "frame-src": [
    "'self'",
    API_ORIGIN,
    "https://www.youtube.com",
    "https://youtube.com",
    "https://www.youtube-nocookie.com",
    "https://youtube-nocookie.com",
    "https://open.spotify.com",
    "https://embed.podcasts.apple.com",
    "https://podcasts.apple.com",
  ],
  "media-src": ["'self'", "blob:", "https:"],
  "worker-src": ["'self'", "blob:"],
  "manifest-src": ["'self'"],
  "report-uri": [REPORTING_ENDPOINT],
  "report-to": ["csp-endpoint"],
};

function serializeContentSecurityPolicy(policy = directives) {
  return Object.entries(policy)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

module.exports = {
  REPORTING_ENDPOINT,
  directives,
  serializeContentSecurityPolicy,
};
