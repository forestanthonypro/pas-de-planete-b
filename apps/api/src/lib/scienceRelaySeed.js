import { sanitizeScopeCodes } from "./scopeCodes.js";
import { isAllowedEmbedUrl } from "./embedValidation.js";
import { PETITION_LOCALES, isHttpsUrl, isValidImageUrl } from "./petitionSeed.js";

export const RELAY_LOCALES = PETITION_LOCALES;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_TYPES = ["video", "article", "podcast"];

// Valide un lot de relais scientifiques (et de nouvelles catégories) AVANT
// toute écriture en base : une langue oubliée, une URL non https ou un code
// de portée inventé fait échouer tout le lot.
export function validateScienceRelaySeed(seed) {
  const errors = [];
  const relays = [];
  const categories = [];

  const rawCategories = seed && Array.isArray(seed.categories) ? seed.categories : [];
  const seenCategories = new Set();
  rawCategories.forEach((c, index) => {
    const label = `categories[${index}]${c && c.slug ? ` (${c.slug})` : ""}`;
    if (!c || typeof c.slug !== "string" || !SLUG_RE.test(c.slug)) {
      errors.push(`${label} : slug invalide`);
      return;
    }
    if (seenCategories.has(c.slug)) errors.push(`${label} : slug en double`);
    seenCategories.add(c.slug);
    const names = c.names && typeof c.names === "object" ? c.names : {};
    for (const locale of RELAY_LOCALES) {
      if (typeof names[locale] !== "string" || names[locale].trim() === "") {
        errors.push(`${label} : nom manquant pour la langue ${locale}`);
      }
    }
    categories.push({ slug: c.slug, names });
  });

  const entries = seed && Array.isArray(seed.relays) ? seed.relays : null;
  if (!entries || entries.length === 0) {
    errors.push('Le fichier doit contenir un tableau "relays" non vide');
    return { relays, categories, errors };
  }

  const seenSlugs = new Set();
  entries.forEach((entry, index) => {
    const label = `relays[${index}]${entry && entry.slug ? ` (${entry.slug})` : ""}`;
    const fail = (message) => errors.push(`${label} : ${message}`);
    if (!entry || typeof entry !== "object") return fail("entrée invalide");

    if (typeof entry.slug !== "string" || !SLUG_RE.test(entry.slug) || entry.slug.length > 120) {
      fail("slug invalide (minuscules, chiffres et tirets uniquement)");
    } else if (seenSlugs.has(entry.slug)) {
      fail("slug en double dans le fichier");
    } else {
      seenSlugs.add(entry.slug);
    }
    if (!CONTENT_TYPES.includes(entry.contentType)) fail("contentType doit valoir video, article ou podcast");
    if (!isHttpsUrl(entry.sourceUrl)) fail("sourceUrl doit être une URL https valide");
    if (typeof entry.sourceName !== "string" || entry.sourceName.trim() === "") fail("sourceName est requis");
    if (entry.scientistName !== undefined && (typeof entry.scientistName !== "string" || entry.scientistName.trim() === "")) {
      fail("scientistName doit être un texte non vide s'il est fourni");
    }
    if (entry.embedUrl !== undefined && (!isHttpsUrl(entry.embedUrl) || !isAllowedEmbedUrl(entry.embedUrl))) {
      fail("embedUrl doit provenir de YouTube, Spotify ou Apple Podcasts (https)");
    }
    if (entry.imageUrl !== undefined && !isValidImageUrl(entry.imageUrl)) {
      fail("imageUrl doit être un chemin du site (/...) ou une URL https");
    }
    if (typeof entry.categorySlug !== "string" || !SLUG_RE.test(entry.categorySlug)) {
      fail("categorySlug est requis (catégorie existante ou déclarée dans categories)");
    }

    const scopeCodes = Array.isArray(entry.scopeCodes) ? entry.scopeCodes : [];
    if (scopeCodes.length === 0 || sanitizeScopeCodes(scopeCodes).length !== scopeCodes.length) {
      fail("scopeCodes doit contenir au moins un code valide, sans doublon (ex. FRA, EUR, WORLD)");
    }

    const translations = entry.translations && typeof entry.translations === "object" ? entry.translations : {};
    for (const locale of RELAY_LOCALES) {
      const tr = translations[locale] || {};
      const title = typeof tr.title === "string" ? tr.title.trim() : "";
      const description = typeof tr.description === "string" ? tr.description.trim() : "";
      const field = typeof tr.scientistField === "string" ? tr.scientistField.trim() : "";
      if (!title) fail(`titre manquant pour la langue ${locale}`);
      if (!description) fail(`description manquante pour la langue ${locale}`);
      if (!field) fail(`scientistField manquant pour la langue ${locale}`);
      if (title.length > 250) fail(`titre trop long pour la langue ${locale}`);
      if (description.length > 2000) fail(`description trop longue pour la langue ${locale}`);
    }

    relays.push({
      slug: entry.slug,
      contentType: entry.contentType,
      sourceUrl: entry.sourceUrl,
      sourceName: entry.sourceName ? entry.sourceName.trim() : null,
      scientistName: entry.scientistName ? entry.scientistName.trim() : null,
      embedUrl: entry.embedUrl || null,
      imageUrl: entry.imageUrl || null,
      categorySlug: entry.categorySlug,
      scopeCodes: sanitizeScopeCodes(scopeCodes),
      published: entry.published === true,
      translations,
    });
  });

  // Une catégorie utilisée doit être déclarée dans le fichier OU exister déjà
  // en base (vérifié au lancement du script, qui connaît la base).
  return { relays, categories, errors };
}
