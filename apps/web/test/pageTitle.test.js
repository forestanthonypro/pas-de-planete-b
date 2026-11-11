const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPageTitle, SITE_NAME } = require("../lib/pageTitle");

test("ajoute le nom du site au titre de la page", () => {
  assert.equal(buildPageTitle("Émissions de CO₂ — France"), `Émissions de CO₂ — France — ${SITE_NAME}`);
});

test("ne répète pas le nom du site s'il est déjà le titre", () => {
  assert.equal(buildPageTitle(SITE_NAME), SITE_NAME);
});

test("ignore un titre pas encore chargé (garde le titre par défaut)", () => {
  for (const bad of [undefined, null, "", "   ", "undefined — France", "CO2 — null", 42]) {
    assert.equal(buildPageTitle(bad), null);
  }
});

test("normalise les espaces", () => {
  assert.equal(buildPageTitle("  Éoliennes \n  recyclage "), `Éoliennes recyclage — ${SITE_NAME}`);
});
