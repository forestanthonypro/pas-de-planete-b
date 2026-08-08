import { Router } from "express";
import crypto from "crypto";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { requireIngestToken } from "../lib/auth.js";
import { EMAIL_RE } from "../lib/validators.js";
import { sendEmail } from "../emailSender.js";

const router = Router();

// --- Suivi personnalisé d'un élu étranger par email ---
// Même principe que deputy_follows côté France : double opt-in (RGPD),
// last_notified_vote_id initialisé au vote le plus récent au moment de la
// confirmation pour que le premier digest ne renvoie pas tout l'historique.
// country requis à l'inscription (pour retrouver l'élu via son
// external_id, qui n'est unique qu'associé à un pays) ; pas requis pour la
// confirmation/désabonnement, le jeton suffit à identifier la ligne.

router.post("/api/parliament/:country/member-follows", publicWriteLimiter, async (req, res) => {
  const { country } = req.params;
  const { email, externalId } = req.body || {};
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "Adresse email invalide" });
  }
  if (!externalId || typeof externalId !== "string") {
    return res.status(400).json({ error: "externalId requis" });
  }
  try {
    const memberResult = await pool.query(
      "SELECT id, full_name FROM parliament_members WHERE country_code = $1 AND external_id = $2",
      [country, externalId]
    );
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: "Élu introuvable" });
    }
    const { id: memberId, full_name: memberName } = memberResult.rows[0];
    const confirmToken = crypto.randomBytes(24).toString("hex");
    const unsubscribeToken = crypto.randomBytes(24).toString("hex");
    const normalizedEmail = email.trim().toLowerCase();
    await pool.query(
      `INSERT INTO parliament_member_follows (email, member_id, confirm_token, unsubscribe_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (member_id, email) DO UPDATE SET confirm_token = $3, confirmed = false`,
      [normalizedEmail, memberId, confirmToken, unsubscribeToken]
    );
    const confirmUrl = `${process.env.WEB_URL || "http://localhost:3000"}/international/confirmer-suivi?token=${confirmToken}`;
    // Même principe que pour la newsletter/le suivi français : l'inscription
    // est déjà enregistrée, un souci d'envoi d'email ne doit pas la faire
    // échouer.
    sendEmail({
      to: normalizedEmail,
      subject: `Confirme le suivi de ${memberName}`,
      html: `<p>Tu as demandé à suivre les votes de <strong>${memberName}</strong>.</p>
             <p><a href="${confirmUrl}">Confirme ton suivi en cliquant ici</a>.</p>
             <p style="font-size:12px;color:#666">Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>`,
    }).catch((err) => {
      console.error("Échec d'envoi de l'email de confirmation de suivi (international):", err.message);
    });
    res.json({ status: "pending_confirmation" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

// Pas de préfixe pays ici : le jeton identifie la ligne à lui seul, comme
// côté France.
router.get("/api/parliament/member-follows/confirm", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Jeton manquant" });
  }
  try {
    // Idempotent à dessein, même raison que côté France : un second appel
    // sur un token déjà confirmé doit rester un succès, pas une erreur.
    const existingResult = await pool.query(
      "SELECT id, member_id, confirmed FROM parliament_member_follows WHERE confirm_token = $1",
      [token]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Jeton invalide" });
    }
    const { id, member_id, confirmed } = existingResult.rows[0];
    if (confirmed) {
      return res.json({ status: "confirmed" });
    }
    const latestVoteResult = await pool.query(
      `SELECT MAX(mv.vote_id) AS max FROM parliament_member_votes mv WHERE mv.member_id = $1`,
      [member_id]
    );
    const latestVoteId = latestVoteResult.rows[0].max;
    await pool.query(
      "UPDATE parliament_member_follows SET confirmed = true, last_notified_vote_id = $2 WHERE id = $1",
      [id, latestVoteId]
    );
    res.json({ status: "confirmed" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.get("/api/parliament/member-follows/unsubscribe", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Jeton manquant" });
  }
  try {
    const result = await pool.query("DELETE FROM parliament_member_follows WHERE unsubscribe_token = $1", [token]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Jeton invalide" });
    }
    res.json({ status: "unsubscribed" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

// Déclenché par une action GitHub planifiée, comme le digest français —
// couvre tous les pays en une seule tâche (pas besoin de la dupliquer par
// pays, le job reste léger).
router.post("/api/admin/parliament/member-follows/send-digests", requireIngestToken, async (_req, res) => {
  try {
    const follows = await pool.query(
      `SELECT pf.id, pf.email, pf.unsubscribe_token, pf.last_notified_vote_id,
              m.id AS member_id, m.external_id, m.full_name, m.country_code
       FROM parliament_member_follows pf
       JOIN parliament_members m ON m.id = pf.member_id
       WHERE pf.confirmed = true`
    );
    let sentCount = 0;
    for (const follow of follows.rows) {
      const newVotesResult = await pool.query(
        `SELECT mv.vote_id, mv.position, v.question, v.result, v.vote_date
         FROM parliament_member_votes mv
         JOIN parliament_votes v ON v.id = mv.vote_id
         WHERE mv.member_id = $1 AND mv.vote_id > COALESCE($2, 0)
         ORDER BY mv.vote_id ASC`,
        [follow.member_id, follow.last_notified_vote_id]
      );
      if (newVotesResult.rows.length === 0) continue;
      const unsubscribeUrl = `${process.env.WEB_URL || "http://localhost:3000"}/international/desabonner-suivi?token=${follow.unsubscribe_token}`;
      const itemsHtml = newVotesResult.rows
        .map((v) => `<li>${v.question} — a voté <strong>${v.position}</strong> (${v.result || "résultat inconnu"})</li>`)
        .join("");
      try {
        await sendEmail({
          to: follow.email,
          subject: `Nouveaux votes de ${follow.full_name}`,
          html: `<p><strong>${follow.full_name}</strong> a pris part à ${newVotesResult.rows.length} nouveau(x) vote(s) :</p>
               <ul>${itemsHtml}</ul>
               <p style="font-size:12px;color:#666"><a href="${unsubscribeUrl}">Se désabonner de ce suivi</a></p>`,
        });
      } catch (err) {
        // Un échec d'envoi pour une personne ne doit ni planter le digest de
        // tout le monde, ni faire avancer son curseur de notification.
        console.error(`Échec d'envoi du digest à ${follow.email}:`, err.message);
        continue;
      }
      const maxVoteId = Math.max(...newVotesResult.rows.map((v) => v.vote_id));
      await pool.query("UPDATE parliament_member_follows SET last_notified_vote_id = $2 WHERE id = $1", [follow.id, maxVoteId]);
      sentCount += 1;
    }
    res.json({ status: "ok", digestsSent: sentCount, totalFollows: follows.rows.length });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

export default router;
