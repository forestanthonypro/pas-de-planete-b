import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateScienceRelaySeed, RELAY_LOCALES } from "../src/lib/scienceRelaySeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function validEntry(overrides = {}) {
  const translations = Object.fromEntries(
    RELAY_LOCALES.map((l) => [l, { title: `Titre ${l}`, description: `Description ${l}`, scientistField: `Domaine ${l}` }])
  );
  return {
    slug: "exemple-de-relais", contentType: "article", sourceUrl: "https://exemple.org/rapport",
    sourceName: "Exemple", categorySlug: "climat", scopeCodes: ["WORLD"], published: true, translations, ...overrides,
  };
}

test("le lot de relais livré dans le dépôt est valide (8 langues, URLs, portées, catégories)", () => {
  const seed = JSON.parse(readFileSync(join(__dirname, "../src/scripts/data/science-relays-2026-10.json"), "utf8"));
  const { relays, categories, errors } = validateScienceRelaySeed(seed);
  assert.deepEqual(errors, []);
  assert.equal(relays.length, 5);
  assert.equal(categories.length, 2);
});

test("une entrée complète passe la validation", () => {
  const { errors } = validateScienceRelaySeed({ relays: [validEntry()] });
  assert.deepEqual(errors, []);
});

test("une langue ou un champ manquant bloque le lot", () => {
  const entry = validEntry();
  delete entry.translations.zh.scientistField;
  delete entry.translations.hi;
  const { errors } = validateScienceRelaySeed({ relays: [entry] });
  assert.ok(errors.some((e) => e.includes("zh")));
  assert.ok(errors.some((e) => e.includes("hi")));
});

test("rejette slug invalide, doublon, type inconnu, URL http et portée inventée", () => {
  const { errors } = validateScienceRelaySeed({
    relays: [
      validEntry({ slug: "Slug Invalide" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "type-bidon", contentType: "livre" }),
      validEntry({ slug: "url-http", sourceUrl: "http://exemple.org" }),
      validEntry({ slug: "portee-bidon", scopeCodes: ["ZZZ"] }),
    ],
  });
  for (const fragment of ["slug invalide", "slug en double", "contentType", "sourceUrl", "scopeCodes"]) {
    assert.ok(errors.some((e) => e.includes(fragment)), fragment);
  }
});

test("embedUrl : seules les plateformes autorisées passent", () => {
  assert.deepEqual(validateScienceRelaySeed({ relays: [validEntry({ embedUrl: "https://www.youtube.com/embed/abc" })] }).errors, []);
  const { errors } = validateScienceRelaySeed({ relays: [validEntry({ embedUrl: "https://evil.example/x" })] });
  assert.ok(errors.some((e) => e.includes("embedUrl")));
});

test("une catégorie déclarée doit avoir un nom dans les 8 langues", () => {
  const { errors } = validateScienceRelaySeed({ categories: [{ slug: "sante", names: { fr: "Santé" } }], relays: [validEntry()] });
  assert.ok(errors.some((e) => e.includes("sante") && e.includes("en")));
});

test("un fichier sans tableau relays est refusé", () => {
  assert.ok(validateScienceRelaySeed({}).errors.length > 0);
});
