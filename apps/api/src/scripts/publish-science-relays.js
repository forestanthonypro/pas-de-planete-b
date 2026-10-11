// Script ponctuel : publie un lot de relais scientifiques (page /interviews) —
// notre propre résumé en français + 7 traductions + image + lien source +
// catégorie + portée — directement en base, sans passer par l'admin.
//
// Même principe que publish-petitions.js / publish-future-ideas.js : aperçu par
// défaut, rien n'est écrit sans --apply. Données dans
// src/scripts/data/science-relays-2026-10.json (ou un autre fichier via --file=).
//
// Usage (dans le conteneur api de production) :
//   node src/scripts/publish-science-relays.js                   # aperçu, ne modifie rien
//   node src/scripts/publish-science-relays.js --apply           # publie les relais NOUVEAUX
//   node src/scripts/publish-science-relays.js --apply --update  # écrase aussi ceux qui existent déjà
//
// Pas d'option --no-push : les relais scientifiques n'envoient pas de
// notification push (aucun trigger dans la migration 051). Un relai dont le slug
// existe déjà est laissé intact par défaut. Tout est écrit dans UNE transaction.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../lib/db.js";
import { RELAY_LOCALES, validateScienceRelaySeed } from "../lib/scienceRelaySeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apply = process.argv.includes("--apply");
const update = process.argv.includes("--update");
const fileArg = process.argv.find((a) => a.startsWith("--file="));
const filePath = fileArg ? fileArg.split("=")[1] : join(__dirname, "data", "science-relays-2026-10.json");

async function upsertTranslation(client, type, id, field, locale, value) {
  await client.query(
    `INSERT INTO content_translations (content_type, content_id, field_name, locale, value, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (content_type, content_id, field_name, locale)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [type, id, field, locale, value.trim()]
  );
}

async function main() {
  const seed = JSON.parse(readFileSync(filePath, "utf8"));
  const { relays, categories, errors } = validateScienceRelaySeed(seed);

  const client = await pool.connect();
  try {
    const existingCats = await client.query("SELECT id, slug FROM interview_categories");
    const categoryIds = new Map(existingCats.rows.map((r) => [r.slug, r.id]));
    const declared = new Set(categories.map((c) => c.slug));
    for (const r of relays) {
      if (!categoryIds.has(r.categorySlug) && !declared.has(r.categorySlug)) {
        errors.push(`${r.slug} : catégorie inconnue "${r.categorySlug}" (ni en base, ni déclarée dans le fichier)`);
      }
    }
    if (errors.length > 0) {
      console.error(`Fichier invalide (${filePath}) — rien n'a été écrit :`);
      for (const e of errors) console.error(` - ${e}`);
      process.exitCode = 1;
      return;
    }

    const existing = await client.query("SELECT slug FROM science_relays WHERE slug = ANY($1::text[])", [relays.map((r) => r.slug)]);
    const existingSlugs = new Set(existing.rows.map((r) => r.slug));
    const toWrite = relays.filter((r) => !existingSlugs.has(r.slug) || update);

    for (const c of categories) {
      console.log(`- catégorie ${c.slug} : ${categoryIds.has(c.slug) ? "existe déjà (nom français inchangé)" : "NOUVELLE"}`);
    }
    for (const r of relays) {
      const state = existingSlugs.has(r.slug) ? (update ? "MISE À JOUR" : "déjà en ligne, ignoré") : "NOUVEAU";
      console.log(`- ${r.slug} [${r.contentType}, ${r.published ? "publié" : "brouillon"}, ${r.categorySlug}, ${r.scopeCodes.join("/")}] : ${state}`);
    }

    if (!apply) {
      console.log(`\nAperçu seulement (${toWrite.length} relais seraient écrits, ${RELAY_LOCALES.length} langues chacun). Relancer avec --apply pour publier.`);
      return;
    }
    if (toWrite.length === 0 && categories.every((c) => categoryIds.has(c.slug))) {
      console.log("\nRien à écrire.");
      return;
    }

    await client.query("BEGIN");
    // Catégories d'abord (nom français + 7 traductions), avant les relais qui les utilisent.
    for (const c of categories) {
      const res = await client.query(
        `INSERT INTO interview_categories (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO NOTHING RETURNING id`,
        [c.names.fr.trim(), c.slug]
      );
      if (res.rows.length > 0) categoryIds.set(c.slug, res.rows[0].id);
      for (const locale of RELAY_LOCALES.filter((l) => l !== "fr")) {
        await upsertTranslation(client, "interview_category", c.slug, "name", locale, c.names[locale]);
      }
    }
    for (const r of toWrite) {
      // Traductions avant le relais lui-même (même ordre que les autres scripts).
      for (const locale of RELAY_LOCALES.filter((l) => l !== "fr")) {
        const tr = r.translations[locale];
        await upsertTranslation(client, "interview", r.slug, "title", locale, tr.title);
        await upsertTranslation(client, "interview", r.slug, "description", locale, tr.description);
        await upsertTranslation(client, "interview", r.slug, "scientist_field", locale, tr.scientistField);
      }
      const fr = r.translations.fr;
      await client.query(
        `INSERT INTO science_relays
           (slug, title, description, scientist_name, scientist_field, content_type,
            source_url, source_name, embed_url, image_url, category_id, published, scope_codes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description,
           scientist_name = EXCLUDED.scientist_name, scientist_field = EXCLUDED.scientist_field,
           content_type = EXCLUDED.content_type, source_url = EXCLUDED.source_url,
           source_name = EXCLUDED.source_name, embed_url = EXCLUDED.embed_url, image_url = EXCLUDED.image_url,
           category_id = EXCLUDED.category_id, published = EXCLUDED.published,
           scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
        [r.slug, fr.title.trim(), fr.description.trim(), r.scientistName, fr.scientistField.trim(), r.contentType,
         r.sourceUrl, r.sourceName, r.embedUrl, r.imageUrl, categoryIds.get(r.categorySlug), r.published, r.scopeCodes]
      );
    }
    await client.query("COMMIT");
    console.log(`\n${toWrite.length} relais écrit(s) avec leurs ${RELAY_LOCALES.length - 1} traductions.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error("Échec :", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
