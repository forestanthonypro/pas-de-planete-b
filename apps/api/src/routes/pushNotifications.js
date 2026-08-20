import crypto from "node:crypto";
import { Router } from "express";
import { pool } from "../lib/db.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { createManageToken, hashManageToken, normalizePushLocale, validatePreference } from "../lib/pushNotifications.js";

const router = Router();
const MAX_ENDPOINT_LENGTH = 2048;

function validSubscription(value) {
  if (!value || typeof value.endpoint !== "string" || value.endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    const url = new URL(value.endpoint);
    if (url.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return typeof value.keys?.p256dh === "string" && value.keys.p256dh.length <= 512
    && typeof value.keys?.auth === "string" && value.keys.auth.length <= 256;
}

function tokenMatches(received, expectedHash) {
  if (typeof received !== "string" || !expectedHash) return false;
  const actual = Buffer.from(hashManageToken(received), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

router.get("/api/push/public-key", (_req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: "Push indisponible" });
  res.set("Cache-Control", "public, max-age=3600").json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post("/api/push/subscriptions", publicWriteLimiter, async (req, res) => {
  const { subscription, locale } = req.body || {};
  if (!validSubscription(subscription)) return res.status(400).json({ error: "Abonnement push invalide" });
  const manageToken = createManageToken();
  try {
    const result = await pool.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth_secret, manage_token_hash, locale)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET
         p256dh = EXCLUDED.p256dh, auth_secret = EXCLUDED.auth_secret,
         manage_token_hash = EXCLUDED.manage_token_hash, locale = EXCLUDED.locale,
         revoked_at = NULL, updated_at = now()
       RETURNING id`,
      [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, hashManageToken(manageToken), normalizePushLocale(locale)]
    );
    res.status(201).json({ subscriptionId: result.rows[0].id, manageToken });
  } catch {
    res.status(500).json({ error: "Impossible d’enregistrer l’abonnement" });
  }
});

router.put("/api/push/preferences", publicWriteLimiter, async (req, res) => {
  const { subscriptionId, manageToken, locale, preferences } = req.body || {};
  if (!Array.isArray(preferences) || preferences.length > 100) return res.status(400).json({ error: "Préférences invalides" });
  const clean = preferences.map(validatePreference);
  if (clean.some((item) => item === null)) return res.status(400).json({ error: "Préférence invalide" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owner = await client.query("SELECT manage_token_hash FROM push_subscriptions WHERE id = $1 AND revoked_at IS NULL FOR UPDATE", [subscriptionId]);
    if (!owner.rows[0] || !tokenMatches(manageToken, owner.rows[0].manage_token_hash)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Accès refusé" });
    }
    await client.query("UPDATE push_subscriptions SET locale=$2, updated_at=now() WHERE id=$1", [subscriptionId, normalizePushLocale(locale)]);
    await client.query("DELETE FROM push_preferences WHERE subscription_id=$1", [subscriptionId]);
    for (const item of clean) {
      await client.query(
        `INSERT INTO push_preferences (subscription_id, topic, target_type, target_value)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [subscriptionId, item.topic, item.targetType, item.targetValue]
      );
    }
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Impossible d’enregistrer les préférences" });
  } finally {
    client.release();
  }
});

router.delete("/api/push/subscriptions/:id", publicWriteLimiter, async (req, res) => {
  const { manageToken } = req.body || {};
  try {
    const owner = await pool.query("SELECT manage_token_hash FROM push_subscriptions WHERE id=$1", [req.params.id]);
    if (!owner.rows[0] || !tokenMatches(manageToken, owner.rows[0].manage_token_hash)) return res.status(403).json({ error: "Accès refusé" });
    await pool.query("DELETE FROM push_subscriptions WHERE id=$1", [req.params.id]);
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Impossible de supprimer l’abonnement" });
  }
});

export default router;
