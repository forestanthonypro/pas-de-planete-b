import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateFutureIdeaSeed, FUTURE_IDEA_LOCALES } from "../src/lib/futureIdeaSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function validEntry(overrides = {}) {
  const translations = Object.fromEntries(FUTURE_IDEA_LOCALES.map((l) => [l, { title: `Titre ${l}`, description: `Description ${l}` }]));
  return { slug: "exemple-d-idee", scopeCodes: ["FRA"], published: true, translations, ...overrides };
}

test("le lot d'idées livré dans le dépôt est valide (8 langues, portées)", () => {
  const seed = JSON.parse(readFileSync(join(__dirname, "../src/scripts/data/future-ideas-2026-10.json"), "utf8"));
  const { ideas, errors } = validateFutureIdeaSeed(seed);
  assert.deepEqual(errors, []);
  assert.equal(ideas.length, 12);
});

test("une entrée complète passe la validation", () => {
  const { ideas, errors } = validateFutureIdeaSeed({ ideas: [validEntry()] });
  assert.deepEqual(errors, []);
  assert.equal(ideas[0].published, true);
});

test("une langue manquante bloque tout le lot", () => {
  const entry = validEntry();
  delete entry.translations.ja;
  const { errors } = validateFutureIdeaSeed({ ideas: [entry] });
  assert.ok(errors.some((e) => e.includes("ja")));
});

test("rejette un slug invalide, un doublon et un code de portée inventé", () => {
  const { errors } = validateFutureIdeaSeed({
    ideas: [
      validEntry({ slug: "Slug Invalide" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "portee-bidon", scopeCodes: ["ZZZ"] }),
    ],
  });
  assert.ok(errors.some((e) => e.includes("slug invalide")));
  assert.ok(errors.some((e) => e.includes("slug en double")));
  assert.ok(errors.some((e) => e.includes("scopeCodes")));
});

test("un fichier vide ou sans tableau ideas est refusé", () => {
  assert.ok(validateFutureIdeaSeed({}).errors.length > 0);
  assert.ok(validateFutureIdeaSeed({ ideas: [] }).errors.length > 0);
});
