import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { generateUniqueSlug } from "../lib/slug.js";
import { isAllowedEmbedUrl } from "../lib/embedValidation.js";
import { mergeTranslations, applyTranslations } from "../lib/translations.js";
import { sanitizeScopeCodes, parseScopesQueryParam, expandScopeFilterForSearch, worldSelected } from "../lib/scopeCodes.js";
import { EMAIL_RE } from "../lib/validators.js";

const router = Router();

// --- Relais d'interviews et vidéos scientifiques ---
// Même principe que Debunk : contenu éditorial géré via l'interface admin,
// jamais ingéré automatiquement.

router.get("/api/interview-categories", async (req, res) => {
  const { locale } = req.query;
  try {
    const result = await pool.query("SELECT id, name, slug FROM interview_categories ORDER BY name");
    const rows = await mergeTranslations(result.rows, "interview_category", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/interview-categories", requireAdminSession, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO interview_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.put("/api/admin/interview-categories/:id", requireAdminSession, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name est requis" });
  }
  try {
    const result = await pool.query(
      "UPDATE interview_categories SET name = $1 WHERE id = $2 RETURNING id, name, slug",
      [name.trim(), req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Catégorie introuvable" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de la modification", detail: errorDetail(err) });
  }
});

router.delete("/api/admin/interview-categories/:id", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM interview_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.get("/api/science-relays", async (req, res) => {
  const { category, locale, scopes } = req.query;
  try {
    const params = [];
    let where = "WHERE r.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0 && !worldSelected(scopeCodes)) {
      params.push(expandScopeFilterForSearch(scopeCodes));
      where += ` AND r.scope_codes && $${params.length}`;
    }
    const result = await pool.query(
      `SELECT r.slug, r.title, r.description, r.scientist_name, r.scientist_field, r.content_type,
              r.source_name, r.embed_url, r.image_url, r.scope_codes, c.name AS category_name, c.slug AS category_slug, r.updated_at
       FROM science_relays r
       LEFT JOIN interview_categories c ON c.id = r.category_id
       ${where}
       ORDER BY r.updated_at DESC`,
      params
    );
    const rows = await mergeTranslations(result.rows, "interview", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/science-relays/:slug", async (req, res) => {
  const { locale } = req.query;
  try {
    const result = await pool.query(
      `SELECT r.*, c.name AS category_name, c.slug AS category_slug
       FROM science_relays r
       LEFT JOIN interview_categories c ON c.id = r.category_id
       WHERE r.slug = $1 AND r.published = true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const entry = await applyTranslations(result.rows[0], "interview", req.params.slug, locale);
    res.json(entry);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/science-relays", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.slug, r.title, r.content_type, r.published, r.submitted_publicly, r.image_url, r.updated_at, c.name AS category_name
       FROM science_relays r
       LEFT JOIN interview_categories c ON c.id = r.category_id
       ORDER BY r.submitted_publicly DESC, r.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/science-relays/:slug", requireAdminSession, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM science_relays WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/science-relays", requireAdminSession, async (req, res) => {
  const {
    slug, title, description, scientistName, scientistField, contentType,
    sourceUrl, sourceName, embedUrl, imageUrl, categoryId, relatedDebunkSlug, published, scopeCodes,
  } = req.body || {};
  if (!slug || !title || !description || !sourceUrl) {
    return res.status(400).json({ error: "slug, title, description et sourceUrl sont requis" });
  }
  if (!["video", "article", "podcast"].includes(contentType)) {
    return res.status(400).json({ error: "contentType doit être 'video', 'article' ou 'podcast'" });
  }
  if (embedUrl && !isAllowedEmbedUrl(embedUrl)) {
    return res.status(400).json({ error: "embedUrl doit provenir de YouTube, Spotify ou Apple Podcasts" });
  }
  try {
    await pool.query(
      `INSERT INTO science_relays
         (slug, title, description, scientist_name, scientist_field, content_type,
          source_url, source_name, embed_url, image_url, category_id, related_debunk_slug, published, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         scientist_name = EXCLUDED.scientist_name, scientist_field = EXCLUDED.scientist_field,
         content_type = EXCLUDED.content_type, source_url = EXCLUDED.source_url,
         source_name = EXCLUDED.source_name, embed_url = EXCLUDED.embed_url,
         image_url = EXCLUDED.image_url,
         category_id = EXCLUDED.category_id, related_debunk_slug = EXCLUDED.related_debunk_slug,
         published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
      [slug, title, description, scientistName || null, scientistField || null, contentType,
       sourceUrl, sourceName || null, embedUrl || null, imageUrl || null, categoryId || null, relatedDebunkSlug || null, published === true, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.post("/api/admin/science-relays/:slug/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE science_relays SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [published, req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: errorDetail(err) });
  }
});

// Soumission publique — juste un lien à examiner (interview, article,
// vidéo) proposé par un visiteur, pas un article rédigé : "description"
// reste vide à ce stade (jamais affichée tant que published=false), le
// contexte fourni va dans submission_notes. La rédaction écrit toujours
// sa propre description avant publication.
router.post("/api/science-relays/submit", publicWriteLimiter, async (req, res) => {
  const { sourceUrl, suggestedTitle, contentType, notes, website, scopeCodes, submitterEmail } = req.body || {};
  if (website) {
    return res.json({ status: "pending" });
  }
  if (!sourceUrl || !sourceUrl.trim()) {
    return res.status(400).json({ error: "sourceUrl est requis" });
  }
  const validContentType = ["video", "article", "podcast"].includes(contentType) ? contentType : "article";
  const cleanEmail = submitterEmail && EMAIL_RE.test(submitterEmail.trim()) ? submitterEmail.trim() : null;
  try {
    const baseTitle = suggestedTitle && suggestedTitle.trim() ? suggestedTitle.trim() : sourceUrl.trim();
    const slug = await generateUniqueSlug(baseTitle, "science_relays");
    await pool.query(
      `INSERT INTO science_relays
         (slug, title, description, content_type, source_url, published, submitted_publicly, submission_notes, scope_codes, submitter_email, updated_at)
       VALUES ($1, $2, '', $3, $4, false, true, $5, $6, $7, now())`,
      [slug, baseTitle, validContentType, sourceUrl.trim(), notes ? notes.trim() : null, sanitizeScopeCodes(scopeCodes), cleanEmail]
    );
    res.json({ status: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

export default router;
