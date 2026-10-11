import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateDebunkSeed, DEBUNK_LOCALES } from "../src/lib/debunkSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function validEntry(overrides = {}) {
  const translations = Object.fromEntries(
    DEBUNK_LOCALES.map((l) => [l, { myth: `Mythe ${l}`, claimQuote: `Citation ${l}`, reality: `Réalité ${l}` }])
  );
  return {
    slug: "exemple-de-fiche", verdict: "faux", categorySlug: "climat", scopeCodes: ["WORLD"], published: true,
    sources: [{ label: "Source", url: "https://exemple.org/source" }], translations, ...overrides,
  };
}

test("le lot de fiches Débunk livré dans le dépôt est valide (8 langues, sources, verdicts)", () => {
  const seed = JSON.parse(readFileSync(join(__dirname, "../src/scripts/data/debunk-2026-10.json"), "utf8"));
  const { entries, categories, errors } = validateDebunkSeed(seed);
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 7);
  assert.equal(categories.length, 1);
});

test("une entrée complète passe la validation", () => {
  assert.deepEqual(validateDebunkSeed({ entries: [validEntry()] }).errors, []);
});

test("une langue ou un champ manquant bloque le lot", () => {
  const entry = validEntry();
  delete entry.translations.ja.claimQuote;
  delete entry.translations.hi;
  const { errors } = validateDebunkSeed({ entries: [entry] });
  assert.ok(errors.some((e) => e.includes("ja")));
  assert.ok(errors.some((e) => e.includes("hi")));
});

test("une fiche sans source, ou avec une source http, est refusée", () => {
  assert.ok(validateDebunkSeed({ entries: [validEntry({ sources: [] })] }).errors.some((e) => e.includes("source")));
  const { errors } = validateDebunkSeed({ entries: [validEntry({ sources: [{ label: "x", url: "http://exemple.org" }] })] });
  assert.ok(errors.some((e) => e.includes("https")));
});

test("rejette slug invalide, doublon, verdict inconnu et portée inventée", () => {
  const { errors } = validateDebunkSeed({
    entries: [
      validEntry({ slug: "Slug Invalide" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "verdict-bidon", verdict: "peut-etre" }),
      validEntry({ slug: "portee-bidon", scopeCodes: ["ZZZ"] }),
    ],
  });
  for (const fragment of ["slug invalide", "slug en double", "verdict", "scopeCodes"]) {
    assert.ok(errors.some((e) => e.includes(fragment)), fragment);
  }
});

test("un fichier sans tableau entries est refusé", () => {
  assert.ok(validateDebunkSeed({}).errors.length > 0);
});
