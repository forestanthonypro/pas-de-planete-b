// Libellés de chambre spécifiques par pays — quand un pays a des noms
// propres (Chambre des représentants / Sénat pour les États-Unis), on les
// utilise partout plutôt que les libellés génériques "Chambre basse" /
// "Chambre haute", pour rester cohérent d'une page à l'autre.
const COUNTRY_CHAMBER_LABELS = {
  us: { lower: "international.chamber_us_house", upper: "international.chamber_us_senate" },
};

export function chamberLabelKey(country, chamber) {
  const labels = COUNTRY_CHAMBER_LABELS[country] || { lower: "international.chamber_lower", upper: "international.chamber_upper" };
  return chamber === "upper" ? labels.upper : labels.lower;
}
