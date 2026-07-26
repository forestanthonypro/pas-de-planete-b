// Devine la langue préférée du visiteur parmi celles qu'on stocke (fr, en, es, de),
// sans aucun appel réseau ni donnée transmise nulle part.
const SUPPORTED = ["fr", "en", "es", "de"];

export function detectPreferredLanguage(fallback = null) {
  if (typeof navigator === "undefined") return fallback;
  const lang = (navigator.language || "").split("-")[0].toLowerCase();
  return SUPPORTED.includes(lang) ? lang : fallback;
}
