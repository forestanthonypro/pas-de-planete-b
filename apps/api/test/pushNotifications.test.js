import test from "node:test";
import assert from "node:assert/strict";
import { normalizePushLocale, validatePreference } from "../src/lib/pushNotifications.js";

test("normalizePushLocale conserve les huit langues prises en charge", () => {
  assert.equal(normalizePushLocale("es-ES"), "es");
  assert.equal(normalizePushLocale("zh"), "zh");
});

test("une langue inconnue retombe sur l'anglais international", () => {
  assert.equal(normalizePushLocale("de-DE"), "en");
  assert.equal(normalizePushLocale(undefined), "en");
});

test("les préférences éditoriales exigent une portée valide", () => {
  assert.deepEqual(validatePreference({ topic: "debunk", targetType: "scope_code", targetValue: "fra" }), {
    topic: "debunk", targetType: "scope_code", targetValue: "FRA",
  });
  assert.equal(validatePreference({ topic: "debunk", targetType: "scope_code", targetValue: "ZZZ" }), null);
});

test("un abonnement ne peut pas détourner le type de cible d'un sujet", () => {
  assert.equal(validatePreference({ topic: "petition", targetType: "deputy_uid", targetValue: "PA123" }), null);
  assert.deepEqual(validatePreference({ topic: "deputy_vote", targetType: "deputy_uid", targetValue: "PA123" }), {
    topic: "deputy_vote", targetType: "deputy_uid", targetValue: "PA123",
  });
});
