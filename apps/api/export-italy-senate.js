// Exporte UNIQUEMENT les données du Senat italien (country_code='it',
// chamber='upper') sous forme d'instructions SQL surs (ON CONFLICT DO
// UPDATE) — meme modele que export-spain-senate.js. Necessaire car
// dati.senato.it bloque les requetes venant d'adresses IP de datacenter
// (confirme le 14 aout 2026, Amazon CloudFront - meme type de blocage
// structurel que senado.es, bien que via un CDN different).
//
// Contrairement a l'Espagne, les groupes du Senat italien n'ont pas de
// prefixe de slug distinctif (juste "it-{id}", alors que la Camera
// utilise "it-camera-{nom}") - on les cible donc via une jointure avec
// les membres du Senat plutot que par motif de slug, plus fiable.
//
// Usage : node export-italy-senate.js > italy-senate-export.sql
// (a executer DANS le conteneur API, pas sur l'hote)

import { pool } from "./src/lib/db.js";

function sqlString(val) {
  if (val === null || val === undefined) return "NULL";
  return "'" + String(val).replace(/'/g, "''") + "'";
}
function sqlNumber(val) {
  if (val === null || val === undefined) return "NULL";
  return String(val);
}
function sqlDate(val) {
  if (!val) return "NULL";
  return "'" + new Date(val).toISOString() + "'";
}

async function main() {
  const lines = [];
  lines.push("-- Export cible : Senat italien uniquement (country_code='it', chamber='upper')");
  lines.push("-- Genere le " + new Date().toISOString());
  lines.push("BEGIN;");

  // 1. Groupes du Senat italien, cibles via jointure avec les membres
  // (pas par motif de slug, non fiable pour l'Italie - voir en-tete).
  const groups = await pool.query(
    `SELECT DISTINCT g.external_id, g.slug, g.name, g.color
     FROM parliament_groups g
     JOIN parliament_members m ON m.group_id = g.id
     WHERE m.country_code = 'it' AND m.chamber = 'upper'`
  );
  for (const g of groups.rows) {
    lines.push(
      `INSERT INTO parliament_groups (country_code, external_id, slug, name, color) VALUES ('it', ${sqlString(g.external_id)}, ${sqlString(g.slug)}, ${sqlString(g.name)}, ${sqlString(g.color)}) ON CONFLICT (country_code, slug) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, updated_at = now();`
    );
  }

  // 2. Membres.
  const members = await pool.query(
    `SELECT m.external_id, m.first_name, m.last_name, m.full_name, g.slug AS group_slug, m.official_url
     FROM parliament_members m
     LEFT JOIN parliament_groups g ON g.id = m.group_id
     WHERE m.country_code = 'it' AND m.chamber = 'upper'`
  );
  for (const m of members.rows) {
    const groupSubquery = m.group_slug
      ? `(SELECT id FROM parliament_groups WHERE country_code='it' AND slug=${sqlString(m.group_slug)})`
      : "NULL";
    lines.push(
      `INSERT INTO parliament_members (country_code, chamber, external_id, first_name, last_name, full_name, group_id, official_url, in_office) VALUES ('it', 'upper', ${sqlString(m.external_id)}, ${sqlString(m.first_name)}, ${sqlString(m.last_name)}, ${sqlString(m.full_name)}, ${groupSubquery}, ${sqlString(m.official_url)}, true) ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, full_name = EXCLUDED.full_name, group_id = EXCLUDED.group_id, official_url = EXCLUDED.official_url, in_office = true, updated_at = now();`
    );
  }

  // 3. Votes.
  const votes = await pool.query(
    `SELECT external_id, question, vote_date, result, yes_count, no_count, abstain_count, source_url
     FROM parliament_votes WHERE country_code = 'it' AND chamber = 'upper'`
  );
  for (const v of votes.rows) {
    lines.push(
      `INSERT INTO parliament_votes (country_code, chamber, external_id, question, vote_date, result, yes_count, no_count, abstain_count, source_url) VALUES ('it', 'upper', ${sqlString(v.external_id)}, ${sqlString(v.question)}, ${sqlDate(v.vote_date)}, ${sqlString(v.result)}, ${sqlNumber(v.yes_count)}, ${sqlNumber(v.no_count)}, ${sqlNumber(v.abstain_count)}, ${sqlString(v.source_url)}) ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET question = EXCLUDED.question, vote_date = EXCLUDED.vote_date, result = EXCLUDED.result, yes_count = EXCLUDED.yes_count, no_count = EXCLUDED.no_count, abstain_count = EXCLUDED.abstain_count, source_url = EXCLUDED.source_url, updated_at = now();`
    );
  }

  // 4. Positions individuelles.
  const positions = await pool.query(
    `SELECT v.external_id AS vote_external_id, m.external_id AS member_external_id, pmv.position
     FROM parliament_member_votes pmv
     JOIN parliament_votes v ON v.id = pmv.vote_id
     JOIN parliament_members m ON m.id = pmv.member_id
     WHERE v.country_code = 'it' AND v.chamber = 'upper'`
  );
  for (const p of positions.rows) {
    const voteSubquery = `(SELECT id FROM parliament_votes WHERE country_code='it' AND chamber='upper' AND external_id=${sqlString(p.vote_external_id)})`;
    const memberSubquery = `(SELECT id FROM parliament_members WHERE country_code='it' AND chamber='upper' AND external_id=${sqlString(p.member_external_id)})`;
    lines.push(
      `INSERT INTO parliament_member_votes (vote_id, member_id, position) VALUES (${voteSubquery}, ${memberSubquery}, ${sqlString(p.position)}) ON CONFLICT (vote_id, member_id) DO UPDATE SET position = EXCLUDED.position;`
    );
  }

  lines.push("COMMIT;");
  console.log(lines.join("\n"));
  console.error(`\n[info] Export terminé : ${groups.rows.length} groupe(s), ${members.rows.length} membre(s), ${votes.rows.length} vote(s), ${positions.rows.length} position(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
