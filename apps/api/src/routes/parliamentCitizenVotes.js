import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { UUID_RE } from "../lib/validators.js";

// Votes citoyens sur les scrutins étrangers (schéma parliament_*) — même
// principe que citizenVotes.js côté France : un visiteur peut voter
// anonymement pour comparer sa réponse à celle des élus. Identifiant UUID
// généré côté navigateur, jamais lié à une identité, un email ou une IP.
// Positions génériques "yes"/"no"/"abstain" (alignées sur
// parliament_member_votes), pas "pour"/"contre"/"abstention" comme côté
// France — ce système sert potentiellement des parlements non francophones.

const router = Router();

router.post("/api/parliament/:country/citizen-votes", publicWriteLimiter, async (req, res) => {
  const { country } = req.params;
  const { anonymousId, voteId, position } = req.body || {};
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  if (!["yes", "no", "abstain"].includes(position)) {
    return res.status(400).json({ error: "Position invalide" });
  }
  const voteIdNum = parseInt(voteId, 10);
  if (Number.isNaN(voteIdNum)) {
    return res.status(400).json({ error: "Scrutin invalide" });
  }
  try {
    // Vérifie que le scrutin appartient bien au pays indiqué dans l'URL,
    // pour éviter qu'un identifiant de vote d'un autre pays ne soit
    // accepté par erreur ici.
    const voteCheck = await pool.query(
      "SELECT id FROM parliament_votes WHERE id = $1 AND country_code = $2",
      [voteIdNum, country]
    );
    if (voteCheck.rows.length === 0) {
      return res.status(404).json({ error: "Scrutin non trouvé pour ce pays" });
    }
    await pool.query(
      `INSERT INTO parliament_citizen_votes (vote_id, voter_hash, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (vote_id, voter_hash)
       DO UPDATE SET position = EXCLUDED.position, created_at = now()`,
      [voteIdNum, anonymousId, position]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.get("/api/parliament/:country/citizen-votes/:anonymousId", async (req, res) => {
  const { country, anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    const result = await pool.query(
      `SELECT pcv.vote_id, pcv.position, pcv.created_at,
              v.question, v.bill_number, v.vote_date, v.result, v.chamber
       FROM parliament_citizen_votes pcv
       JOIN parliament_votes v ON v.id = pcv.vote_id
       WHERE v.country_code = $1 AND pcv.voter_hash = $2
       ORDER BY pcv.created_at DESC`,
      [country, anonymousId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Alignement avec les élus et les groupes — même principe que côté France :
// uniquement calculé sur les scrutins où la personne a elle-même voté ET où
// on a le détail nominatif. Seuil minimum de 3 scrutins communs.
router.get("/api/parliament/:country/citizen-votes/:anonymousId/alignment", async (req, res) => {
  const { country, anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  const MIN_COMMON_VOTES = 3;
  try {
    const membersResult = await pool.query(
      `SELECT m.id, m.external_id, m.full_name, g.slug AS group_slug, g.name AS group_name,
              COUNT(*) FILTER (WHERE mv.position = pcv.position) AS matches,
              COUNT(*) AS total
       FROM parliament_citizen_votes pcv
       JOIN parliament_member_votes mv ON mv.vote_id = pcv.vote_id
       JOIN parliament_members m ON m.id = mv.member_id
       LEFT JOIN parliament_groups g ON g.id = m.group_id
       JOIN parliament_votes v ON v.id = pcv.vote_id
       WHERE v.country_code = $1 AND pcv.voter_hash = $2 AND mv.position IN ('yes', 'no', 'abstain')
       GROUP BY m.id, m.external_id, m.full_name, g.slug, g.name
       HAVING COUNT(*) >= $3
       ORDER BY (COUNT(*) FILTER (WHERE mv.position = pcv.position))::float / COUNT(*) DESC
       LIMIT 20`,
      [country, anonymousId, MIN_COMMON_VOTES]
    );

    const groupsResult = await pool.query(
      `SELECT g.slug, g.name,
              COUNT(*) FILTER (WHERE mv.position = pcv.position) AS matches,
              COUNT(*) AS total
       FROM parliament_citizen_votes pcv
       JOIN parliament_member_votes mv ON mv.vote_id = pcv.vote_id
       JOIN parliament_members m ON m.id = mv.member_id
       JOIN parliament_groups g ON g.id = m.group_id
       JOIN parliament_votes v ON v.id = pcv.vote_id
       WHERE v.country_code = $1 AND pcv.voter_hash = $2 AND mv.position IN ('yes', 'no', 'abstain')
       GROUP BY g.slug, g.name
       HAVING COUNT(*) >= $3
       ORDER BY (COUNT(*) FILTER (WHERE mv.position = pcv.position))::float / COUNT(*) DESC`,
      [country, anonymousId, MIN_COMMON_VOTES]
    );

    res.json({ minCommonVotes: MIN_COMMON_VOTES, members: membersResult.rows, groups: groupsResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.delete("/api/parliament/:country/citizen-votes/:anonymousId", async (req, res) => {
  const { country, anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    await pool.query(
      `DELETE FROM parliament_citizen_votes
       WHERE voter_hash = $1
         AND vote_id IN (SELECT id FROM parliament_votes WHERE country_code = $2)`,
      [anonymousId, country]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

// Agrégat public (jamais individuel) des votes citoyens sur un scrutin.
// Seuil minimum avant affichage, même logique que côté France.
const MIN_CITIZEN_VOTES_FOR_STATS = 5;

router.get("/api/parliament/:country/votes/:id/citizen-stats", async (req, res) => {
  const { country, id } = req.params;
  const voteId = parseInt(id, 10);
  if (Number.isNaN(voteId)) {
    return res.status(400).json({ error: "Scrutin invalide" });
  }
  try {
    const result = await pool.query(
      `SELECT pcv.position, COUNT(*) AS count
       FROM parliament_citizen_votes pcv
       JOIN parliament_votes v ON v.id = pcv.vote_id
       WHERE v.country_code = $1 AND pcv.vote_id = $2
       GROUP BY pcv.position`,
      [country, voteId]
    );
    const total = result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);
    if (total < MIN_CITIZEN_VOTES_FOR_STATS) {
      return res.json({ total, available: false, minRequired: MIN_CITIZEN_VOTES_FOR_STATS });
    }
    res.json({
      total,
      available: true,
      counts: Object.fromEntries(result.rows.map((r) => [r.position, parseInt(r.count, 10)])),
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

export default router;
