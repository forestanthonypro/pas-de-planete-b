import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { UUID_RE, EMAIL_RE } from "../lib/validators.js";

const router = Router();

// --- Charte éthique "Les enfants d'aujourd'hui et de demain" ---
// Sections et éléments gérables et réordonnables en admin, vote citoyen
// anonyme (adhère / à nuancer, jamais de rejet brutal), boîte à idées
// modérée avant toute publication.

router.get("/api/charter", async (req, res) => {
  const { locale } = req.query;
  try {
    const sections = await pool.query(
      "SELECT id, name, display_order FROM charter_sections ORDER BY display_order"
    );
    const items = await pool.query(
      `SELECT i.id, i.section_id, i.title, i.description, i.display_order,
              COUNT(*) FILTER (WHERE v.vote_type = 'adhere') AS adhere_count,
              COUNT(*) FILTER (WHERE v.vote_type = 'nuance') AS nuance_count
       FROM charter_items i
       LEFT JOIN charter_votes v ON v.item_id = i.id
       WHERE i.published = true
       GROUP BY i.id
       ORDER BY i.display_order`
    );

    let sectionNameOverrides = {};
    let itemOverrides = {};
    if (locale && locale !== "fr") {
      const [sectionTr, itemTr] = await Promise.all([
        pool.query(
          "SELECT content_id, value FROM content_translations WHERE content_type = 'charter_section' AND field_name = 'name' AND locale = $1",
          [locale]
        ),
        pool.query(
          "SELECT content_id, field_name, value FROM content_translations WHERE content_type = 'charter_item' AND locale = $1",
          [locale]
        ),
      ]);
      for (const r of sectionTr.rows) sectionNameOverrides[r.content_id] = r.value;
      for (const r of itemTr.rows) {
        itemOverrides[r.content_id] = itemOverrides[r.content_id] || {};
        itemOverrides[r.content_id][r.field_name] = r.value;
      }
    }

    const itemsBySection = {};
    for (const item of items.rows) {
      if (!itemsBySection[item.section_id]) itemsBySection[item.section_id] = [];
      const override = itemOverrides[String(item.id)] || {};
      itemsBySection[item.section_id].push({
        id: item.id,
        title: override.title || item.title,
        description: override.description !== undefined ? override.description : item.description,
        adhereCount: parseInt(item.adhere_count, 10),
        nuanceCount: parseInt(item.nuance_count, 10),
      });
    }
    const suggestions = await pool.query(
      "SELECT id, text FROM charter_suggestions WHERE status = 'published' ORDER BY submitted_at DESC"
    );
    res.json({
      sections: sections.rows.map((s) => ({
        id: s.id,
        name: sectionNameOverrides[String(s.id)] || s.name,
        items: itemsBySection[s.id] || [],
      })),
      publishedSuggestions: suggestions.rows,
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/charter-votes", publicWriteLimiter, async (req, res) => {
  const { anonymousId, itemId, voteType } = req.body || {};
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  if (!["adhere", "nuance"].includes(voteType)) {
    return res.status(400).json({ error: "Vote invalide" });
  }
  const itemIdNum = parseInt(itemId, 10);
  if (Number.isNaN(itemIdNum)) {
    return res.status(400).json({ error: "Élément invalide" });
  }
  try {
    await pool.query(
      `INSERT INTO charter_votes (anonymous_id, item_id, vote_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (anonymous_id, item_id) DO UPDATE SET vote_type = EXCLUDED.vote_type, voted_at = now()`,
      [anonymousId, itemIdNum, voteType]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.get("/api/charter-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    const result = await pool.query(
      "SELECT item_id, vote_type FROM charter_votes WHERE anonymous_id = $1",
      [anonymousId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/charter-suggestions", publicWriteLimiter, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text est requis" });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Texte trop long (2000 caractères max)" });
  }
  try {
    await pool.query("INSERT INTO charter_suggestions (text, status) VALUES ($1, 'pending')", [text.trim()]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

// Soumission publique directe — même principe que débunk/paysans/
// pétitions/ressources : la proposition devient un vrai élément de charte
// (published=false, submitted_publicly=true) plutôt qu'un texte libre à
// part qui resterait une simple ligne de liste une fois publié. Comme
// section_id est obligatoire et qu'un visiteur ne peut pas raisonnablement
// choisir parmi les sections éditoriales existantes, tout atterrit dans
// la section "Boîte à idées (à trier)" créée par la migration 061 —
// l'admin la déplace ensuite si besoin via la page d'édition.
router.post("/api/charter-items/submit", publicWriteLimiter, async (req, res) => {
  const { title, description, website, submitterEmail, submissionNotes } = req.body || {};
  if (website) {
    return res.json({ status: "pending" });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "title est requis" });
  }
  if (title.length > 300) {
    return res.status(400).json({ error: "Titre trop long (300 caractères max)" });
  }
  if (description && description.length > 2000) {
    return res.status(400).json({ error: "Description trop longue (2000 caractères max)" });
  }
  const cleanEmail = submitterEmail && EMAIL_RE.test(submitterEmail.trim()) ? submitterEmail.trim() : null;
  try {
    const defaultSection = await pool.query(
      "SELECT id FROM charter_sections WHERE name = 'Boîte à idées (à trier)' LIMIT 1"
    );
    if (defaultSection.rows.length === 0) {
      throw new Error("Section par défaut introuvable — la migration 061 a-t-elle été appliquée ?");
    }
    const sectionId = defaultSection.rows[0].id;
    const maxOrder = await pool.query(
      "SELECT COALESCE(MAX(display_order), 0) AS max FROM charter_items WHERE section_id = $1",
      [sectionId]
    );
    await pool.query(
      `INSERT INTO charter_items
         (section_id, title, description, display_order, published, submitted_publicly, submitter_email, submission_notes, updated_at)
       VALUES ($1, $2, $3, $4, false, true, $5, $6, now())`,
      [
        sectionId,
        title.trim(),
        description ? description.trim() : null,
        parseInt(maxOrder.rows[0].max, 10) + 1,
        cleanEmail,
        submissionNotes ? submissionNotes.trim().slice(0, 2000) : null,
      ]
    );
    res.json({ status: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

// -- Administration : sections --

router.get("/api/admin/charter-sections", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, name, display_order FROM charter_sections ORDER BY display_order");
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/charter-sections", requireAdminSession, async (req, res) => {
  const { id, name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name est requis" });
  }
  try {
    if (id) {
      await pool.query("UPDATE charter_sections SET name = $1 WHERE id = $2", [name.trim(), id]);
      res.json({ status: "ok", id });
    } else {
      const maxOrder = await pool.query("SELECT COALESCE(MAX(display_order), 0) AS max FROM charter_sections");
      const result = await pool.query(
        "INSERT INTO charter_sections (name, display_order) VALUES ($1, $2) RETURNING id",
        [name.trim(), parseInt(maxOrder.rows[0].max, 10) + 1]
      );
      res.json({ status: "ok", id: result.rows[0].id });
    }
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.delete("/api/admin/charter-sections/:id", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM charter_sections WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.post("/api/admin/charter-sections/:id/move", requireAdminSession, async (req, res) => {
  const { direction } = req.body || {};
  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "direction doit être 'up' ou 'down'" });
  }
  const client = await pool.connect();
  try {
    const current = await client.query("SELECT id, display_order FROM charter_sections WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: "Section non trouvée" });
    const currentOrder = current.rows[0].display_order;
    const neighborResult = await client.query(
      direction === "up"
        ? "SELECT id, display_order FROM charter_sections WHERE display_order < $1 ORDER BY display_order DESC LIMIT 1"
        : "SELECT id, display_order FROM charter_sections WHERE display_order > $1 ORDER BY display_order ASC LIMIT 1",
      [currentOrder]
    );
    if (neighborResult.rows.length === 0) return res.json({ status: "ok" });
    await client.query("BEGIN");
    await client.query("UPDATE charter_sections SET display_order = $1 WHERE id = $2", [neighborResult.rows[0].display_order, req.params.id]);
    await client.query("UPDATE charter_sections SET display_order = $1 WHERE id = $2", [currentOrder, neighborResult.rows[0].id]);
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Échec du déplacement", detail: errorDetail(err) });
  } finally {
    client.release();
  }
});

// -- Administration : éléments --

router.get("/api/admin/charter-items", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.title, i.published, i.submitted_publicly, i.display_order, i.section_id, s.name AS section_name
       FROM charter_items i
       JOIN charter_sections s ON s.id = i.section_id
       ORDER BY s.display_order, i.display_order`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/admin/charter-items/:id", requireAdminSession, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM charter_items WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Élément non trouvé" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/charter-items", requireAdminSession, async (req, res) => {
  const { id, sectionId, title, description, published } = req.body || {};
  if (!sectionId || !title || !title.trim()) {
    return res.status(400).json({ error: "sectionId et title sont requis" });
  }
  try {
    if (id) {
      await pool.query(
        "UPDATE charter_items SET section_id = $1, title = $2, description = $3, published = $4, updated_at = now() WHERE id = $5",
        [sectionId, title.trim(), description || null, published === true, id]
      );
      res.json({ status: "ok", id });
    } else {
      const maxOrder = await pool.query(
        "SELECT COALESCE(MAX(display_order), 0) AS max FROM charter_items WHERE section_id = $1",
        [sectionId]
      );
      const result = await pool.query(
        `INSERT INTO charter_items (section_id, title, description, display_order, published, updated_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
        [sectionId, title.trim(), description || null, parseInt(maxOrder.rows[0].max, 10) + 1, published === true]
      );
      res.json({ status: "ok", id: result.rows[0].id });
    }
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.delete("/api/admin/charter-items/:id", requireAdminSession, async (req, res) => {
  try {
    await pool.query("DELETE FROM charter_items WHERE id = $1", [req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

router.post("/api/admin/charter-items/:id/publish", requireAdminSession, async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== "boolean") {
    return res.status(400).json({ error: "published doit être true ou false" });
  }
  try {
    await pool.query("UPDATE charter_items SET published = $1, updated_at = now() WHERE id = $2", [published, req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: errorDetail(err) });
  }
});

router.post("/api/admin/charter-items/:id/move", requireAdminSession, async (req, res) => {
  const { direction } = req.body || {};
  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "direction doit être 'up' ou 'down'" });
  }
  const client = await pool.connect();
  try {
    const current = await client.query("SELECT id, section_id, display_order FROM charter_items WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: "Élément non trouvé" });
    const { section_id: sectionId, display_order: currentOrder } = current.rows[0];
    const neighborResult = await client.query(
      direction === "up"
        ? "SELECT id, display_order FROM charter_items WHERE section_id = $1 AND display_order < $2 ORDER BY display_order DESC LIMIT 1"
        : "SELECT id, display_order FROM charter_items WHERE section_id = $1 AND display_order > $2 ORDER BY display_order ASC LIMIT 1",
      [sectionId, currentOrder]
    );
    if (neighborResult.rows.length === 0) return res.json({ status: "ok" });
    await client.query("BEGIN");
    await client.query("UPDATE charter_items SET display_order = $1 WHERE id = $2", [neighborResult.rows[0].display_order, req.params.id]);
    await client.query("UPDATE charter_items SET display_order = $1 WHERE id = $2", [currentOrder, neighborResult.rows[0].id]);
    await client.query("COMMIT");
    res.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Échec du déplacement", detail: errorDetail(err) });
  } finally {
    client.release();
  }
});

// -- Administration : suggestions (boîte à idées, modération) --

router.get("/api/admin/charter-suggestions", requireAdminSession, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, text, status, submitted_at FROM charter_suggestions ORDER BY submitted_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/charter-suggestions/:id/status", requireAdminSession, async (req, res) => {
  const { status } = req.body || {};
  if (!["pending", "published", "draft", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }
  try {
    await pool.query("UPDATE charter_suggestions SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: errorDetail(err) });
  }
});

// Permet de corriger une proposition (fautes, mise en forme, contenu
// inapproprié à retirer) avant de la publier — même principe que les
// autres rubriques (débunk, interviews, paysans, pétitions, ressources),
// où la proposition devient une entrée complète modifiable via edit.js
// avant publication. Ici la "proposition" reste un texte libre, donc une
// simple édition du texte suffit.
router.post("/api/admin/charter-suggestions/:id/text", requireAdminSession, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text est requis" });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Texte trop long (2000 caractères max)" });
  }
  try {
    await pool.query("UPDATE charter_suggestions SET text = $1 WHERE id = $2", [text.trim(), req.params.id]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la mise à jour", detail: errorDetail(err) });
  }
});


export default router;
