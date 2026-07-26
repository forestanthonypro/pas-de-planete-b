// Traduit la classe taxonomique (GBIF) en un groupe compréhensible pour le public,
// avec repli sur le règne quand la classe n'apporte rien de plus précis.
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

export function speciesGroupLabel(kingdom, speciesClass) {
  if (speciesClass && CLASS_LABELS[speciesClass]) return CLASS_LABELS[speciesClass];
  return KINGDOM_LABELS[kingdom] || kingdom || "Groupe inconnu";
}
