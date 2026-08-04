import crypto from "crypto";
import { pool } from "./db.js";
import { errorDetail } from "./errors.js";

// Comparaison résistante aux attaques temporelles : une comparaison "!=="
// classique s'arrête au premier caractère différent, ce qui permet en
// théorie de deviner le jeton octet par octet en mesurant le temps de
// réponse. crypto.timingSafeEqual compare en temps constant. On vérifie
// d'abord la longueur (celle-ci ne fuite pas d'information exploitable
// pour un jeton aléatoire de longueur fixe).
function timingSafeTokenEqual(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireIngestToken(req, res, next) {
  const token = req.header("x-ingest-token");
  if (!process.env.INGEST_TOKEN || !token || !timingSafeTokenEqual(token, process.env.INGEST_TOKEN)) {
    return res.status(401).json({ error: "Jeton invalide" });
  }
  next();
}

// Authentification admin par code TOTP (Google Authenticator, Authy...) —
// remplace le jeton statique partagé pour toutes les routes d'administration
// de CONTENU (pas les routes d'ingestion CI/CD, qui restent sur
// INGEST_TOKEN puisqu'elles tournent sans intervention humaine).
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12h

export async function requireAdminSession(req, res, next) {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Session admin requise" });
  }
  try {
    const result = await pool.query(
      "SELECT session_token FROM admin_sessions WHERE session_token = $1 AND expires_at > now()",
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Session expirée ou invalide" });
    }
    next();
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
}
