import { pool } from "./db.js";

// Le français reste la donnée "source" dans les tables existantes ; cette
// table ne stocke que les variantes dans les autres langues, en overlay.
export const TRANSLATABLE_CONTENT_TYPES = ["debunk", "interview", "paysan", "resource_location", "resource_online", "charter_section", "charter_item", "future_idea", "petition"];
export const TRANSLATABLE_FIELDS = {
  debunk: ["myth", "reality", "claim_quote"],
  interview: ["title", "description", "scientist_field"],
  paysan: ["title", "description"],
  resource_location: ["name", "description"],
  resource_online: ["title", "description"],
  charter_section: ["name"],
  charter_item: ["title", "description"],
  future_idea: ["title", "description"],
  petition: ["title", "description"],
};

// Fusionne les traductions disponibles dans une liste de lignes déjà
// chargées depuis la table "source" (française) — remplace le même bloc
// qui était dupliqué identiquement dans 7 routes différentes (débunk,
// interviews, paysans, ressources×2, idées enfants, et la fusion
// unitaire pour les pages détail). "idField" est le nom de la colonne qui
// sert de content_id dans content_translations (toujours "slug" sauf
// mention contraire).
export async function mergeTranslations(rows, contentType, locale, idField = "slug") {
  if (!locale || locale === "fr" || rows.length === 0) return rows;
  const trResult = await pool.query(
    "SELECT content_id, field_name, value FROM content_translations WHERE content_type = $1 AND locale = $2",
    [contentType, locale]
  );
  const overrides = {};
  for (const r of trResult.rows) {
    overrides[r.content_id] = overrides[r.content_id] || {};
    overrides[r.content_id][r.field_name] = r.value;
  }
  return rows.map((row) => ({ ...row, ...(overrides[row[idField]] || {}) }));
}

// Même principe que mergeTranslations, mais pour une seule fiche détail
// (mute l'objet directement plutôt que de retourner un tableau) — utilisé
// par les routes /:slug de débunk, interviews, paysans, ressources.
export async function applyTranslations(entry, contentType, contentId, locale) {
  if (!locale || locale === "fr") return entry;
  const trResult = await pool.query(
    "SELECT field_name, value FROM content_translations WHERE content_type = $1 AND content_id = $2 AND locale = $3",
    [contentType, contentId, locale]
  );
  for (const r of trResult.rows) {
    entry[r.field_name] = r.value;
  }
  return entry;
}
