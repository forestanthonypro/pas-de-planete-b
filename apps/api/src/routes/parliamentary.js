import { Router } from "express";
import { pool } from "../lib/db.js";
import { errorDetail } from "../lib/errors.js";
import { requireIngestToken } from "../lib/auth.js";
import { ingestDeputies } from "../ingest/deputies.js";
import { ingestGroups } from "../ingest/an_groups.js";
import { ingestScrutins } from "../ingest/scrutins.js";
import { ingestDeputyVotes } from "../ingest/deputy_votes.js";
import { ingestUsCongress } from "../scripts/ingest-us-congress.js";
import { ingestSpainCongress } from "../scripts/ingest-spain-congress.js";
import { ingestItalySenate } from "../scripts/ingest-italy-senate.js";

const router = Router();

// --- Députés, groupes et votes à l'Assemblée nationale (17e législature) ---
// Données factuelles uniquement (qui a voté quoi, résultat officiel) — aucune
// qualification ni interprétation politique n'est ajoutée. Source : CIVIX,
// à partir des données open data de l'Assemblée nationale.

router.get("/api/deputies", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT acteur_uid, full_name, group_name, group_abbreviation, department, circo_number
       FROM deputies ORDER BY last_name, first_name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Classement de participation : sur la fenêtre de scrutins avec détail
// nominatif disponible, quelle part des scrutins voit chaque député exprimer
// un vote (pour/contre/abstention) plutôt qu'être absent. Un seuil minimum de
// scrutins est appliqué pour éviter qu'un député avec très peu de données
// (ex: arrivé récemment) fausse le classement avec un échantillon trop petit.
router.get("/api/deputies/participation", async (_req, res) => {
  const MIN_VOTES = 20;
  try {
    const result = await pool.query(
      `SELECT d.acteur_uid, d.full_name, d.group_abbreviation,
              COUNT(*) AS total_votes,
              COUNT(*) FILTER (WHERE dv.position != 'absent') AS active_votes
       FROM deputy_votes dv
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE dv.legislature = 17
       GROUP BY d.acteur_uid, d.full_name, d.group_abbreviation
       HAVING COUNT(*) >= $1
       ORDER BY (COUNT(*) FILTER (WHERE dv.position != 'absent'))::float / COUNT(*) DESC`,
      [MIN_VOTES]
    );
    res.json({ minVotes: MIN_VOTES, deputies: result.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/deputies/:acteurUid", async (req, res) => {
  const { acteurUid } = req.params;
  try {
    const deputyResult = await pool.query("SELECT * FROM deputies WHERE acteur_uid = $1", [acteurUid]);
    if (deputyResult.rows.length === 0) {
      return res.status(404).json({ error: "Député non trouvé" });
    }
    const deputy = deputyResult.rows[0];
    const votesResult = await pool.query(
      `SELECT dv.numero_scrutin, dv.position, s.scrutin_date, s.title, s.objet,
              s.result_code, s.result_label
       FROM deputy_votes dv
       JOIN scrutins s ON s.legislature = dv.legislature AND s.numero = dv.numero_scrutin
       WHERE dv.acteur_uid = $1 AND dv.legislature = 17
       ORDER BY s.scrutin_date DESC NULLS LAST, dv.numero_scrutin DESC`,
      [acteurUid]
    );
    let groupStats = null;
    if (deputy.group_abbreviation) {
      const groupResult = await pool.query(
        "SELECT avg_participation_pct, median_participation_pct FROM an_groups WHERE legislature = 17 AND abbreviation = $1",
        [deputy.group_abbreviation]
      );
      groupStats = groupResult.rows[0] || null;
    }
    res.json({ deputy, votes: votesResult.rows, groupStats });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/an-groups", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM an_groups WHERE legislature = 17 ORDER BY effectif DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Cohésion de groupe : sur les scrutins où au moins 2 membres du groupe ont
// voté (hors absents, qui ne reflètent pas un désaccord de fond), quelle part
// des scrutins voit tous les votants du groupe choisir la même position.
// Détail d'un groupe : ses infos + le résultat (adopté/rejeté) des scrutins
// où au moins un de ses membres a voté, en pourcentage — puisque les votes
// sont individuels, on ne peut pas dire que "le groupe a fait adopter" un
// texte, seulement que ses membres ont participé à des scrutins qui ont
// abouti à tel ou tel résultat.
router.get("/api/an-groups/:abbreviation", async (req, res) => {
  const { abbreviation } = req.params;
  try {
    const groupResult = await pool.query(
      "SELECT * FROM an_groups WHERE legislature = 17 AND abbreviation = $1",
      [abbreviation]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Groupe non trouvé" });
    }

    const resultBreakdown = await pool.query(
      `SELECT s.result_code, COUNT(DISTINCT s.numero) AS count
       FROM scrutins s
       JOIN deputy_votes dv ON dv.legislature = s.legislature AND dv.numero_scrutin = s.numero
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE s.legislature = 17 AND d.group_abbreviation = $1
       GROUP BY s.result_code`,
      [abbreviation]
    );

    const recentScrutins = await pool.query(
      `SELECT s.legislature, s.numero, s.scrutin_date, s.title, s.objet, s.result_code, s.result_label,
              COUNT(*) FILTER (WHERE dv.position = 'pour') AS pour,
              COUNT(*) FILTER (WHERE dv.position = 'contre') AS contre,
              COUNT(*) FILTER (WHERE dv.position = 'abstention') AS abstention
       FROM scrutins s
       JOIN deputy_votes dv ON dv.legislature = s.legislature AND dv.numero_scrutin = s.numero
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE s.legislature = 17 AND d.group_abbreviation = $1
       GROUP BY s.legislature, s.numero, s.scrutin_date, s.title, s.objet, s.result_code, s.result_label
       ORDER BY s.scrutin_date DESC NULLS LAST, s.numero DESC
       LIMIT 100`,
      [abbreviation]
    );

    res.json({
      group: groupResult.rows[0],
      resultBreakdown: resultBreakdown.rows,
      recentScrutins: recentScrutins.rows,
    });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/scrutins", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  try {
    const result = await pool.query(
      `SELECT legislature, numero, scrutin_date, title, objet, type_vote_label,
              result_code, result_label
       FROM scrutins WHERE legislature = 17
       ORDER BY numero DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Taux d'adoption global, sur l'ensemble des 8000+ scrutins de la
// législature (pas seulement la fenêtre récente des votes détaillés).
router.get("/api/scrutins/stats", async (_req, res) => {
  try {
    const byResult = await pool.query(
      `SELECT result_code, COUNT(*) AS count FROM scrutins WHERE legislature = 17
       GROUP BY result_code ORDER BY count DESC`
    );
    const byType = await pool.query(
      `SELECT type_vote_label, result_code, COUNT(*) AS count FROM scrutins WHERE legislature = 17
       GROUP BY type_vote_label, result_code ORDER BY type_vote_label, count DESC`
    );
    const total = await pool.query("SELECT COUNT(*) AS count FROM scrutins WHERE legislature = 17");
    res.json({ total: parseInt(total.rows[0].count, 10), byResult: byResult.rows, byType: byType.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

// Recherche par mot-clé sur l'ensemble des 8000+ scrutins (titre + objet),
// pas seulement la fenêtre des 200 plus récents — pour retrouver un débat
// spécifique (ex: un pesticide, une substance) même ancien dans la
// législature. Le détail nominatif des votes peut ne pas être disponible pour
// les résultats hors de la fenêtre récente (voir la fiche du scrutin).
router.get("/api/scrutins/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 3) {
    return res.status(400).json({ error: "Recherche trop courte (3 caractères minimum)" });
  }
  try {
    const result = await pool.query(
      `SELECT legislature, numero, scrutin_date, title, objet, type_vote_label, result_code, result_label
       FROM scrutins
       WHERE legislature = 17 AND (title ILIKE $1 OR objet ILIKE $1)
       ORDER BY scrutin_date DESC NULLS LAST
       LIMIT 100`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.get("/api/scrutins/:legislature/:numero", async (req, res) => {
  const legislature = parseInt(req.params.legislature, 10);
  const numero = parseInt(req.params.numero, 10);
  try {
    const scrutinResult = await pool.query(
      "SELECT * FROM scrutins WHERE legislature = $1 AND numero = $2",
      [legislature, numero]
    );
    if (scrutinResult.rows.length === 0) {
      return res.status(404).json({ error: "Scrutin non trouvé" });
    }
    const votesResult = await pool.query(
      `SELECT dv.acteur_uid, dv.position, d.full_name, d.group_abbreviation
       FROM deputy_votes dv
       JOIN deputies d ON d.acteur_uid = dv.acteur_uid
       WHERE dv.legislature = $1 AND dv.numero_scrutin = $2
       ORDER BY d.group_abbreviation, d.last_name`,
      [legislature, numero]
    );
    res.json({ scrutin: scrutinResult.rows[0], votes: votesResult.rows });
  } catch (err) {
    res.status(503).json({ error: "Données non initialisées", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/deputies", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestDeputies(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/an-groups", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestGroups(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/scrutins", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestScrutins(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/deputy-votes", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestDeputyVotes(pool);
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

// --- Congrès des États-Unis (schéma générique parliament_*) ---
// Timeout côté appelant à prévoir généreux (voir --max-time dans le
// workflow GitHub Actions) : l'ingestion fait un appel Congress.gov par
// vote de la Chambre, ça peut prendre plusieurs minutes.
router.post("/api/admin/ingest/us-congress", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestUsCongress();
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/spain-congress", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestSpainCongress();
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});

router.post("/api/admin/ingest/italy-senate", requireIngestToken, async (_req, res) => {
  try {
    const result = await ingestItalySenate();
    res.json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: "Échec de l'ingestion", detail: errorDetail(err) });
  }
});


export default router;
