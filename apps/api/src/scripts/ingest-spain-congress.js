// Ingestion du Congrès des députés espagnol (Congreso de los Diputados)
// dans le schéma générique parliament_* (migration 040).
//
// Contrairement aux États-Unis, l'Espagne n'expose pas d'identifiant
// numérique unique par député dans son jeu de données ouvertes — on
// utilise donc le nom complet ("Nom, Prénom", format identique des deux
// côtés : liste des députés ET détail de chaque vote) comme identifiant
// externe et clé d'appariement. Contrairement au Sénat américain
// (GovTrack, nom de famille + État seulement, fragile), le nom complet
// est disponible ici des deux côtés — l'appariement est donc direct et
// fiable, sans les approximations nécessaires côté US.
//
// Sources :
//   - Membres : https://www.congreso.es/es/opendata/diputados (JSON direct)
//   - Votes   : https://www.congreso.es/es/opendata/votaciones (page HTML —
//               pas d'API listant les votes, il faut extraire les liens
//               JSON de chaque vote depuis le HTML de cette page).
//
// Historique complet des votes (20 août 2026) : la page d'index n'affiche
// par défaut que la séance la plus récente, mais le site accepte une
// vraie navigation par date en simple GET — trouvé en observant le trafic
// réseau d'un clic réel sur le calendrier (le site tourne sur Liferay,
// dont les portlets exposent des paramètres d'URL nommés) :
//
//   ?p_p_id=votaciones&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view
//    &targetLegislatura=XV&targetDate=DD/MM/YYYY
//
// Confirmé en conditions réelles : demander une date précise renvoie bien
// la séance de cette date-là (pas seulement la plus récente). Pas besoin
// de navigateur automatisé — une limitation initialement supposée
// nécessiter Playwright, finalement résolue en simple requête GET. Voir
// ingestSpainVotesHistorical() ci-dessous, qui remonte dans le temps
// jour par jour et ingère chaque nouvelle séance rencontrée.
//
// Chambre haute (Sénat espagnol, dati.senato équivalent) hors périmètre
// pour l'instant, comme convenu.
//
// Utilisable de plusieurs façons :
//   1. En script autonome, rafraîchissement courant :
//      node src/scripts/ingest-spain-congress.js
//   2. En script autonome, backfill historique complet de la législature
//      en cours :
//      node src/scripts/ingest-spain-congress.js --historical
//   3. Importé et appelé depuis une route API (ingestSpainCongress()),
//      pour un rafraîchissement programmé — même modèle que
//      ingest-us-congress.js.

import { pool } from "../lib/db.js";

const MEMBERS_PAGE_URL = "https://www.congreso.es/es/opendata/diputados";
const VOTES_INDEX_URL = "https://www.congreso.es/es/opendata/votaciones";

// Date de début de la XV législature (17 août 2023) — sert de borne basse
// par défaut au backfill historique, pour ne pas remonter indéfiniment
// sans bénéfice (les législatures précédentes suivraient le même
// mécanisme mais avec un autre code, ex. Leg14 — hors périmètre pour
// l'instant, comme le Sénat).
const CURRENT_LEGISLATURE = "XV";
const CURRENT_LEGISLATURE_START = new Date("2023-08-17T00:00:00Z");

