// Script ponctuel : publie un lot de pétitions (texte français + 7 traductions
// + image + lien + portée géographique) directement en base, sans passer par
// l'admin — même résultat qu'une saisie manuelle, mais en une commande.
//
// Même principe que import-resource-locations.js : aperçu par défaut, rien
// n'est écrit sans --apply. Le lot de données est dans
// src/scripts/data/petitions-2026-10.json (ou un autre fichier via --file=).
//
// Usage (dans le conteneur api de production) :
//   node src/scripts/publish-petitions.js                    # aperçu, ne modifie rien
//   node src/scripts/publish-petitions.js --apply            # publie les pétitions NOUVELLES
//   node src/scripts/publish-petitions.js --apply --update   # écrase aussi celles qui existent déjà
//   node src/scripts/publish-petitions.js --apply --no-push  # sans notification push aux abonnés
//
// Par défaut une pétition dont le slug existe déjà est laissée intacte (pour
// ne jamais écraser une correction faite depuis l'admin). Tout est écrit dans
// UNE transaction : en cas d'erreur, rien n'est publié à moitié. Les
// traductions sont écrites avant la pétition elle-même, de sorte que la
// notification push (déclenchée par la publication, voir migration 051) ne
// puisse jamais partir avant que les 8 langues soient en base.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../lib/db.js";
import { PETITION_LOCALES, validatePetitionSeed } from "../lib/petitionSeed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apply = process.argv.includes("--apply");
const update = process.argv.includes("--update");
const noPush = process.argv.includes("--no-push");
const fileArg = process.argv.find((a) => a.startsWith("--file="));
const filePath = fileArg ? fileArg.split("=")[1] : join(__dirname, "data", "petitions-2026-10.json");

async function main() {
  const seed = JSON.parse(readFileSync(filePath, "utf8"));
  const { petitions, errors } = validatePetitionSeed(seed);
  if (errors.length > 0) {
    console.error(`Fichier invalide (${filePath}) — rien n'a été écrit :`);
    for (const e of errors) console.error(` - ${e}`);
    process.exitCode = 1;
    return;
  }

  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT slug FROM petitions WHERE slug = ANY($1::text[])", [petitions.map((p) => p.slug)]);
    const existingSlugs = new Set(existing.rows.map((r) => r.slug));

    const toWrite = petitions.filter((p) => !existingSlugs.has(p.slug) || update);
    for (const p of petitions) {
      const state = existingSlugs.has(p.slug) ? (update ? "MISE À JOUR" : "déjà en ligne, ignorée") : "NOUVELLE";
      console.log(`- ${p.slug} [${p.status}, ${p.published ? "publiée" : "brouillon"}, ${p.scopeCodes.join("/")}] : ${state}`);
    }

    if (!apply) {
      console.log(`\nAperçu seulement (${toWrite.length} pétition(s) seraient écrites, ${PETITION_LOCALES.length} langues chacune). Relancer avec --apply pour publier.`);
      return;
    }
    if (toWrite.length === 0) {
      console.log("\nRien à écrire.");
      return;
    }

    await client.query("BEGIN");
    for (const p of toWrite) {
      for (const locale of PETITION_LOCALES.filter((l) => l !== "fr")) {
        for (const field of ["title", "description"]) {
          await client.query(
            `INSERT INTO content_translations (content_type, content_id, field_name, locale, value, updated_at)
             VALUES ('petition', $1, $2, $3, $4, now())
             ON CONFLICT (content_type, content_id, field_name, locale)
             DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [p.slug, field, locale, p.translations[locale][field].trim()]
          );
        }
      }
      await client.query(
        `INSERT INTO petitions
           (slug, title, description, petition_url, source_name, status, image_url, published, scope_codes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description, petition_url = EXCLUDED.petition_url,
           source_name = EXCLUDED.source_name, status = EXCLUDED.status, image_url = EXCLUDED.image_url,
           published = EXCLUDED.published, scope_codes = EXCLUDED.scope_codes, updated_at = now()`,
        [p.slug, p.translations.fr.title.trim(), p.translations.fr.description.trim(), p.petitionUrl, p.sourceName, p.status, p.imageUrl, p.published, p.scopeCodes]
      );
    }
    if (noPush) {
      // Les triggers de la migration 051 ont déjà mis en file un événement
      // "petition_published" par pétition publiée ; on le retire avant le
      // COMMIT, donc avant que le worker puisse le voir.
      const removed = await client.query(
        "DELETE FROM notification_events WHERE entity_type = 'petition' AND entity_id = ANY($1::text[]) AND processed_at IS NULL",
        [toWrite.map((p) => p.slug)]
      );
      console.log(`Notifications push retirées de la file : ${removed.rowCount}`);
    }
    await client.query("COMMIT");
    console.log(`\n${toWrite.length} pétition(s) écrite(s) avec leurs ${PETITION_LOCALES.length - 1} traductions.`);
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
