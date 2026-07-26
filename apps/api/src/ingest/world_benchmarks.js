// Ingestion des repères mondiaux : une seule valeur de référence par métrique
// (pas une série complète), extraite de la ligne "Monde"/"World" de chaque
// source déjà utilisée ailleurs, plus le seuil OMS pour la pollution (constante
// fixe, pas une donnée mesurée).
//
// Ces repères servent à comparer le pays sélectionné au reste du monde sur le
// dashboard — jamais présentés comme un "% par pays" quand la donnée ne le
// permet pas (voir les scripts d'ingestion espèces/eau pour le détail de cette
// limite méthodologique).

import { parse } from "csv-parse/sync";

const CO2_URL = "https://owid-public.owid.io/data/co2/owid-co2-data.csv";
const WATER_STRESS_URL = "https://ourworldindata.org/grapher/freshwater-withdrawals-as-a-share-of-internal-resources.csv?v=1&csvType=full&useColumnShortNames=false";
const WATER_WITHDRAWAL_URL = "https://ourworldindata.org/grapher/annual-freshwater-withdrawals.csv?v=1&csvType=full&useColumnShortNames=false";
const ENERGY_URL = "https://owid-public.owid.io/data/energy/owid-energy-data.csv";
const MAMMAL_URL = "https://ourworldindata.org/grapher/threatened-mammal-species.csv?v=1&csvType=full&useColumnShortNames=false";
const BIRD_URL = "https://ourworldindata.org/grapher/threatened-bird-species.csv?v=1&csvType=full&useColumnShortNames=false";
const FISH_URL = "https://ourworldindata.org/grapher/fish-species-threatened.csv?v=1&csvType=full&useColumnShortNames=false";
const PM25_URL = "https://ourworldindata.org/grapher/outdoor-air-pollution-exposure.csv?v=1&csvType=full&useColumnShortNames=false";
const TREE_LOSS_URL = "https://ourworldindata.org/grapher/tree-cover-loss.csv?v=1&csvType=full&useColumnShortNames=false";
const FOREST_AREA_URL = "https://ourworldindata.org/grapher/forest-area-km.csv?v=1&csvType=full&useColumnShortNames=false";

