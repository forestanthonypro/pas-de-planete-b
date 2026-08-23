import countriesLib from "i18n-iso-countries";
import { COUNTRY_TO_CONTINENT, CONTINENT_TO_COUNTRIES } from "./countryContinents.js";

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

// Complète une liste de portées avec la hiérarchie géographique implicite
// dans LES DEUX SENS (pays <-> continent) — un pays ajoute son continent,
// un continent ajoute chacun de ses pays membres. Utilisée UNIQUEMENT
// pour le déclenchement des notifications (workers/pushNotifications.js) :
// un abonné pays doit être notifié d'un contenu continent, et
// réciproquement un abonné continent doit être notifié d'un contenu pays
// précis — les deux sont pertinents pour un abonnement (bidirectionnel).
// Ne PAS utiliser pour les filtres de recherche : voir
// expandScopeFilterForSearch ci-dessous, qui suit une logique différente
// (à sens unique) plus adaptée à une recherche.
export function expandScopeHierarchy(scopeCodes) {
  const expanded = new Set(scopeCodes);
  for (const code of scopeCodes) {
    if (CONTINENT_TO_COUNTRIES[code]) {
      for (const country of CONTINENT_TO_COUNTRIES[code]) expanded.add(country);
    } else if (COUNTRY_TO_CONTINENT[code]) {
      expanded.add(COUNTRY_TO_CONTINENT[code]);
    }
  }
  return [...expanded];
}

// Complète une liste de portées pour un FILTRE DE RECHERCHE — à sens
// unique, du plus large vers le plus précis uniquement (jamais l'inverse) :
//   - filtrer par un PAYS reste strict, aucune extension (on cherche du
//     contenu qui concerne précisément ce pays, pas toute l'Europe) ;
//   - filtrer par un CONTINENT ajoute chacun de ses pays membres (on
//     cherche tout ce qui concerne l'Europe, y compris le contenu propre
//     à la France, l'Allemagne...) ;
//   - filtrer par WORLD doit renvoyer tout, sans exception — géré à part
//     par worldSelected() ci-dessous plutôt qu'ici, car "tout" inclut
//     aussi le contenu sans scope_codes du tout, qu'aucune liste de codes
//     ne peut représenter par un simple chevauchement de tableaux.
export function expandScopeFilterForSearch(scopeCodes) {
  const expanded = new Set(scopeCodes);
  for (const code of scopeCodes) {
    if (CONTINENT_TO_COUNTRIES[code]) {
      for (const country of CONTINENT_TO_COUNTRIES[code]) expanded.add(country);
    }
    // Un code pays reste tel quel, volontairement — pas d'ajout de son
    // continent : filtrer par un pays doit rester strict.
  }
  return [...expanded];
}

// true si la sélection de l'utilisateur inclut WORLD — dans ce cas, le
// filtre par portée doit être ignoré entièrement (voir usage dans les
// routes), pour renvoyer tout le contenu, y compris celui sans
// scope_codes renseigné.
export function worldSelected(scopeCodes) {
  return scopeCodes.includes("WORLD");
}
