const SESSION_KEY = "pdpb-admin-session";

// Session admin créée après vérification d'un code TOTP — remplace l'ancien
// jeton statique partagé. Stockée en local avec sa date d'expiration ; toute
// lecture vérifie l'expiration et purge automatiquement si dépassée.
export function getAdminSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.sessionToken || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setAdminSession(sessionToken, expiresAt) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionToken, expiresAt }));
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function adminAuthHeaders() {
  const session = getAdminSession();
  return session ? { Authorization: `Bearer ${session.sessionToken}` } : {};
}
