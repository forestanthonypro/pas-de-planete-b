// Ajoute "theme" aux dependances des 3 useEffect qui dessinent des
// couleurs sensibles au theme.
//
// Usage : node fix-charts-theme-live-update.js

const fs = require("fs");
const path = "apps/web/pages/pays/[code].js";

let content = fs.readFileSync(path, "utf8");
let count = 0;

const fixes = [
  {
    label: "graphique energie principal",
    before: "  }, [summary, locale, t]);",
    after: "  }, [summary, locale, t, theme]);",
  },
  {
    label: "graphique energie comparaison",
    before: "  }, [compareCode, compareSummary, locale, t]);",
    after: "  }, [compareCode, compareSummary, locale, t, theme]);",
  },
  {
    label: "graphique comparaison mondiale (Moyenne mondiale)",
    before: "  }, [summary, worldBenchmarks, code, locale, compareCode, compareSummary, t]);",
    after: "  }, [summary, worldBenchmarks, code, locale, compareCode, compareSummary, t, theme]);",
  },
];

for (const { label, before, after } of fixes) {
  const occurrences = content.split(before).length - 1;
  if (occurrences !== 1) {
    console.error(`ECHEC : "${label}" - motif trouve ${occurrences} fois (attendu 1) - ignore par securite.`);
    continue;
  }
  content = content.replace(before, after);
  count++;
  console.log(`OK : ${label}`);
}

fs.writeFileSync(path, content, "utf8");
console.log(`\n${count}/3 correction(s) appliquee(s).`);
