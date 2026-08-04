import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { mergeTranslations, applyTranslations } from "../lib/translations.js";

const router = Router();

router.get("/api/debunk-categories", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, slug FROM debunk_categories ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/debunk", async (req, res) => {
  const { category, locale } = req.query;
  try {
    const params = [];
    let where = "WHERE d.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT d.slug, d.myth, d.verdict, d.image_url, d.updated_at,
              c.name AS category_name, c.slug AS category_slug
       FROM debunk_entries d
       LEFT JOIN debunk_categories c ON c.id = d.category_id
       ${where}
       ORDER BY d.updated_at DESC`,
      params
    );
    const rows = await mergeTranslations(result.rows, "debunk", locale);
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/debunk/:slug", async (req, res) => {
  const { locale } = req.query;
  try {
    const entryResult = await pool.query(
      `SELECT d.*, c.name AS category_name, c.slug AS category_slug
       FROM debunk_entries d
       LEFT JOIN debunk_categories c ON c.id = d.category_id
       WHERE d.slug = $1 AND d.published = true`,
      [req.params.slug]
    );
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const entry = await applyTranslations(entryResult.rows[0], "debunk", req.params.slug, locale);
    const sourcesResult = await pool.query(
      "SELECT label, url FROM debunk_sources WHERE debunk_slug = $1 ORDER BY id",
      [req.params.slug]
    );
    res.json({ entry, sources: sourcesResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Création/mise à jour d'une entrée — protégé, réservé à la rédaction du
// site. "sources" est un tableau [{label, url}, ...].
// Lecture admin : toutes les entrées, publiées ou non (contrairement aux
// routes publiques ci-dessus) — pour l'interface d'administration.
router.get("/api/admin/debunk", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.slug, d.myth, d.verdict, d.published, d.image_url, d.updated_at, c.name AS category_name
       FROM debunk_entries d
       LEFT JOIN debunk_categories c ON c.id = d.category_id
       ORDER BY d.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/debunk-categories", requireAdminSession, async (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: "name et slug sont requis" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO debunk_categories (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, slug`,
      [name, slug]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.delete("/api/admin/debunk-categories/:id", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM debunk_categories WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.get("/api/admin/debunk/:slug", requireAdminSession, async (req, res) => {
  try {
    const entryResult = await pool.query("SELECT * FROM debunk_entries WHERE slug = $1", [req.params.slug]);
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: "Entrée non trouvée" });
    }
    const sourcesResult = await pool.query(
      "SELECT label, url FROM debunk_sources WHERE debunk_slug = $1 ORDER BY id",
      [req.params.slug]
    );
    res.json({ entry: entryResult.rows[0], sources: sourcesResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Bascule rapide publié/brouillon depuis la liste — sans repasser par tout
// le formulaire, ne touche que ce seul champ.
router.post("/api/admin/debunk/:slug/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    const result = await pool.query(
      "UPDATE debunk_entries SET published = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
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

router.post("/api/admin/debunk", requireAdminSession, async (req, res) => {
  const { slug, myth, reality, categoryId, verdict, claimQuote, imageUrl, published, sources } = req.body || {};
  if (!slug || !myth || !reality) {
    return res.status(400).json({ error: "slug, myth et reality sont requis" });
  }
  if (verdict && !["faux", "trompeur", "confirme"].includes(verdict)) {
    return res.status(400).json({ error: "verdict doit être 'faux', 'trompeur' ou 'confirme'" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO debunk_entries (slug, myth, reality, category_id, verdict, claim_quote, image_url, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (slug)
       DO UPDATE SET myth = EXCLUDED.myth, reality = EXCLUDED.reality, category_id = EXCLUDED.category_id,
                     verdict = EXCLUDED.verdict, claim_quote = EXCLUDED.claim_quote,
                     image_url = EXCLUDED.image_url, published = EXCLUDED.published, updated_at = now()`,
      [slug, myth, reality, categoryId || null, verdict || "faux", claimQuote || null, imageUrl || null, published === true]
    );
    if (Array.isArray(sources)) {
      await client.query("DELETE FROM debunk_sources WHERE debunk_slug = $1", [slug]);
      for (const s of sources) {
        if (s?.label && s?.url) {
          await client.query(
            "INSERT INTO debunk_sources (debunk_slug, label, url) VALUES ($1, $2, $3)",
            [slug, s.label, s.url]
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


export default router;
