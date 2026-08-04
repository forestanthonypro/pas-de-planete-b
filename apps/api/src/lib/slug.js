import { pool } from "./db.js";

// Génère un slug à partir d'un texte libre (titre saisi par le public,
// par exemple), et garantit son unicité dans la table donnée en ajoutant
// un suffixe numérique si besoin. "tableName" est toujours une valeur
// fixe passée par notre propre code, jamais une entrée utilisateur — pas
// de risque d'injection SQL malgré l'interpolation directe.
export function slugifyServer(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function generateUniqueSlug(baseText, tableName) {
  const base = slugifyServer(baseText) || "entree";
  let slug = base;
  let suffix = 2;
  for (let attempts = 0; attempts < 50; attempts++) {
    const result = await pool.query(`SELECT 1 FROM ${tableName} WHERE slug = $1`, [slug]);
    if (result.rows.length === 0) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  // Filet de sécurité improbable : après 50 tentatives, on rend le slug
  // unique de force plutôt que de boucler indéfiniment.
  return `${base}-${Date.now()}`;
}
