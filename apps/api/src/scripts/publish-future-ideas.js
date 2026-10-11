// Script ponctuel : publie un lot d'idées « Les enfants d'aujourd'hui et de
// demain » (texte français + 7 traductions + portée géographique) directement
// en base, sans passer par l'admin — même résultat qu'une saisie manuelle.
//
// Même principe que publish-petitions.js : aperçu par défaut, rien n'est écrit
// sans --apply. Le lot de données est dans
// src/scripts/data/future-ideas-2026-10.json (ou un autre fichier via --file=).
//
// Usage (dans le conteneur api de production) :
//   node src/scripts/publish-future-ideas.js                    # aperçu, ne modifie rien
//   node src/scripts/publish-future-ideas.js --apply            # publie les idées NOUVELLES
//   node src/scripts/publish-future-ideas.js --apply --update   # écrase aussi celles qui existent déjà
//   node src/scripts/publish-future-ideas.js --apply --no-push  # sans notification push aux abonnés
//
// Une idée dont le slug existe déjà est laissée intacte par défaut (pour ne
// jamais écraser une correction faite depuis l'admin). Tout est écrit dans UNE
// transaction ; les traductions sont écrites avant l'idée elle-même, de sorte
// que la notification push (migration 051) ne parte jamais avant que les 8
// langues soient en base.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../lib/db.js";
import { FUTURE_IDEA_LOCALES, validateFutureIdeaSeed } from "../lib/futureIdeaSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apply = process.argv.includes("--apply");
const update = process.argv.includes("--update");
const noPush = process.argv.includes("--no-push");
const fileArg = process.argv.find((a) => a.startsWith("--file="));
const filePath = fileArg ? fileArg.split("=")[1] : join(__dirname, "data", "future-ideas-2026-10.json");

async function main() {
  const seed = JSON.parse(readFileSync(filePath, "utf8"));
  const { ideas, errors } = validateFutureIdeaSeed(seed);
  if (errors.length > 0) {
    console.error(`Fichier invalide (${filePath}) — rien n'a été écrit :`);
    for (const e of errors) console.error(` - ${e}`);
    process.exitCode = 1;
    return;
  }

  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT slug FROM future_ideas WHERE slug = ANY($1::text[])", [ideas.map((i) => i.slug)]);
    const existingSlugs = new Set(existing.rows.map((r) => r.slug));

    const toWrite = ideas.filter((i) => !existingSlugs.has(i.slug) || update);
    for (const i of ideas) {
      const state = existingSlugs.has(i.slug) ? (update ? "MISE À JOUR" : "déjà en ligne, ignorée") : "NOUVELLE";
      console.log(`- ${i.slug} [${i.published ? "publiée" : "brouillon"}, ${i.scopeCodes.join("/")}] : ${state}`);
    }

    if (!apply) {
      console.log(`\nAperçu seulement (${toWrite.length} idée(s) seraient écrites, ${FUTURE_IDEA_LOCALES.length} langues chacune). Relancer avec --apply pour publier.`);
      return;
    }
    if (toWrite.length === 0) {
      console.log("\nRien à écrire.");
      return;
    }

    await client.query("BEGIN");
    for (const i of toWrite) {
      for (const locale of FUTURE_IDEA_LOCALES.filter((l) => l !== "fr")) {
        for (const field of ["title", "description"]) {
          await client.query(
            `INSERT INTO content_translations (content_type, content_id, field_name, locale, value, updated_at)
             VALUES ('future_idea', $1, $2, $3, $4, now())
             ON CONFLICT (content_type, content_id, field_name, locale)
             DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [i.slug, field, locale, i.translations[locale][field].trim()]
          );
        }
      }
      await client.query(
        `INSERT INTO future_ideas (slug, title, description, published, scope_codes, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description,
           published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
        [i.slug, i.translations.fr.title.trim(), i.translations.fr.description.trim(), i.published, i.scopeCodes]
      );
    }
    if (noPush) {
      // Les triggers de la migration 051 ont déjà mis en file un événement
      // "future_idea_published" par idée publiée ; on le retire avant le
      // COMMIT, donc avant que le worker puisse le voir.
      const removed = await client.query(
        "DELETE FROM notification_events WHERE entity_type = 'future_idea' AND entity_id = ANY($1::text[]) AND processed_at IS NULL",
        [toWrite.map((i) => i.slug)]
      );
      console.log(`Notifications push retirées de la file : ${removed.rowCount}`);
    }
    await client.query("COMMIT");
    console.log(`\n${toWrite.length} idée(s) écrite(s) avec leurs ${FUTURE_IDEA_LOCALES.length - 1} traductions.`);
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
