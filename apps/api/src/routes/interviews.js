import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { isAllowedEmbedUrl } from "../lib/embedValidation.js";
import { mergeTranslations, applyTranslations } from "../lib/translations.js";

const router = Router();

// --- Relais d'interviews et vidéos scientifiques ---
// Même principe que Debunk : contenu éditorial géré via l'interface admin,
// jamais ingéré automatiquement.

router.get("/api/interview-categories", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, slug FROM interview_categories ORDER BY name");
    res.json(result.rows);
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

router.delete("/api/admin/interview-categories/:id", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM interview_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.get("/api/science-relays", async (req, res) => {
  const { category, locale } = req.query;
  try {
    const params = [];
    let where = "WHERE r.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT r.slug, r.title, r.description, r.scientist_name, r.scientist_field, r.content_type,
              r.source_name, r.embed_url, r.image_url, c.name AS category_name, c.slug AS category_slug, r.updated_at
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
      `SELECT r.slug, r.title, r.content_type, r.published, r.image_url, r.updated_at, c.name AS category_name
       FROM science_relays r
       LEFT JOIN interview_categories c ON c.id = r.category_id
       ORDER BY r.updated_at DESC`
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
    sourceUrl, sourceName, embedUrl, imageUrl, categoryId, relatedDebunkSlug, published,
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
          source_url, source_name, embed_url, image_url, category_id, related_debunk_slug, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         scientist_name = EXCLUDED.scientist_name, scientist_field = EXCLUDED.scientist_field,
         content_type = EXCLUDED.content_type, source_url = EXCLUDED.source_url,
         source_name = EXCLUDED.source_name, embed_url = EXCLUDED.embed_url,
         image_url = EXCLUDED.image_url,
         category_id = EXCLUDED.category_id, related_debunk_slug = EXCLUDED.related_debunk_slug,
         published = EXCLUDED.published, updated_at = now()`,
      [slug, title, description, scientistName || null, scientistField || null, contentType,
       sourceUrl, sourceName || null, embedUrl || null, imageUrl || null, categoryId || null, relatedDebunkSlug || null, published === true]
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


export default router;
