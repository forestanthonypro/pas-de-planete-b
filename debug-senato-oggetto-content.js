// Diagnostic : examine le contenu principal (pas juste le head) de la
// page oggettotrattazione, pour voir si elle affiche des infos utiles
// sur le texte de loi malgre le <title> vide.
//
// Usage : node debug-senato-oggetto-content.js

async function main() {
  const res = await fetch("https://dati.senato.it/oggettotrattazione/1474636", {
    headers: { Accept: "text/html" },
  });
  const text = await res.text();

  // Cherche la zone de contenu principal (souvent apres <body> ou dans
  // une balise h1/h2/header specifique a LodView).
  const bodyStart = text.indexOf("<body");
  console.log("--- 3000 caracteres apres <body> ---");
  console.log(text.slice(bodyStart, bodyStart + 3000));
}

main().catch((err) => console.error("Erreur :", err));
