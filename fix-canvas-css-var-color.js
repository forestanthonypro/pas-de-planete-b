// Corrige le vrai bug : ctx.strokeStyle/fillStyle assignés directement
// avec la chaîne "var(--color-texte-clair)" — Canvas 2D ne comprend pas
// les variables CSS, cette assignation invalide est silencieusement
// ignorée et retombe sur le noir par défaut du Canvas (jamais visible en
// mode clair par coïncidence de contraste, mais invisible en mode sombre).
// Il faut résoudre la variable en couleur réelle via getComputedStyle
// avant de l'assigner.
//
// Usage : node fix-canvas-css-var-color.js

const fs = require("fs");
const path = "apps/web/pages/pays/[code].js";

let content = fs.readFileSync(path, "utf8");
let count = 0;

const before = `        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = "var(--color-texte-clair)";
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "var(--color-texte-clair)";`;

const after = `        const ctx = chart.ctx;
        // Canvas 2D ne comprend pas les variables CSS (var(--xxx)) — il
        // faut résoudre la valeur réelle actuelle avant de l'assigner,
        // sinon l'assignation est silencieusement ignorée et retombe sur
        // le noir par défaut du Canvas (invisible en mode sombre).
        const referenceLineColor = getComputedStyle(document.documentElement).getPropertyValue("--color-texte-clair").trim() || "#647076";
        ctx.save();
        ctx.strokeStyle = referenceLineColor;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = referenceLineColor;`;

if (!content.includes(before)) {
  console.error("ECHEC : bloc introuvable — le fichier a peut-être changé depuis.");
  process.exit(1);
}

content = content.replace(before, after);
count++;

fs.writeFileSync(path, content, "utf8");
console.log(`${count} correction appliquée avec succès.`);
