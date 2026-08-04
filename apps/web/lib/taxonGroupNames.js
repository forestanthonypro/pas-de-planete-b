// Traduit les noms de grands groupes taxonomiques tels que renvoyés par
// Our World in Data (colonne "Entity" du jeu de données OWID, toujours en
// anglais à la source) — utilisé pour le tableau "repère mondial" de la page
// espèces. Si un libellé n'est pas reconnu, on affiche la valeur brute plutôt
// que de planter : c'est un filet de sécurité, pas une liste exhaustive
// garantie à 100%.
//
// Vocabulaire source différent de lib/speciesGroups.js (qui traduit des noms
// taxonomiques latins issus de GBIF, ex: Mammalia, Aves) — ici ce sont des
// noms anglais courants issus d'OWID (Mammals, Birds), sans correspondance
// directe garantie avec la taxonomie GBIF (ex: "Selected animals" est un
// regroupement propre à OWID, sans équivalent en classe taxonomique).
const LABELS_FR = {
  Mammals: "Mammifères", Birds: "Oiseaux", Reptiles: "Reptiles", Amphibians: "Amphibiens",
  Fish: "Poissons", Molluscs: "Mollusques", Crustaceans: "Crustacés", Corals: "Coraux",
  Insects: "Insectes", Arachnids: "Arachnides", "Selected animals": "Animaux (sélection)",
  "Selected plants": "Plantes (sélection)", "Vascular plants": "Plantes vasculaires",
  "Other invertebrates": "Autres invertébrés", Fungi: "Champignons",
};
const LABELS_EN = {
  Mammals: "Mammals", Birds: "Birds", Reptiles: "Reptiles", Amphibians: "Amphibians",
  Fish: "Fish", Molluscs: "Molluscs", Crustaceans: "Crustaceans", Corals: "Corals",
  Insects: "Insects", Arachnids: "Arachnids", "Selected animals": "Selected animals",
  "Selected plants": "Selected plants", "Vascular plants": "Vascular plants",
  "Other invertebrates": "Other invertebrates", Fungi: "Fungi",
};
const LABELS_ES = {
  Mammals: "Mamíferos", Birds: "Aves", Reptiles: "Reptiles", Amphibians: "Anfibios",
  Fish: "Peces", Molluscs: "Moluscos", Crustaceans: "Crustáceos", Corals: "Corales",
  Insects: "Insectos", Arachnids: "Arácnidos", "Selected animals": "Animales (selección)",
  "Selected plants": "Plantas (selección)", "Vascular plants": "Plantas vasculares",
  "Other invertebrates": "Otros invertebrados", Fungi: "Hongos",
};
const LABELS_IT = {
  Mammals: "Mammiferi", Birds: "Uccelli", Reptiles: "Rettili", Amphibians: "Anfibi",
  Fish: "Pesci", Molluscs: "Molluschi", Crustaceans: "Crostacei", Corals: "Coralli",
  Insects: "Insetti", Arachnids: "Aracnidi", "Selected animals": "Animali (selezione)",
  "Selected plants": "Piante (selezione)", "Vascular plants": "Piante vascolari",
  "Other invertebrates": "Altri invertebrati", Fungi: "Funghi",
};
const LABELS_RU = {
  Mammals: "Млекопитающие", Birds: "Птицы", Reptiles: "Пресмыкающиеся", Amphibians: "Земноводные",
  Fish: "Рыбы", Molluscs: "Моллюски", Crustaceans: "Ракообразные", Corals: "Кораллы",
  Insects: "Насекомые", Arachnids: "Паукообразные", "Selected animals": "Животные (выборка)",
  "Selected plants": "Растения (выборка)", "Vascular plants": "Сосудистые растения",
  "Other invertebrates": "Прочие беспозвоночные", Fungi: "Грибы",
};
const LABELS_JA = {
  Mammals: "哺乳類", Birds: "鳥類", Reptiles: "爬虫類", Amphibians: "両生類",
  Fish: "魚類", Molluscs: "軟体動物", Crustaceans: "甲殻類", Corals: "サンゴ",
  Insects: "昆虫", Arachnids: "クモ形類", "Selected animals": "動物（一部）",
  "Selected plants": "植物（一部）", "Vascular plants": "維管束植物",
  "Other invertebrates": "その他の無脊椎動物", Fungi: "菌類",
};
const LABELS_ZH = {
  Mammals: "哺乳动物", Birds: "鸟类", Reptiles: "爬行动物", Amphibians: "两栖动物",
  Fish: "鱼类", Molluscs: "软体动物", Crustaceans: "甲壳类", Corals: "珊瑚",
  Insects: "昆虫", Arachnids: "蛛形纲", "Selected animals": "动物（精选）",
  "Selected plants": "植物（精选）", "Vascular plants": "维管植物",
  "Other invertebrates": "其他无脊椎动物", Fungi: "真菌",
};
const LABELS_HI = {
  Mammals: "स्तनधारी", Birds: "पक्षी", Reptiles: "सरीसृप", Amphibians: "उभयचर",
  Fish: "मछली", Molluscs: "मोलस्क", Crustaceans: "क्रस्टेशियन", Corals: "प्रवाल",
  Insects: "कीट", Arachnids: "मकड़ी वर्ग", "Selected animals": "जंतु (चयनित)",
  "Selected plants": "पादप (चयनित)", "Vascular plants": "संवहनी पौधे",
  "Other invertebrates": "अन्य अकशेरुकी", Fungi: "कवक",
};

const LABEL_TABLES = { fr: LABELS_FR, en: LABELS_EN, es: LABELS_ES, it: LABELS_IT, ru: LABELS_RU, ja: LABELS_JA, zh: LABELS_ZH, hi: LABELS_HI };

export function translateTaxonGroup(value, locale = "fr") {
  const table = LABEL_TABLES[locale] || LABELS_FR;
  return table[value] || value;
}
