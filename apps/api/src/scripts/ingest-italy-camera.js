// Ingestion de la Chambre des députés italienne (Camera dei Deputati)
// dans le schéma générique parliament_* (migration 040), via l'endpoint
// SPARQL officiel (https://dati.camera.it/sparql).
//
// Contrairement à la page de téléchargement classique de dati.camera.it
// (bloquée par un CAPTCHA Cloudflare, confirmé le 13 août 2026), son
// endpoint SPARQL est librement accessible — même constat que pour le
// Sénat (dati.senato.it). Virtuoso plus récent que celui du Sénat, gère
// correctement le format JSON habituel... mais on garde le XML par
// cohérence avec le script du Sénat (même analyseur maison réutilisable).
//
// Chaque député a un identifiant stable dans son URI
// (ex. http://dati.camera.it/ocd/deputato.rdf/d309220_19, où 309220 est
// la personne et 19 la législature) — appariement fiable, comme pour le
// Sénat et les États-Unis.
//
// Requêtes construites à partir d'exemples réels trouvés en ligne
// (dati.camera.it/ocd-rappresentazione-semantica-e-documentazione,
// github.com/briatte/parlamento) et testées manuellement le 13 août 2026
// avant écriture de ce script.

import { pool } from "../lib/db.js";

const SPARQL_ENDPOINT = "https://dati.camera.it/sparql";
const OCD_NAMESPACE = "http://dati.camera.it/ocd/";
const CURRENT_LEGISLATURE_URI = "http://dati.camera.it/ocd/legislatura.rdf/repubblica_19";

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

// Même petit analyseur XML fait main que pour le Sénat (voir
// ingest-italy-senate.js) — format des résultats SPARQL identique.
function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseSparqlXml(xml) {
  const results = [];
  const resultBlocks = xml.match(/<result>[\s\S]*?<\/result>/g) || [];
  const bindingPattern = /<binding name="([^"]+)">\s*(?:<uri>([^<]*)<\/uri>|<literal[^>]*>([^<]*)<\/literal>)\s*<\/binding>/g;
  for (const block of resultBlocks) {
    const row = {};
    bindingPattern.lastIndex = 0;
    let m;
    while ((m = bindingPattern.exec(block)) !== null) {
      const value = m[2] !== undefined ? m[2] : m[3];
      row[m[1]] = value !== undefined ? decodeXmlEntities(value) : null;
    }
    results.push(row);
  }
  return results;
}

async function sparqlQuery(query) {
  return withRetry(async () => {
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/sparql-results+xml" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    const xml = await res.text();
    return parseSparqlXml(xml);
  });
}

