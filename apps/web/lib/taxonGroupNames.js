// Traduit les noms de grands groupes taxonomiques tels que renvoyés par
// Our World in Data (colonne "Entity" du jeu de données OWID, toujours en
// anglais à la source) — utilisé pour le tableau "repère mondial" de la page
// espèces. Si un libellé n'est pas reconnu, on affiche la valeur brute plutôt
// que de planter : c'est un filet de sécurité, pas une liste exhaustive
// garantie à 100%.
const LABELS_FR = {
  Mammals: "Mammifères",
  Birds: "Oiseaux",
  Reptiles: "Reptiles",
  Amphibians: "Amphibiens",
  Fish: "Poissons",
  Molluscs: "Mollusques",
  Crustaceans: "Crustacés",
  Corals: "Coraux",
  Insects: "Insectes",
  Arachnids: "Arachnides",
  "Selected animals": "Animaux (sélection)",
  "Selected plants": "Plantes (sélection)",
  "Vascular plants": "Plantes vasculaires",
  "Other invertebrates": "Autres invertébrés",
  Fungi: "Champignons",
};

export function translateTaxonGroup(value, locale = "fr") {
  if (locale === "en") return value;
  return LABELS_FR[value] || value;
}
