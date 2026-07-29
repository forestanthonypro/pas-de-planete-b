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
  const table = locale === "en" ? FUEL_LABELS_EN : FUEL_LABELS_FR;
  return table[type] || type;
}
