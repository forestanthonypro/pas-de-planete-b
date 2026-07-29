// Identifiant anonyme pour le vote citoyen — un UUID généré dans le
// navigateur, jamais envoyé nulle part tant que la personne n'a pas
// explicitement confirmé vouloir garder un historique. Pas de compte, pas
// d'email, pas de nom : juste ce jeton, stocké en local, que la personne
// peut effacer à tout moment (voir clearAll dans lib/citizenVotes.js).

const ID_KEY = "pdpb-anonymous-id";
const CONSENT_KEY = "pdpb-vote-consent"; // "yes" | "no" | absent (pas encore demandé)

function generateUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Repli simple si crypto.randomUUID indisponible (navigateurs très anciens).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAnonymousId() {
  if (typeof window === "undefined") return null;
  let id = window.localStorage.getItem(ID_KEY);
  if (!id) {
    id = generateUuid();
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getConsent() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CONSENT_KEY);
}

export function setConsent(value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, value ? "yes" : "no");
}

// Permet de redemander le consentement sans effacer l'historique déjà
// sauvegardé côté serveur (contrairement à forgetLocalIdentity, qui change
// l'identifiant et rend l'ancien historique définitivement inaccessible).
export function resetConsentChoice() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONSENT_KEY);
}

// Efface tout : le choix de consentement ET l'identifiant lui-même — un
// nouvel identifiant sera généré à la prochaine visite si besoin, sans lien
// avec l'ancien historique (déjà supprimé côté serveur via l'API).
export function forgetLocalIdentity() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ID_KEY);
  window.localStorage.removeItem(CONSENT_KEY);
}
