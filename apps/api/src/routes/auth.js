import { Router } from "express";
import crypto from "crypto";
import { verifyTotp } from "../totp.js";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession, SESSION_DURATION_MS } from "../lib/auth.js";
import { otpLimiter } from "../lib/rateLimits.js";

const router = Router();

router.post("/api/admin/auth/verify-otp", otpLimiter, async (req, res) => {
  const { code } = req.body || {};
  if (!process.env.ADMIN_TOTP_SECRET) {
    return res.status(500).json({ error: "ADMIN_TOTP_SECRET n'est pas configuré côté serveur" });
  }
  if (!verifyTotp(process.env.ADMIN_TOTP_SECRET, code)) {
    return res.status(401).json({ error: "Code invalide" });
  }
  try {
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await pool.query(
      "INSERT INTO admin_sessions (session_token, expires_at) VALUES ($1, $2)",
      [sessionToken, expiresAt]
    );
    // Purge discrète des sessions expirées pour ne pas accumuler indéfiniment.
    pool.query("DELETE FROM admin_sessions WHERE expires_at < now()").catch(() => {});
    res.json({ sessionToken, expiresAt });
  } catch (err) {
    res.status(500).json({ error: "Échec de la création de session", detail: errorDetail(err) });
  }
});

router.post("/api/admin/auth/logout", async (req, res) => {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    await pool.query("DELETE FROM admin_sessions WHERE session_token = $1", [token]).catch(() => {});
  }
  res.json({ status: "ok" });
});

// Révoque toutes les sessions admin actives, y compris celle qui appelle
// cette route — utile si un jeton de session a pu fuiter (poste partagé,
// ordinateur volé...) : plutôt que d'attendre l'expiration naturelle,
// force tout le monde à se reconnecter immédiatement avec le code TOTP.
router.post("/api/admin/auth/revoke-all", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query("DELETE FROM admin_sessions");
    res.json({ status: "ok", revokedCount: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: "Échec de la révocation", detail: errorDetail(err) });
  }
});

export default router;
