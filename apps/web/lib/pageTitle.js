// Logique pure des titres de page (sans JSX, pour être testable avec
// node --test comme le reste de lib/). Utilisée par components/PageTitle.js.
const SITE_NAME = "Pas de planète B";

// Construit le titre complet « <page> — Pas de planète B », ou null si le
// titre de la page n'est pas (encore) utilisable : donnée pas encore
// chargée (undefined/null/vide) — on laisse alors le titre par défaut de
// _app.js plutôt que d'afficher « undefined — Pas de planète B ».
function buildPageTitle(title) {
  if (typeof title !== "string") return null;
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean || /\b(undefined|null)\b/.test(clean)) return null;
  return clean === SITE_NAME ? SITE_NAME : `${clean} — ${SITE_NAME}`;
}

module.exports = { SITE_NAME, buildPageTitle };
