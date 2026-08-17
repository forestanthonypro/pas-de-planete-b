import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { generateUniqueSlug } from "../lib/slug.js";
import { mergeTranslations, applyTranslations } from "../lib/translations.js";
import { sanitizeScopeCodes, parseScopesQueryParam } from "../lib/scopeCodes.js";

const router = Router();

// --- Pétitions ---
// Mêmes principes que "on devient tous paysans" / ressources : contenu
// éditorial géré via l'admin, formulaire public de proposition modéré
// avant publication (published = false par défaut).

router.get("/api/petitions", async (req, res) => {
  const { status, locale, scopes } = req.query;
  try {
    const params = [];
    let where = "WHERE published = true";
    if (status === "ongoing" || status === "closed") {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0) {
      params.push(scopeCodes);
      where += ` AND scope_codes && $${params.length}`;
    }
    const result = await pool.query(
      `SELECT slug, title, description, petition_url, source_name, status, image_url, scope_codes, updated_at
       FROM petitions
       ${where}
       ORDER BY status ASC, updated_at DESC`,
      params
    );
    const rows = await mergeTranslations(result.rows, "petition", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/petitions/:slug", async (req, res) => {
  const { locale } = req.query;
  try {
    const result = await pool.query(
      "SELECT * FROM petitions WHERE slug = $1 AND published = true",
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const entry = await applyTranslations(result.rows[0], "petition", req.params.slug, locale);
    res.json(entry);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/petitions", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT slug, title, status, published, submitted_publicly, updated_at
       FROM petitions
       ORDER BY submitted_publicly DESC, updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/petitions/:slug", requireAdminSession, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM petitions WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/petitions", requireAdminSession, async (req, res) => {
  const { slug, title, description, petitionUrl, sourceName, status, imageUrl, published, scopeCodes } = req.body || {};
  if (!slug || !title || !description || !petitionUrl) {
    return res.status(400).json({ error: "slug, title, description et petitionUrl sont requis" });
  }
  if (!["ongoing", "closed"].includes(status)) {
    return res.status(400).json({ error: "status invalide (ongoing ou closed)" });
  }
  try {
    await pool.query(
      `INSERT INTO petitions
         (slug, title, description, petition_url, source_name, status, image_url, published, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description, petition_url = EXCLUDED.petition_url,
         source_name = EXCLUDED.source_name, status = EXCLUDED.status, image_url = EXCLUDED.image_url,
         published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
      [slug, title, description, petitionUrl, sourceName || null, status, imageUrl || null, published === true, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.post("/api/admin/petitions/:slug/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE petitions SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
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

router.delete("/api/admin/petitions/:slug", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM petitions WHERE slug = $1", [req.params.slug]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.post("/api/petitions/submit", publicWriteLimiter, async (req, res) => {
  const { title, description, petitionUrl, sourceName, website, scopeCodes } = req.body || {};
  if (website) {
    // Piège à bots rempli : on répond succès sans rien enregistrer, pour
    // ne pas révéler à un robot que sa soumission a été repérée.
    return res.json({ status: "pending" });
  }
  if (!title || !description || !petitionUrl) {
    return res.status(400).json({ error: "title, description et petitionUrl sont requis" });
  }
  try {
    const slug = await generateUniqueSlug(title, "petitions");
    await pool.query(
      `INSERT INTO petitions
         (slug, title, description, petition_url, source_name, status, published, submitted_publicly, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ongoing', false, true, $6, now())`,
      [slug, title, description, petitionUrl, sourceName || null, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

export default router;
