import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validatePetitionSeed, PETITION_LOCALES } from "../src/lib/petitionSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function validEntry(overrides = {}) {
  const translations = Object.fromEntries(PETITION_LOCALES.map((l) => [l, { title: `Titre ${l}`, description: `Description ${l}` }]));
  return {
    slug: "exemple-de-petition",
    status: "ongoing",
    petitionUrl: "https://exemple.org/petition",
    sourceName: "Exemple",
    imageUrl: "/images/petitions/exemple.svg",
    scopeCodes: ["WORLD"],
    published: true,
    translations,
    ...overrides,
  };
}

test("le lot de pétitions livré dans le dépôt est valide (8 langues, URLs, portées)", () => {
  const seed = JSON.parse(readFileSync(join(__dirname, "../src/scripts/data/petitions-2026-10.json"), "utf8"));
  const { petitions, errors } = validatePetitionSeed(seed);
  assert.deepEqual(errors, []);
  assert.ok(petitions.length > 0);
});

test("une entrée complète passe la validation", () => {
  const { petitions, errors } = validatePetitionSeed({ petitions: [validEntry()] });
  assert.deepEqual(errors, []);
  assert.equal(petitions[0].published, true);
});

test("une langue manquante bloque tout le lot", () => {
  const entry = validEntry();
  delete entry.translations.hi;
  const { errors } = validatePetitionSeed({ petitions: [entry] });
  assert.ok(errors.some((e) => e.includes("hi")));
});

test("rejette un slug invalide, un doublon, une URL http et un code de portée inventé", () => {
  const { errors } = validatePetitionSeed({
    petitions: [
      validEntry({ slug: "Slug Invalide" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "doublon" }),
      validEntry({ slug: "url-http", petitionUrl: "http://exemple.org" }),
      validEntry({ slug: "portee-bidon", scopeCodes: ["ZZZ"] }),
    ],
  });
  assert.ok(errors.some((e) => e.includes("slug invalide")));
  assert.ok(errors.some((e) => e.includes("slug en double")));
  assert.ok(errors.some((e) => e.includes("petitionUrl")));
  assert.ok(errors.some((e) => e.includes("scopeCodes")));
});

test("imageUrl : chemin du site ou https accepté, URL protocole-relatif refusée", () => {
  assert.deepEqual(validatePetitionSeed({ petitions: [validEntry({ imageUrl: "https://cdn.exemple.org/a.png" })] }).errors, []);
  const { errors } = validatePetitionSeed({ petitions: [validEntry({ imageUrl: "//evil.example/a.png" })] });
  assert.ok(errors.some((e) => e.includes("imageUrl")));
});

test("un fichier vide ou sans tableau petitions est refusé", () => {
  assert.ok(validatePetitionSeed({}).errors.length > 0);
  assert.ok(validatePetitionSeed({ petitions: [] }).errors.length > 0);
});
