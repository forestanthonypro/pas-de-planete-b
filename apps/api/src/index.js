import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool } from "./lib/db.js";
import { globalLimiter } from "./lib/rateLimits.js";

import authRoutes from "./routes/auth.js";
import environmentalDataRoutes from "./routes/environmentalData.js";
import parliamentaryRoutes from "./routes/parliamentary.js";
import parliamentGenericRoutes from "./routes/parliamentGeneric.js";
import parliamentCitizenVotesRoutes from "./routes/parliamentCitizenVotes.js";
import parliamentMemberFollowsRoutes from "./routes/parliamentMemberFollows.js";
import citizenVotesRoutes from "./routes/citizenVotes.js";
import newsletterRoutes from "./routes/newsletter.js";
import settingsRoutes from "./routes/settings.js";
import deputyFollowsRoutes from "./routes/deputyFollows.js";
import contentTranslationsRoutes from "./routes/contentTranslations.js";
import debunkRoutes from "./routes/debunk.js";
import interviewsRoutes from "./routes/interviews.js";
import paysansRoutes from "./routes/paysans.js";
import resourcesRoutes from "./routes/resources.js";
import charterRoutes from "./routes/charter.js";
import futureIdeasRoutes from "./routes/futureIdeas.js";
import petitionsRoutes from "./routes/petitions.js";
import translateRoutes from "./routes/translate.js";

const app = express();
const port = process.env.API_PORT || 4000;

// En-têtes de sécurité HTTP standards (X-Content-Type-Options,
// X-Frame-Options, Strict-Transport-Security, etc.). L'API et le site web
// tournent sur des origines différentes (ports/domaines distincts) — sans
// crossOriginResourcePolicy: "cross-origin", le navigateur bloquerait les
// appels fetch() faits directement depuis le frontend vers cette API.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS_ORIGIN accepte une ou plusieurs origines séparées par des virgules
// (ex: pour autoriser à la fois le navigateur classique en localhost et
// l'app mobile Capacitor qui charge le site via l'IP réseau locale).
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
  })
);

// Limite explicite (au lieu de la valeur par défaut d'Express) : évite
// qu'une requête avec un corps JSON énorme ne consomme mémoire/CPU
// inutilement — 1 Mo est largement suffisant pour tous les formulaires
// du site (le plus gros contenu, les pages légales en HTML, reste petit).
app.use(express.json({ limit: "1mb" }));

// Limite générale sur toute l'API : protège contre le scraping massif ou les
// scripts mal intentionnés, sans gêner un usage normal (une personne qui
// consulte le site ne s'approche jamais de cette limite). Les routes
// publiques d'écriture (newsletter, suggestions, votes) ont en plus leur
// propre limite, plus stricte, définie dans lib/rateLimits.js.
app.use(globalLimiter);

// Vérifie aussi la connexion à la base : un simple "res.json ok" répondrait
// toujours positivement même si Postgres est injoignable, ce qui fausserait
// un contrôle de santé d'orchestrateur (Docker healthcheck, load balancer...).
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "database non joignable" });
  }
});

app.use(authRoutes);
app.use(environmentalDataRoutes);
app.use(parliamentaryRoutes);
app.use(parliamentGenericRoutes);
app.use(parliamentCitizenVotesRoutes);
app.use(parliamentMemberFollowsRoutes);
app.use(citizenVotesRoutes);
app.use(newsletterRoutes);
app.use(settingsRoutes);
app.use(deputyFollowsRoutes);
app.use(contentTranslationsRoutes);
app.use(debunkRoutes);
app.use(interviewsRoutes);
app.use(paysansRoutes);
app.use(resourcesRoutes);
app.use(charterRoutes);
app.use(futureIdeasRoutes);
app.use(petitionsRoutes);
app.use(translateRoutes);

app.listen(port, () => {
  console.log(`API Pas de planète B à l'écoute sur le port ${port}`);
});
