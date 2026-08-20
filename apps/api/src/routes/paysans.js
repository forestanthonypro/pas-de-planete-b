import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { isAllowedEmbedUrl } from "../lib/embedValidation.js";
import { generateUniqueSlug } from "../lib/slug.js";
import { mergeTranslations, applyTranslations } from "../lib/translations.js";
import { sanitizeScopeCodes, parseScopesQueryParam } from "../lib/scopeCodes.js";

const router = Router();

// --- "On devient tous paysans" ---
// Mêmes principes que Debunk/Relais scientifique : contenu éditorial géré
// via l'admin. Catégories gérables séparément (pas du texte libre), pour
// garder un filtre cohérent dans le temps.

router.get("/api/paysan-categories", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, slug FROM paysan_categories ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/paysan-categories", requireAdminSession, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO paysan_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.delete("/api/admin/paysan-categories/:id", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM paysan_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.get("/api/paysan-resources", async (req, res) => {
  const { category, locale, scopes } = req.query;
  try {
    const params = [];
    let where = "WHERE r.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0) {
      params.push(scopeCodes);
      where += ` AND r.scope_codes && $${params.length}`;
    }
    const result = await pool.query(
      `SELECT r.slug, r.title, r.description, r.content_type, r.source_name,
              r.embed_url, r.image_url, r.scope_codes, c.name AS category_name, c.slug AS category_slug, r.updated_at
       FROM paysan_resources r
       LEFT JOIN paysan_categories c ON c.id = r.category_id
       ${where}
       ORDER BY r.updated_at DESC`,
      params
    );
    const rows = await mergeTranslations(result.rows, "paysan", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/paysan-resources/:slug", async (req, res) => {
  const { locale } = req.query;
  try {
    const result = await pool.query(
      `SELECT r.*, c.name AS category_name, c.slug AS category_slug
       FROM paysan_resources r
       LEFT JOIN paysan_categories c ON c.id = r.category_id
       WHERE r.slug = $1 AND r.published = true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const entry = await applyTranslations(result.rows[0], "paysan", req.params.slug, locale);
    res.json(entry);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/paysan-resources", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.slug, r.title, r.content_type, r.published, r.submitted_publicly, r.scope_codes, r.updated_at, c.name AS category_name
       FROM paysan_resources r
       LEFT JOIN paysan_categories c ON c.id = r.category_id
       ORDER BY r.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/paysan-resources/:slug", requireAdminSession, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM paysan_resources WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/paysan-resources", requireAdminSession, async (req, res) => {
  const {
    slug, title, description, contentType, sourceUrl, sourceName,
    embedUrl, imageUrl, categoryId, published, scopeCodes,
  } = req.body || {};
  if (!slug || !title || !description || !sourceUrl) {
    return res.status(400).json({ error: "slug, title, description et sourceUrl sont requis" });
  }
  if (!["video", "article", "podcast", "document"].includes(contentType)) {
    return res.status(400).json({ error: "contentType invalide" });
  }
  if (embedUrl && !isAllowedEmbedUrl(embedUrl)) {
    return res.status(400).json({ error: "embedUrl doit provenir de YouTube, Spotify ou Apple Podcasts" });
  }
  try {
    await pool.query(
      `INSERT INTO paysan_resources
         (slug, title, description, content_type, source_url, source_name, embed_url, image_url, category_id, published, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description, content_type = EXCLUDED.content_type,
         source_url = EXCLUDED.source_url, source_name = EXCLUDED.source_name, embed_url = EXCLUDED.embed_url,
         image_url = EXCLUDED.image_url, category_id = EXCLUDED.category_id,
         published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
      [slug, title, description, contentType, sourceUrl, sourceName || null, embedUrl || null, imageUrl || null, categoryId || null, published === true, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.post("/api/admin/paysan-resources/:slug/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE paysan_resources SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
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

router.post("/api/paysan-resources/submit", publicWriteLimiter, async (req, res) => {
  const { title, description, contentType, sourceUrl, sourceName, embedUrl, imageUrl, categoryId, website, scopeCodes } = req.body || {};
  if (website) {
    // Piège à bots rempli : on répond succès sans rien enregistrer, pour
    // ne pas révéler à un robot que sa soumission a été repérée.
    return res.json({ status: "pending" });
  }
  if (!title || !description || !sourceUrl) {
    return res.status(400).json({ error: "title, description et sourceUrl sont requis" });
  }
  if (!["video", "article", "podcast", "document"].includes(contentType)) {
    return res.status(400).json({ error: "contentType invalide" });
  }
  if (embedUrl && !isAllowedEmbedUrl(embedUrl)) {
    return res.status(400).json({ error: "embedUrl doit provenir de YouTube, Spotify ou Apple Podcasts" });
  }
  try {
    const slug = await generateUniqueSlug(title, "paysan_resources");
    await pool.query(
      `INSERT INTO paysan_resources
         (slug, title, description, content_type, source_url, source_name, embed_url, image_url, category_id, published, submitted_publicly, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, true, $10, now())`,
      [slug, title, description, contentType, sourceUrl, sourceName || null, embedUrl || null, imageUrl || null, categoryId || null, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});


export default router;
