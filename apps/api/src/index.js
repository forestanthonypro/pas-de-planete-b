import express from "express";
import pg from "pg";

const app = express();
const port = process.env.API_PORT || 4000;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Exemple d'endpoint : à remplacer par l'ingestion réelle (Global Carbon Project / OWID)
app.get("/api/co2/:country", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      "SELECT year, emissions_mt FROM co2_emissions WHERE country_code = $1 ORDER BY year",
      [country.toUpperCase()]
    );
    res.json(result.rows);
  } catch (err) {
    // La table n'existe pas encore tant que les migrations n'ont pas tourné
    res.status(503).json({ error: "Données non initialisées", detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`API Pas de planète B à l'écoute sur le port ${port}`);
});
