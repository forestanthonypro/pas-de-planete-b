// Ingestion de la génération électrique réelle par filière et par an (TWh) —
// à distinguer de la capacité installée (MW, figée depuis 2021) du module énergie.
// Source : jeu de données complet Our World in Data (Ember + Energy Institute),
// CSV ouvert, sans authentification, même domaine que le CO2 (owid-public.owid.io).

import { parse } from "csv-parse/sync";

const CSV_URL = "https://owid-public.owid.io/data/energy/owid-energy-data.csv";
const SOURCE_LABEL = "Ember / Energy Institute, via Our World in Data";
const ISO3_RE = /^[A-Z]{3}$/;

function num(row, col) {
  const v = row[col];
  return v === "" || v === undefined ? null : parseFloat(v);
}

export async function ingestElectricity(pool) {
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    throw new Error(`Échec du téléchargement : ${res.status} ${res.statusText}`);
  }
  const csvText = await res.text();
  const rows = parse(csvText, { columns: true, skip_empty_lines: true });

  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const isoCode = (row.iso_code || "").trim().toUpperCase();
      const year = parseInt(row.year, 10);
      const totalGen = num(row, "electricity_generation");

      // On ne garde que les pays réels (code ISO3) avec au moins une donnée de
      // génération totale, pour ne pas remplir la table d'années sans rien.
      if (!ISO3_RE.test(isoCode) || Number.isNaN(year) || totalGen === null) {
        skipped += 1;
        continue;
      }

      await client.query(
        `INSERT INTO electricity_generation
           (country_code, country_name, year, coal_twh, gas_twh, oil_twh, nuclear_twh,
            hydro_twh, wind_twh, solar_twh, biofuel_twh, other_renewable_twh,
            total_generation_twh, demand_twh, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (country_code, year)
         DO UPDATE SET
           coal_twh = EXCLUDED.coal_twh,
           gas_twh = EXCLUDED.gas_twh,
           oil_twh = EXCLUDED.oil_twh,
           nuclear_twh = EXCLUDED.nuclear_twh,
           hydro_twh = EXCLUDED.hydro_twh,
           wind_twh = EXCLUDED.wind_twh,
           solar_twh = EXCLUDED.solar_twh,
           biofuel_twh = EXCLUDED.biofuel_twh,
           other_renewable_twh = EXCLUDED.other_renewable_twh,
           total_generation_twh = EXCLUDED.total_generation_twh,
           demand_twh = EXCLUDED.demand_twh,
           updated_at = now()`,
        [
          isoCode,
          row.country,
          year,
          num(row, "coal_electricity"),
          num(row, "gas_electricity"),
          num(row, "oil_electricity"),
          num(row, "nuclear_electricity"),
          num(row, "hydro_electricity"),
          num(row, "wind_electricity"),
          num(row, "solar_electricity"),
          num(row, "biofuel_electricity"),
          num(row, "other_renewable_electricity"),
          totalGen,
          num(row, "electricity_demand"),
          SOURCE_LABEL,
        ]
      );
      inserted += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { inserted, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log(`Téléchargement de ${CSV_URL} ...`);
  const { inserted, skipped } = await ingestElectricity(pool);
  console.log(`Terminé : ${inserted} lignes insérées/mises à jour, ${skipped} lignes ignorées.`);
  await pool.end();
}
