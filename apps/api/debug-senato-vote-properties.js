// Diagnostic : liste TOUTES les proprietes disponibles pour un vote
// connu du Senat italien, pour trouver comment il est relie a l'objet
// traite (texte de loi/motion/etc).
//
// Usage : node debug-senato-vote-properties.js

const query = `
SELECT ?p ?o WHERE {
  <http://dati.senato.it/votazione/19-445-1> ?p ?o.
}
`;

async function main() {
  const url = `https://dati.senato.it/sparql?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+xml" } });
  console.log(`Statut : ${res.status}`);
  const text = await res.text();
  console.log(text);
}

main().catch((err) => console.error("Erreur :", err));