async function withRetry(fn, { attempts = 4, baseDelayMs = 2000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * 2 ** i;
        console.error(`  Tentative ${i + 1}/${attempts} échouée (${err.message}), nouvel essai dans ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastErr;
}

async function fetchJson(url) {
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return res.json();
  });
}

async function fetchText(url) {
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return res.text();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------
// 1. Groupes parlementaires — couleurs approximatives des partis
//    représentés, pas de source officielle de couleurs (comme pour les
//    États-Unis). Clé = nom exact tel que renvoyé par le champ
//    GRUPOPARLAMENTARIO du jeu de données des députés.
// ---------------------------------------------------------------------
const GROUP_INFO = {
  "Grupo Parlamentario Popular en el Congreso": { slug: "es-pp", color: "#0D5EA6" },
  "Grupo Parlamentario Socialista": { slug: "es-psoe", color: "#E30613" },
  "Grupo Parlamentario VOX": { slug: "es-vox", color: "#5AC19E" },
  "Grupo Parlamentario Plurinacional SUMAR": { slug: "es-sumar", color: "#A6006B" },
  "Grupo Parlamentario Republicano": { slug: "es-erc", color: "#FFD400" },
  "Grupo Parlamentario Junts per Catalunya": { slug: "es-junts", color: "#00A0DC" },
  "Grupo Parlamentario Vasco (EAJ-PNV)": { slug: "es-eaj-pnv", color: "#009B3A" },
  "Grupo Parlamentario Euskal Herria Bildu": { slug: "es-eh-bildu", color: "#95C11F" },
  "Grupo Parlamentario Mixto": { slug: "es-mixto", color: "#9CA3AF" },
};

async function upsertGroup(groupName) {
  const info = GROUP_INFO[groupName] || {
    slug: `es-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    color: "#9ca3af",
  };
  const result = await pool.query(
    `INSERT INTO parliament_groups (country_code, external_id, slug, name, color)
     VALUES ('es', $1, $2, $3, $4)
     ON CONFLICT (country_code, slug) DO UPDATE SET name = $3, color = $4, updated_at = now()
     RETURNING id`,
    [groupName, info.slug, groupName, info.color]
  );
  return result.rows[0].id;
}

// ---------------------------------------------------------------------
// 2. Membres — le nom complet (format "Nom, Prénom") sert d'identifiant
//    externe, faute d'ID numérique dans ce jeu de données.
// ---------------------------------------------------------------------
export async function ingestSpainMembers() {
  // L'URL du JSON des députés contient un horodatage qui change chaque
  // jour (ex. DiputadosActivos__20260812050007.json) — on la découvre
  // donc dynamiquement depuis la page HTML plutôt que de la coder en dur.
  const pageHtml = await fetchText(MEMBERS_PAGE_URL);
  const membersUrlMatch = pageHtml.match(/\/webpublica\/opendata\/diputados\/DiputadosActivos[^"'\s)]+\.json/);
  if (!membersUrlMatch) {
    throw new Error("Impossible de trouver l'URL du JSON des députés sur la page d'index — la structure HTML a peut-être changé.");
  }
  const deputies = await fetchJson(`https://www.congreso.es${membersUrlMatch[0]}`);
  let count = 0;

  for (const d of deputies) {
    const nombre = (d.NOMBRE || "").trim();
    if (!nombre) continue;

    const groupId = await upsertGroup(d.GRUPOPARLAMENTARIO || "Grupo Parlamentario Mixto");

    // NOMBRE est au format "Nom(s) de famille, Prénom(s)".
    const [lastName, firstName] = nombre.split(",").map((s) => s.trim());
    const fullName = firstName ? `${firstName} ${lastName}` : nombre;

    await pool.query(
      `INSERT INTO parliament_members
         (country_code, chamber, external_id, first_name, last_name, full_name,
          group_id, state_or_region, official_url, in_office)
       VALUES ('es', 'lower', $1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
         first_name = $2, last_name = $3, full_name = $4, group_id = $5,
         state_or_region = $6, official_url = $7, in_office = true, updated_at = now()`,
      [
        nombre, // external_id : le nom complet lui-même, unique en pratique
        firstName || nombre,
        lastName || nombre,
        fullName,
        groupId,
        d.CIRCUNSCRIPCION || null,
        "https://www.congreso.es/diputados",
      ]
    );
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------
// 3. Votes
// ---------------------------------------------------------------------
const VOTE_POSITION_MAP = {
  "Sí": "yes",
  "No": "no",
  "Abstención": "abstain",
  "No vota": "not_voting",
};

// Convertit "23/7/2026" (jour/mois non paddés) en "2026-07-23".
function parseSpanishDate(dateStr) {
  const [day, month, year] = (dateStr || "").split("/");
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Inverse de parseSpanishDate — utilisé pour construire le paramètre
// targetDate (DD/MM/YYYY) à partir d'un objet Date JS.
function formatDateForCongreso(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// Point de reprise pour le backfill historique : interroge la base pour
// connaître la date la plus ancienne déjà ingérée, et repart juste avant
// — évite de rebalayer depuis aujourd'hui à chaque relance après une
// interruption (redémarrage du conteneur, coupure réseau...). Utilise la
// base elle-même comme état de progression plutôt qu'un fichier ou une
// table dédiée : cohérent avec le reste du projet (ON CONFLICT partout),
// et fonctionne même après un redéploiement qui perdrait tout fichier
// local. Si rien n'est encore ingéré pour l'Espagne, repart d'aujourd'hui.
async function getHistoricalResumeCursor() {
  const result = await pool.query(
    "SELECT MIN(vote_date) AS oldest FROM parliament_votes WHERE country_code = 'es' AND chamber = 'lower'"
  );
  const oldest = result.rows[0]?.oldest;
  if (!oldest) return new Date();
  const cursor = new Date(oldest);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor;
}

// Repère le numéro et la date de la séance affichée sur une page — sert à
// savoir si une page correspond à une séance déjà traitée (backfill).
function extractSessionInfo(html) {
  const sessionMatch = html.match(/Sesi[oó]n Plenaria n[uú]mero\s*(\d+)/i);
  const dateMatch = html.match(/Fecha\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  return {
    sessionNumber: sessionMatch ? parseInt(sessionMatch[1], 10) : null,
    sessionDate: dateMatch ? dateMatch[1] : null,
  };
}

// Extrait les URLs de JSON de vote présentes sur une page de séance —
// motif robuste basé sur le chemin caractéristique, indépendant de la
// structure HTML exacte autour du lien.
function extractVoteJsonUrls(html) {
  const jsonUrlPattern = /\/webpublica\/opendata\/votaciones\/[^"'\s)]+\.json/g;
  return [...new Set(html.match(jsonUrlPattern) || [])].map((path) => `https://www.congreso.es${path}`);
}

// Ingère toutes les votations listées sur une page de séance déjà
// récupérée — partagé entre le rafraîchissement courant (dernière séance)
// et le backfill historique (une séance à la fois, remontée jour par
// jour). Retourne le nombre de votes traités.
async function ingestVotesFromPage(html, { limitVotes = Infinity } = {}) {
  const voteUrls = extractVoteJsonUrls(html);
  if (voteUrls.length === 0) return 0;

  let voteCount = 0;
  for (const voteUrl of voteUrls) {
    if (voteCount >= limitVotes) break;

    const data = await fetchJson(voteUrl);
    const info = data.informacion || {};
    const totales = data.totales || {};

    const externalId = `${info.sesion}-${info.numeroVotacion}`;
    const question = [info.titulo, info.textoExpediente, info.tituloSubGrupo, info.textoSubGrupo]
      .filter(Boolean)
      .join(" — ");
    const result = (totales.afavor ?? 0) > (totales.enContra ?? 0) ? "Aprobado" : "Rechazado";

    const voteResult = await pool.query(
      `INSERT INTO parliament_votes
         (country_code, chamber, external_id, question, vote_date, result,
          yes_count, no_count, abstain_count, not_voting_count, source_url)
       VALUES ('es', 'lower', $1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
         question = $2, vote_date = $3, result = $4, yes_count = $5,
         no_count = $6, abstain_count = $7, not_voting_count = $8,
         source_url = $9, updated_at = now()
       RETURNING id`,
      [
        externalId,
        question || `Votación ${info.numeroVotacion}`,
        parseSpanishDate(info.fecha),
        result,
        totales.afavor ?? 0,
        totales.enContra ?? 0,
        totales.abstenciones ?? 0,
        totales.noVotan ?? 0,
        voteUrl,
      ]
    );
    const voteId = voteResult.rows[0].id;

    // On saute le détail par élu si déjà enregistré, pour ne pas refaire
    // un travail inutile à chaque rafraîchissement/reprise du backfill.
    const alreadyDetailed = await pool.query(
      "SELECT 1 FROM parliament_member_votes WHERE vote_id = $1 LIMIT 1",
      [voteId]
    );
    if (alreadyDetailed.rows.length > 0) {
      voteCount++;
      continue;
    }

    for (const v of data.votaciones || []) {
      const nombre = (v.diputado || "").trim();
      if (!nombre) continue;

      const memberResult = await pool.query(
        "SELECT id FROM parliament_members WHERE country_code = 'es' AND chamber = 'lower' AND external_id = $1",
        [nombre]
      );
      if (memberResult.rows.length === 0) continue; // ex-député, substitut non encore importé, etc.
      const memberId = memberResult.rows[0].id;

      const position = VOTE_POSITION_MAP[v.voto] || "not_voting";

      await pool.query(
        `INSERT INTO parliament_member_votes (vote_id, member_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (vote_id, member_id) DO UPDATE SET position = $3`,
        [voteId, memberId, position]
      );
    }
    voteCount++;
  }
  return voteCount;
}

// Rafraîchissement courant : ingère uniquement la séance la plus récente
// (page d'index sans paramètre de date). Appelé régulièrement (CI, route
// programmée) — rapide, ne remonte pas dans l'historique.
export async function ingestSpainVotes({ limitVotes = Infinity } = {}) {
  const html = await fetchText(VOTES_INDEX_URL);
  const voteCount = await ingestVotesFromPage(html, { limitVotes });
  if (voteCount === 0) {
    console.error("  [avertissement] Aucun lien de vote JSON trouvé sur la page d'index — la structure HTML a peut-être changé.");
  }
  return voteCount;
}

// Backfill historique : remonte jour par jour depuis une date de fin
// (aujourd'hui par défaut) jusqu'à une date de début (début de la
// législature XV par défaut), en ingérant chaque NOUVELLE séance
// rencontrée (plusieurs jours consécutifs renvoient la même séance tant
// qu'aucune nouvelle n'a eu lieu — on ne la retraite pas). Usage ponctuel
// (une fois, ou occasionnellement pour rattraper un long retard), pas
// destiné à tourner à chaque déploiement comme ingestSpainVotes().
//
// delayMs : pause entre deux requêtes de page de séance, pour rester
// courtois envers le serveur source sur un backfill de plusieurs
// centaines de jours.
export async function ingestSpainVotesHistorical({
  legislatura = CURRENT_LEGISLATURE,
  startDate = CURRENT_LEGISLATURE_START,
  endDate = null, // null = reprise automatique depuis la base (voir getHistoricalResumeCursor)
  maxSessions = Infinity,
  maxDurationMs = Infinity, // borne de durée, pour un appel en tranche (route HTTP avec délai limité)
  delayMs = 1500,
} = {}) {
  const seenSessions = new Set();
  let sessionCount = 0;
  let voteCount = 0;
  const startedAt = Date.now();
  const cursor = endDate ? new Date(endDate) : await getHistoricalResumeCursor();

  while (cursor >= startDate && sessionCount < maxSessions && Date.now() - startedAt < maxDurationMs) {
    const dateStr = formatDateForCongreso(cursor);
    const url = `${VOTES_INDEX_URL}?p_p_id=votaciones&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&targetLegislatura=${legislatura}&targetDate=${encodeURIComponent(dateStr)}`;

    try {
      const html = await fetchText(url);
      const { sessionNumber, sessionDate } = extractSessionInfo(html);

      if (sessionNumber !== null && !seenSessions.has(sessionNumber)) {
        seenSessions.add(sessionNumber);
        const votes = await ingestVotesFromPage(html);
        voteCount += votes;
        sessionCount++;
        console.log(`  Séance ${sessionNumber} (${sessionDate || dateStr}) : ${votes} vote(s).`);
      }
    } catch (err) {
      // Une date sans page valide (erreur réseau ponctuelle, jour hors
      // bornes légitimes de la législature...) ne doit pas interrompre
      // tout le backfill — on log et on continue au jour précédent.
      console.error(`  [avertissement] Échec pour ${dateStr} : ${err.message}`);
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1);
    await sleep(delayMs);
  }

  // done=true seulement si on s'est arrêté en atteignant réellement la
  // borne de début — permet à l'appelant (route HTTP en tranches) de
  // savoir s'il faut se rappeler lui-même pour continuer.
  const done = cursor < startDate;
  return { sessions: sessionCount, votes: voteCount, done, resumeBefore: formatDateForCongreso(cursor) };
}

// ---------------------------------------------------------------------
// Points d'entrée réutilisables — même modèle que ingestUsCongress().
// ---------------------------------------------------------------------
export async function ingestSpainCongress({ limitVotes = Infinity } = {}) {
  const memberCount = await ingestSpainMembers();
  const voteCount = await ingestSpainVotes({ limitVotes });
  return { members: memberCount, votes: voteCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const historical = process.argv.includes("--historical");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const maxSessions = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

  const run = historical
    ? (async () => {
        console.log(
          `Backfill historique — législature ${CURRENT_LEGISLATURE}` +
            (maxSessions < Infinity ? ` (limité à ${maxSessions} séance(s) — mode test)` : "") +
            "..."
        );
        const memberCount = await ingestSpainMembers();
        const result = await ingestSpainVotesHistorical({ maxSessions });
        return { members: memberCount, ...result };
      })()
    : ingestSpainCongress();

  run
    .then((result) => {
      console.log(`Terminé :`, result);
      if (historical && result.done === false) {
        console.log(
          `Backfill non terminé (limite atteinte) — relancer la même commande pour continuer : ` +
            `la reprise se fait automatiquement depuis la base (prochain point : avant le ${result.resumeBefore}).`
        );
      }
      return pool.end();
    })
    .catch((err) => {
      console.error("Échec de l'ingestion :", err);
      pool.end().finally(() => process.exit(1));
    });
}
