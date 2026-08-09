// Version 3 : évite tout caractère accentué/tiret cadratin dans les motifs
// recherchés (la ligne ShareButtons contenant "Pas de planète B — ..."
// posait problème dans les deux tentatives précédentes, probablement un
// souci d'encodage). Cette version n'essaie plus de déplacer ShareButtons :
// elle enveloppe seulement les deux CountrySelect ensemble, juste après.
//
// Usage : node fix-pays-header-nav-v3.js

const fs = require("fs");
const path = "apps/web/pages/pays/[code].js";

let raw = fs.readFileSync(path, "utf8");
const hadCRLF = raw.includes("\r\n");
let content = raw.replace(/\r\n/g, "\n");
let changes = 0;

function apply(label, before, after) {
  if (content.includes(before)) {
    content = content.replace(before, after);
    changes++;
    console.log(`OK: ${label}`);
  } else {
    console.error(`ECHEC: ${label} - motif introuvable, etape ignoree.`);
  }
}

apply(
  "En-tete (selecteurs + barre d'ancres)",
  `        <CountrySelect
          countries={countries}
          value={code || ""}
          onChange={(newCode) => router.push(\`/pays/\${newCode}\`)}
          preferredLang={locale}
          label={t("pays.change_country")}
          raised
        />
      </div>
      {loading && <p>{t("common.loading")}</p>}`,
  `        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <CountrySelect
            countries={countries}
            value={code || ""}
            onChange={(newCode) => router.push(\`/pays/\${newCode}\`)}
            preferredLang={locale}
            label={t("pays.change_country")}
            raised
          />
          {summary && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <CountrySelect
                countries={countries.filter((c) => c.country_code !== code)}
                value={compareCode}
                onChange={setCompareCode}
                preferredLang={locale}
                label={t("pays.compare_with")}
                raised
              />
              {compareCode && (
                <button onClick={() => setCompareCode("")} style={{ fontSize: 13 }}>
                  {t("pays.remove_comparison")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {!loading && !error && summary && (
        <nav
          aria-label={t("pays.section_nav_label")}
          style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}
        >
          {[
            ["comparaison", t("pays.world_comparison_title")],
            ["co2", t("co2.title")],
            ["energie", t("energie.mix_title")],
            ["biodiversite", t("pays.biodiversity_title")],
            ["incendies", t("pays.fires_title")],
            ["vegetation", t("vegetation.title")],
            ["eau", t("eau.title")],
          ].map(([anchorId, anchorLabel]) => (
            <a
              key={anchorId}
              href={\`#\${anchorId}\`}
              style={{
                display: "inline-block",
                padding: "5px 12px",
                borderRadius: 20,
                border: "1px solid var(--color-bordure)",
                fontSize: 13,
                textDecoration: "none",
                color: "var(--color-texte)",
              }}
            >
              {anchorLabel}
            </a>
          ))}
        </nav>
      )}
      {loading && <p>{t("common.loading")}</p>}`
);

if (changes === 0) {
  console.error("\nAucune modification appliquée. Envoyez le contenu exact du fichier pour un diagnostic plus poussé.");
  process.exit(1);
}

if (hadCRLF) content = content.replace(/\n/g, "\r\n");

fs.writeFileSync(path, content, "utf8");
console.log(`\n${changes}/1 modification(s) appliquee(s).`);
console.log("Verifiez le diff avant de committer.");
