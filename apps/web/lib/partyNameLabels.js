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
  "Fratelli d'Italia": "party_it_fdi",
  "Partito Democratico - Italia Democratica e Progressista": "party_it_pd",
  "Lega Salvini Premier - Partito Sardo d'Azione": "party_it_lega",
  "MoVimento 5 Stelle": "party_it_m5s",
  "Forza Italia - Berlusconi Presidente - PPE": "party_it_fi",
  "Civici d'Italia-UDC-Noi Moderati (Noi con l'Italia, Coraggio Italia, Italia al Centro)-MAIE-Centro Popolare": "party_it_civici",
  "Italia Viva - Casa Riformista": "party_it_iv",
  "Misto": "party_it_misto",
  "Per le Autonomie (SVP-PATT, Campobase)": "party_it_autonomie",
  "GRUPO PARLAMENTARIO POPULAR EN EL SENADO": "party_es_senado_pp",
  "GRUPO PARLAMENTARIO SOCIALISTA": "party_es_senado_psoe",
  "GRUPO PARLAMENTARIO IZQUIERDAS POR LA INDEPENDENCIA (ESQUERRA REPUBLICANA-EUSKAL HERRIA BILDU)": "party_es_senado_erc_bildu",
  "GRUPO PARLAMENTARIO PLURAL EN EL SENADO JUNTS PER CATALUNYA-COALICIÓN CANARIA-AGRUPACIÓN HERREÑA INDEPENDIENTE-BLOQUE NACIONALISTA GALEGO": "party_es_senado_plural",
  "GRUPO PARLAMENTARIO VASCO EN EL SENADO (EAJ-PNV)": "party_es_senado_pnv",
  "GRUPO PARLAMENTARIO IZQUIERDA CONFEDERAL (MÁS MADRID, EIVISSA I FORMENTERA AL SENAT, COMPROMÍS, AGRUPACIÓN SOCIALISTA GOMERA Y GEROA BAI)": "party_es_senado_confederal",
  "GRUPO PARLAMENTARIO MIXTO": "party_es_senado_mixto",
  "FRATELLI D'ITALIA (FDI)": "party_it_camera_fdi",
  "PARTITO DEMOCRATICO - ITALIA DEMOCRATICA E PROGRESSISTA (PD-IDP)": "party_it_camera_pd",
  "LEGA - SALVINI PREMIER (LEGA)": "party_it_camera_lega",
  "FORZA ITALIA - BERLUSCONI PRESIDENTE - PPE (FI-PPE)": "party_it_camera_fi",
  "MOVIMENTO 5 STELLE (M5S)": "party_it_camera_m5s",
  "ALLEANZA VERDI E SINISTRA (AVS)": "party_it_camera_avs",
  "AZIONE-POPOLARI EUROPEISTI RIFORMATORI-RENEW EUROPE (AZ-PER-RE)": "party_it_camera_azione",
  "NOI MODERATI (NOI CON L'ITALIA, CORAGGIO ITALIA, UDC E ITALIA AL CENTRO)-MAIE-CENTRO POPOLARE (NM(N-C-U-I)M-CP)": "party_it_camera_noimoderati",
  "ITALIA VIVA-CASA RIFORMISTA (IV-CR)": "party_it_camera_iv",
  "MISTO (MISTO)": "party_it_camera_misto",
};

export function translatePartyName(name, t) {
  if (!name) return name;
  const key = PARTY_KEYS[name];
  return key ? t(`international.${key}`) : name;
}
