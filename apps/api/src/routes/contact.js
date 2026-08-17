import { Router } from "express";
import { errorDetail } from "../lib/errors.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { EMAIL_RE } from "../lib/validators.js";
import { sendEmail } from "../emailSender.js";

const router = Router();

const CONTACT_EMAIL = "contact@pasdeplaneteb.com";

// Échappement minimal — le message vient d'un visiteur non authentifié et
// sera inséré tel quel dans un email HTML ; sans ça, un contenu du type
// <img onerror=...> pourrait s'exécuter dans le client mail de l'admin qui
// lit le message.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

router.post("/api/contact", publicWriteLimiter, async (req, res) => {
  const { name, email, subject, message, website } = req.body || {};
  if (website) {
    // Piège à bots rempli — même principe que les autres formulaires
    // publics : on répond succès sans rien envoyer, sans révéler la
    // détection.
    return res.json({ status: "ok" });
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "Adresse email invalide" });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "message est requis" });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: "Message trop long (4000 caractères max)" });
  }
  const cleanEmail = email.trim();
  const cleanName = name && typeof name === "string" ? name.trim().slice(0, 200) : "";
  const cleanSubject = subject && typeof subject === "string" ? subject.trim().slice(0, 200) : "";

  const emailSubject = cleanSubject
    ? `[Contact] ${cleanSubject}`
    : "[Contact] Nouveau message depuis le site";

  const html = `
    <p><strong>De :</strong> ${escapeHtml(cleanName || "(nom non renseigné)")} — ${escapeHtml(cleanEmail)}</p>
    ${cleanSubject ? `<p><strong>Sujet :</strong> ${escapeHtml(cleanSubject)}</p>` : ""}
    <p><strong>Message :</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message.trim())}</p>
  `;

  try {
    await sendEmail({ to: CONTACT_EMAIL, subject: emailSubject, html, replyTo: cleanEmail });
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'envoi", detail: errorDetail(err) });
  }
});

export default router;
