// Ingestion du Sénat espagnol (Senado de España) dans le schéma générique
// parliament_* (migration 040).
//
// Contrairement au Congreso (nom complet exact des deux côtés), le Sénat
// n'expose pas d'identifiant numérique fiable dans son fichier de
// composition (colonne "número" = siège, souvent VIDE pour les sénateurs
// récemment désignés) — on utilise donc le nom complet comme identifiant
// externe, comme pour le Congreso.
//
// Point technique important : les fichiers de votes par séance sont
// encodés en ISO-8859-1 (déclaré dans leur en-tête XML), pas en UTF-8 —
// contrairement au fichier de composition qui lui est en UTF-8. Décodage
// donc adapté dynamiquement selon la déclaration XML de chaque fichier
// (voir fetchXmlAuto), plutôt que supposé fixe.
//
// Sources :
//   - Membres : https://www.senado.es/web/ficopendataservlet?tipoFich=20
//     (composition actuelle de l'hémicycle)
//   - Groupes/partis : https://www.senado.es/web/ficopendataservlet?tipoFich=4&legis=15
//     (table de correspondance parti -> groupe parlementaire, plusieurs
//     partis régionaux formant un seul groupe, ex. PSOE+PSC+PSE-EE+PSdeG
//     -> "Grupo Parlamentario Socialista")
//   - Votes : liste des séances plénières sur
//     https://www.senado.es/web/relacionesciudadanos/datosabiertos/catalogodatos/sesionesplenariascd/votacionescd/index.html,
//     un fichier XML par séance (/legis15/votaciones/ses_NN.xml),
//     contenant plusieurs votes avec le détail nominal complet.

import { pool } from "../lib/db.js";

const MEMBERS_URL = "https://www.senado.es/web/ficopendataservlet?tipoFich=20";
const GROUPS_URL = "https://www.senado.es/web/ficopendataservlet?tipoFich=4&legis=15";
const SESSIONS_INDEX_URL = "https://www.senado.es/web/relacionesciudadanos/datosabiertos/catalogodatos/sesionesplenariascd/votacionescd/index.html";

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

// Récupère un fichier XML en respectant l'encodage qu'il déclare lui-même
// (ISO-8859-1 pour les votes, UTF-8 pour la composition) — fetch().text()
// suppose UTF-8 par défaut, ce qui corromprait les fichiers ISO-8859-1
// (accents remplacés par des "ï¿½").
async function fetchXmlAuto(url) {
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    const buffer = await res.arrayBuffer();
    const preview = new TextDecoder("iso-8859-1").decode(buffer.slice(0, 200));
    const encMatch = preview.match(/encoding="([^"]+)"/i);
    const encoding = encMatch ? encMatch[1].toLowerCase() : "utf-8";
    return new TextDecoder(encoding).decode(buffer);
  });
}

async function fetchTextUtf8(url) {
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return res.text();
  });
}

function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : "";
}

function getCdataTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*)\\]\\]`));
  return m ? m[1].trim() : "";
}

// ---------------------------------------------------------------------
// 1. Groupes — table de correspondance parti -> groupe, construite à
//    partir du fichier officiel (plusieurs partis régionaux peuvent
//    former un seul groupe parlementaire).
// ---------------------------------------------------------------------
const GROUP_COLORS = {
  "GRUPO PARLAMENTARIO POPULAR EN EL SENADO": "#0D5EA6",
  "GRUPO PARLAMENTARIO SOCIALISTA": "#E30613",
  "GRUPO PARLAMENTARIO IZQUIERDAS POR LA INDEPENDENCIA (ESQUERRA REPUBLICANA-EUSKAL HERRIA BILDU)": "#FFD400",
  "GRUPO PARLAMENTARIO PLURAL EN EL SENADO JUNTS PER CATALUNYA-COALICIÓN CANARIA-AGRUPACIÓN HERREÑA INDEPENDIENTE-BLOQUE NACIONALISTA GALEGO": "#00A0DC",
  "GRUPO PARLAMENTARIO VASCO EN EL SENADO (EAJ-PNV)": "#009B3A",
  "GRUPO PARLAMENTARIO IZQUIERDA CONFEDERAL (MÁS MADRID, EIVISSA I FORMENTERA AL SENAT, COMPROMÍS, AGRUPACIÓN SOCIALISTA GOMERA Y GEROA BAI)": "#A6006B",
  "GRUPO PARLAMENTARIO MIXTO": "#9CA3AF",
};

async function fetchPartyToGroupMap() {
  const xml = await fetchXmlAuto(GROUPS_URL);
  const groupBlocks = xml.match(/<Grupo>[\s\S]*?<\/Grupo>/g) || [];
  const partyToGroup = new Map();
  for (const block of groupBlocks) {
    const nombre = getCdataTag(block, "nombre");
    if (!nombre) continue;
    const partyBlocks = block.match(/<partido>[\s\S]*?<\/partido>/g) || [];
    for (const p of partyBlocks) {
      const partidoCod = getCdataTag(p, "partidoCod");
      if (partidoCod) partyToGroup.set(partidoCod, nombre);
    }
  }
  return partyToGroup;
}

async function upsertGroup(groupName) {
  const color = GROUP_COLORS[groupName] || "#9ca3af";
  const slug = `es-senado-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
  const result = await pool.query(
    `INSERT INTO parliament_groups (country_code, external_id, slug, name, color)
     VALUES ('es', $1, $2, $3, $4)
     ON CONFLICT (country_code, slug) DO UPDATE SET name = $3, color = $4, updated_at = now()
     RETURNING id`,
    [slug, slug, groupName, color]
  );
  return result.rows[0].id;
}

