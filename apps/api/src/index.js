import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
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
import kitCommunicationRoutes from "./routes/kitCommunication.js";
import contactRoutes from "./routes/contact.js";
import pushNotificationsRoutes from "./routes/pushNotifications.js";

const app = express();

// Traefik est le seul reverse proxy en amont en production (un seul saut) —
// "1" fait confiance uniquement a ce premier saut pour X-Forwarded-For,
// necessaire pour qu'express-rate-limit identifie correctement l'IP reelle
// des visiteurs sans pour autant faire confiance a un en-tete arbitraire.
app.set("trust proxy", 1);
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
    credentials: true,
  })
);
app.use(cookieParser());

// Limite explicite (au lieu de la valeur par défaut d'Express) : évite
// qu'une requête avec un corps JSON énorme ne consomme mémoire/CPU
// inutilement — 1 Mo est largement suffisant pour tous les formulaires
// du site (le plus gros contenu, les pages légales en HTML, reste petit).
app.use(
  express.json({
    limit: "1mb",
    // Les navigateurs utilisent ces deux types pour report-uri (ancien
    // format) et Reporting API/report-to (format moderne).
    type: ["application/json", "application/csp-report", "application/reports+json"],
  })
);

// Limite générale sur toute l'API : protège contre le scraping massif ou les
// scripts mal intentionnés, sans gêner un usage normal (une personne qui
// consulte le site ne s'approche jamais de cette limite). Les routes
// publiques d'écriture (newsletter, suggestions, votes) ont en plus leur
// propre limite, plus stricte, définie dans lib/rateLimits.js.
app.use(globalLimiter);

// Collecte CSP sans donnée métier et sans réponse détaillée. Le JSON est
// sérialisé sur une seule ligne pour éviter l'injection de lignes de log.
// Les rapports sont observables via les logs du conteneur API pendant la
// phase Report-Only, puis servent à resserrer la politique avant blocage.
app.post("/api/csp-report", (req, res) => {
  const reports = Array.isArray(req.body) ? req.body : [req.body];
  for (const report of reports.slice(0, 20)) {
    if (report && typeof report === "object") {
      console.warn("CSP_VIOLATION", JSON.stringify(report));
    }
  }
  res.status(204).end();
});

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
app.use(kitCommunicationRoutes);
app.use(contactRoutes);
app.use(pushNotificationsRoutes);

app.listen(port, () => {
  console.log(`API Pas de planète B à l'écoute sur le port ${port}`);
});
