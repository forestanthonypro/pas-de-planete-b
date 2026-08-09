// Traduit les noms de partis stockés en anglais en base (langue source,
// voir ingest-us-congress.js) — même principe que translateFuel.js pour
// les types de combustible. Repli sur le nom brut si non reconnu (pays
// futurs avec d'autres partis, ex. Italie/Espagne).
const PARTY_KEYS = {
  Republican: "party_republican",
  Democratic: "party_democratic",
  Independent: "party_independent",
};

export function translatePartyName(name, t) {
  if (!name) return name;
  const key = PARTY_KEYS[name];
  return key ? t(`international.${key}`) : name;
}
