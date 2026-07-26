// Traduit la classe (ou, à défaut, l'ordre) taxonomique GBIF en un groupe
// compréhensible pour le public. GBIF ne renseigne pas toujours la classe pour
// chaque fiche — l'ordre sert de filet de sécurité, il est presque toujours présent.
const KINGDOM_LABELS = {
  Animalia: "Animal",
  Plantae: "Végétal",
  Fungi: "Champignon",
  Chromista: "Chromiste",
  Protozoa: "Protiste",
};

const CLASS_LABELS = {
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

// Ordres de poissons les plus courants, pour rattraper les cas où la classe
// (Actinopterygii/Actinopteri) n'est pas renseignée par GBIF pour une fiche donnée.
const ORDER_LABELS = {
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

export function speciesGroupLabel(kingdom, speciesClass, taxonOrder) {
  if (speciesClass && CLASS_LABELS[speciesClass]) return CLASS_LABELS[speciesClass];
  if (taxonOrder && ORDER_LABELS[taxonOrder]) return ORDER_LABELS[taxonOrder];
  return KINGDOM_LABELS[kingdom] || kingdom || "Groupe inconnu";
}
