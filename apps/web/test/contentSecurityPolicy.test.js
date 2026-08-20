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

// Les entrées localhost ne doivent servir qu'au développement local — les
// livrer en production n'est pas une faille en soi (inoffensif pour un
// vrai visiteur), mais un vrai signe que la config n'est pas filtrée par
// environnement. Recharge le module à chaud avec NODE_ENV différent pour
// vérifier les deux branches (require() met le module en cache : on doit
// explicitement le vider entre les deux cas pour forcer sa réévaluation).
test("les entrées localhost sont absentes en production, présentes sinon", () => {
  const modulePath = require.resolve("../lib/contentSecurityPolicy");
  const originalEnv = process.env.NODE_ENV;

  delete require.cache[modulePath];
  process.env.NODE_ENV = "production";
  const prod = require("../lib/contentSecurityPolicy");
  assert.equal(prod.directives["connect-src"].some((v) => v.includes("localhost")), false);

  delete require.cache[modulePath];
  process.env.NODE_ENV = "development";
  const dev = require("../lib/contentSecurityPolicy");
  assert.ok(dev.directives["connect-src"].includes("http://localhost:4000"));
  assert.ok(dev.directives["connect-src"].includes("ws://localhost:3000"));

  delete require.cache[modulePath];
  process.env.NODE_ENV = originalEnv;
});

test("la politique sérialisée contient le point de collecte", () => {
  const value = serializeContentSecurityPolicy();
  assert.match(value, /default-src 'self'/);
  assert.ok(value.includes(`report-uri ${REPORTING_ENDPOINT}`));
  assert.equal(value.includes("\n"), false);
});
