// Alias : depuis le passage à la source officielle de l'Assemblée nationale,
// scrutins.js ingère déjà à la fois les métadonnées ET le détail nominatif
// des votes en un seul passage (le même fichier source contient les deux).
// Ce fichier est conservé pour ne pas casser la commande npm existante.

export { ingestScrutins as ingestDeputyVotes } from "./scrutins.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import("pg");
  const { ingestScrutins } = await import("./scrutins.js");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Cette commande fait maintenant la même chose que 'npm run ingest:scrutins'...");
  const result = await ingestScrutins(pool);
  console.log(
    `Terminé : ${result.scrutinsInserted}/${result.totalScrutinsFound} scrutins insérés (métadonnées), ${result.votesInserted} votes détaillés insérés (${result.votesSkippedNoDeputy} ignorés, député non trouvé).`
  );
  await pool.end();
}
