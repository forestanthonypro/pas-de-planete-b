// Traductions et couleurs partagées pour les types de combustible,
// utilisées à la fois par la carte énergie et le dashboard pays.
export const FUEL_LABELS_FR = {
  Nuclear: "Nucléaire",
  Hydro: "Hydraulique",
  Wind: "Éolien",
  Gas: "Gaz",
  Solar: "Solaire",
  Oil: "Pétrole",
  Coal: "Charbon",
  Biomass: "Biomasse",
  "Wave and Tidal": "Houlomotrice et marémotrice",
  Geothermal: "Géothermie",
  Storage: "Stockage",
  Waste: "Déchets",
  Petcoke: "Coke de pétrole",
  Cogeneration: "Cogénération",
  Other: "Autre",
};

export const FUEL_LABELS_EN = {
  Nuclear: "Nuclear",
  Hydro: "Hydro",
  Wind: "Wind",
  Gas: "Gas",
  Solar: "Solar",
  Oil: "Oil",
  Coal: "Coal",
  Biomass: "Biomass",
  "Wave and Tidal": "Wave and tidal",
  Geothermal: "Geothermal",
  Storage: "Storage",
  Waste: "Waste",
  Petcoke: "Petroleum coke",
  Cogeneration: "Cogeneration",
  Other: "Other",
};

export const FUEL_LABELS_ES = {
  Nuclear: "Nuclear",
  Hydro: "Hidráulica",
  Wind: "Eólica",
  Gas: "Gas",
  Solar: "Solar",
  Oil: "Petróleo",
  Coal: "Carbón",
  Biomass: "Biomasa",
  "Wave and Tidal": "Mareomotriz y undimotriz",
  Geothermal: "Geotérmica",
  Storage: "Almacenamiento",
  Waste: "Residuos",
  Petcoke: "Coque de petróleo",
  Cogeneration: "Cogeneración",
  Other: "Otro",
};

export const FUEL_LABELS_IT = {
  Nuclear: "Nucleare",
  Hydro: "Idroelettrica",
  Wind: "Eolica",
  Gas: "Gas",
  Solar: "Solare",
  Oil: "Petrolio",
  Coal: "Carbone",
  Biomass: "Biomassa",
  "Wave and Tidal": "Maremotrice e ondosa",
  Geothermal: "Geotermica",
  Storage: "Accumulo",
  Waste: "Rifiuti",
  Petcoke: "Coke di petrolio",
  Cogeneration: "Cogenerazione",
  Other: "Altro",
};

export const FUEL_LABELS_RU = {
  Nuclear: "Атомная",
  Hydro: "Гидроэнергетика",
  Wind: "Ветровая",
  Gas: "Газ",
  Solar: "Солнечная",
  Oil: "Нефть",
  Coal: "Уголь",
  Biomass: "Биомасса",
  "Wave and Tidal": "Волновая и приливная",
  Geothermal: "Геотермальная",
  Storage: "Накопители",
  Waste: "Отходы",
  Petcoke: "Нефтяной кокс",
  Cogeneration: "Когенерация",
  Other: "Прочее",
};

export const FUEL_LABELS_JA = {
  Nuclear: "原子力",
  Hydro: "水力",
  Wind: "風力",
  Gas: "ガス",
  Solar: "太陽光",
  Oil: "石油",
  Coal: "石炭",
  Biomass: "バイオマス",
  "Wave and Tidal": "波力・潮力",
  Geothermal: "地熱",
  Storage: "蓄電",
  Waste: "廃棄物",
  Petcoke: "石油コークス",
  Cogeneration: "コージェネレーション",
  Other: "その他",
};

export const FUEL_LABELS_ZH = {
  Nuclear: "核能",
  Hydro: "水力",
  Wind: "风能",
  Gas: "天然气",
  Solar: "太阳能",
  Oil: "石油",
  Coal: "煤炭",
  Biomass: "生物质能",
  "Wave and Tidal": "波浪能与潮汐能",
  Geothermal: "地热能",
  Storage: "储能",
  Waste: "废弃物",
  Petcoke: "石油焦",
  Cogeneration: "热电联产",
  Other: "其他",
};

export const FUEL_LABELS_HI = {
  Nuclear: "परमाणु",
  Hydro: "जलविद्युत",
  Wind: "पवन",
  Gas: "गैस",
  Solar: "सौर",
  Oil: "तेल",
  Coal: "कोयला",
  Biomass: "जैव द्रव्यमान",
  "Wave and Tidal": "तरंग और ज्वारीय",
  Geothermal: "भूतापीय",
  Storage: "भंडारण",
  Waste: "अपशिष्ट",
  Petcoke: "पेट्रोलियम कोक",
  Cogeneration: "सह-उत्पादन",
  Other: "अन्य",
};

const FUEL_LABEL_TABLES = {
  fr: FUEL_LABELS_FR,
  en: FUEL_LABELS_EN,
  es: FUEL_LABELS_ES,
  it: FUEL_LABELS_IT,
  ru: FUEL_LABELS_RU,
  ja: FUEL_LABELS_JA,
  zh: FUEL_LABELS_ZH,
  hi: FUEL_LABELS_HI,
};

export const FUEL_COLORS = {
  Nuclear: "#8e44ad",
  Hydro: "#1baf7a",
  Wind: "#4285f4",
  Gas: "#e67e22",
  Solar: "#f4b400",
  Oil: "#5b3a29",
  Coal: "#7f8c8d",
  Biomass: "#27ae60",
  "Wave and Tidal": "#16a085",
  Geothermal: "#c0392b",
  Storage: "#16a085",
  Waste: "#95a5a6",
};
export const DEFAULT_FUEL_COLOR = "#3388ff";

// "locale" doit venir de router.locale (via useT()) — jamais de la détection
// navigateur legacy (detectPreferredLanguage), qui est un système séparé et
// ne change pas quand la personne bascule la langue via le sélecteur.
export function translateFuel(type, locale = "fr") {
  const table = FUEL_LABEL_TABLES[locale] || FUEL_LABELS_FR;
  return table[type] || type;
}
