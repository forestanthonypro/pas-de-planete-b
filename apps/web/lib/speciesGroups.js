// Traduit la classe (ou, à défaut, l'ordre) taxonomique GBIF en un groupe
// compréhensible pour le public. GBIF ne renseigne pas toujours la classe pour
// chaque fiche — l'ordre sert de filet de sécurité, il est presque toujours présent.
const KINGDOM_LABELS_FR = {
  Animalia: "Animal",
  Plantae: "Végétal",
  Fungi: "Champignon",
  Chromista: "Chromiste",
  Protozoa: "Protiste",
};
const KINGDOM_LABELS_EN = {
  Animalia: "Animal",
  Plantae: "Plant",
  Fungi: "Fungus",
  Chromista: "Chromist",
  Protozoa: "Protist",
};

const CLASS_LABELS_FR = {
  Aves: "Oiseau",
  Mammalia: "Mammifère",
  Reptilia: "Reptile",
  Amphibia: "Amphibien",
  Actinopterygii: "Poisson",
  Actinopteri: "Poisson",
  Teleostei: "Poisson",
  Chondrichthyes: "Poisson (cartilagineux)",
  Insecta: "Insecte",
  Arachnida: "Arachnide",
  Gastropoda: "Escargot / mollusque",
  Bivalvia: "Mollusque (bivalve)",
  Malacostraca: "Crustacé",
  Magnoliopsida: "Plante à fleurs",
  Liliopsida: "Plante à fleurs",
  Pinopsida: "Conifère",
  Polypodiopsida: "Fougère",
  Agaricomycetes: "Champignon",
};
const CLASS_LABELS_EN = {
  Aves: "Bird",
  Mammalia: "Mammal",
  Reptilia: "Reptile",
  Amphibia: "Amphibian",
  Actinopterygii: "Fish",
  Actinopteri: "Fish",
  Teleostei: "Fish",
  Chondrichthyes: "Fish (cartilaginous)",
  Insecta: "Insect",
  Arachnida: "Arachnid",
  Gastropoda: "Snail / mollusc",
  Bivalvia: "Mollusc (bivalve)",
  Malacostraca: "Crustacean",
  Magnoliopsida: "Flowering plant",
  Liliopsida: "Flowering plant",
  Pinopsida: "Conifer",
  Polypodiopsida: "Fern",
  Agaricomycetes: "Fungus",
};

// Ordres de poissons les plus courants, pour rattraper les cas où la classe
// (Actinopterygii/Actinopteri) n'est pas renseignée par GBIF pour une fiche donnée.
const ORDER_LABELS_FR = {
  Clupeiformes: "Poisson",
  Anguilliformes: "Poisson",
  Cypriniformes: "Poisson",
  Salmoniformes: "Poisson",
  Perciformes: "Poisson",
  Gadiformes: "Poisson",
  Siluriformes: "Poisson",
  Cyprinodontiformes: "Poisson",
  Pleuronectiformes: "Poisson",
};
const ORDER_LABELS_EN = {
  Clupeiformes: "Fish",
  Anguilliformes: "Fish",
  Cypriniformes: "Fish",
  Salmoniformes: "Fish",
  Perciformes: "Fish",
  Gadiformes: "Fish",
  Siluriformes: "Fish",
  Cyprinodontiformes: "Fish",
  Pleuronectiformes: "Fish",
};

// "locale" doit venir de router.locale (via useT()) — comme translateFuel,
// jamais de la détection navigateur legacy.
export function speciesGroupLabel(kingdom, speciesClass, taxonOrder, locale = "fr") {
  const CLASS_LABELS = locale === "en" ? CLASS_LABELS_EN : CLASS_LABELS_FR;
  const ORDER_LABELS = locale === "en" ? ORDER_LABELS_EN : ORDER_LABELS_FR;
  const KINGDOM_LABELS = locale === "en" ? KINGDOM_LABELS_EN : KINGDOM_LABELS_FR;
  const unknownLabel = locale === "en" ? "Unknown group" : "Groupe inconnu";

  if (speciesClass && CLASS_LABELS[speciesClass]) return CLASS_LABELS[speciesClass];
  if (taxonOrder && ORDER_LABELS[taxonOrder]) return ORDER_LABELS[taxonOrder];
  return KINGDOM_LABELS[kingdom] || kingdom || unknownLabel;
}
