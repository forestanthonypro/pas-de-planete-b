import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidScopeCode, sanitizeScopeCodes } from "../src/lib/scopeCodes.js";

// Fonction pure, sans base de données ni serveur — contrairement à
// index.js (qui a un effet de bord au chargement : il démarre le
// serveur), ce module ne fait rien tant qu'on n'appelle pas ses
// fonctions explicitement. Voir la note dans package.json sur pourquoi
// "node --test" pointe vers ce dossier plutôt que vers tout "src".

test("isValidScopeCode accepte un code pays ISO3 valide", () => {
  assert.equal(isValidScopeCode("FRA"), true);
});

test("isValidScopeCode accepte un code continent/monde fixe", () => {
  assert.equal(isValidScopeCode("EUR"), true);
  assert.equal(isValidScopeCode("WORLD"), true);
});

test("isValidScopeCode rejette un code invalide sans planter", () => {
  assert.equal(isValidScopeCode("XXX"), false);
  assert.equal(isValidScopeCode(null), false);
  assert.equal(isValidScopeCode(123), false);
});

test("sanitizeScopeCodes normalise la casse et dédoublonne", () => {
  assert.deepEqual(sanitizeScopeCodes(["fra", "ESP", "eur", "fra"]), ["FRA", "ESP", "EUR"]);
});

test("sanitizeScopeCodes renvoie un tableau vide sur une entrée non-tableau", () => {
  assert.deepEqual(sanitizeScopeCodes("FRA"), []);
  assert.deepEqual(sanitizeScopeCodes(null), []);
});