// ---------------------------------------------------------------------
// 2. Membres — composition actuelle de l'hémicycle. Le nom complet
//    (nombre + apellidos) sert d'identifiant externe et de clé
//    d'appariement avec les votes (même format des deux côtés).
// ---------------------------------------------------------------------
export async function ingestSpainSenateMembers() {
  const [membersXml, partyToGroup] = await Promise.all([
    fetchXmlAuto(MEMBERS_URL),
    fetchPartyToGroupMap(),
  ]);

  const blocks = membersXml.match(/<escaño>[\s\S]*?<\/escaño>/g) || [];
  let count = 0;

  for (const block of blocks) {
    const nombre = getTag(block, "nombre");
    const apellidos = getTag(block, "apellidos");
    const partido = getTag(block, "partido_político");
    const circunscripcion = getTag(block, "circunscripción");
    const comunidad = getTag(block, "comunidad_autónoma");
    if (!nombre || !apellidos) continue;

    const fullName = `${nombre} ${apellidos}`;
    const groupName = partyToGroup.get(partido) || "GRUPO PARLAMENTARIO MIXTO";
    const groupId = await upsertGroup(groupName);

    await pool.query(
      `INSERT INTO parliament_members
         (country_code, chamber, external_id, first_name, last_name, full_name,
          group_id, state_or_region, official_url, in_office)
       VALUES ('es', 'upper', $1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
         first_name = $2, last_name = $3, full_name = $4, group_id = $5,
         state_or_region = $6, official_url = $7, in_office = true, updated_at = now()`,
      [
        fullName, // external_id : nom complet, comme pour le Congreso
        nombre,
        apellidos,
        fullName,
        groupId,
        circunscripcion || comunidad || null,
        "https://www.senado.es/web/composicionorganizacion/senadores/composicionsenado/index.html",
      ]
    );
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------
// 3. Votes — un fichier XML par séance plénière, plusieurs votes par
//    fichier, détail nominal complet inclus (pas besoin d'appel séparé
//    par vote, contrairement au Congreso).
// ---------------------------------------------------------------------
const MONTH_ES = {
  ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
  JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
};

// Convertit "17-SEP-2025" en "2025-09-17".
function parseSpanishSenateDate(dateStr) {
  const m = (dateStr || "").match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/);
  if (!m) return null;
  const [, day, monthAbbr, year] = m;
  const month = MONTH_ES[monthAbbr];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

const VOTE_POSITION_MAP = {
  "Sí": "yes",
  SI: "yes",
  NO: "no",
  "Abstención": "abstain",
  Abstencion: "abstain",
};

async function fetchSessionUrls() {
  const html = await fetchTextUtf8(SESSIONS_INDEX_URL);
  const matches = [...new Set(html.match(/\/legis15\/votaciones\/ses_\d+\.xml/g) || [])];
  return matches.map((path) => `https://www.senado.es${path}`);
}

export async function ingestSpainSenateVotes({ limitSessions = 3 } = {}) {
  const sessionUrls = (await fetchSessionUrls()).slice(0, limitSessions);
  let voteCount = 0;

  for (const sessionUrl of sessionUrls) {
    const xml = await fetchXmlAuto(sessionUrl);
    const numSesion = getTag(xml, "num_sesion");
    const votacionBlocks = xml.match(/<votacion>[\s\S]*?<\/votacion>/g) || [];

    for (const block of votacionBlocks) {
      const numVot = getTag(block, "num_vot");
      const codVotacion = getTag(block, "CodVotacion");
      const titulo = getTag(block, "tit_vot") || getTag(block, "tit_sec");
      const fecha = getTag(block, "fecha_v");
      const afirmativos = getTag(block, "tot_afirmativos");
      const negativos = getTag(block, "tot_negativos");
      const abstenciones = getTag(block, "tot_abstenciones");
      const externalId = codVotacion || `${numSesion}-${numVot}`;
      const result = Number(afirmativos) > Number(negativos) ? "Aprobado" : "Rechazado";

      const voteResult = await pool.query(
        `INSERT INTO parliament_votes
           (country_code, chamber, external_id, question, vote_date, result,
            yes_count, no_count, abstain_count, source_url)
         VALUES ('es', 'upper', $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
           question = $2, vote_date = $3, result = $4, yes_count = $5,
           no_count = $6, abstain_count = $7, source_url = $8, updated_at = now()
         RETURNING id`,
        [
          externalId,
          titulo || `Votación ${numVot}`,
          parseSpanishSenateDate(fecha),
          result,
          Number(afirmativos) || 0,
          Number(negativos) || 0,
          Number(abstenciones) || 0,
          sessionUrl,
        ]
      );
      const voteId = voteResult.rows[0].id;

      const alreadyDetailed = await pool.query(
        "SELECT 1 FROM parliament_member_votes WHERE vote_id = $1 LIMIT 1",
        [voteId]
      );
      if (alreadyDetailed.rows.length > 0) {
        voteCount++;
        continue;
      }

      const votanteBlocks = block.match(/<VotoSenador>[\s\S]*?<\/VotoSenador>/g) || [];
      for (const vb of votanteBlocks) {
        const nombreCompleto = getTag(vb, "nombre");
        const voto = getTag(vb, "voto");
        if (!nombreCompleto) continue;

        // Le nom ici est au format "PRÉNOM(S) NOM(S)" en majuscules — on
        // rattache par correspondance insensible à la casse plutôt
        // qu'exacte (la composition de l'hémicycle est en casse mixte).
        const memberResult = await pool.query(
          "SELECT id FROM parliament_members WHERE country_code = 'es' AND chamber = 'upper' AND UPPER(external_id) = UPPER($1)",
          [nombreCompleto]
        );
        if (memberResult.rows.length === 0) continue;
        const memberId = memberResult.rows[0].id;

        const position = VOTE_POSITION_MAP[voto] || "not_voting";

        await pool.query(
          `INSERT INTO parliament_member_votes (vote_id, member_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (vote_id, member_id) DO UPDATE SET position = $3`,
          [voteId, memberId, position]
        );
      }
      voteCount++;
    }
  }
  return voteCount;
}

// ---------------------------------------------------------------------
// Point d'entrée réutilisable.
// ---------------------------------------------------------------------
export async function ingestSpainSenate({ limitSessions = 3 } = {}) {
  const memberCount = await ingestSpainSenateMembers();
  const voteCount = await ingestSpainSenateVotes({ limitSessions });
  return { members: memberCount, votes: voteCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ingestSpainSenate()
    .then((result) => {
      console.log(`Terminé : ${result.members} sénateur(s), ${result.votes} vote(s).`);
      return pool.end();
    })
    .catch((err) => {
      console.error("Échec de l'ingestion :", err);
      pool.end().finally(() => process.exit(1));
    });
}
