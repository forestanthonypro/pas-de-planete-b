#!/usr/bin/env node
/**
 * Convertit les getStaticProps()/getStaticPaths() ajoutés précédemment (par
 * fix-static-props.js) en getServerSideProps() — élimine les échecs
 * intermittents de pré-génération statique Turbopack ("NextRouter was not
 * mounted") observés sur des pages qui n'ont de toute façon aucun contenu
 * réellement statique (tout vient de fetch() côté client). Le rendu à la
 * demande (SSR) contourne entièrement ce problème de build, et correspond
 * mieux à la nature dynamique du contenu (piloté par l'admin).
 *
 * Usage : node fix-serverside-props.js [--yes]
 */

const fs = require("fs");
const path = require("path");

const skipConfirm = process.argv.includes("--yes");
const pagesDir = path.join(__dirname, "pages");

const STATIC_PATHS_BLOCK =
  '\nexport async function getStaticPaths() {\n  return { paths: [], fallback: "blocking" };\n}\n';
const STATIC_PROPS_BLOCK = '\nexport async function getStaticProps() {\n  return { props: {} };\n}\n';
const SERVER_SIDE_PROPS_BLOCK =
  '\nexport async function getServerSideProps() {\n  return { props: {} };\n}\n';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      walk(full, files);
    } else if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(pagesDir);
const toFix = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes(STATIC_PROPS_BLOCK) || content.includes(STATIC_PATHS_BLOCK)) {
    toFix.push(file);
  }
}

if (toFix.length === 0) {
  console.log("Aucune page à convertir (aucun getStaticProps/getStaticPaths ajouté précédemment détecté).");
  process.exit(0);
}

console.log(`${toFix.length} page(s) à convertir en getServerSideProps :\n`);
for (const file of toFix) {
  console.log(`  ${path.relative(__dirname, file)}`);
}

if (!skipConfirm) {
  console.log("\nMode diagnostic uniquement. Relance avec --yes pour appliquer la conversion.");
  process.exit(0);
}

for (const file of toFix) {
  let content = fs.readFileSync(file, "utf8");
  content = content.split(STATIC_PATHS_BLOCK).join("");
  content = content.split(STATIC_PROPS_BLOCK).join(SERVER_SIDE_PROPS_BLOCK);
  fs.writeFileSync(file, content, "utf8");
  console.log(`Converti : ${path.relative(__dirname, file)}`);
}

console.log(`\n${toFix.length} page(s) converties.`);
