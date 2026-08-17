import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { UUID_RE, EMAIL_RE } from "../lib/validators.js";
import { mergeTranslations } from "../lib/translations.js";
import { sanitizeScopeCodes, parseScopesQueryParam } from "../lib/scopeCodes.js";

const router = Router();

// --- "Les enfants d'aujourd'hui et de demain" ---
// Espace d'idées à soutenir par le vote — indépendant de la charte éthique.
// Classement par popularité (nombre de soutiens), pas d'ordre géré à la main.

router.get("/api/future-ideas", async (req, res) => {
  const { locale, scopes } = req.query;
  try {
    const params = [];
    let where = "WHERE i.published = true";
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0) {
      params.push(scopeCodes);
      where += ` AND i.scope_codes && $${params.length}`;
    }
    const result = await pool.query(
      `SELECT i.slug, i.title, i.description, i.scope_codes, i.updated_at,
              COUNT(v.anonymous_id) AS support_count
       FROM future_ideas i
       LEFT JOIN future_idea_votes v ON v.idea_slug = i.slug
       ${where}
       GROUP BY i.slug
       ORDER BY support_count DESC, i.updated_at DESC`,
      params
    );
    const parsedRows = result.rows.map((r) => ({ ...r, support_count: parseInt(r.support_count, 10) }));
    const rows = await mergeTranslations(parsedRows, "future_idea", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/future-idea-votes", publicWriteLimiter, async (req, res) => {
  const { anonymousId, ideaSlug } = req.body || {};
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  if (!ideaSlug) {
    return res.status(400).json({ error: "ideaSlug est requis" });
  }
  try {
    const existing = await pool.query(
      "SELECT 1 FROM future_idea_votes WHERE anonymous_id = $1 AND idea_slug = $2",
      [anonymousId, ideaSlug]
    );
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM future_idea_votes WHERE anonymous_id = $1 AND idea_slug = $2", [anonymousId, ideaSlug]);
      return res.json({ status: "ok", voted: false });
    }
    await pool.query("INSERT INTO future_idea_votes (anonymous_id, idea_slug) VALUES ($1, $2)", [anonymousId, ideaSlug]);
    res.json({ status: "ok", voted: true });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.get("/api/future-idea-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    const result = await pool.query("SELECT idea_slug FROM future_idea_votes WHERE anonymous_id = $1", [anonymousId]);
    res.json(result.rows.map((r) => r.idea_slug));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/future-ideas", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.slug, i.title, i.published, i.updated_at, COUNT(v.anonymous_id) AS support_count
       FROM future_ideas i
       LEFT JOIN future_idea_votes v ON v.idea_slug = i.slug
       GROUP BY i.slug
       ORDER BY i.updated_at DESC`
    );
    res.json(result.rows.map((r) => ({ ...r, support_count: parseInt(r.support_count, 10) })));
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/future-ideas/:slug", requireAdminSession, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM future_ideas WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Idée non trouvée" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/future-ideas", requireAdminSession, async (req, res) => {
  const { slug, title, description, published, scopeCodes } = req.body || {};
  if (!slug || !title || !title.trim()) {
    return res.status(400).json({ error: "slug et title sont requis" });
  }
  try {
    await pool.query(
      `INSERT INTO future_ideas (slug, title, description, published, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
      [slug, title.trim(), description || null, published === true, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.delete("/api/admin/future-ideas/:slug", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM future_ideas WHERE slug = $1", [req.params.slug]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.post("/api/admin/future-ideas/:slug/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE future_ideas SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Idée non trouvée" });
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: errorDetail(err) });
  }
});

// Boîte à idées pour "Les enfants d'aujourd'hui et de demain" — jamais
// publié directement, toujours modéré manuellement (même principe que la
// boîte à idées de la charte éthique).
router.post("/api/future-idea-suggestions", publicWriteLimiter, async (req, res) => {
  const { text, website, scopeCodes, submitterEmail, submissionNotes } = req.body || {};
  if (website) {
    // Piège à bots rempli — même principe que pétitions/ressources : on
    // répond succès sans rien enregistrer, sans révéler la détection.
    return res.json({ status: "ok" });
  }
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text est requis" });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Texte trop long (2000 caractères max)" });
  }
  const cleanEmail = submitterEmail && EMAIL_RE.test(submitterEmail.trim()) ? submitterEmail.trim() : null;
  try {
    await pool.query(
      "INSERT INTO future_idea_suggestions (text, status, scope_codes, submitter_email, submission_notes) VALUES ($1, 'pending', $2, $3, $4)",
      [text.trim(), sanitizeScopeCodes(scopeCodes), cleanEmail, submissionNotes ? submissionNotes.trim().slice(0, 2000) : null]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.get("/api/future-idea-suggestions/published", async (req, res) => {
  const { scopes } = req.query;
  try {
    const params = [];
    let where = "WHERE status = 'published'";
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0) {
      params.push(scopeCodes);
      where += ` AND scope_codes && $${params.length}`;
    }
    const result = await pool.query(
      `SELECT id, text, scope_codes FROM future_idea_suggestions ${where} ORDER BY submitted_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/future-idea-suggestions", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, text, status, scope_codes, submitter_email, submission_notes, submitted_at FROM future_idea_suggestions
       ORDER BY (status = 'pending') DESC, submitted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/future-idea-suggestions/:id/status", requireAdminSession, async (req, res) => {
  const { status } = req.body || {};
  if (!["pending", "published", "draft", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }
  try {
    await pool.query("UPDATE future_idea_suggestions SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: errorDetail(err) });
  }
});

export default router;
