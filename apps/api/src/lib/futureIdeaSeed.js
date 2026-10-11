import { sanitizeScopeCodes } from "./scopeCodes.js";
import { PETITION_LOCALES } from "./petitionSeed.js";

// Mêmes 8 langues que partout sur le site ; le français est la donnée source
// dans future_ideas, les 7 autres vivent dans content_translations.
export const FUTURE_IDEA_LOCALES = PETITION_LOCALES;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Valide un lot d'idées AVANT toute écriture en base : une langue oubliée ou
// un code de portée inventé fait échouer tout le lot, jamais une publication
// à moitié.
export function validateFutureIdeaSeed(seed) {
  const errors = [];
  const ideas = [];
  const entries = seed && Array.isArray(seed.ideas) ? seed.ideas : null;
  if (!entries || entries.length === 0) {
    return { ideas, errors: ['Le fichier doit contenir un tableau "ideas" non vide'] };
  }

  const seenSlugs = new Set();
  entries.forEach((entry, index) => {
    const label = `ideas[${index}]${entry && entry.slug ? ` (${entry.slug})` : ""}`;
    const fail = (message) => errors.push(`${label} : ${message}`);
    if (!entry || typeof entry !== "object") return fail("entrée invalide");

    if (typeof entry.slug !== "string" || !SLUG_RE.test(entry.slug) || entry.slug.length > 120) {
      fail("slug invalide (minuscules, chiffres et tirets uniquement)");
    } else if (seenSlugs.has(entry.slug)) {
      fail("slug en double dans le fichier");
    } else {
      seenSlugs.add(entry.slug);
    }

    const scopeCodes = Array.isArray(entry.scopeCodes) ? entry.scopeCodes : [];
    if (scopeCodes.length === 0 || sanitizeScopeCodes(scopeCodes).length !== scopeCodes.length) {
      fail("scopeCodes doit contenir au moins un code valide, sans doublon (ex. FRA, EUR, WORLD)");
    }

    const translations = entry.translations && typeof entry.translations === "object" ? entry.translations : {};
    for (const locale of FUTURE_IDEA_LOCALES) {
      const tr = translations[locale];
      const title = tr && typeof tr.title === "string" ? tr.title.trim() : "";
      const description = tr && typeof tr.description === "string" ? tr.description.trim() : "";
      if (!title) fail(`titre manquant pour la langue ${locale}`);
      if (!description) fail(`description manquante pour la langue ${locale}`);
      if (title.length > 250) fail(`titre trop long pour la langue ${locale}`);
      if (description.length > 2000) fail(`description trop longue pour la langue ${locale}`);
    }

    ideas.push({
      slug: entry.slug,
      scopeCodes: sanitizeScopeCodes(scopeCodes),
      published: entry.published === true,
      translations,
    });
  });

  return { ideas, errors };
}
