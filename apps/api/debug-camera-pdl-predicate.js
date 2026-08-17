// Diagnostic : cherche les predicats SPARQL contenant "pdl", "progetto"
// ou "atto" pour trouver comment un vote est relie a un projet de loi
// (DDL - Disegno Di Legge), pas juste aux resolutions/motions (rif_aic).
//
// Usage : node debug-camera-pdl-predicate.js

const query = `
SELECT DISTINCT ?p WHERE {
  ?s ?p ?o.
  FILTER(CONTAINS(STR(?p), "pdl") || CONTAINS(STR(?p), "progetto") || CONTAINS(STR(?p), "atto"))
}
LIMIT 20
`;

async function main() {
  const url = `https://dati.camera.it/sparql?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+xml" } });
  console.log(`Statut : ${res.status}`);
  const text = await res.text();
  console.log(text);
}

main().catch((err) => console.error("Erreur :", err));
