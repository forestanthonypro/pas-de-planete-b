// Deuxième occurrence du même bug que fix-countryselect-locale-prop.js :
// le sélecteur "Change country" en haut de la page (pas celui de
// comparaison, déjà corrigé) avait aussi locale={locale} au lieu de
// preferredLang={locale}.
//
// Usage : node fix-countryselect-locale-prop-2.js

const fs = require("fs");
const path = "apps/web/pages/pays/[code].js";

let content = fs.readFileSync(path, "utf8");

const before = `          onChange={(newCode) => router.push(\`/pays/\${newCode}\`)}
          locale={locale}
          label={t("pays.change_country")}`;

const after = `          onChange={(newCode) => router.push(\`/pays/\${newCode}\`)}
          preferredLang={locale}
          label={t("pays.change_country")}`;

if (!content.includes(before)) {
  console.error("Motif introuvable — le fichier a peut-être changé depuis. Aucune modification appliquée.");
  process.exit(1);
}

content = content.replace(before, after);
fs.writeFileSync(path, content, "utf8");
console.log("Corrigé : preferredLang remplace locale sur le CountrySelect 'Change country'.");
