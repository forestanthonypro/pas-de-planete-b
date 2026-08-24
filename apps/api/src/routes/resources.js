import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { generateUniqueSlug } from "../lib/slug.js";
import { mergeTranslations } from "../lib/translations.js";
import { sanitizeScopeCodes, parseScopesQueryParam, expandScopeFilterForSearch, worldSelected } from "../lib/scopeCodes.js";
import { EMAIL_RE } from "../lib/validators.js";

const router = Router();

// --- Ressources ---
// Volet 1 : lieux physiques (carte) — jardins partagés, AMAP, recycleries...
// Volet 2 : ressources non physiques (trocs, plateformes d'échange en ligne).
// Catégories partagées entre les deux volets.

router.get("/api/resource-categories", async (req, res) => {
  const { locale } = req.query;
  try {
    const result = await pool.query("SELECT id, name, slug FROM resource_categories ORDER BY name");
    const rows = await mergeTranslations(result.rows, "resource_category", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/resource-categories", requireAdminSession, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO resource_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.put("/api/admin/resource-categories/:id", requireAdminSession, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name est requis" });
  }
  try {
    const result = await pool.query(
      "UPDATE resource_categories SET name = $1 WHERE id = $2 RETURNING id, name, slug",
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

router.delete("/api/admin/resource-categories/:id", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM resource_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

// Lieux physiques — toujours renvoyés avec leurs liens joints, pour éviter
// un aller-retour supplémentaire (une carte affiche tout d'un coup).
router.get("/api/resource-locations", async (req, res) => {
  const { category, locale, scopes } = req.query;
  // Sans plafond, un filtre trop large (ou aucun filtre — "le monde entier")
  // peut renvoyer les ~66 000 lieux d'un coup, ce qui rend la carte
  // inutilisable côté navigateur (voir /ressources) — filet de sécurité
  // même quand le frontend est censé toujours filtrer avant d'appeler
  // cette route.
  const RESOURCE_LOCATIONS_LIMIT = 3000;
  try {
    const params = [];
    let where = "WHERE l.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0 && !worldSelected(scopeCodes)) {
      params.push(expandScopeFilterForSearch(scopeCodes));
      where += ` AND l.scope_codes && $${params.length}`;
    }
    params.push(RESOURCE_LOCATIONS_LIMIT + 1); // +1 pour détecter la troncature sans un COUNT(*) séparé coûteux
    const locations = await pool.query(
      `SELECT l.slug, l.name, l.description, l.address, l.latitude, l.longitude, l.scope_codes,
              c.name AS category_name, c.slug AS category_slug
       FROM resource_locations l
       LEFT JOIN resource_categories c ON c.id = l.category_id
       ${where}
       ORDER BY l.name
       LIMIT $${params.length}`,
      params
    );
    const truncated = locations.rows.length > RESOURCE_LOCATIONS_LIMIT;
    if (truncated) locations.rows.length = RESOURCE_LOCATIONS_LIMIT;
    const links = await pool.query(
      `SELECT location_slug, label, url FROM resource_location_links
       WHERE location_slug = ANY($1::text[]) ORDER BY id`,
      [locations.rows.map((l) => l.slug)]
    );
    const linksBySlug = {};
    for (const l of links.rows) {
      if (!linksBySlug[l.location_slug]) linksBySlug[l.location_slug] = [];
      linksBySlug[l.location_slug].push({ label: l.label, url: l.url });
    }
    const rowsWithLinks = locations.rows.map((l) => ({ ...l, links: linksBySlug[l.slug] || [] }));
    const rows = await mergeTranslations(rowsWithLinks, "resource_location", locale);
    res.json({ results: rows, truncated });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/resource-locations", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.slug, l.name, l.published, l.submitted_publicly, l.updated_at, c.name AS category_name
       FROM resource_locations l
       LEFT JOIN resource_categories c ON c.id = l.category_id
       ORDER BY l.submitted_publicly DESC, l.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/resource-locations/:slug", requireAdminSession, async (req, res) => {
  try {
    const location = await pool.query("SELECT * FROM resource_locations WHERE slug = $1", [req.params.slug]);
    if (location.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const links = await pool.query(
      "SELECT label, url FROM resource_location_links WHERE location_slug = $1 ORDER BY id",
      [req.params.slug]
    );
    res.json({ location: location.rows[0], links: links.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/resource-locations", requireAdminSession, async (req, res) => {
  const { slug, name, description, address, latitude, longitude, categoryId, published, links, scopeCodes } = req.body || {};
  if (!slug || !name || !description || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "slug, name, description, latitude et longitude sont requis" });
  }
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Coordonnées invalides" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO resource_locations (slug, name, description, address, latitude, longitude, category_id, published, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, address = EXCLUDED.address,
         latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, category_id = EXCLUDED.category_id,
         published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
      [slug, name, description, address || null, lat, lng, categoryId || null, published === true, sanitizeScopeCodes(scopeCodes)]
    );
    if (Array.isArray(links)) {
      await client.query("DELETE FROM resource_location_links WHERE location_slug = $1", [slug]);
      for (const l of links) {
        if (l?.label && l?.url) {
          await client.query(
            "INSERT INTO resource_location_links (location_slug, label, url) VALUES ($1, $2, $3)",
            [slug, l.label, l.url]
          );
        }
      }
    }
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  } finally {
    client.release();
  }
});

router.post("/api/admin/resource-locations/:slug/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE resource_locations SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
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

router.delete("/api/admin/resource-locations/:slug", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM resource_locations WHERE slug = $1", [req.params.slug]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

// Ressources non physiques (trocs, plateformes d'échange...).
router.get("/api/resource-online", async (req, res) => {
  const { category, locale, scopes } = req.query;
  try {
    const params = [];
    let where = "WHERE o.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0 && !worldSelected(scopeCodes)) {
      params.push(expandScopeFilterForSearch(scopeCodes));
      where += ` AND o.scope_codes && $${params.length}`;
    }
    const result = await pool.query(
      `SELECT o.slug, o.title, o.description, o.url, o.scope_codes, c.name AS category_name, c.slug AS category_slug
       FROM resource_online o
       LEFT JOIN resource_categories c ON c.id = o.category_id
       ${where}
       ORDER BY o.title`,
      params
    );
    const rows = await mergeTranslations(result.rows, "resource_online", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/resource-online", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.slug, o.title, o.published, o.submitted_publicly, o.updated_at, c.name AS category_name
       FROM resource_online o
       LEFT JOIN resource_categories c ON c.id = o.category_id
       ORDER BY o.submitted_publicly DESC, o.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/resource-online/:slug", requireAdminSession, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM resource_online WHERE slug = $1", [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/resource-online", requireAdminSession, async (req, res) => {
  const { slug, title, description, url, categoryId, published, scopeCodes } = req.body || {};
  if (!slug || !title || !description || !url) {
    return res.status(400).json({ error: "slug, title, description et url sont requis" });
  }
  try {
    await pool.query(
      `INSERT INTO resource_online (slug, title, description, url, category_id, published, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description, url = EXCLUDED.url,
         category_id = EXCLUDED.category_id, published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
      [slug, title, description, url, categoryId || null, published === true, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.post("/api/admin/resource-online/:slug/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE resource_online SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
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

router.delete("/api/admin/resource-online/:slug", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM resource_online WHERE slug = $1", [req.params.slug]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.post("/api/resource-locations/submit", publicWriteLimiter, async (req, res) => {
  const { name, description, address, latitude, longitude, categoryId, links, website, scopeCodes, submitterEmail, submissionNotes } = req.body || {};
  if (website) {
    return res.json({ status: "pending" });
  }
  if (!name || !description || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "name, description, latitude et longitude sont requis" });
  }
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Coordonnées invalides" });
  }
  const cleanEmail = submitterEmail && EMAIL_RE.test(submitterEmail.trim()) ? submitterEmail.trim() : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const slug = await generateUniqueSlug(name, "resource_locations");
    await client.query(
      `INSERT INTO resource_locations (slug, name, description, address, latitude, longitude, category_id, published, submitted_publicly, scope_codes, submitter_email, submission_notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, true, $8, $9, $10, now())`,
      [slug, name, description, address || null, lat, lng, categoryId || null, sanitizeScopeCodes(scopeCodes), cleanEmail, submissionNotes ? submissionNotes.trim().slice(0, 2000) : null]
    );
    if (Array.isArray(links)) {
      for (const l of links) {
        if (l?.label && l?.url) {
          await client.query(
            "INSERT INTO resource_location_links (location_slug, label, url) VALUES ($1, $2, $3)",
            [slug, l.label, l.url]
          );
        }
      }
    }
    await client.query("COMMIT");
    res.json({ status: "pending" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  } finally {
    client.release();
  }
});

router.post("/api/resource-online/submit", publicWriteLimiter, async (req, res) => {
  const { title, description, url, categoryId, website, scopeCodes, submitterEmail, submissionNotes } = req.body || {};
  if (website) {
    return res.json({ status: "pending" });
  }
  if (!title || !description || !url) {
    return res.status(400).json({ error: "title, description et url sont requis" });
  }
  const cleanEmail = submitterEmail && EMAIL_RE.test(submitterEmail.trim()) ? submitterEmail.trim() : null;
  try {
    const slug = await generateUniqueSlug(title, "resource_online");
    await pool.query(
      `INSERT INTO resource_online (slug, title, description, url, category_id, published, submitted_publicly, scope_codes, submitter_email, submission_notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, false, true, $6, $7, $8, now())`,
      [slug, title, description, url, categoryId || null, sanitizeScopeCodes(scopeCodes), cleanEmail, submissionNotes ? submissionNotes.trim().slice(0, 2000) : null]
    );
    res.json({ status: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

export default router;
