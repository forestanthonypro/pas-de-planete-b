import { Router } from "express";
import crypto from "crypto";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { requireIngestToken } from "../lib/auth.js";
import { EMAIL_RE } from "../lib/validators.js";
import { sendEmail } from "../emailSender.js";

const router = Router();

// --- Suivi personnalisé d'un député par email ---
// Double opt-in (RGPD) : l'inscription crée une ligne non confirmée avec un
// jeton envoyé par email ; seule la confirmation active réellement le
// suivi. last_notified_scrutin est initialisé au scrutin le plus récent au
// moment de la confirmation, pour que le premier digest ne renvoie pas tout
// l'historique du député.

router.post("/api/deputy-follows", publicWriteLimiter, async (req, res) => {
  const { email, acteurUid } = req.body || {};
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "Adresse email invalide" });
  }
  if (!acteurUid || typeof acteurUid !== "string") {
    return res.status(400).json({ error: "acteurUid requis" });
  }
  try {
    const deputyResult = await pool.query("SELECT full_name FROM deputies WHERE acteur_uid = $1", [acteurUid]);
    if (deputyResult.rows.length === 0) {
      return res.status(404).json({ error: "Député introuvable" });
    }
    const deputyName = deputyResult.rows[0].full_name;
    const confirmToken = crypto.randomBytes(24).toString("hex");
    const unsubscribeToken = crypto.randomBytes(24).toString("hex");
    const normalizedEmail = email.trim().toLowerCase();

    await pool.query(
      `INSERT INTO deputy_follows (email, acteur_uid, confirm_token, unsubscribe_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email, acteur_uid) DO UPDATE SET confirm_token = $3, confirmed = false`,
      [normalizedEmail, acteurUid, confirmToken, unsubscribeToken]
    );

    const confirmUrl = `${process.env.WEB_URL || "http://localhost:3000"}/confirmer-suivi?token=${confirmToken}`;
    // Même principe que pour la newsletter : l'inscription est déjà
    // enregistrée, un souci d'envoi d'email ne doit pas la faire échouer.
    sendEmail({
      to: normalizedEmail,
      subject: `Confirme le suivi de ${deputyName}`,
      html: `<p>Tu as demandé à suivre les votes de <strong>${deputyName}</strong> à l'Assemblée nationale.</p>
             <p><a href="${confirmUrl}">Confirme ton suivi en cliquant ici</a>.</p>
             <p style="font-size:12px;color:#666">Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>`,
    }).catch((err) => {
      console.error("Échec d'envoi de l'email de confirmation de suivi:", err.message);
    });

    res.json({ status: "pending_confirmation" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.get("/api/deputy-follows/confirm", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Jeton manquant" });
  }
  try {
    // Idempotent à dessein : certains clients mail pré-visitent les liens
    // par sécurité avant que la personne ne clique elle-même, et React
    // Strict Mode peut aussi déclencher l'effet deux fois en développement
    // — dans les deux cas, un second appel sur un token déjà confirmé doit
    // rester un succès, pas une erreur.
    const existingResult = await pool.query(
      "SELECT id, acteur_uid, confirmed FROM deputy_follows WHERE confirm_token = $1",
      [token]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Jeton invalide" });
    }
    const { id, acteur_uid, confirmed } = existingResult.rows[0];
    if (confirmed) {
      return res.json({ status: "confirmed" });
    }

    const latestScrutinResult = await pool.query(
      "SELECT MAX(numero_scrutin) AS max FROM deputy_votes WHERE acteur_uid = $1",
      [acteur_uid]
    );
    const latestScrutin = latestScrutinResult.rows[0].max;

    await pool.query(
      "UPDATE deputy_follows SET confirmed = true, last_notified_scrutin = $2 WHERE id = $1",
      [id, latestScrutin]
    );
    res.json({ status: "confirmed" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.get("/api/deputy-follows/unsubscribe", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Jeton manquant" });
  }
  try {
    const result = await pool.query("DELETE FROM deputy_follows WHERE unsubscribe_token = $1", [token]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Jeton invalide" });
    }
    res.json({ status: "unsubscribed" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

// Déclenché par une action GitHub planifiée (comme les autres tâches
// d'ingestion), pas par un humain — protégé par le même jeton d'ingestion.
router.post("/api/admin/deputy-follows/send-digests", requireIngestToken, async (_req, res) => {
  try {
    const follows = await pool.query(
      `SELECT df.id, df.email, df.acteur_uid, df.unsubscribe_token, df.last_notified_scrutin, d.full_name
       FROM deputy_follows df
       JOIN deputies d ON d.acteur_uid = df.acteur_uid
       WHERE df.confirmed = true`
    );

    let sentCount = 0;
    for (const follow of follows.rows) {
      const newVotesResult = await pool.query(
        `SELECT dv.numero_scrutin, dv.position, s.title, s.objet, s.result_label, s.scrutin_date
         FROM deputy_votes dv
         JOIN scrutins s ON s.numero = dv.numero_scrutin AND s.legislature = dv.legislature
         WHERE dv.acteur_uid = $1 AND dv.numero_scrutin > COALESCE($2, 0)
         ORDER BY dv.numero_scrutin ASC`,
        [follow.acteur_uid, follow.last_notified_scrutin]
      );

      if (newVotesResult.rows.length === 0) continue;

      const unsubscribeUrl = `${process.env.WEB_URL || "http://localhost:3000"}/desabonner-suivi?token=${follow.unsubscribe_token}`;
      const itemsHtml = newVotesResult.rows
        .map(
          (v) =>
            `<li>${v.title || v.objet || `Scrutin n°${v.numero_scrutin}`} — a voté <strong>${v.position}</strong> (${v.result_label || "résultat inconnu"})</li>`
        )
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
        // Un échec d'envoi pour une personne ne doit ni planter le digest
        // de tout le monde, ni faire avancer son curseur de notification —
        // sinon elle ne serait plus jamais notifiée de ces votes précis.
        console.error(`Échec d'envoi du digest à ${follow.email}:`, err.message);
        continue;
      }

      const maxScrutin = Math.max(...newVotesResult.rows.map((v) => v.numero_scrutin));
      await pool.query("UPDATE deputy_follows SET last_notified_scrutin = $2 WHERE id = $1", [follow.id, maxScrutin]);
      sentCount += 1;
    }

    res.json({ status: "ok", digestsSent: sentCount, totalFollows: follows.rows.length });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});


export default router;
