// Traduit la classe (ou, à défaut, l'ordre) taxonomique GBIF en un groupe
// compréhensible pour le public. GBIF ne renseigne pas toujours la classe pour
// chaque fiche — l'ordre sert de filet de sécurité, il est presque toujours présent.
const KINGDOM_LABELS_FR = { Animalia: "Animal", Plantae: "Végétal", Fungi: "Champignon", Chromista: "Chromiste", Protozoa: "Protiste" };
const KINGDOM_LABELS_EN = { Animalia: "Animal", Plantae: "Plant", Fungi: "Fungus", Chromista: "Chromist", Protozoa: "Protist" };
const KINGDOM_LABELS_ES = { Animalia: "Animal", Plantae: "Vegetal", Fungi: "Hongo", Chromista: "Cromista", Protozoa: "Protista" };
const KINGDOM_LABELS_IT = { Animalia: "Animale", Plantae: "Vegetale", Fungi: "Fungo", Chromista: "Cromista", Protozoa: "Protista" };
const KINGDOM_LABELS_RU = { Animalia: "Животное", Plantae: "Растение", Fungi: "Гриб", Chromista: "Хромист", Protozoa: "Простейшее" };
const KINGDOM_LABELS_JA = { Animalia: "動物", Plantae: "植物", Fungi: "菌類", Chromista: "クロミスタ", Protozoa: "原生生物" };
const KINGDOM_LABELS_ZH = { Animalia: "动物", Plantae: "植物", Fungi: "真菌", Chromista: "藻物界", Protozoa: "原生生物" };
const KINGDOM_LABELS_HI = { Animalia: "जंतु", Plantae: "पादप", Fungi: "कवक", Chromista: "क्रोमिस्टा", Protozoa: "प्रोटिस्ट" };

const CLASS_LABELS_FR = {
  Aves: "Oiseau", Mammalia: "Mammifère", Reptilia: "Reptile", Amphibia: "Amphibien",
  Actinopterygii: "Poisson", Actinopteri: "Poisson", Teleostei: "Poisson", Chondrichthyes: "Poisson (cartilagineux)",
  Insecta: "Insecte", Arachnida: "Arachnide", Gastropoda: "Escargot / mollusque", Bivalvia: "Mollusque (bivalve)",
  Malacostraca: "Crustacé", Magnoliopsida: "Plante à fleurs", Liliopsida: "Plante à fleurs",
  Pinopsida: "Conifère", Polypodiopsida: "Fougère", Agaricomycetes: "Champignon",
};
const CLASS_LABELS_EN = {
  Aves: "Bird", Mammalia: "Mammal", Reptilia: "Reptile", Amphibia: "Amphibian",
  Actinopterygii: "Fish", Actinopteri: "Fish", Teleostei: "Fish", Chondrichthyes: "Fish (cartilaginous)",
  Insecta: "Insect", Arachnida: "Arachnid", Gastropoda: "Snail / mollusc", Bivalvia: "Mollusc (bivalve)",
  Malacostraca: "Crustacean", Magnoliopsida: "Flowering plant", Liliopsida: "Flowering plant",
  Pinopsida: "Conifer", Polypodiopsida: "Fern", Agaricomycetes: "Fungus",
};
const CLASS_LABELS_ES = {
  Aves: "Ave", Mammalia: "Mamífero", Reptilia: "Reptil", Amphibia: "Anfibio",
  Actinopterygii: "Pez", Actinopteri: "Pez", Teleostei: "Pez", Chondrichthyes: "Pez (cartilaginoso)",
  Insecta: "Insecto", Arachnida: "Arácnido", Gastropoda: "Caracol / molusco", Bivalvia: "Molusco (bivalvo)",
  Malacostraca: "Crustáceo", Magnoliopsida: "Planta con flores", Liliopsida: "Planta con flores",
  Pinopsida: "Conífera", Polypodiopsida: "Helecho", Agaricomycetes: "Hongo",
};
const CLASS_LABELS_IT = {
  Aves: "Uccello", Mammalia: "Mammifero", Reptilia: "Rettile", Amphibia: "Anfibio",
  Actinopterygii: "Pesce", Actinopteri: "Pesce", Teleostei: "Pesce", Chondrichthyes: "Pesce (cartilagineo)",
  Insecta: "Insetto", Arachnida: "Aracnide", Gastropoda: "Chiocciola / mollusco", Bivalvia: "Mollusco (bivalve)",
  Malacostraca: "Crostaceo", Magnoliopsida: "Pianta con fiori", Liliopsida: "Pianta con fiori",
  Pinopsida: "Conifera", Polypodiopsida: "Felce", Agaricomycetes: "Fungo",
};
const CLASS_LABELS_RU = {
  Aves: "Птица", Mammalia: "Млекопитающее", Reptilia: "Пресмыкающееся", Amphibia: "Земноводное",
  Actinopterygii: "Рыба", Actinopteri: "Рыба", Teleostei: "Рыба", Chondrichthyes: "Рыба (хрящевая)",
  Insecta: "Насекомое", Arachnida: "Паукообразное", Gastropoda: "Улитка / моллюск", Bivalvia: "Моллюск (двустворчатый)",
  Malacostraca: "Ракообразное", Magnoliopsida: "Цветковое растение", Liliopsida: "Цветковое растение",
  Pinopsida: "Хвойное", Polypodiopsida: "Папоротник", Agaricomycetes: "Гриб",
};
const CLASS_LABELS_JA = {
  Aves: "鳥類", Mammalia: "哺乳類", Reptilia: "爬虫類", Amphibia: "両生類",
  Actinopterygii: "魚類", Actinopteri: "魚類", Teleostei: "魚類", Chondrichthyes: "魚類（軟骨魚）",
  Insecta: "昆虫", Arachnida: "クモ形類", Gastropoda: "巻貝・軟体動物", Bivalvia: "軟体動物（二枚貝）",
  Malacostraca: "甲殻類", Magnoliopsida: "被子植物", Liliopsida: "被子植物",
  Pinopsida: "針葉樹", Polypodiopsida: "シダ", Agaricomycetes: "菌類",
};
const CLASS_LABELS_ZH = {
  Aves: "鸟类", Mammalia: "哺乳动物", Reptilia: "爬行动物", Amphibia: "两栖动物",
  Actinopterygii: "鱼类", Actinopteri: "鱼类", Teleostei: "鱼类", Chondrichthyes: "鱼类（软骨鱼）",
  Insecta: "昆虫", Arachnida: "蛛形纲", Gastropoda: "蜗牛/软体动物", Bivalvia: "软体动物（双壳类）",
  Malacostraca: "甲壳类", Magnoliopsida: "被子植物", Liliopsida: "被子植物",
  Pinopsida: "针叶树", Polypodiopsida: "蕨类", Agaricomycetes: "真菌",
};
const CLASS_LABELS_HI = {
  Aves: "पक्षी", Mammalia: "स्तनधारी", Reptilia: "सरीसृप", Amphibia: "उभयचर",
  Actinopterygii: "मछली", Actinopteri: "मछली", Teleostei: "मछली", Chondrichthyes: "मछली (उपास्थि)",
  Insecta: "कीट", Arachnida: "मकड़ी वर्ग", Gastropoda: "घोंघा / मोलस्क", Bivalvia: "मोलस्क (द्विकपाटी)",
  Malacostraca: "क्रस्टेशियन", Magnoliopsida: "पुष्पीय पौधा", Liliopsida: "पुष्पीय पौधा",
  Pinopsida: "शंकुधारी", Polypodiopsida: "फर्न", Agaricomycetes: "कवक",
};

