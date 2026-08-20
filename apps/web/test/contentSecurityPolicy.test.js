const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REPORTING_ENDPOINT,
  directives,
  serializeContentSecurityPolicy,
} = require("../lib/contentSecurityPolicy");

test("la CSP couvre les principales familles de ressources", () => {
  for (const directive of [
    "default-src", "base-uri", "object-src", "frame-ancestors",
    "form-action", "script-src", "style-src", "img-src", "font-src",
    "connect-src", "frame-src", "media-src", "worker-src",
    "manifest-src", "report-uri", "report-to",
  ]) {
    assert.ok(directives[directive], `directive manquante: ${directive}`);
  }
});

test("la CSP autorise uniquement les intégrations connues", () => {
  assert.ok(directives["connect-src"].includes("https://api.pasdeplaneteb.com"));
  assert.ok(directives["script-src"].includes("https://stats.pasdeplaneteb.com"));
  assert.ok(directives["frame-src"].includes("https://www.youtube.com"));
  assert.equal(directives["object-src"].join(" "), "'none'");
  assert.equal(directives["script-src"].includes("'unsafe-eval'"), false);
});

test("la politique sérialisée contient le point de collecte", () => {
  const value = serializeContentSecurityPolicy();
  assert.match(value, /default-src 'self'/);
  assert.ok(value.includes(`report-uri ${REPORTING_ENDPOINT}`));
  assert.equal(value.includes("\n"), false);
});
