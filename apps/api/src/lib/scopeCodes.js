import countriesLib from "i18n-iso-countries";

// Les 8 codes fixes pour une portée plus large qu'un seul pays — voir
// db/migrations/046_scope_codes.sql pour le détail. Distincts des codes
// pays ISO 3166-1 alpha-3 (toujours 3 lettres eux aussi, mais aucun pays
// réel n'a l'un de ces codes précis).
export const CONTINENT_WORLD_CODES = ["AFR", "NAC", "SAM", "ASI", "EUR", "OCE", "ANT", "WORLD"];
const CONTINENT_WORLD_SET = new Set(CONTINENT_WORLD_CODES);

export function isValidScopeCode(code) {
  if (typeof code !== "string") return false;
  const upper = code.toUpperCase();
  if (CONTINENT_WORLD_SET.has(upper)) return true;
  return countriesLib.alpha3ToAlpha2(upper) !== undefined;
}

// Nettoie une entrée utilisateur (tableau attendu, mais on se protège de
// toute forme inattendue) : majuscule, retire les codes invalides et les
// doublons. Ne renvoie jamais autre chose qu'un tableau, jamais d'erreur —
// une entrée malformée devient simplement un tableau vide plutôt qu'un
// rejet, cohérent avec le fait que scope_codes reste optionnel partout.
export function sanitizeScopeCodes(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((c) => (typeof c === "string" ? c.toUpperCase().trim() : null))
    .filter((c) => c && isValidScopeCode(c));
  return [...new Set(cleaned)];
}

// Lit le paramètre de requête ?scopes=FRA,ESP,EUR (chaîne séparée par des
// virgules — format simple à construire côté front, pas besoin de
// scopes[]=FRA&scopes[]=ESP) et le nettoie de la même façon qu'une
// soumission de formulaire.
export function parseScopesQueryParam(value) {
  if (!value || typeof value !== "string") return [];
  return sanitizeScopeCodes(value.split(","));
}