// Extrait l'identifiant depuis une URI dati.camera.it
// (ex. ".../deputato.rdf/d309220_19" -> "d309220_19").
function idFromUri(uri) {
  if (!uri) return null;
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

// Le titre du groupe renvoyé par la requête est suivi de la date
// d'adhésion collée sans séparateur clair (ex. "FRATELLI D'ITALIA (FDI)
// (18.10.2022") — on la retire pour ne garder que le nom du groupe.
function cleanPartyTitle(title) {
  if (!title) return title;
  return title.replace(/\s*\(\d{1,2}\.\d{1,2}\.\d{4}.*$/, "").trim();
}

// ---------------------------------------------------------------------
// 1. Groupes — couleurs approximatives, mêmes teintes que pour le Sénat
//    quand il s'agit du même parti.
// ---------------------------------------------------------------------
const GROUP_COLORS = {
  "FRATELLI D'ITALIA (FDI)": "#0F2350",
  "PARTITO DEMOCRATICO - ITALIA DEMOCRATICA E PROGRESSISTA (PD-IDP)": "#E4032E",
  "MOVIMENTO 5 STELLE (M5S)": "#FFD60A",
  "FORZA ITALIA - BERLUSCONI PRESIDENTE - PPE (FI-PPE)": "#1279BF",
  "LEGA - SALVINI PREMIER (LEGA)": "#0F7C3B",
  "AZIONE-POPOLARI EUROPEISTI RIFORMATORI-RENEW EUROPE (AZ-PER-RE)": "#F5A623",
  "MISTO": "#9CA3AF",
};

async function upsertGroup(rawTitle) {
  const title = cleanPartyTitle(rawTitle) || "MISTO";
  const color = GROUP_COLORS[title] || "#9ca3af";
  const slug = `it-camera-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
  const result = await pool.query(
    `INSERT INTO parliament_groups (country_code, external_id, slug, name, color)
     VALUES ('it', $1, $2, $3, $4)
     ON CONFLICT (country_code, slug) DO UPDATE SET name = $3, color = $4, updated_at = now()
     RETURNING id`,
    [slug, slug, title, color]
  );
  return result.rows[0].id;
}

// ---------------------------------------------------------------------
// 2. Membres — députés actuellement en mandat (pas de date de fin
//    d'adhésion à leur groupe).
// ---------------------------------------------------------------------
export async function ingestItalyCameraMembers() {
  const query = `
PREFIX ocd: <${OCD_NAMESPACE}>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?d ?name ?surname ?party
WHERE {
  ?d a ocd:deputato;
     ocd:rif_leg <${CURRENT_LEGISLATURE_URI}>;
     ocd:aderisce ?aderisce.
  ?d foaf:firstName ?name; foaf:surname ?surname.
  OPTIONAL { ?aderisce ocd:endDate ?fine. }
  OPTIONAL { ?aderisce ocd:rif_gruppoParlamentare ?gruppo. ?gruppo dc:title ?party. }
  FILTER(!bound(?fine))
}
`;
  const rows = await sparqlQuery(query);
  let count = 0;

  for (const row of rows) {
    const externalId = idFromUri(row.d);
    if (!externalId) continue;

    const groupId = await upsertGroup(row.party || "MISTO");
    const fullName = `${row.name} ${row.surname}`;

    await pool.query(
      `INSERT INTO parliament_members
         (country_code, chamber, external_id, first_name, last_name, full_name,
          group_id, official_url, in_office)
       VALUES ('it', 'lower', $1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
         first_name = $2, last_name = $3, full_name = $4, group_id = $5,
         official_url = $6, in_office = true, updated_at = now()`,
      [externalId, row.name, row.surname, fullName, groupId, row.d]
    );
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------
// 3. Votes — les plus récents de la législature courante, avec détail
//    par député (classe ocd:voto, liée au vote global et au député).
// ---------------------------------------------------------------------
const POSITION_MAP = {
  Favorevole: "yes",
  Contrario: "no",
  Astensione: "abstain",
  "Non ha votato": "not_voting",
};

// Convertit "20260806" (AAAAMMJJ) en "2026-08-06".
function parseCameraDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

export async function ingestItalyCameraVotes({ limitVotes = 20 } = {}) {
  const votesQuery = `
PREFIX ocd: <${OCD_NAMESPACE}>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?votazione ?title ?favorevoli ?contrari ?astenuti ?data
WHERE {
  ?votazione a ocd:votazione;
    ocd:rif_leg <${CURRENT_LEGISLATURE_URI}>.
  OPTIONAL { ?votazione dc:title ?title. }
  OPTIONAL { ?votazione ocd:favorevoli ?favorevoli. }
  OPTIONAL { ?votazione ocd:contrari ?contrari. }
  OPTIONAL { ?votazione ocd:astenuti ?astenuti. }
  OPTIONAL { ?votazione dc:date ?data. }
}
ORDER BY DESC(?data)
LIMIT ${limitVotes}
`;
  const votes = await sparqlQuery(votesQuery);
  let voteCount = 0;

  for (const v of votes) {
    const externalId = idFromUri(v.votazione);
    if (!externalId) continue;

    const favorevoli = Number(v.favorevoli) || 0;
    const contrari = Number(v.contrari) || 0;
    const astenuti = Number(v.astenuti) || 0;
    const result = favorevoli > contrari ? "Approvato" : "Respinto";

    const voteResult = await pool.query(
      `INSERT INTO parliament_votes
         (country_code, chamber, external_id, question, vote_date, result,
          yes_count, no_count, abstain_count, source_url)
       VALUES ('it', 'lower', $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
         question = $2, vote_date = $3, result = $4, yes_count = $5,
         no_count = $6, abstain_count = $7, source_url = $8, updated_at = now()
       RETURNING id`,
      [
        externalId,
        (v.title || "").trim() || `Votazione ${externalId}`,
        parseCameraDate(v.data),
        result,
        favorevoli,
        contrari,
        astenuti,
        v.votazione,
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

    const detailQuery = `
PREFIX ocd: <${OCD_NAMESPACE}>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?deputato ?tipo
WHERE {
  ?voto a ocd:voto;
    ocd:rif_votazione <${v.votazione}>;
    ocd:rif_deputato ?deputato;
    dc:type ?tipo.
}
`;
    const positions = await sparqlQuery(detailQuery);

    for (const p of positions) {
      const deputyExternalId = idFromUri(p.deputato);
      if (!deputyExternalId) continue;

      const memberResult = await pool.query(
        "SELECT id FROM parliament_members WHERE country_code = 'it' AND chamber = 'lower' AND external_id = $1",
        [deputyExternalId]
      );
      if (memberResult.rows.length === 0) continue;
      const memberId = memberResult.rows[0].id;

      const position = POSITION_MAP[p.tipo] || "not_voting";

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

// ---------------------------------------------------------------------
// Point d'entrée réutilisable — même modèle que les autres scripts.
// ---------------------------------------------------------------------
export async function ingestItalyCamera({ limitVotes = 20 } = {}) {
  const memberCount = await ingestItalyCameraMembers();
  const voteCount = await ingestItalyCameraVotes({ limitVotes });
  return { members: memberCount, votes: voteCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ingestItalyCamera()
    .then((result) => {
      console.log(`Terminé : ${result.members} député(s), ${result.votes} vote(s).`);
      return pool.end();
    })
    .catch((err) => {
      console.error("Échec de l'ingestion :", err);
      pool.end().finally(() => process.exit(1));
    });
}
