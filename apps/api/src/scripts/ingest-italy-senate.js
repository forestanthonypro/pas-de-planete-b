// Ingestion du Sénat italien (Senato della Repubblica) dans le schéma
// générique parliament_* (migration 040), via l'endpoint SPARQL officiel
// (https://dati.senato.it/sparql).
//
// Contrairement à l'Espagne, chaque sénateur a un vrai identifiant
// numérique stable dans son URI (http://dati.senato.it/senatore/NNN),
// utilisé directement comme external_id — appariement fiable, comme pour
// les États-Unis.
//
// Chambre des députés (dati.camera.it) hors périmètre pour l'instant :
// sa page de téléchargement classique est protégée par un CAPTCHA
// (Cloudflare), contrairement au Sénat. Un endpoint SPARQL existerait
// aussi côté Chambre d'après une source tierce, mais non vérifié — à
// explorer une prochaine fois si besoin.
//
// Requêtes construites à partir des exemples officiels du Sénat
// (senato.it/download/public/hackaton.pdf), adaptées à la législature
// courante (19e) et testées manuellement le 13 août 2026 avant écriture
// de ce script.

import { pool } from "../lib/db.js";

const SPARQL_ENDPOINT = "https://dati.senato.it/sparql";
const CURRENT_LEGISLATURE = 19;

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

// ---------------------------------------------------------------------
// Petit analyseur XML fait main pour le format (très simple et prévisible)
// des résultats SPARQL — pas de dépendance externe, cohérent avec le
// reste du projet (voir parseCsv dans ingest-us-congress.js, même esprit).
// ---------------------------------------------------------------------
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

