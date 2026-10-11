// Script ponctuel : publie un lot de fiches Débunk (affirmation + citation +
// verdict + réponse sourcée, en français + 7 traductions + sources + catégorie
// + portée) directement en base, sans passer par l'admin.
//
// Même principe que publish-petitions.js : aperçu par défaut, rien n'est écrit
// sans --apply. Données dans src/scripts/data/debunk-2026-10.json (ou un autre
// fichier via --file=).
//
// Usage (dans le conteneur api de production) :
//   node src/scripts/publish-debunk.js                    # aperçu, ne modifie rien
//   node src/scripts/publish-debunk.js --apply            # publie les fiches NOUVELLES
//   node src/scripts/publish-debunk.js --apply --update   # écrase aussi celles qui existent déjà
//   node src/scripts/publish-debunk.js --apply --no-push  # sans notification push aux abonnés
//
// Une fiche dont le slug existe déjà est laissée intacte par défaut (pour ne
// jamais écraser une correction faite depuis l'admin). Tout est écrit dans UNE
// transaction ; les traductions sont écrites avant la fiche (la notification
// push, migration 051, ne part donc jamais avant que les 8 langues existent).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../lib/db.js";
import { DEBUNK_LOCALES, validateDebunkSeed } from "../lib/debunkSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apply = process.argv.includes("--apply");
const update = process.argv.includes("--update");
const noPush = process.argv.includes("--no-push");
const fileArg = process.argv.find((a) => a.startsWith("--file="));
const filePath = fileArg ? fileArg.split("=")[1] : join(__dirname, "data", "debunk-2026-10.json");

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
  const { entries, categories, errors } = validateDebunkSeed(seed);

  const client = await pool.connect();
  try {
    const existingCats = await client.query("SELECT id, slug FROM debunk_categories");
    const categoryIds = new Map(existingCats.rows.map((r) => [r.slug, r.id]));
    const declared = new Set(categories.map((c) => c.slug));
    for (const e of entries) {
      if (!categoryIds.has(e.categorySlug) && !declared.has(e.categorySlug)) {
        errors.push(`${e.slug} : catégorie inconnue "${e.categorySlug}" (ni en base, ni déclarée dans le fichier)`);
      }
    }
    if (errors.length > 0) {
      console.error(`Fichier invalide (${filePath}) — rien n'a été écrit :`);
      for (const e of errors) console.error(` - ${e}`);
      process.exitCode = 1;
      return;
    }

    const existing = await client.query("SELECT slug FROM debunk_entries WHERE slug = ANY($1::text[])", [entries.map((e) => e.slug)]);
    const existingSlugs = new Set(existing.rows.map((r) => r.slug));
    const toWrite = entries.filter((e) => !existingSlugs.has(e.slug) || update);

    for (const c of categories) {
      console.log(`- catégorie ${c.slug} : ${categoryIds.has(c.slug) ? "existe déjà (nom français inchangé)" : "NOUVELLE"}`);
    }
    for (const e of entries) {
      const state = existingSlugs.has(e.slug) ? (update ? "MISE À JOUR" : "déjà en ligne, ignorée") : "NOUVELLE";
      console.log(`- ${e.slug} [${e.verdict}, ${e.published ? "publiée" : "brouillon"}, ${e.categorySlug}, ${e.scopeCodes.join("/")}, ${e.sources.length} source(s)] : ${state}`);
    }

    if (!apply) {
      console.log(`\nAperçu seulement (${toWrite.length} fiche(s) seraient écrites, ${DEBUNK_LOCALES.length} langues chacune). Relancer avec --apply pour publier.`);
      return;
    }
    if (toWrite.length === 0 && categories.every((c) => categoryIds.has(c.slug))) {
      console.log("\nRien à écrire.");
      return;
    }

    await client.query("BEGIN");
    for (const c of categories) {
      const res = await client.query(
        `INSERT INTO debunk_categories (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO NOTHING RETURNING id`,
        [c.names.fr.trim(), c.slug]
      );
      if (res.rows.length > 0) categoryIds.set(c.slug, res.rows[0].id);
      for (const locale of DEBUNK_LOCALES.filter((l) => l !== "fr")) {
        await upsertTranslation(client, "debunk_category", c.slug, "name", locale, c.names[locale]);
      }
    }
    for (const e of toWrite) {
      for (const locale of DEBUNK_LOCALES.filter((l) => l !== "fr")) {
        const tr = e.translations[locale];
        await upsertTranslation(client, "debunk", e.slug, "myth", locale, tr.myth);
        await upsertTranslation(client, "debunk", e.slug, "reality", locale, tr.reality);
        await upsertTranslation(client, "debunk", e.slug, "claim_quote", locale, tr.claimQuote);
      }
      const fr = e.translations.fr;
      await client.query(
        `INSERT INTO debunk_entries (slug, myth, reality, category_id, verdict, claim_quote, published, scope_codes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (slug) DO UPDATE SET
           myth = EXCLUDED.myth, reality = EXCLUDED.reality, category_id = EXCLUDED.category_id,
           verdict = EXCLUDED.verdict, claim_quote = EXCLUDED.claim_quote,
           published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
        [e.slug, fr.myth.trim(), fr.reality.trim(), categoryIds.get(e.categorySlug), e.verdict, fr.claimQuote.trim(), e.published, e.scopeCodes]
      );
      await client.query("DELETE FROM debunk_sources WHERE debunk_slug = $1", [e.slug]);
      for (const s of e.sources) {
        await client.query("INSERT INTO debunk_sources (debunk_slug, label, url) VALUES ($1, $2, $3)", [e.slug, s.label, s.url]);
      }
    }
    if (noPush) {
      // Les triggers de la migration 051 ont déjà mis en file un événement
      // "debunk_published" par fiche publiée ; on le retire avant le COMMIT,
      // donc avant que le worker puisse le voir.
      const removed = await client.query(
        "DELETE FROM notification_events WHERE entity_type = 'debunk' AND entity_id = ANY($1::text[]) AND processed_at IS NULL",
        [toWrite.map((e) => e.slug)]
      );
      console.log(`Notifications push retirées de la file : ${removed.rowCount}`);
    }
    await client.query("COMMIT");
    console.log(`\n${toWrite.length} fiche(s) écrite(s) avec leurs ${DEBUNK_LOCALES.length - 1} traductions.`);
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
