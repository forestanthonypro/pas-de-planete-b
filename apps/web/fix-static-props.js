#!/usr/bin/env node
/**
 * Ajoute un getStaticProps() vide (et getStaticPaths pour les routes
 * dynamiques [param].js) à toutes les pages qui n'en ont ni n'ont de
 * getServerSideProps — nécessaire depuis Next.js 16 + Turbopack pour les
 * pages entièrement rendues côté client (useT()/useRouter appelé sans
 * données de route fournies par le serveur pendant la pré-génération).
 *
 * Usage : node fix-static-props.js [--yes]
 * Sans --yes : liste les fichiers concernés sans les modifier.
 * Avec --yes : applique la correction.
 */

const fs = require("fs");
const path = require("path");

const skipConfirm = process.argv.includes("--yes");
const pagesDir = path.join(__dirname, "pages");

const IGNORE_FILES = new Set(["_app.js", "_document.js", "404.js", "500.js"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") continue; // routes API, pas des pages
      walk(full, files);
    } else if (entry.name.endsWith(".js") && !IGNORE_FILES.has(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(pagesDir);
const toFix = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const hasDataFetching =
    /export\s+(async\s+)?function\s+getStaticProps/.test(content) ||
    /export\s+(async\s+)?function\s+getServerSideProps/.test(content) ||
    /export\s+const\s+getStaticProps/.test(content) ||
    /export\s+const\s+getServerSideProps/.test(content);

  if (!hasDataFetching) {
    const isDynamic = /\[.+\]\.js$/.test(path.basename(file));
    toFix.push({ file, isDynamic });
  }
}

if (toFix.length === 0) {
  console.log("Aucune page à corriger.");
  process.exit(0);
}

console.log(`${toFix.length} page(s) sans getStaticProps/getServerSideProps :\n`);
for (const { file, isDynamic } of toFix) {
  console.log(`  ${isDynamic ? "[dynamique]" : "[statique] "} ${path.relative(__dirname, file)}`);
}

if (!skipConfirm) {
  console.log("\nMode diagnostic uniquement. Relance avec --yes pour appliquer la correction.");
  process.exit(0);
}

for (const { file, isDynamic } of toFix) {
  let addition = "\nexport async function getStaticProps() {\n  return { props: {} };\n}\n";
  if (isDynamic) {
    addition =
      '\nexport async function getStaticPaths() {\n  return { paths: [], fallback: "blocking" };\n}\n' +
      addition;
  }
  fs.appendFileSync(file, addition, "utf8");
  console.log(`Corrigé : ${path.relative(__dirname, file)}`);
}

console.log(`\n${toFix.length} page(s) corrigée(s).`);
