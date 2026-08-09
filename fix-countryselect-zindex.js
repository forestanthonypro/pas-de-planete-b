// Corrige le bug : le menu déroulant du sélecteur de pays passait derrière
// la carte des incendies. Cause : SearchableSelect utilise zIndex: 20 pour
// sa liste déroulante, alors que les tuiles Leaflet montent à 200-700+ —
// le menu se retrouvait donc visuellement sous la carte adjacente.
//
// Correctif local (pas dans SearchableSelect.js, composant partagé par tout
// le site — éviter d'y toucher pour ne pas risquer un effet de bord
// ailleurs) : on enveloppe le sélecteur dans un conteneur avec son propre
// contexte d'empilement (position: relative + z-index élevé), qui passe
// au-dessus de la carte sans changer le z-index de la carte elle-même.
//
// Usage : node fix-countryselect-zindex.js

const fs = require("fs");
const path = "apps/web/pages/pays/[code].js";

let content = fs.readFileSync(path, "utf8");

const before = `            <CountrySelect
              countries={countries.filter((c) => c.country_code !== code)}
              value={compareCode}
              onChange={setCompareCode}
              preferredLang={locale}
              label={t("pays.compare_with")}
            />`;

const after = `            <div style={{ position: "relative", zIndex: 1000 }}>
              <CountrySelect
                countries={countries.filter((c) => c.country_code !== code)}
                value={compareCode}
                onChange={setCompareCode}
                preferredLang={locale}
                label={t("pays.compare_with")}
              />
            </div>`;

if (!content.includes(before)) {
  console.error("Motif introuvable (le correctif preferredLang a-t-il bien été appliqué avant celui-ci ?). Aucune modification appliquée.");
  process.exit(1);
}

content = content.replace(before, after);
fs.writeFileSync(path, content, "utf8");
console.log("Corrigé : le sélecteur de pays a maintenant son propre contexte d'empilement (z-index: 1000).");
