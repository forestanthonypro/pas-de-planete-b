import { sanitizeScopeCodes } from "./scopeCodes.js";
import { PETITION_LOCALES, isHttpsUrl, isValidImageUrl } from "./petitionSeed.js";

export const DEBUNK_LOCALES = PETITION_LOCALES;
export const DEBUNK_VERDICTS = ["faux", "trompeur", "confirme"];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Valide un lot de fiches Débunk AVANT toute écriture en base : une langue
// oubliée, un verdict inconnu, une fiche sans source ou une URL non https
// fait échouer tout le lot. Une fiche de vérification sans source n'a pas
// sa place sur le site : au moins une source https est exigée.
export function validateDebunkSeed(seed) {
  const errors = [];
  const entries = [];
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
    for (const locale of DEBUNK_LOCALES) {
      if (typeof names[locale] !== "string" || names[locale].trim() === "") {
        errors.push(`${label} : nom manquant pour la langue ${locale}`);
      }
    }
    categories.push({ slug: c.slug, names });
  });

  const raw = seed && Array.isArray(seed.entries) ? seed.entries : null;
  if (!raw || raw.length === 0) {
    errors.push('Le fichier doit contenir un tableau "entries" non vide');
    return { entries, categories, errors };
  }

  const seenSlugs = new Set();
  raw.forEach((entry, index) => {
    const label = `entries[${index}]${entry && entry.slug ? ` (${entry.slug})` : ""}`;
    const fail = (message) => errors.push(`${label} : ${message}`);
    if (!entry || typeof entry !== "object") return fail("entrée invalide");

    if (typeof entry.slug !== "string" || !SLUG_RE.test(entry.slug) || entry.slug.length > 200) {
      fail("slug invalide (minuscules, chiffres et tirets uniquement)");
    } else if (seenSlugs.has(entry.slug)) {
      fail("slug en double dans le fichier");
    } else {
      seenSlugs.add(entry.slug);
    }
    if (!DEBUNK_VERDICTS.includes(entry.verdict)) fail("verdict doit valoir faux, trompeur ou confirme");
    if (typeof entry.categorySlug !== "string" || !SLUG_RE.test(entry.categorySlug)) {
      fail("categorySlug est requis (catégorie existante ou déclarée dans categories)");
    }

    if (entry.imageUrl !== undefined && !isValidImageUrl(entry.imageUrl)) {
      fail("imageUrl doit être un chemin du site (/...) ou une URL https");
    }

    const scopeCodes = Array.isArray(entry.scopeCodes) ? entry.scopeCodes : [];
    if (scopeCodes.length === 0 || sanitizeScopeCodes(scopeCodes).length !== scopeCodes.length) {
      fail("scopeCodes doit contenir au moins un code valide, sans doublon (ex. FRA, EUR, WORLD)");
    }

    const sources = Array.isArray(entry.sources) ? entry.sources : [];
    if (sources.length === 0) fail("au moins une source est requise");
    sources.forEach((s, i) => {
      if (!s || typeof s.label !== "string" || s.label.trim() === "") fail(`sources[${i}] : label manquant`);
      if (!s || !isHttpsUrl(s.url)) fail(`sources[${i}] : url doit être une URL https valide`);
    });

    const translations = entry.translations && typeof entry.translations === "object" ? entry.translations : {};
    for (const locale of DEBUNK_LOCALES) {
      const tr = translations[locale] || {};
      const myth = typeof tr.myth === "string" ? tr.myth.trim() : "";
      const quote = typeof tr.claimQuote === "string" ? tr.claimQuote.trim() : "";
      const reality = typeof tr.reality === "string" ? tr.reality.trim() : "";
      if (!myth) fail(`myth manquant pour la langue ${locale}`);
      if (!quote) fail(`claimQuote manquant pour la langue ${locale}`);
      if (!reality) fail(`reality manquant pour la langue ${locale}`);
      if (myth.length > 400) fail(`myth trop long pour la langue ${locale}`);
      if (quote.length > 400) fail(`claimQuote trop long pour la langue ${locale}`);
      if (reality.length > 6000) fail(`reality trop long pour la langue ${locale}`);
    }

    entries.push({
      slug: entry.slug,
      verdict: entry.verdict,
      categorySlug: entry.categorySlug,
      imageUrl: entry.imageUrl || null,
      scopeCodes: sanitizeScopeCodes(scopeCodes),
      published: entry.published === true,
      sources: sources.map((s) => ({ label: String(s.label).trim(), url: s.url })),
      translations,
    });
  });

  return { entries, categories, errors };
}
