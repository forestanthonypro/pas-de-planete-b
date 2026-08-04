import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireAdminSession } from "../lib/auth.js";

// Réglages du site (activation de fonctionnalités, contenu des pages
// légales par langue) — géré depuis /admin/settings.
const router = Router();

router.get("/api/settings/newsletter-enabled", async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key = 'newsletter_enabled'");
    const enabled = result.rows[0]?.value === "true";
    res.json({ enabled });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.get("/api/admin/settings", requireAdminSession, async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM site_settings");
    const settings = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.post("/api/admin/settings/newsletter-enabled", requireAdminSession, async (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled doit être un booléen" });
  }
  try {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('newsletter_enabled', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(enabled)]
    );
    res.json({ enabled });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

// Contenu éditable des pages légales (mentions légales, confidentialité) —
// liste blanche stricte des clés autorisées pour éviter d'exposer/modifier
// n'importe quel réglage interne via ces routes génériques.
// Clés sans suffixe = français (comportement historique). Suffixe par code
// de langue pour les autres langues (phase 2 : _en/_es/_it, phase 3 :
// _ru/_ja/_zh/_hi).
const LEGAL_CONTENT_KEYS = [
  "mentions_legales_content",
  "mentions_legales_content_en",
  "mentions_legales_content_es",
  "mentions_legales_content_it",
  "mentions_legales_content_ru",
  "mentions_legales_content_ja",
  "mentions_legales_content_zh",
  "mentions_legales_content_hi",
  "confidentialite_content",
  "confidentialite_content_en",
  "confidentialite_content_es",
  "confidentialite_content_it",
  "confidentialite_content_ru",
  "confidentialite_content_ja",
  "confidentialite_content_zh",
  "confidentialite_content_hi",
];

router.get("/api/settings/legal-content/:key", async (req, res) => {
  const { key } = req.params;
  if (!LEGAL_CONTENT_KEYS.includes(key)) {
    return res.status(404).json({ error: "Contenu introuvable" });
  }
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key = $1", [key]);
    res.json({ content: result.rows[0]?.value || "" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});

router.post("/api/admin/settings/legal-content", requireAdminSession, async (req, res) => {
  const { key, content } = req.body || {};
  if (!LEGAL_CONTENT_KEYS.includes(key)) {
    return res.status(400).json({ error: "Clé de contenu invalide" });
  }
  if (typeof content !== "string") {
    return res.status(400).json({ error: "content doit être une chaîne" });
  }
  try {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, content]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: errorDetail(err) });
  }
});


export default router;
