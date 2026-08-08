import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";

const router = Router();

router.get("/api/parliament/:country/members", async (req, res) => {
  const { country } = req.params;
  const { chamber } = req.query;
  try {
    const params = [country];
    let chamberClause = "";
    if (chamber === "lower" || chamber === "upper") {
      params.push(chamber);
      chamberClause = "AND m.chamber = $2";
    }
    const result = await pool.query(
      `SELECT m.id, m.chamber, m.external_id, m.full_name, m.state_or_region,
              m.photo_url, m.in_office, g.slug AS group_slug, g.name AS group_name,
              g.color AS group_color
       FROM parliament_members m
       LEFT JOIN parliament_groups g ON g.id = m.group_id
       WHERE m.country_code = $1 ${chamberClause}
       ORDER BY m.last_name, m.first_name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/parliament/:country/members/:externalId", async (req, res) => {
  const { country, externalId } = req.params;
  try {
    const memberResult = await pool.query(
      `SELECT m.*, g.slug AS group_slug, g.name AS group_name, g.color AS group_color
       FROM parliament_members m
       LEFT JOIN parliament_groups g ON g.id = m.group_id
       WHERE m.country_code = $1 AND m.external_id = $2`,
      [country, externalId]
    );
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: "Élu non trouvé" });
    }
    const member = memberResult.rows[0];

    const votesResult = await pool.query(
      `SELECT mv.position, v.id AS vote_id, v.external_id AS vote_external_id,
              v.question, v.bill_number, v.vote_date, v.result
       FROM parliament_member_votes mv
       JOIN parliament_votes v ON v.id = mv.vote_id
       WHERE mv.member_id = $1
       ORDER BY v.vote_date DESC NULLS LAST`,
      [member.id]
    );

    res.json({ member, votes: votesResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Répartition par chambre incluse (lower_count/upper_count) — utile pour
// les pays bicaméraux (ex. États-Unis), afin d'afficher Chambre/Sénat
// séparément sous le graphique plutôt qu'un seul total mélangé.
router.get("/api/parliament/:country/groups", async (req, res) => {
  const { country } = req.params;
  try {
    const result = await pool.query(
      `SELECT g.id, g.slug, g.name, g.color,
              COUNT(m.id) AS member_count,
              COUNT(m.id) FILTER (WHERE m.chamber = 'lower') AS lower_count,
              COUNT(m.id) FILTER (WHERE m.chamber = 'upper') AS upper_count
       FROM parliament_groups g
       LEFT JOIN parliament_members m ON m.group_id = g.id AND m.in_office = true
       WHERE g.country_code = $1
       GROUP BY g.id
       ORDER BY member_count DESC`,
      [country]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/parliament/:country/groups/:slug", async (req, res) => {
  const { country, slug } = req.params;
  try {
    const groupResult = await pool.query(
      "SELECT * FROM parliament_groups WHERE country_code = $1 AND slug = $2",
      [country, slug]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Groupe non trouvé" });
    }
    const membersResult = await pool.query(
      `SELECT id, external_id, chamber, full_name, state_or_region, photo_url
       FROM parliament_members
       WHERE group_id = $1 AND in_office = true
       ORDER BY last_name, first_name`,
      [groupResult.rows[0].id]
    );
    res.json({ group: groupResult.rows[0], members: membersResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// IMPORTANT : ces deux routes (/stats et /search) doivent être déclarées
// AVANT "/votes/:id" ci-dessous, sinon Express interprète "stats"/"search"
// comme une valeur du paramètre :id.

router.get("/api/parliament/:country/votes/stats", async (req, res) => {
  const { country } = req.params;
  try {
    const byResult = await pool.query(
      `SELECT result, COUNT(*) AS count FROM parliament_votes
       WHERE country_code = $1 GROUP BY result ORDER BY count DESC`,
      [country]
    );
    const total = await pool.query(
      "SELECT COUNT(*) AS count FROM parliament_votes WHERE country_code = $1",
      [country]
    );
    res.json({ total: parseInt(total.rows[0].count, 10), byResult: byResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/parliament/:country/votes/search", async (req, res) => {
  const { country } = req.params;
  const q = (req.query.q || "").trim();
  if (q.length < 3) {
    return res.status(400).json({ error: "Recherche trop courte (3 caractères minimum)" });
  }
  try {
    const result = await pool.query(
      `SELECT id, chamber, external_id, question, bill_number, vote_date, result
       FROM parliament_votes
       WHERE country_code = $1 AND question ILIKE $2
       ORDER BY vote_date DESC NULLS LAST
       LIMIT 100`,
      [country, `%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/parliament/:country/votes", async (req, res) => {
  const { country } = req.params;
  const { chamber } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  try {
    const params = [country];
    let chamberClause = "";
    if (chamber === "lower" || chamber === "upper") {
      params.push(chamber);
      chamberClause = "AND chamber = $2";
    }
    params.push(limit);
    const result = await pool.query(
      `SELECT id, chamber, external_id, question, bill_number, vote_date, result,
              yes_count, no_count, abstain_count, not_voting_count, source_url
       FROM parliament_votes
       WHERE country_code = $1 ${chamberClause}
       ORDER BY vote_date DESC NULLS LAST
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/parliament/:country/votes/:id", async (req, res) => {
  const { country, id } = req.params;
  try {
    const voteResult = await pool.query(
      "SELECT * FROM parliament_votes WHERE country_code = $1 AND id = $2",
      [country, id]
    );
    if (voteResult.rows.length === 0) {
      return res.status(404).json({ error: "Vote non trouvé" });
    }
    const positionsResult = await pool.query(
      `SELECT mv.position, m.id AS member_id, m.external_id, m.full_name,
              m.state_or_region, g.slug AS group_slug, g.name AS group_name, g.color AS group_color
       FROM parliament_member_votes mv
       JOIN parliament_members m ON m.id = mv.member_id
       LEFT JOIN parliament_groups g ON g.id = m.group_id
       WHERE mv.vote_id = $1
       ORDER BY g.name, m.last_name`,
      [id]
    );
    res.json({ vote: voteResult.rows[0], positions: positionsResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

export default router;
