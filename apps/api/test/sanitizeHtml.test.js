import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeLegalHtml } from "../src/lib/sanitizeHtml.js";

// Ces tests reproduisent la faille trouvée lors de l'audit de sécurité du
// 20 août 2026 : l'ancien nettoyeur (regex maison) vérifiait le protocole
// d'un lien sur la chaîne brute, avant tout décodage d'entités HTML — un
// navigateur décode &#106; en "j" au moment de résoudre le href, donc
// &#106;avascript: s'exécutait normalement au clic malgré la vérification.
// Démontré avec un vrai navigateur (Playwright) avant ce correctif.

test("neutralise un lien javascript: encodé en entité décimale", () => {
  const result = sanitizeLegalHtml('<a href="&#106;avascript:alert(1)">Cliquez</a>');
  assert.equal(result.includes("javascript"), false);
});

test("neutralise un lien javascript: encodé en entité hexadécimale", () => {
  const result = sanitizeLegalHtml('<a href="&#x6A;avascript:alert(1)">Cliquez</a>');
  assert.equal(result.includes("javascript"), false);
});

test("neutralise un lien javascript: direct, y compris casse mixte et espaces", () => {
  const result = sanitizeLegalHtml('<a href="  JaVaScRiPt:alert(1)">Cliquez</a>');
  assert.equal(result.toLowerCase().includes("javascript"), false);
});

test("retire une balise <script> et son contenu", () => {
  const result = sanitizeLegalHtml("<script>alert(1)</script><p>Texte</p>");
  assert.equal(result.includes("<script"), false);
  assert.equal(result.includes("<p>Texte</p>"), true);
});

test("retire un gestionnaire d'évènement inline (onerror, onclick...)", () => {
  const result = sanitizeLegalHtml('<img src=x onerror=alert(1)>');
  assert.equal(result.includes("onerror"), false);
});

test("conserve un lien https légitime et ajoute rel/target", () => {
  const result = sanitizeLegalHtml('<a href="https://exemple.fr">Site</a>');
  assert.ok(result.includes('href="https://exemple.fr"'));
  assert.ok(result.includes('rel="noopener noreferrer"'));
  assert.ok(result.includes('target="_blank"'));
});

test("conserve un lien relatif légitime (navigation interne)", () => {
  const result = sanitizeLegalHtml('<a href="/confidentialite">Confidentialité</a>');
  assert.ok(result.includes('href="/confidentialite"'));
});

test("conserve un lien mailto légitime", () => {
  const result = sanitizeLegalHtml('<a href="mailto:contact@pasdeplaneteb.com">Écrire</a>');
  assert.ok(result.includes('href="mailto:contact@pasdeplaneteb.com"'));
});

test("conserve les balises de la liste blanche (titres, listes, emphase)", () => {
  const input = "<h2>Titre</h2><p>Texte <strong>important</strong></p><ul><li>Item</li></ul>";
  assert.equal(sanitizeLegalHtml(input), input);
});

test("gère les entrées non-chaîne sans planter", () => {
  assert.equal(sanitizeLegalHtml(null), null);
  assert.equal(sanitizeLegalHtml(undefined), undefined);
  assert.equal(sanitizeLegalHtml(""), "");
});
