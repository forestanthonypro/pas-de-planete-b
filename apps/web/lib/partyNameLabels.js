// Traduit les noms de partis stockés en langue source en base (anglais
// pour les États-Unis, espagnol pour l'Espagne — voir ingest-us-congress.js
// et ingest-spain-congress.js) — même principe que translateFuel.js pour
// les types de combustible. Repli sur le nom brut si non reconnu (pays
// futurs avec d'autres partis).
const PARTY_KEYS = {
  Republican: "party_republican",
  Democratic: "party_democratic",
  Independent: "party_independent",
  "Grupo Parlamentario Popular en el Congreso": "party_es_pp",
  "Grupo Parlamentario Socialista": "party_es_psoe",
  "Grupo Parlamentario VOX": "party_es_vox",
  "Grupo Parlamentario Plurinacional SUMAR": "party_es_sumar",
  "Grupo Parlamentario Republicano": "party_es_erc",
  "Grupo Parlamentario Junts per Catalunya": "party_es_junts",
  "Grupo Parlamentario Vasco (EAJ-PNV)": "party_es_eaj_pnv",
  "Grupo Parlamentario Euskal Herria Bildu": "party_es_eh_bildu",
  "Grupo Parlamentario Mixto": "party_es_mixto",
};

export function translatePartyName(name, t) {
  if (!name) return name;
  const key = PARTY_KEYS[name];
  return key ? t(`international.${key}`) : name;
}
