#!/usr/bin/env node
/**
 * Diagnostic et correction du mojibake (UTF-8 mal réencodé) dans le projet.
 *
 * Symptôme : des fichiers contiennent "Ã©" au lieu de "é", "Ã¨" au lieu de
 * "è", "â€™" au lieu de "'", etc. Cela arrive quand un texte UTF-8 est lu à
 * un moment comme du Windows-1252/Latin-1 (chaque octet UTF-8 devient un
 * caractère à part), puis re-sauvegardé en UTF-8 — les caractères accentués
 * sont alors doublement encodés.
 *
 * Le correctif : Buffer.from(texte_corrompu, "latin1").toString("utf8")
 * inverse exactement cette transformation, à condition que le fichier soit
 * VRAIMENT corrompu de cette façon-là (sinon ça abîme un texte déjà correct).
 * Ce script ne corrige donc que les fichiers où le motif est détecté.
 *
 * Usage :
 *   node fix-encoding.js --scan   apps/web apps/api   (rapport seulement)
 *   node fix-encoding.js --apply  apps/web apps/api   (corrige les fichiers listés)
 *   node fix-encoding.js --apply  apps/web apps/api --yes   (sans confirmation)
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const mode = args.includes("--apply") ? "apply" : "scan";
const skipConfirm = args.includes("--yes");
const targets = args.filter((a) => !a.startsWith("--"));

if (targets.length === 0) {
  console.error("Indique au moins un dossier à scanner, ex : node fix-encoding.js --scan apps/web apps/api");
  process.exit(1);
}

const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".md"]);
const IGNORE_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage"]);

// Motif de détection : séquences typiques du mojibake UTF-8 -> Latin-1.
// Ã suivi d'un caractère de continuation, ou les guillemets/apostrophes
// typographiques mal encodés (â€™, â€œ, â€, etc.).
const MOJIBAKE_PATTERN = /Ã[\x80-\xBF]|â€[\x99\x9c\x9d\x93\x94\x26\x22]|Ã‰|Ã€|Ãˆ/;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function fixMojibake(text) {
  // Reconstitue les octets UTF-8 d'origine puis les redécode correctement.
  return Buffer.from(text, "latin1").toString("utf8");
}

function looksBetterAfterFix(fixed) {
  // Vérifie que la correction ne laisse pas de motif suspect résiduel et
  // ne casse rien (le caractère de remplacement U+FFFD signalerait un échec).
  const stillBad = MOJIBAKE_PATTERN.test(fixed);
  const hasReplacementChar = fixed.includes("\uFFFD");
  return !stillBad && !hasReplacementChar;
}

let allFiles = [];
for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.warn(`Introuvable, ignoré : ${t}`);
    continue;
  }
  allFiles = allFiles.concat(walk(t));
}

const affected = [];
for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (MOJIBAKE_PATTERN.test(content)) {
    const fixed = fixMojibake(content);
    const safe = looksBetterAfterFix(fixed);
    affected.push({ file, safe, fixed });
  }
}

if (affected.length === 0) {
  console.log("Aucun fichier corrompu détecté. Rien à faire.");
  process.exit(0);
}

console.log(`\n${affected.length} fichier(s) avec un encodage suspect détecté :\n`);
for (const { file, safe } of affected) {
  console.log(`  ${safe ? "OK, corrigible" : "A VERIFIER manuellement"}  ${file}`);
}

const safeCount = affected.filter((a) => a.safe).length;
const unsafeCount = affected.length - safeCount;

console.log(`\n${safeCount} fichier(s) corrigibles automatiquement, ${unsafeCount} à vérifier à la main.`);

if (mode === "scan") {
  console.log("\nMode diagnostic uniquement — aucun fichier modifié.");
  console.log("Relance avec --apply pour corriger les fichiers marqués \"corrigible\".");
  process.exit(0);
}

// --- Mode application ---
const toFix = affected.filter((a) => a.safe);

if (toFix.length === 0) {
  console.log("\nAucun fichier ne peut être corrigé automatiquement en toute sécurité.");
  process.exit(0);
}

if (!skipConfirm) {
  console.log(`\n${toFix.length} fichier(s) vont être réécrits en UTF-8 correct. Relance avec --yes pour confirmer.`);
  process.exit(0);
}

for (const { file, fixed } of toFix) {
  fs.writeFileSync(file, fixed, "utf8");
  console.log(`Corrigé : ${file}`);
}

console.log(`\n${toFix.length} fichier(s) corrigé(s). Vérifie le rendu du site puis commite ces changements.`);
if (unsafeCount > 0) {
  console.log(`${unsafeCount} fichier(s) restent à vérifier à la main (motif ambigu, correction non appliquée) :`);
  for (const { file, safe } of affected) {
    if (!safe) console.log(`  - ${file}`);
  }
}
