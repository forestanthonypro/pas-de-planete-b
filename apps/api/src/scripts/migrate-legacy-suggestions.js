// Script ponctuel : migre les anciennes suggestions (charter_suggestions,
// future_idea_suggestions — texte libre + statut, système remplacé par la
// migration 061) vers de vrais éléments (charter_items / future_ideas),
// pour qu'elles s'affichent enfin comme de vrais blocs votables au lieu
// de rester des lignes de texte dans une liste à part.
//
// Usage (dans le conteneur api) :
//   node src/scripts/migrate-legacy-suggestions.js           # aperçu, ne modifie rien
//   node src/scripts/migrate-legacy-suggestions.js --apply    # applique réellement

import { pool } from "../lib/db.js";
import { generateUniqueSlug } from "../lib/slug.js";

const apply = process.argv.includes("--apply");

// Un texte libre ("Titre court.\n\nParagraphe plus long...") est scindé en
// titre + description à partir du premier saut de paragraphe (ou de
// ligne, à défaut) — ça correspond exactement à la façon dont les
// suggestions existantes ont été rédigées dans la pratique (une phrase
// d'accroche, puis le détail).
function splitTitleDescription(rawText) {
  const trimmed = (rawText || "").trim();
  const paragraphs = trimmed.split(/\n\s*\n/);
  let title;
  let description;
  if (paragraphs.length > 1) {
    title = paragraphs[0].trim();
    description = paragraphs.slice(1).join("\n\n").trim();
  } else {
    const lines = trimmed.split("\n");
    title = lines[0].trim();
    description = lines.slice(1).join("\n").trim();
  }
  if (title.length > 300) {
    description = description ? `${title}\n\n${description}` : title;
    title = `${title.slice(0, 297)}...`;
  }
  return { title, description: description || null };
}

async function migrateFutureIdeaSuggestions(client, stats) {
  const rows = (await client.query("SELECT * FROM future_idea_suggestions ORDER BY submitted_at")).rows;
  for (const row of rows) {
    const { title, description } = splitTitleDescription(row.text);
    if (apply) {
      const slug = await generateUniqueSlug(title, "future_ideas");
      await client.query(
        `INSERT INTO future_ideas
           (slug, title, description, published, submitted_publicly, scope_codes, submitter_email, submission_notes, updated_at)
         VALUES ($1, $2, $3, $4, true, $5, $6, $7, now())`,
        [
          slug,
          title,
          description,
          row.status === "published",
          row.scope_codes || [],
          row.submitter_email || null,
          row.submission_notes || null,
        ]
      );
      await client.query("DELETE FROM future_idea_suggestions WHERE id = $1", [row.id]);
    }
    stats.futureIdeas += 1;
    console.log(`  [idées-enfants] "${title}" (${row.status})${apply ? " — migrée" : ""}`);
  }
}

async function migrateCharterSuggestions(client, stats) {
  const defaultSection = await client.query(
    "SELECT id FROM charter_sections WHERE name = 'Boîte à idées (à trier)' LIMIT 1"
  );
  if (defaultSection.rows.length === 0) {
    throw new Error("Section par défaut introuvable — la migration 061 a-t-elle été appliquée ?");
  }
  const sectionId = defaultSection.rows[0].id;

  const rows = (await client.query("SELECT * FROM charter_suggestions ORDER BY submitted_at")).rows;
  for (const row of rows) {
    const { title, description } = splitTitleDescription(row.text);
    if (apply) {
      const maxOrder = await client.query(
        "SELECT COALESCE(MAX(display_order), 0) AS max FROM charter_items WHERE section_id = $1",
        [sectionId]
      );
      await client.query(
        `INSERT INTO charter_items
           (section_id, title, description, display_order, published, submitted_publicly, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, now())`,
        [sectionId, title, description, parseInt(maxOrder.rows[0].max, 10) + 1, row.status === "published"]
      );
      await client.query("DELETE FROM charter_suggestions WHERE id = $1", [row.id]);
    }
    stats.charterItems += 1;
    console.log(`  [charte] "${title}" (${row.status})${apply ? " — migrée" : ""}`);
  }
}

async function main() {
  console.log(apply ? "Mode : APPLICATION RÉELLE" : "Mode : APERÇU (aucune écriture — relancer avec --apply pour appliquer)");
  const stats = { futureIdeas: 0, charterItems: 0 };

  const client = await pool.connect();
  try {
    if (apply) await client.query("BEGIN");
    console.log("\n--- Idées-enfants ---");
    await migrateFutureIdeaSuggestions(client, stats);
    console.log("\n--- Charte ---");
    await migrateCharterSuggestions(client, stats);
    if (apply) await client.query("COMMIT");
  } catch (err) {
    if (apply) await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(`\n--- Résumé ---`);
  console.log(`Idées-enfants : ${stats.futureIdeas} suggestion(s) ${apply ? "migrée(s)" : "à migrer"}.`);
  console.log(`Charte : ${stats.charterItems} suggestion(s) ${apply ? "migrée(s)" : "à migrer"}.`);
  console.log(apply ? "\n✅ Migration appliquée." : "\nAucune écriture effectuée — relancer avec --apply pour appliquer réellement.");

  await pool.end();
}

main().catch((err) => {
  console.error("❌ ÉCHEC:", err);
  process.exitCode = 1;
});
