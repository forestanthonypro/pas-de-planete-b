import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { generateUniqueSlug } from "../lib/slug.js";
import { mergeTranslations, applyTranslations } from "../lib/translations.js";
import { sanitizeScopeCodes, parseScopesQueryParam } from "../lib/scopeCodes.js";

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
  const { category, featured, locale, scopes } = req.query;
  try {
    const params = [];
    let where = "WHERE d.published = true";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    if (featured === "true") {
      where += " AND d.featured_decouverte = true";
    }
    const scopeCodes = parseScopesQueryParam(scopes);
    if (scopeCodes.length > 0) {
      params.push(scopeCodes);
      where += ` AND d.scope_codes && $${params.length}`;
    }
    const result = await pool.query(
      `SELECT d.slug, d.myth, d.verdict, d.image_url, d.scope_codes, d.updated_at,
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
      `SELECT d.slug, d.myth, d.verdict, d.published, d.submitted_publicly, d.featured_decouverte, d.image_url, d.updated_at, c.name AS category_name
       FROM debunk_entries d
       LEFT JOIN debunk_categories c ON c.id = d.category_id
       ORDER BY d.submitted_publicly DESC, d.updated_at DESC`
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

// Bascule "mise en avant sur /decouverte" — même patron que /publish
// ci-dessus, avec en plus une limite dure à 6 entrées sélectionnées
// simultanément (vérifiée ici, pas en contrainte SQL — voir la migration
// 044). Décocher est toujours autorisé ; cocher une 7e entrée est refusé
// avec un message explicite, l'admin doit d'abord en décocher une.
router.post("/api/admin/debunk/:slug/featured", requireAdminSession, async (req, res) => {
  const { featured } = req.body || {};
  if (typeof featured !== "boolean") {
    return res.status(400).json({ error: "featured doit être true ou false" });
  }
  try {
    if (featured) {
      const countResult = await pool.query(
        "SELECT COUNT(*) AS count FROM debunk_entries WHERE featured_decouverte = true AND slug != $1",
        [req.params.slug]
      );
      if (Number(countResult.rows[0].count) >= 6) {
        return res.status(400).json({ error: "6 entrées déjà sélectionnées — décochez-en une avant d'en cocher une autre" });
      }
    }
    const result = await pool.query(
      "UPDATE debunk_entries SET featured_decouverte = $1, updated_at = now() WHERE slug = $2 RETURNING slug",
      [featured, req.params.slug]
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
  const { slug, myth, reality, categoryId, verdict, claimQuote, imageUrl, published, sources, scopeCodes } = req.body || {};
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
      `INSERT INTO debunk_entries (slug, myth, reality, category_id, verdict, claim_quote, image_url, published, scope_codes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (slug)
       DO UPDATE SET myth = EXCLUDED.myth, reality = EXCLUDED.reality, category_id = EXCLUDED.category_id,
                     verdict = EXCLUDED.verdict, claim_quote = EXCLUDED.claim_quote,
                     image_url = EXCLUDED.image_url, published = EXCLUDED.published,
                     scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
      [slug, myth, reality, categoryId || null, verdict || "faux", claimQuote || null, imageUrl || null, published === true, sanitizeScopeCodes(scopeCodes)]
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

// Soumission publique — une simple proposition de mythe à vérifier, pas un
// article rédigé : "reality" reste volontairement vide à ce stade (jamais
// affiché tant que published=false), le contexte éventuel fourni par la
// personne va dans submission_notes, séparé du contenu éditorial vérifié.
// C'est la rédaction qui écrit "reality" avant toute publication — jamais
// une reprise telle quelle de ce qu'un visiteur a soumis.
router.post("/api/debunk/submit", publicWriteLimiter, async (req, res) => {
  const { myth, sourceUrl, notes, website, scopeCodes } = req.body || {};
  if (website) {
    return res.json({ status: "pending" });
  }
  if (!myth || !myth.trim()) {
    return res.status(400).json({ error: "myth est requis" });
  }
  try {
    const slug = await generateUniqueSlug(myth, "debunk_entries");
    const combinedNotes = [sourceUrl ? `Source suggérée : ${sourceUrl}` : null, notes ? notes.trim() : null]
      .filter(Boolean)
      .join("\n\n");
    await pool.query(
      `INSERT INTO debunk_entries (slug, myth, reality, published, submitted_publicly, submission_notes, scope_codes, updated_at)
       VALUES ($1, $2, '', false, true, $3, $4, now())`,
      [slug, myth.trim(), combinedNotes || null, sanitizeScopeCodes(scopeCodes)]
    );
    res.json({ status: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

export default router;
