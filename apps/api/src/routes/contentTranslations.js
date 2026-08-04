import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { TRANSLATABLE_CONTENT_TYPES, TRANSLATABLE_FIELDS } from "../lib/translations.js";

// Routes génériques de gestion des traductions, communes à tous les types
// de contenu (débunk, interviews, paysans, ressources, charte, idées
// enfants) — voir lib/translations.js pour la logique de fusion côté
// lecture publique (mergeTranslations/applyTranslations).
const router = Router();

router.get("/api/admin/content-translations/:contentType/:contentId", requireAdminSession, async (req, res) => {
  const { contentType, contentId } = req.params;
  if (!TRANSLATABLE_CONTENT_TYPES.includes(contentType)) {
    return res.status(400).json({ error: "Type de contenu invalide" });
  }
  try {
    const result = await pool.query(
      "SELECT field_name, locale, value FROM content_translations WHERE content_type = $1 AND content_id = $2",
      [contentType, contentId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.post("/api/admin/content-translations", requireAdminSession, async (req, res) => {
  const { contentType, contentId, fieldName, locale, value } = req.body || {};
  if (!TRANSLATABLE_CONTENT_TYPES.includes(contentType)) {
    return res.status(400).json({ error: "Type de contenu invalide" });
  }
  if (!TRANSLATABLE_FIELDS[contentType]?.includes(fieldName)) {
    return res.status(400).json({ error: "Champ non traduisible pour ce type de contenu" });
  }
  if (!contentId || !locale || typeof value !== "string") {
    return res.status(400).json({ error: "contentId, locale et value sont requis" });
  }
  try {
    if (value.trim() === "") {
      // Valeur vidée par l'admin : on supprime la traduction plutôt que de
      // stocker une chaîne vide, pour que le repli sur le français s'applique.
      await pool.query(
        "DELETE FROM content_translations WHERE content_type = $1 AND content_id = $2 AND field_name = $3 AND locale = $4",
        [contentType, contentId, fieldName, locale]
      );
    } else {
      await pool.query(
        `INSERT INTO content_translations (content_type, content_id, field_name, locale, value, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (content_type, content_id, field_name, locale)
         DO UPDATE SET value = $5, updated_at = now()`,
        [contentType, contentId, fieldName, locale, value]
      );
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});


export default router;
