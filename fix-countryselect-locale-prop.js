// Corrige le bug : les noms de pays du sélecteur de comparaison restaient
// toujours en français quelle que soit la langue du site. Cause : la prop
// passée au composant s'appelait "locale", mais CountrySelect attend
// "preferredLang" — le nom ne correspondant pas, preferredLang restait
// undefined et localizedCountryName() retombait sur le repli français.
//
// Usage : node fix-countryselect-locale-prop.js

const fs = require("fs");
const path = "apps/web/pages/pays/[code].js";

let content = fs.readFileSync(path, "utf8");

const before = `              onChange={setCompareCode}
              locale={locale}
              label={t("pays.compare_with")}`;

const after = `              onChange={setCompareCode}
              preferredLang={locale}
              label={t("pays.compare_with")}`;

if (!content.includes(before)) {
  console.error("Motif introuvable — le fichier a peut-être changé depuis. Aucune modification appliquée.");
  process.exit(1);
}

content = content.replace(before, after);
fs.writeFileSync(path, content, "utf8");
console.log("Corrigé : preferredLang remplace locale sur le CountrySelect de comparaison.");
