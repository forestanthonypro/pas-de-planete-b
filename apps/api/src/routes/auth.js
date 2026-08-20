import { Router } from "express";
import crypto from "crypto";
import { verifyTotp } from "../totp.js";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession, SESSION_DURATION_MS, SESSION_COOKIE_NAME, hashSessionToken } from "../lib/auth.js";
import { otpLimiter } from "../lib/rateLimits.js";

const router = Router();

// Secure uniquement en production : en local (docker-compose.yml, pas
// prod), l'API tourne en simple HTTP, un cookie Secure ne serait alors
// jamais envoyé par le navigateur et la connexion admin serait cassée en
// développement.
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

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
      "INSERT INTO admin_sessions (session_token_hash, expires_at) VALUES ($1, $2)",
      [hashSessionToken(sessionToken), expiresAt]
    );
    // Purge discrète des sessions expirées pour ne pas accumuler indéfiniment.
    pool.query("DELETE FROM admin_sessions WHERE expires_at < now()").catch(() => {});
    res.cookie(SESSION_COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });
    res.json({ status: "ok", expiresAt });
  } catch (err) {
    res.status(500).json({ error: "Échec de la création de session", detail: errorDetail(err) });
  }
});

router.post("/api/admin/auth/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    await pool.query("DELETE FROM admin_sessions WHERE session_token_hash = $1", [hashSessionToken(token)]).catch(() => {});
  }
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
  res.json({ status: "ok" });
});

// Révoque toutes les sessions admin actives, y compris celle qui appelle
// cette route — utile si un jeton de session a pu fuiter (poste partagé,
// ordinateur volé...) : plutôt que d'attendre l'expiration naturelle,
// force tout le monde à se reconnecter immédiatement avec le code TOTP.
// Le cookie étant HttpOnly, le front ne peut plus savoir localement s'il
// est connecté (impossible de lire le cookie en JavaScript, par
// construction) — cette route sert uniquement à vérifier ça au chargement
// de l'admin, via un aller-retour réseau plutôt qu'une simple lecture
// locale comme avant.
router.get("/api/admin/auth/session", requireAdminSession, (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/api/admin/auth/revoke-all", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query("DELETE FROM admin_sessions");
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    res.json({ status: "ok", revokedCount: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: "Échec de la révocation", detail: errorDetail(err) });
  }
});

export default router;
