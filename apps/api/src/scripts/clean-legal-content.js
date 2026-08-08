// Script ponctuel : nettoie le HTML déjà enregistré dans site_settings pour
// les pages légales (mentions légales, confidentialité, toutes langues),
// en repassant chaque valeur par le même sanitizeLegalHtml() désormais
// appliqué à chaque nouvel enregistrement. Sert à corriger l'existant après
// la découverte d'un style en ligne (font-family:sans-serif) hérité d'une
// traduction automatique passée en format "text" au lieu de "html".
//
// Usage (dans le conteneur api) :
//   node src/scripts/clean-legal-content.js          # aperçu, ne modifie rien
//   node src/scripts/clean-legal-content.js --apply   # applique réellement

import { pool } from "../lib/db.js";
import { sanitizeLegalHtml } from "../lib/sanitizeHtml.js";

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

const apply = process.argv.includes("--apply");

async function main() {
  const result = await pool.query(
    "SELECT key, value FROM site_settings WHERE key = ANY($1)",
    [LEGAL_CONTENT_KEYS]
  );

  let changedCount = 0;

  for (const row of result.rows) {
    const cleaned = sanitizeLegalHtml(row.value);
    if (cleaned !== row.value) {
      changedCount++;
      console.log(`\n--- ${row.key} ---`);
      console.log("Avant :", row.value.slice(0, 200));
      console.log("Après :", cleaned.slice(0, 200));
      if (apply) {
        await pool.query("UPDATE site_settings SET value = $1 WHERE key = $2", [cleaned, row.key]);
      }
    }
  }

  console.log(`\n${changedCount} clé(s) avec du contenu à nettoyer sur ${result.rows.length} vérifiée(s).`);
  console.log(apply ? "Modifications appliquées." : "Mode aperçu seulement — relancez avec --apply pour enregistrer.");

  await pool.end();
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
