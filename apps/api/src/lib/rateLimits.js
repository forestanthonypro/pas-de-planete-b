import rateLimit from "express-rate-limit";

// Limite générale sur toute l'API : protège contre le scraping massif ou les
// scripts mal intentionnés, sans gêner un usage normal (une personne qui
// consulte le site ne s'approche jamais de cette limite). Les routes
// publiques d'écriture (newsletter, suggestions, votes) ont en plus leur
// propre limite, plus stricte, définie séparément.
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, réessaie dans une minute." },
});

// Limite stricte pour les routes publiques qui écrivent des données sans
// authentification (inscription newsletter, suggestions, votes citoyens) —
// plus sujettes à l'abus/spam qu'une simple lecture.
export const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, réessaie dans quelques minutes." },
});

// Limite les tentatives de code TOTP : un code à 6 chiffres est cassable par
// force brute sans cette protection (1 000 000 de combinaisons, plusieurs
// codes valides simultanément à cause de la fenêtre de tolérance ±30s).
// 5 tentatives par IP toutes les 15 minutes est large pour un usage humain
// normal (on tape rarement 5 codes faux d'affilée) mais bloque un script.
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessaie dans quelques minutes." },
});
