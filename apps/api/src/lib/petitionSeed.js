import { sanitizeScopeCodes } from "./scopeCodes.js";

// Même liste que PUSH_LOCALES / les 8 langues du site (next.config.js). Le
// français est la donnée "source" dans la table petitions ; les 7 autres
// vivent dans content_translations (voir lib/translations.js).
export const PETITION_LOCALES = ["fr", "en", "es", "it", "ru", "ja", "zh", "hi"];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// Une image est soit hébergée par le site lui-même (chemin racine, ex.
// "/images/petitions/x.svg" — jamais "//hote/..." qui serait une URL
// externe déguisée), soit une URL https externe.
export function isValidImageUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  return isHttpsUrl(value);
}

// Valide un lot de pétitions AVANT toute écriture en base : un lot
// incomplet (une langue oubliée, un code pays inventé) échoue ici, en
// bloc, plutôt que de publier à moitié en production.
export function validatePetitionSeed(seed) {
  const errors = [];
  const petitions = [];
  const entries = seed && Array.isArray(seed.petitions) ? seed.petitions : null;
  if (!entries || entries.length === 0) {
    return { petitions, errors: ['Le fichier doit contenir un tableau "petitions" non vide'] };
  }

  const seenSlugs = new Set();
  entries.forEach((entry, index) => {
    const label = `petitions[${index}]${entry && entry.slug ? ` (${entry.slug})` : ""}`;
    const fail = (message) => errors.push(`${label} : ${message}`);
    if (!entry || typeof entry !== "object") return fail("entrée invalide");

    if (typeof entry.slug !== "string" || !SLUG_RE.test(entry.slug) || entry.slug.length > 120) {
      fail("slug invalide (minuscules, chiffres et tirets uniquement)");
    } else if (seenSlugs.has(entry.slug)) {
      fail("slug en double dans le fichier");
    } else {
      seenSlugs.add(entry.slug);
    }
    if (!["ongoing", "closed"].includes(entry.status)) fail("status doit valoir ongoing ou closed");
    if (!isHttpsUrl(entry.petitionUrl)) fail("petitionUrl doit être une URL https valide");
    if (entry.sourceName !== undefined && (typeof entry.sourceName !== "string" || entry.sourceName.trim() === "")) {
      fail("sourceName doit être un texte non vide s'il est fourni");
    }
    if (entry.imageUrl !== undefined && !isValidImageUrl(entry.imageUrl)) {
      fail("imageUrl doit être un chemin du site (/...) ou une URL https");
    }

    const scopeCodes = Array.isArray(entry.scopeCodes) ? entry.scopeCodes : [];
    if (scopeCodes.length === 0 || sanitizeScopeCodes(scopeCodes).length !== scopeCodes.length) {
      fail("scopeCodes doit contenir au moins un code valide, sans doublon (ex. FRA, EUR, WORLD)");
    }

    const translations = entry.translations && typeof entry.translations === "object" ? entry.translations : {};
    for (const locale of PETITION_LOCALES) {
      const tr = translations[locale];
      const title = tr && typeof tr.title === "string" ? tr.title.trim() : "";
      const description = tr && typeof tr.description === "string" ? tr.description.trim() : "";
      if (!title) fail(`titre manquant pour la langue ${locale}`);
      if (!description) fail(`description manquante pour la langue ${locale}`);
      if (title.length > 250) fail(`titre trop long pour la langue ${locale}`);
      if (description.length > 1500) fail(`description trop longue pour la langue ${locale}`);
    }

    petitions.push({
      slug: entry.slug,
      status: entry.status,
      petitionUrl: entry.petitionUrl,
      sourceName: entry.sourceName ? entry.sourceName.trim() : null,
      imageUrl: entry.imageUrl || null,
      scopeCodes: sanitizeScopeCodes(scopeCodes),
      published: entry.published === true,
      translations,
    });
  });

  return { petitions, errors };
}
