import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { publicWriteLimiter } from "../lib/rateLimits.js";
import { UUID_RE } from "../lib/validators.js";

const router = Router();

// --- Vote citoyen ---
// Un visiteur peut voter (anonymement) sur un scrutin pour comparer sa
// réponse à celle de l'Assemblée. Rien n'est stocké ici tant que le
// frontend n'envoie pas explicitement le vote — ce qui n'arrive qu'après
// consentement explicite de la personne (voir lib/anonymousId.js côté web).
// L'identifiant est un UUID généré dans le navigateur, jamais lié à un
// compte, un email ou une IP.


router.post("/api/citizen-votes", publicWriteLimiter, async (req, res) => {
  const { anonymousId, legislature, numeroScrutin, position } = req.body || {};
  if (!anonymousId || !UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  if (!["pour", "contre", "abstention"].includes(position)) {
    return res.status(400).json({ error: "Position invalide" });
  }
  const legislatureNum = parseInt(legislature, 10);
  const numeroNum = parseInt(numeroScrutin, 10);
  if (Number.isNaN(legislatureNum) || Number.isNaN(numeroNum)) {
    return res.status(400).json({ error: "Scrutin invalide" });
  }
  try {
    await pool.query(
      `INSERT INTO citizen_votes (anonymous_id, legislature, numero_scrutin, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (anonymous_id, legislature, numero_scrutin)
       DO UPDATE SET position = EXCLUDED.position, voted_at = now()`,
      [anonymousId, legislatureNum, numeroNum, position]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'enregistrement", detail: errorDetail(err) });
  }
});

router.get("/api/citizen-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    const result = await pool.query(
      `SELECT cv.legislature, cv.numero_scrutin, cv.position, cv.voted_at,
              s.title, s.objet, s.scrutin_date, s.result_code, s.result_label
       FROM citizen_votes cv
       LEFT JOIN scrutins s ON s.legislature = cv.legislature AND s.numero = cv.numero_scrutin
       WHERE cv.anonymous_id = $1
       ORDER BY cv.voted_at DESC`,
      [anonymousId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Alignement avec les député·e·s et les groupes — uniquement calculé sur les
// scrutins où la personne a ELLE-MÊME voté ET où on a le détail nominatif
// des député·e·s. Seuil minimum de 3 scrutins communs pour éviter qu'un tout
// petit échantillon fausse le classement (même logique que le classement de
// participation).
router.get("/api/citizen-votes/:anonymousId/alignment", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  const MIN_COMMON_VOTES = 3;
  try {
    const deputiesResult = await pool.query(
      `SELECT dv.acteur_uid, d.full_name, d.group_abbreviation,
              COUNT(*) FILTER (WHERE dv.position = cv.position) AS matches,
              COUNT(*) AS total
       FROM citizen_votes cv
       JOIN deputy_votes dv ON dv.legislature = cv.legislature AND dv.numero_scrutin = cv.numero_scrutin
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE cv.anonymous_id = $1 AND dv.position IN ('pour', 'contre', 'abstention')
       GROUP BY dv.acteur_uid, d.full_name, d.group_abbreviation
       HAVING COUNT(*) >= $2
       ORDER BY (COUNT(*) FILTER (WHERE dv.position = cv.position))::float / COUNT(*) DESC
       LIMIT 20`,
      [anonymousId, MIN_COMMON_VOTES]
    );

    const groupsResult = await pool.query(
      `SELECT d.group_abbreviation,
              COUNT(*) FILTER (WHERE dv.position = cv.position) AS matches,
              COUNT(*) AS total
       FROM citizen_votes cv
       JOIN deputy_votes dv ON dv.legislature = cv.legislature AND dv.numero_scrutin = cv.numero_scrutin
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE cv.anonymous_id = $1 AND dv.position IN ('pour', 'contre', 'abstention')
             AND d.group_abbreviation IS NOT NULL
       GROUP BY d.group_abbreviation
       HAVING COUNT(*) >= $2
       ORDER BY (COUNT(*) FILTER (WHERE dv.position = cv.position))::float / COUNT(*) DESC`,
      [anonymousId, MIN_COMMON_VOTES]
    );

    res.json({ minCommonVotes: MIN_COMMON_VOTES, deputies: deputiesResult.rows, groups: groupsResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Droit à l'oubli : efface tout l'historique lié à cet identifiant.
router.delete("/api/citizen-votes/:anonymousId", async (req, res) => {
  const { anonymousId } = req.params;
  if (!UUID_RE.test(anonymousId)) {
    return res.status(400).json({ error: "Identifiant anonyme invalide" });
  }
  try {
    await pool.query("DELETE FROM citizen_votes WHERE anonymous_id = $1", [anonymousId]);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Échec de la suppression", detail: errorDetail(err) });
  }
});

// Agrégat public (jamais individuel) des votes citoyens sur un scrutin — pas
// d'authentification requise, aucune donnée personnelle exposée : juste des
// comptages. Seuil minimum avant affichage pour éviter qu'un tout petit
// nombre de votes (ex: 1 ou 2) donne une fausse impression de tendance.
const MIN_CITIZEN_VOTES_FOR_STATS = 5;

router.get("/api/scrutins/:legislature/:numero/citizen-stats", async (req, res) => {
  const legislatureNum = parseInt(req.params.legislature, 10);
  const numeroNum = parseInt(req.params.numero, 10);
  if (Number.isNaN(legislatureNum) || Number.isNaN(numeroNum)) {
    return res.status(400).json({ error: "Scrutin invalide" });
  }
  try {
    const result = await pool.query(
      `SELECT position, COUNT(*) AS count FROM citizen_votes
       WHERE legislature = $1 AND numero_scrutin = $2
       GROUP BY position`,
      [legislatureNum, numeroNum]
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
