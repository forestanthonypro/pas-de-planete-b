const query = `
SELECT ?p ?o WHERE {
  <http://dati.camera.it/ocd/votazione.rdf/vs19_705_001> ?p ?o.
}
`;

async function main() {
  const url = `https://dati.camera.it/sparql?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+xml" } });
  console.log(`Statut : ${res.status}`);
  const text = await res.text();
  console.log(text);
}

main().catch((err) => console.error("Erreur :", err));