// Extrait l'identifiant numérique final d'une URI dati.senato.it
// (ex. "http://dati.senato.it/senatore/32" -> "32").
function idFromUri(uri) {
  if (!uri) return null;
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

// ---------------------------------------------------------------------
// 1. Groupes — couleurs approximatives, comme pour les États-Unis et
//    l'Espagne (pas de source officielle de couleurs).
// ---------------------------------------------------------------------
const GROUP_COLORS = {
  "Fratelli d'Italia": "#0F2350",
  "Partito Democratico - Italia Democratica e Progressista": "#E4032E",
  "Movimento 5 Stelle": "#FFD60A",
  "Forza Italia": "#1279BF",
  "Lega Salvini Premier": "#0F7C3B",
  "Azione - Italia Viva - Renew Europe": "#F5A623",
  "Per le Autonomie": "#9CA3AF",
  "Misto": "#9CA3AF",
};

async function upsertGroup(groupUri, groupName) {
  const groupId = idFromUri(groupUri);
  const color = GROUP_COLORS[groupName] || "#9ca3af";
  const slug = `it-${groupId}`;
  const result = await pool.query(
    `INSERT INTO parliament_groups (country_code, external_id, slug, name, color)
     VALUES ('it', $1, $2, $3, $4)
     ON CONFLICT (country_code, slug) DO UPDATE SET name = $3, color = $4, updated_at = now()
     RETURNING id`,
    [groupId, slug, groupName, color]
  );
  return result.rows[0].id;
}

// ---------------------------------------------------------------------
// 2. Membres — sénateurs de la législature courante, avec leur groupe
//    actuel (deux requêtes séparées, fusionnées côté script : la requête
//    des groupes ne filtre pas par législature explicitement, seulement
//    par adhésion/dénomination toujours actives, ce qui suffit à cibler
//    la composition actuelle).
// ---------------------------------------------------------------------
export async function ingestItalySenateMembers() {
  const senatorsQuery = `
PREFIX osr: <http://dati.senato.it/osr/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT DISTINCT ?senatore ?nome ?cognome
WHERE {
  ?senatore a osr:Senatore.
  ?senatore foaf:firstName ?nome.
  ?senatore foaf:lastName ?cognome.
  ?senatore osr:mandato ?mandato.
  ?mandato osr:legislatura ${CURRENT_LEGISLATURE}.
  OPTIONAL { ?mandato osr:fine ?fine. }
  FILTER(!bound(?fine))
}
ORDER BY ?cognome ?nome
`;

  const groupsQuery = `
PREFIX osr: <http://dati.senato.it/osr/>
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT DISTINCT ?gruppo ?nomeGruppo ?senatore
WHERE {
  ?gruppo a ocd:gruppoParlamentare.
  ?gruppo osr:denominazione ?denominazione.
  ?denominazione osr:titolo ?nomeGruppo.
  ?adesioneGruppo a ocd:adesioneGruppo.
  ?adesioneGruppo osr:gruppo ?gruppo.
  ?senatore ocd:aderisce ?adesioneGruppo.
  ?senatore a osr:Senatore.
  OPTIONAL { ?adesioneGruppo osr:fine ?fineAdesione }
  OPTIONAL { ?denominazione osr:fine ?fineDenominazione }
  FILTER(!bound(?fineAdesione) && !bound(?fineDenominazione))
}
`;

  const [senators, groupMemberships] = await Promise.all([
    sparqlQuery(senatorsQuery),
    sparqlQuery(groupsQuery),
  ]);

  // Table de correspondance sénateur -> groupe (un seul groupe actif
  // attendu par sénateur à un instant donné).
  const groupBySenator = new Map();
  for (const row of groupMemberships) {
    groupBySenator.set(row.senatore, { uri: row.gruppo, name: row.nomeGruppo });
  }

  let count = 0;
  for (const s of senators) {
    const externalId = idFromUri(s.senatore);
    if (!externalId) continue;

    const group = groupBySenator.get(s.senatore);
    const groupId = group ? await upsertGroup(group.uri, group.name) : null;

    const fullName = `${s.nome} ${s.cognome}`;

    await pool.query(
      `INSERT INTO parliament_members
         (country_code, chamber, external_id, first_name, last_name, full_name,
          group_id, official_url, in_office)
       VALUES ('it', 'upper', $1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
         first_name = $2, last_name = $3, full_name = $4, group_id = $5,
         official_url = $6, in_office = true, updated_at = now()`,
      [externalId, s.nome, s.cognome, fullName, groupId, s.senatore]
    );
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------
// 3. Votes — liste des votes récents, puis positions individuelles par
//    sénateur (favorevole/contrario/astenuto) pour chacun.
// ---------------------------------------------------------------------
export async function ingestItalySenateVotes({ limitVotes = 200 } = {}) {
  const votesQuery = `
PREFIX osr: <http://dati.senato.it/osr/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?votazione ?numero ?oggetto ?esito ?dataSeduta
       ?presenti ?favorevoli ?contrari ?astenuti
WHERE {
  ?votazione a osr:Votazione.
  ?votazione osr:numero ?numero.
  ?votazione osr:seduta ?seduta.
  ?votazione osr:esito ?esito.
  ?votazione osr:presenti ?presenti.
  ?votazione osr:favorevoli ?favorevoli.
  ?votazione osr:contrari ?contrari.
  ?votazione osr:astenuti ?astenuti.
  OPTIONAL { ?votazione rdfs:label ?oggetto. }
  ?seduta osr:dataSeduta ?dataSeduta.
  ?seduta osr:legislatura ${CURRENT_LEGISLATURE}.
}
ORDER BY DESC(?dataSeduta) DESC(?numero)
LIMIT ${limitVotes}
`;

  const votes = await sparqlQuery(votesQuery);
  let voteCount = 0;

  for (const v of votes) {
    const externalId = idFromUri(v.votazione);
    if (!externalId) continue;

    const voteResult = await pool.query(
      `INSERT INTO parliament_votes
         (country_code, chamber, external_id, question, vote_date, result,
          yes_count, no_count, abstain_count, source_url)
       VALUES ('it', 'upper', $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
         question = $2, vote_date = $3, result = $4, yes_count = $5,
         no_count = $6, abstain_count = $7, source_url = $8, updated_at = now()
       RETURNING id`,
      [
        externalId,
        v.oggetto || `Votazione n. ${v.numero}`,
        (v.dataSeduta || "").slice(0, 10) || null,
        v.esito ? v.esito.charAt(0).toUpperCase() + v.esito.slice(1) : null,
        Number(v.favorevoli) || 0,
        Number(v.contrari) || 0,
        Number(v.astenuti) || 0,
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

    // Trois requêtes simples séparées plutôt qu'une seule avec UNION+BIND :
    // ce dernier motif (SPARQL 1.1) échoue avec une erreur 400 sur cette
    // instance Virtuoso ancienne (v6, repérée dans la documentation du
    // Sénat) — repli sur des motifs basiques déjà validés individuellement.
    const positionQueries = [
      { predicate: "favorevole", position: "yes" },
      { predicate: "contrario", position: "no" },
      { predicate: "astenuto", position: "abstain" },
    ];

    for (const { predicate, position } of positionQueries) {
      const positionQuery = `
PREFIX osr: <http://dati.senato.it/osr/>
SELECT ?senatore WHERE {
  <${v.votazione}> osr:${predicate} ?senatore .
}
`;
      const senators = await sparqlQuery(positionQuery);

      for (const s of senators) {
        const senatorExternalId = idFromUri(s.senatore);
        if (!senatorExternalId) continue;

        const memberResult = await pool.query(
          "SELECT id FROM parliament_members WHERE country_code = 'it' AND chamber = 'upper' AND external_id = $1",
          [senatorExternalId]
        );
        if (memberResult.rows.length === 0) continue;
        const memberId = memberResult.rows[0].id;

        await pool.query(
          `INSERT INTO parliament_member_votes (vote_id, member_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (vote_id, member_id) DO UPDATE SET position = $3`,
          [voteId, memberId, position]
        );
      }
    }
    voteCount++;
  }
  return voteCount;
}

// ---------------------------------------------------------------------
// Point d'entrée réutilisable — même modèle que les scripts US/Espagne.
// ---------------------------------------------------------------------
export async function ingestItalySenate({ limitVotes = 200 } = {}) {
  const memberCount = await ingestItalySenateMembers();
  const voteCount = await ingestItalySenateVotes({ limitVotes });
  return { members: memberCount, votes: voteCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ingestItalySenate()
    .then((result) => {
      console.log(`Terminé : ${result.members} sénateur(s), ${result.votes} vote(s).`);
      return pool.end();
    })
    .catch((err) => {
      console.error("Échec de l'ingestion :", err);
      pool.end().finally(() => process.exit(1));
    });
}