// Ordres de poissons les plus courants, pour rattraper les cas où la classe
// (Actinopterygii/Actinopteri) n'est pas renseignée par GBIF pour une fiche donnée.
const FISH_ORDERS = ["Clupeiformes", "Anguilliformes", "Cypriniformes", "Salmoniformes", "Perciformes", "Gadiformes", "Siluriformes", "Cyprinodontiformes", "Pleuronectiformes"];
const FISH_LABEL_BY_LOCALE = { fr: "Poisson", en: "Fish", es: "Pez", it: "Pesce", ru: "Рыба", ja: "魚類", zh: "鱼类", hi: "मछली" };

const KINGDOM_TABLES = { fr: KINGDOM_LABELS_FR, en: KINGDOM_LABELS_EN, es: KINGDOM_LABELS_ES, it: KINGDOM_LABELS_IT, ru: KINGDOM_LABELS_RU, ja: KINGDOM_LABELS_JA, zh: KINGDOM_LABELS_ZH, hi: KINGDOM_LABELS_HI };
const CLASS_TABLES = { fr: CLASS_LABELS_FR, en: CLASS_LABELS_EN, es: CLASS_LABELS_ES, it: CLASS_LABELS_IT, ru: CLASS_LABELS_RU, ja: CLASS_LABELS_JA, zh: CLASS_LABELS_ZH, hi: CLASS_LABELS_HI };

const UNKNOWN_LABELS = {
  fr: "Groupe inconnu", en: "Unknown group", es: "Grupo desconocido", it: "Gruppo sconosciuto",
  ru: "Неизвестная группа", ja: "不明なグループ", zh: "未知类群", hi: "अज्ञात समूह",
};

// "locale" doit venir de router.locale (via useT()) — comme translateFuel,
// jamais de la détection navigateur legacy.
export function speciesGroupLabel(kingdom, speciesClass, taxonOrder, locale = "fr") {
  const CLASS_LABELS = CLASS_TABLES[locale] || CLASS_LABELS_FR;
  const KINGDOM_LABELS = KINGDOM_TABLES[locale] || KINGDOM_LABELS_FR;
  const unknownLabel = UNKNOWN_LABELS[locale] || UNKNOWN_LABELS.fr;

  if (speciesClass && CLASS_LABELS[speciesClass]) return CLASS_LABELS[speciesClass];
  if (taxonOrder && FISH_ORDERS.includes(taxonOrder)) return FISH_LABEL_BY_LOCALE[locale] || FISH_LABEL_BY_LOCALE.fr;
  return KINGDOM_LABELS[kingdom] || kingdom || unknownLabel;
}
