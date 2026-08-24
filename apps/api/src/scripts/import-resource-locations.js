// Script ponctuel : importe en masse les lieux ressources fournis par
// Anthony (fichier "Base_lieux_responsables_Monde.xlsx", export
// Lieux_import converti en JSONL) — ~66 000 lieux dans 4 catégories
// (jardins partagés, marchés locaux, recycleries, vente directe),
// sources OpenStreetMap (ODbL 1.0) et DATAtourisme principalement.
//
// Décision produit du 24/08/2026 : publiés directement (published=true),
// pas mis en file de relecture — ce sont des données ouvertes/
// institutionnelles importées par l'admin, pas des soumissions du public
// (submitted_publicly reste false). Voir migration 059 pour les colonnes
// de provenance/licence ajoutées à cet effet.
//
// Usage (dans le conteneur api, fichier attendu à côté de ce script sous
// data/lieux_import.jsonl — ou un autre chemin via --file=...) :
//   node src/scripts/import-resource-locations.js                 # aperçu, ne modifie rien
//   node src/scripts/import-resource-locations.js --apply          # applique réellement
//   node src/scripts/import-resource-locations.js --apply --file=/chemin/vers/lieux_import.jsonl

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import countriesLib from "i18n-iso-countries";
import { pool } from "../lib/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apply = process.argv.includes("--apply");
const fileArg = process.argv.find((a) => a.startsWith("--file="));
const filePath = fileArg ? fileArg.split("=")[1] : join(__dirname, "data", "lieux_import.jsonl");

const BATCH_SIZE = 500;

function toAlpha3(alpha2) {
  try {
    return countriesLib.alpha2ToAlpha3(alpha2) || null;
  } catch {
    return null;
  }
}

async function loadCategoryIds(client) {
  const result = await client.query("SELECT id, slug FROM resource_categories");
  const map = {};
  for (const row of result.rows) map[row.slug] = row.id;
  return map;
}

async function insertBatch(client, batch, categoryIds, stats) {
  if (batch.length === 0) return;

  const placeholders = [];
  const params = [];
  batch.forEach((row, i) => {
    const base = i * 12;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, true, false, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, now())`
    );
    const categoryId = categoryIds[row.categorySlug] || null;
    const alpha3 = toAlpha3(row.countryAlpha2);
    if (!alpha3) stats.countryLookupFailures += 1;
    params.push(
      row.slug,
      row.name,
      row.description,
      row.address,
      row.lat,
      row.lon,
      categoryId,
      alpha3 ? [alpha3] : [],
      row.sourceName,
      row.sourceUrl,
      row.licenseAttribution,
      row.verificationStatus
    );
  });

  await client.query(
    `INSERT INTO resource_locations
       (slug, name, description, address, latitude, longitude, category_id, published, submitted_publicly,
        scope_codes, source_name, source_url, license_attribution, verification_status, updated_at)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name, description = EXCLUDED.description, address = EXCLUDED.address,
       latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, category_id = EXCLUDED.category_id,
       scope_codes = EXCLUDED.scope_codes, source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url,
       license_attribution = EXCLUDED.license_attribution, verification_status = EXCLUDED.verification_status,
       updated_at = now()`,
    params
  );

  // Liens : on repart de zéro pour les lieux de ce batch (plus simple et
  // sûr qu'un diff — le volume par lieu est faible, 0 à 2 liens).
  const slugsWithLinks = batch.filter((r) => r.links.length > 0).map((r) => r.slug);
  if (slugsWithLinks.length > 0) {
    await client.query("DELETE FROM resource_location_links WHERE location_slug = ANY($1::text[])", [slugsWithLinks]);
    const linkPlaceholders = [];
    const linkParams = [];
    let idx = 0;
    for (const row of batch) {
      for (const link of row.links) {
        linkPlaceholders.push(`($${idx + 1}, $${idx + 2}, $${idx + 3})`);
        linkParams.push(row.slug, link.label, link.url);
        idx += 3;
        stats.linksInserted += 1;
      }
    }
    if (linkPlaceholders.length > 0) {
      await client.query(
        `INSERT INTO resource_location_links (location_slug, label, url) VALUES ${linkPlaceholders.join(", ")}`,
        linkParams
      );
    }
  }
}

async function main() {
  console.log(`Fichier source : ${filePath}`);
  console.log(apply ? "Mode : APPLICATION RÉELLE" : "Mode : APERÇU (aucune écriture — relancer avec --apply pour appliquer)");

  const categoryIds = await loadCategoryIds(pool);
  const missingCategories = ["jardin-partage", "marche-local-producteurs", "recyclerie-ressourcerie", "vente-directe-producteur"]
    .filter((slug) => !categoryIds[slug]);
  if (missingCategories.length > 0) {
    throw new Error(
      `Catégories manquantes en base : ${missingCategories.join(", ")} — la migration 059 a-t-elle bien été appliquée ?`
    );
  }

  const stats = { total: 0, byCategory: {}, countryLookupFailures: 0, linksInserted: 0 };
  let batch = [];

  const rl = createInterface({ input: createReadStream(filePath, "utf-8"), crlfDelay: Infinity });

  const client = apply ? await pool.connect() : null;
  if (apply) await client.query("BEGIN");

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      stats.total += 1;
      stats.byCategory[row.categorySlug] = (stats.byCategory[row.categorySlug] || 0) + 1;
      batch.push(row);

      if (batch.length >= BATCH_SIZE) {
        if (apply) await insertBatch(client, batch, categoryIds, stats);
        batch = [];
        if (stats.total % 5000 === 0) console.log(`  ${stats.total} lignes traitées...`);
      }
    }
    if (batch.length > 0 && apply) {
      await insertBatch(client, batch, categoryIds, stats);
    }

    if (apply) {
      await client.query("COMMIT");
    }
  } catch (err) {
    if (apply) await client.query("ROLLBACK");
    throw err;
  } finally {
    if (client) client.release();
  }

  console.log("\n--- Résumé ---");
  console.log(`Total lignes traitées : ${stats.total}`);
  console.log("Par catégorie :", stats.byCategory);
  console.log(`Échecs de conversion de code pays (alpha-2 → alpha-3) : ${stats.countryLookupFailures}`);
  if (apply) console.log(`Liens insérés : ${stats.linksInserted}`);
  console.log(apply ? "\n✅ Import appliqué." : "\nAucune écriture effectuée — relancer avec --apply pour appliquer réellement.");

  await pool.end();
}

main().catch((err) => {
  console.error("❌ ÉCHEC:", err);
  process.exitCode = 1;
});
