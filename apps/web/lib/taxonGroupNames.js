// Traduit les noms de grands groupes taxonomiques du référentiel mondial IUCN
// (Entity du CSV source, en anglais) dans la langue détectée du navigateur —
// même principe que countryNames.js pour les pays. Repli sur le nom anglais
// d'origine si un groupe imprévu apparaît dans une future mise à jour de la
// source (plutôt que de planter ou d'afficher un champ vide).
const TRANSLATIONS = {
  "All vertebrates": { fr: "Tous les vertébrés", en: "All vertebrates", es: "Todos los vertebrados", de: "Alle Wirbeltiere" },
  "All invertebrates": { fr: "Tous les invertébrés", en: "All invertebrates", es: "Todos los invertebrados", de: "Alle Wirbellosen" },
  "All plants": { fr: "Toutes les plantes", en: "All plants", es: "Todas las plantas", de: "Alle Pflanzen" },
  "All fungi": { fr: "Tous les champignons", en: "All fungi", es: "Todos los hongos", de: "Alle Pilze" },
  "Mammals": { fr: "Mammifères", en: "Mammals", es: "Mamíferos", de: "Säugetiere" },
  "Birds": { fr: "Oiseaux", en: "Birds", es: "Aves", de: "Vögel" },
  "Reptiles": { fr: "Reptiles", en: "Reptiles", es: "Reptiles", de: "Reptilien" },
  "Amphibians": { fr: "Amphibiens", en: "Amphibians", es: "Anfibios", de: "Amphibien" },
  "Fishes": { fr: "Poissons", en: "Fishes", es: "Peces", de: "Fische" },
  "Bony fishes": { fr: "Poissons osseux", en: "Bony fishes", es: "Peces óseos", de: "Knochenfische" },
  "Sharks and rays": { fr: "Requins et raies", en: "Sharks and rays", es: "Tiburones y rayas", de: "Haie und Rochen" },
  "Insects": { fr: "Insectes", en: "Insects", es: "Insectos", de: "Insekten" },
  "Molluscs": { fr: "Mollusques", en: "Molluscs", es: "Moluscos", de: "Weichtiere" },
  "Crustaceans": { fr: "Crustacés", en: "Crustaceans", es: "Crustáceos", de: "Krebstiere" },
  "Arachnids": { fr: "Arachnides", en: "Arachnids", es: "Arácnidos", de: "Spinnentiere" },
  "Corals": { fr: "Coraux", en: "Corals", es: "Corales", de: "Korallen" },
  "Horsehoe crabs": { fr: "Limules", en: "Horseshoe crabs", es: "Cangrejos herradura", de: "Pfeilschwanzkrebse" },
  "Horseshoe crabs": { fr: "Limules", en: "Horseshoe crabs", es: "Cangrejos herradura", de: "Pfeilschwanzkrebse" },
  "Velvet worms": { fr: "Onychophores", en: "Velvet worms", es: "Onicóforos", de: "Stummelfüßer" },
  "Gymnosperms": { fr: "Gymnospermes", en: "Gymnosperms", es: "Gimnospermas", de: "Nacktsamer" },
  "Conifers": { fr: "Conifères", en: "Conifers", es: "Coníferas", de: "Nadelbäume" },
  "Cycads": { fr: "Cycas", en: "Cycads", es: "Cícadas", de: "Palmfarne" },
  "Ferns and allies": { fr: "Fougères et alliées", en: "Ferns and allies", es: "Helechos y afines", de: "Farne und Verwandte" },
  "Flowering plants": { fr: "Plantes à fleurs", en: "Flowering plants", es: "Plantas con flores", de: "Blütenpflanzen" },
  "Mangroves": { fr: "Mangroves", en: "Mangroves", es: "Manglares", de: "Mangroven" },
  "Seagrasses": { fr: "Herbiers marins", en: "Seagrasses", es: "Praderas marinas", de: "Seegräser" },
  "Mosses": { fr: "Mousses", en: "Mosses", es: "Musgos", de: "Moose" },
  "Lichens": { fr: "Lichens", en: "Lichens", es: "Líquenes", de: "Flechten" },
};

export function translateTaxonGroup(group, lang) {
  if (!group) return "";
  const entry = TRANSLATIONS[group];
  if (!entry) return group; // groupe imprévu : on affiche le nom d'origine plutôt que rien
  return entry[lang] || entry.fr || group;
}
