// Intensité carbone du réseau électrique (gCO2/kWh), calculée à partir du
// même mix par source déjà utilisé pour le kit "Constats"
// (electricity_generation, voir kitCommunication.js / ENERGY_SOURCES).
//
// Facteurs d'émission du cycle de vie (gCO2eq/kWh, médianes) — source :
// GIEC, 5e rapport (AR5), groupe de travail III, annexe III, tableau
// A.III.2. Valeurs de référence internationalement citées, indépendantes
// du pays (une centrale nucléaire ou solaire a globalement la même
// intensité carbone où qu'elle se trouve — contrairement aux émissions
// territoriales, qui elles dépendent du mix réel du pays).
const EMISSION_FACTORS_G_PER_KWH = {
  nuclear_twh: 12,
  hydro_twh: 24,
  gas_twh: 490,
  coal_twh: 820,
  wind_twh: 11,
  solar_twh: 45,
  oil_twh: 650,
  biofuel_twh: 230,
  other_renewable_twh: 38,
};

// Calcule l'intensité carbone moyenne du réseau à partir de la même ligne
// electricity_generation utilisée par computeTop3EnergySources. Renvoie
// null si aucune donnée de mix n'existe pour ce pays (jamais une valeur
// inventée) — voir gridIntensityTier() pour la logique d'appel.
export function computeGridIntensity(row) {
  if (!row) return null;
  const total = parseFloat(row.total_generation_twh) || null;
  if (!total || total <= 0) return null;

  let weightedSum = 0;
  let coveredTwh = 0;
  for (const [key, factor] of Object.entries(EMISSION_FACTORS_G_PER_KWH)) {
    const value = row[key] !== null && row[key] !== undefined ? parseFloat(row[key]) : null;
    if (value !== null && value > 0) {
      weightedSum += value * factor;
      coveredTwh += value;
    }
  }
  // Si moins de 50 % du mix est couvert par nos 9 catégories connues (cas
  // rare, sources marginales non détaillées par la donnée source), la
  // moyenne calculée serait trop peu fiable pour être affichée comme un
  // vrai chiffre — mieux vaut ne rien afficher que d'être trompeur.
  if (coveredTwh < total * 0.5) return null;

  return Math.round(weightedSum / coveredTwh);
}

// Trois paliers volontairement larges (pas de fausse précision) : le seuil
// exact importe moins que le sens général du message (réseau plutôt
// décarboné / mixte / plutôt carboné), qui est ce qui change concrètement
// l'intérêt d'une voiture électrique ou de panneaux solaires pour un pays
// donné.
export function gridIntensityTier(gCo2PerKwh) {
  if (gCo2PerKwh === null) return null;
  if (gCo2PerKwh < 150) return "low";
  if (gCo2PerKwh < 450) return "medium";
  return "high";
}
