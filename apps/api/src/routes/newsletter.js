import { Router } from "express";
import crypto from "crypto";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { EMAIL_RE } from "../lib/validators.js";
import { sendEmail } from "../emailSender.js";

const router = Router();

router.post("/api/newsletter/signup", publicWriteLimiter, async (req, res) => {
  const { email, areaType, housingType, hasChildren } = req.body || {};
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "Adresse email invalide" });
  }
  const validAreaTypes = ["ville", "campagne", null, undefined];
  const validHousingTypes = ["maison", "appartement", null, undefined];
  if (!validAreaTypes.includes(areaType) || !validHousingTypes.includes(housingType)) {
    return res.status(400).json({ error: "Valeur de profil invalide" });
  }
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const confirmToken = crypto.randomBytes(24).toString("hex");
    const unsubscribeToken = crypto.randomBytes(24).toString("hex");
    await pool.query(
      `INSERT INTO newsletter_subscribers (email, area_type, housing_type, has_children, confirm_token, unsubscribe_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email)
       DO UPDATE SET area_type = EXCLUDED.area_type, housing_type = EXCLUDED.housing_type, has_children = EXCLUDED.has_children,
                     confirm_token = EXCLUDED.confirm_token, unsubscribe_token = EXCLUDED.unsubscribe_token,
                     confirmed = false, unsubscribed_at = NULL`,
      [normalizedEmail, areaType || null, housingType || null, hasChildren === true, confirmToken, unsubscribeToken]
    );

    const confirmUrl = `${process.env.WEB_URL || "http://localhost:3000"}/confirmer-newsletter?token=${confirmToken}`;
    await sendEmail({
      to: normalizedEmail,
      subject: "Confirme ton inscription à la newsletter",
      html: `<p>Merci de vouloir recevoir des actions concrètes pour agir au quotidien !</p>
             <p><a href="${confirmUrl}">Confirme ton inscription en cliquant ici</a>.</p>
             <p style="font-size:12px;color:#666">Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>`,
    });

    res.json({ status: "pending_confirmation" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'inscription", detail: errorDetail(err) });
  }
});

router.get("/api/newsletter/confirm", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Jeton manquant" });
  }
  try {
    // Idempotent (voir la même logique pour le suivi des députés) : un
    // second clic ou un pré-chargement du lien par un client mail ne doit
    // pas transformer un succès en erreur.
    const result = await pool.query(
      "SELECT id FROM newsletter_subscribers WHERE confirm_token = $1",
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Jeton invalide" });
    }
    await pool.query("UPDATE newsletter_subscribers SET confirmed = true WHERE id = $1", [result.rows[0].id]);
    res.json({ status: "confirmed" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.get("/api/newsletter/unsubscribe", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Jeton manquant" });
  }
  try {
    const result = await pool.query(
      "UPDATE newsletter_subscribers SET unsubscribed_at = now() WHERE unsubscribe_token = $1 RETURNING id",
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Jeton invalide" });
    }
    res.json({ status: "unsubscribed" });
  } catch (err) {
    res.status(500).json({ error: "Échec du désabonnement", detail: errorDetail(err) });
  }
});



export default router;
