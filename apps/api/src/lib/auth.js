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
//
// Suite à un audit de sécurité externe (20 août 2026) : la session admin
// vivait auparavant dans localStorage côté navigateur, lisible par
// n'importe quel JavaScript exécuté sur la page (XSS). Elle passe
// maintenant par un cookie HttpOnly (voir routes/auth.js pour la pose du
// cookie) — inaccessible en JavaScript par construction, seul moyen
// réellement efficace de corriger ce type de faille (un cookie non-HttpOnly
// ou localStorage sont strictement équivalents du point de vue de cette
// vulnérabilité précise). Durée réduite de 12h à 4h au passage, et seul un
// hachage du jeton est conservé en base — jamais le jeton brut — pour que
// la table admin_sessions ne soit pas directement exploitable si jamais
// elle fuitait (ex. sauvegarde mal protégée).
export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4h
export const SESSION_COOKIE_NAME = "pdpb_admin_session";

export function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requireAdminSession(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Session admin requise" });
  }
  try {
    const result = await pool.query(
      "SELECT session_token_hash FROM admin_sessions WHERE session_token_hash = $1 AND expires_at > now()",
      [hashSessionToken(token)]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Session expirée ou invalide" });
    }
    next();
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
}