async function fetchCsvRows(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Échec du téléchargement (${url}) : ${res.status} ${res.statusText}`);
  const text = await res.text();
  return parse(text, { columns: true, skip_empty_lines: true });
}

// Trouve la dernière ligne "Monde" disponible (les CSV OWID utilisent "World"
// comme nom d'entité, avec le code OWID_WRL — sauf owid-co2-data.csv et
// owid-energy-data.csv qui utilisent directement iso_code vide et country="World").
function latestWorldRow(rows, { entityCol = "Entity", codeCol = "Code", yearCol = "Year", worldCode = "OWID_WRL", worldName = "World" } = {}) {
  const candidates = rows.filter(
    (r) => (r[codeCol] || "").trim().toUpperCase() === worldCode || (r[entityCol] || "").trim() === worldName
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => parseInt(a[yearCol], 10) - parseInt(b[yearCol], 10));
  return candidates[candidates.length - 1];
}

async function upsertBenchmark(client, key, value, unit, year, source) {
  if (value === null || value === undefined || Number.isNaN(value)) return false;
  await client.query(
    `INSERT INTO world_benchmarks (metric_key, value, unit, year, source)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (metric_key)
     DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, year = EXCLUDED.year,
                   source = EXCLUDED.source, updated_at = now()`,
    [key, value, unit, year, source]
  );
  return true;
}

export async function ingestWorldBenchmarks(pool) {
  let set = 0;

  const [co2Rows, waterRows, waterWithdrawalRows, energyRows, mammalRows, birdRows, fishRows, pm25Rows, treeLossRows, forestAreaRows] = await Promise.all([
    fetchCsvRows(CO2_URL),
    fetchCsvRows(WATER_STRESS_URL),
    fetchCsvRows(WATER_WITHDRAWAL_URL),
    fetchCsvRows(ENERGY_URL),
    fetchCsvRows(MAMMAL_URL),
    fetchCsvRows(BIRD_URL),
    fetchCsvRows(FISH_URL),
    fetchCsvRows(PM25_URL),
    fetchCsvRows(TREE_LOSS_URL),
    fetchCsvRows(FOREST_AREA_URL),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // CO2 par habitant (owid-co2-data.csv : colonnes "country", "iso_code", "year")
    const co2World = latestWorldRow(co2Rows, { entityCol: "country", codeCol: "iso_code", yearCol: "year" });
    if (co2World && co2World.co2_per_capita) {
      if (await upsertBenchmark(client, "co2_per_capita", parseFloat(co2World.co2_per_capita), "t/hab/an", parseInt(co2World.year, 10), "Global Carbon Project via Our World in Data")) set += 1;
    }

    // Stress hydrique (% des ressources renouvelables prélevées)
    const waterWorld = latestWorldRow(waterRows);
    const waterCol = "Level of water stress: freshwater withdrawal as a proportion of available freshwater resources (%) - No breakdown";
    if (waterWorld && waterWorld[waterCol]) {
      if (await upsertBenchmark(client, "water_stress_share", parseFloat(waterWorld[waterCol]), "%", parseInt(waterWorld.Year, 10), "FAO via Our World in Data")) set += 1;
    }

    // Prélèvements d'eau par habitant, monde — pas d'indicateur "par habitant" tout
    // fait pour ça (contrairement au CO2/à l'électricité), donc calculé nous-mêmes
    // à partir du total mondial prélevé et de la population mondiale (même CSV CO2).
    const withdrawalWorld = latestWorldRow(waterWithdrawalRows);
    if (withdrawalWorld && withdrawalWorld["Annual freshwater withdrawals"] && co2World?.population) {
      const worldWithdrawalM3 = parseFloat(withdrawalWorld["Annual freshwater withdrawals"]);
      const worldPopulation = parseFloat(co2World.population);
      if (worldPopulation > 0) {
        const perCapita = worldWithdrawalM3 / worldPopulation;
        if (await upsertBenchmark(client, "water_withdrawal_per_capita", perCapita, "m³/hab/an", parseInt(withdrawalWorld.Year, 10), "AQUASTAT/FAO, via Our World in Data (calcul propre à partir du total et de la population)")) set += 1;
      }
    }

    // Électricité consommée par habitant (owid-energy-data.csv)
    const energyWorld = latestWorldRow(energyRows, { entityCol: "country", codeCol: "iso_code", yearCol: "year" });
    if (energyWorld) {
      const perCapita = energyWorld.electricity_demand_per_capita || energyWorld.per_capita_electricity;
      if (perCapita) {
        if (await upsertBenchmark(client, "electricity_demand_per_capita", parseFloat(perCapita), "kWh/hab/an", parseInt(energyWorld.year, 10), "Ember/Energy Institute via Our World in Data")) set += 1;
      }
    }

    // Espèces menacées, totaux mondiaux (comptages absolus, pour situer le pays)
    const mammalWorld = latestWorldRow(mammalRows);
    if (mammalWorld && mammalWorld["Mammal species, threatened"]) {
      if (await upsertBenchmark(client, "mammals_threatened_world", parseFloat(mammalWorld["Mammal species, threatened"]), "espèces", parseInt(mammalWorld.Year, 10), "IUCN via Banque mondiale, via Our World in Data")) set += 1;
    }
    const birdWorld = latestWorldRow(birdRows);
    if (birdWorld && birdWorld["Bird species, threatened"]) {
      if (await upsertBenchmark(client, "birds_threatened_world", parseFloat(birdWorld["Bird species, threatened"]), "espèces", parseInt(birdWorld.Year, 10), "IUCN via Banque mondiale, via Our World in Data")) set += 1;
    }
    const fishWorld = latestWorldRow(fishRows);
    if (fishWorld && fishWorld["Fish species, threatened"]) {
      if (await upsertBenchmark(client, "fish_threatened_world", parseFloat(fishWorld["Fish species, threatened"]), "espèces", parseInt(fishWorld.Year, 10), "FishBase via Banque mondiale, via Our World in Data")) set += 1;
    }

    // Pollution de l'air : moyenne mondiale ET seuil OMS (constante fixe)
    const pm25World = latestWorldRow(pm25Rows);
    const pm25Col = "Outdoor air pollution exposure (population-weighted PM2.5)";
    if (pm25World && pm25World[pm25Col]) {
      if (await upsertBenchmark(client, "pm25_world_average", parseFloat(pm25World[pm25Col]), "µg/m³", parseInt(pm25World.Year, 10), "SatPM via Our World in Data")) set += 1;
    }
    if (await upsertBenchmark(client, "pm25_who_guideline", 5, "µg/m³", null, "Organisation mondiale de la santé (recommandation)")) set += 1;

    // Déforestation mondiale : % du couvert forestier mondial perdu la dernière année
    const treeLossWorld = latestWorldRow(treeLossRows);
    const forestAreaWorld = latestWorldRow(forestAreaRows);
    if (treeLossWorld && forestAreaWorld && forestAreaWorld["Forest area"]) {
      const forestLossShare = (parseFloat(treeLossWorld.Total) / parseFloat(forestAreaWorld["Forest area"])) * 100;
      if (await upsertBenchmark(client, "forest_loss_share_world", forestLossShare, "%", parseInt(treeLossWorld.Year, 10), "Global Forest Watch et FAO, via Our World in Data")) set += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { set };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Extraction des repères mondiaux depuis les sources déjà utilisées...");
  const { set } = await ingestWorldBenchmarks(pool);
  console.log(`Terminé : ${set} repères mondiaux enregistrés.`);
  await pool.end();
}
