// Corrige le bug mobile : le tableau "Biodiversité (échantillon)" n'était
// pas enveloppé dans <ScrollableTable> — sur mobile, sa largeur minimale
// forçait tout le navigateur à zoomer la page entière en arrière pour le
// faire tenir, rendant tout le reste minuscule.
//
// Usage : node fix-biodiversity-mobile-overflow.js

const fs = require("fs");
const path = "apps/web/pages/pays/[code].js";

let content = fs.readFileSync(path, "utf8");

const titleAnchor = 't("pays.biodiversity_title")';
const titleIdx = content.indexOf(titleAnchor);
if (titleIdx === -1) {
  console.error("ECHEC : titre biodiversité introuvable.");
  process.exit(1);
}

const tableStartIdx = content.indexOf("<table", titleIdx);
if (tableStartIdx === -1) {
  console.error("ECHEC : début du tableau introuvable.");
  process.exit(1);
}

const tableCloseIdx = content.indexOf("</table>", tableStartIdx);
if (tableCloseIdx === -1) {
  console.error("ECHEC : fin du tableau introuvable.");
  process.exit(1);
}
const afterTableCloseIdx = tableCloseIdx + "</table>".length;

const before30 = content.slice(Math.max(0, tableStartIdx - 30), tableStartIdx);
if (before30.includes("ScrollableTable")) {
  console.log("Déjà enveloppé dans ScrollableTable — rien à faire.");
  process.exit(0);
}

const newContent =
  content.slice(0, tableStartIdx) +
  "<ScrollableTable>\n              " +
  content.slice(tableStartIdx, afterTableCloseIdx) +
  "\n              </ScrollableTable>" +
  content.slice(afterTableCloseIdx);

fs.writeFileSync(path, newContent, "utf8");
console.log("Tableau biodiversité enveloppé dans ScrollableTable avec succès.");
