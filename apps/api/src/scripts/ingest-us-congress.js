// Ingestion du Congrès des États-Unis (Chambre des représentants + Sénat)
// dans le schéma générique parliament_* (migration 040).
//
// Sources, par nécessité (voir session du 8 août 2026 — le Sénat n'expose
// pas ses votes en JSON via l'API officielle, et l'endpoint dédié de
// GovTrack pour le détail par élu est actuellement hors service) :
//   - Membres (Chambre + Sénat)        : Congress.gov API (officielle)
//   - Votes Chambre + positions        : Congress.gov API (officielle,
//                                         depuis le 118e Congrès / 2023
//                                         seulement — endpoint bêta)
//   - Votes Sénat (liste)              : GovTrack API (/api/v2/vote)
//   - Positions Sénat par élu          : export CSV de la page GovTrack de
//                                         chaque vote (l'endpoint JSON
//                                         vote_voter renvoie une 502
//                                         actuellement) — voir le champ
//                                         "link" renvoyé par /api/v2/vote,
//                                         suffixé de "/export/csv".
//
// Utilisable de deux façons :
//   1. En script autonome : node src/scripts/ingest-us-congress.js [--congress=119] [--session=1] [--limit-votes=N]
//   2. Importé et appelé depuis une route API (ingestUsCongress()), pour le
//      rafraîchissement mensuel programmé — voir routes/parliamentary.js
//      et .github/workflows/refresh-data.yml.

import { pool } from "../lib/db.js";

const CONGRESS_API_BASE = "https://api.congress.gov/v3";
const GOVTRACK_API_BASE = "https://www.govtrack.us/api/v2";

// Reprise automatique sur erreur réseau transitoire (ex. "SocketError:
// other side closed", rencontré le 9 août 2026 en production sur une
// ingestion longue) — sans ça, la moindre coupure ponctuelle oblige à tout
// relancer depuis le début (le script n'a pas de mécanisme de reprise
// partielle, voir commentaire plus bas).
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

// ---------------------------------------------------------------------
// 1. Groupes (partis) — Républicain / Démocrate / Indépendant, communs
//    aux deux chambres. Le nom est stocké en anglais (langue source) ;
//    la traduction dans les 7 autres langues passe par content_translations
//    (voir extension de lib/translations.js à faire séparément).
// ---------------------------------------------------------------------
const PARTY_SLUGS = {
  Republican: { slug: "us-republican", color: "#E81B23" },
  Democratic: { slug: "us-democratic", color: "#232066" },
  Independent: { slug: "us-independent", color: "#6b7280" },
};

async function upsertGroup(partyName) {
  const info = PARTY_SLUGS[partyName] || { slug: `us-${partyName.toLowerCase().replace(/\s+/g, "-")}`, color: "#9ca3af" };
  const result = await pool.query(
    `INSERT INTO parliament_groups (country_code, external_id, slug, name, color)
     VALUES ('us', $1, $2, $3, $4)
     ON CONFLICT (country_code, slug) DO UPDATE SET name = $3, color = $4, updated_at = now()
     RETURNING id`,
    [partyName, info.slug, partyName, info.color]
  );
  return result.rows[0].id;
}

// ---------------------------------------------------------------------
// 2. Membres — un seul appel pour les deux chambres : le paramètre
//    "chamber" de l'API Congress.gov ne filtre pas réellement côté serveur
//    (vérifié le 8 août 2026 : chamber=house et chamber=senate renvoient
//    tous deux le total combiné, 537). On filtre donc nous-mêmes via le
//    champ terms.item[].chamber ("House of Representatives" / "Senate"),
//    fiable celui-là. Pagination par lots de 250 (max de l'API).
// ---------------------------------------------------------------------
async function ingestAllMembers(apiKey) {
  let offset = 0;
  const limit = 250;
  let total = Infinity;
  const counts = { lower: 0, upper: 0 };

  while (offset < total) {
    const url = `${CONGRESS_API_BASE}/member?currentMember=true&limit=${limit}&offset=${offset}&api_key=${apiKey}`;
    const data = await fetchJson(url);
    total = data.pagination?.count ?? data.members.length;

    for (const m of data.members) {
      const latestTerm = m.terms?.item?.[m.terms.item.length - 1];
      const termChamber = latestTerm?.chamber || "";
      const chamber = termChamber === "Senate" ? "upper" : termChamber === "House of Representatives" ? "lower" : null;
      if (!chamber) continue; // délégués/commissaires résidents non votants, hors périmètre pour l'instant

      const groupId = await upsertGroup(m.partyName || "Independent");
      const fullName = (m.name || "").includes(",")
        ? m.name.split(", ").reverse().join(" ")
        : m.name;
      const lastName = (m.name || "").split(",")[0]?.trim() || m.name;
      const firstName = fullName.replace(lastName, "").trim() || fullName;

      await pool.query(
        `INSERT INTO parliament_members
           (country_code, chamber, external_id, first_name, last_name, full_name,
            group_id, state_or_region, photo_url, official_url, in_office)
         VALUES ('us', $1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
           first_name = $3, last_name = $4, full_name = $5, group_id = $6,
           state_or_region = $7, photo_url = $8, official_url = $9,
           in_office = true, updated_at = now()`,
        [
          chamber,
          m.bioguideId,
          firstName,
          lastName,
          fullName,
          groupId,
          m.state || null,
          m.depiction?.imageUrl || null,
          `https://www.congress.gov/member/${m.bioguideId}`,
        ]
      );
      counts[chamber]++;
    }
    offset += limit;
  }
  return counts;
}

// ---------------------------------------------------------------------
// 3. Votes + positions — Chambre (Congress.gov)
// ---------------------------------------------------------------------
async function ingestHouseVotes(apiKey, congress, session, limitVotes) {
  let offset = 0;
  const limit = 250;
  let total = Infinity;
  let voteCount = 0;

  while (offset < total) {
    const listUrl = `${CONGRESS_API_BASE}/house-vote/${congress}/${session}?limit=${limit}&offset=${offset}&api_key=${apiKey}`;
    const listData = await fetchJson(listUrl);
    total = listData.pagination?.count ?? listData.houseRollCallVotes.length;

    for (const v of listData.houseRollCallVotes) {
      if (voteCount >= limitVotes) break;
      const question = v.legislationNumber
        ? `${v.legislationType} ${v.legislationNumber}`
        : `Vote ${v.rollCallNumber}`;

      const voteResult = await pool.query(
        `INSERT INTO parliament_votes
           (country_code, chamber, external_id, question, bill_number, vote_date,
            result, source_url)
         VALUES ('us', 'lower', $1, $2, $3, $4, $5, $6)
         ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
           question = $2, bill_number = $3, vote_date = $4, result = $5,
           source_url = $6, updated_at = now()
         RETURNING id`,
        [
          // Le rollCallNumber recommence à 1 à chaque nouvelle session — sans
          // le préfixer par la session, un vote de la session 2 écrase celui
          // de la session 1 partageant le même numéro (bug découvert le 9
          // août 2026 : les votes de novembre-décembre 2025 disparaissaient
          // après ingestion de la session 2).
          `${session}-${v.rollCallNumber}`,
          question,
          v.legislationNumber || null,
          v.startDate ? v.startDate.slice(0, 10) : null,
          v.result || null,
          v.sourceDataURL || null,
        ]
      );
      const voteId = voteResult.rows[0].id;

      // Si ce vote a déjà ses positions individuelles enregistrées (un
      // passage précédent l'a déjà entièrement traité), on saute l'appel
      // détaillé — coûteux (un appel API par vote) et inutile de le
      // refaire à chaque rafraîchissement mensuel pour des scrutins déjà
      // connus, dont les résultats ne changent jamais rétroactivement.
      const alreadyDetailed = await pool.query(
        "SELECT 1 FROM parliament_member_votes WHERE vote_id = $1 LIMIT 1",
        [voteId]
      );
      if (alreadyDetailed.rows.length > 0) {
        voteCount++;
        continue;
      }

      // Détail des positions par élu — endpoint séparé, un appel par vote.
      const detailUrl = `${CONGRESS_API_BASE}/house-vote/${congress}/${session}/${v.rollCallNumber}/members?limit=500&api_key=${apiKey}`;
      const detailData = await fetchJson(detailUrl);
      const members = detailData.houseRollCallVoteMemberVotes?.results || detailData.results || [];

      let yes = 0, no = 0, abstain = 0, notVoting = 0;
      for (const mv of members) {
        const memberResult = await pool.query(
          "SELECT id FROM parliament_members WHERE country_code = 'us' AND chamber = 'lower' AND external_id = $1",
          [mv.bioguideID]
        );
        if (memberResult.rows.length === 0) continue; // élu non actif / non importé
        const memberId = memberResult.rows[0].id;

        const position = { Yea: "yes", Nay: "no", "Present": "abstain", "Not Voting": "not_voting" }[mv.voteCast] || "not_voting";
        if (position === "yes") yes++;
        else if (position === "no") no++;
        else if (position === "abstain") abstain++;
        else notVoting++;

        await pool.query(
          `INSERT INTO parliament_member_votes (vote_id, member_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (vote_id, member_id) DO UPDATE SET position = $3`,
          [voteId, memberId, position]
        );
      }
      await pool.query(
        "UPDATE parliament_votes SET yes_count = $1, no_count = $2, abstain_count = $3, not_voting_count = $4 WHERE id = $5",
        [yes, no, abstain, notVoting, voteId]
      );
      voteCount++;
    }
    offset += limit;
    if (voteCount >= limitVotes) break;
  }
  return voteCount;
}

// ---------------------------------------------------------------------
// 4. Votes + positions — Sénat (GovTrack, liste JSON + export CSV par vote)
// ---------------------------------------------------------------------
// Congress.gov renvoie le nom complet de l'État ("California"), tandis que
// l'export CSV de GovTrack utilise l'abréviation postale ("CA") — sans
// cette conversion, la comparaison state_or_region ne correspond jamais et
// aucun sénateur n'est retrouvé (bug découvert le 8 août 2026 : 0 position
// importée côté Sénat malgré un CSV correctement analysé).
const STATE_ABBR_TO_NAME = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function splitCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text) {
  // Le fichier commence par une ligne de titre libre, puis l'en-tête CSV
  // réel à la 2e ligne — on saute la 1re. Découpage caractère par
  // caractère (pas une regex) : nécessaire car la colonne "district" est
  // systématiquement vide pour le Sénat (pas de circonscription), et une
  // regex simple désaligne tous les champs suivants sur un champ vide.
  const lines = text.trim().split("\n").slice(1);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h.trim()] = (values[i] || "").replace(/^"|"$/g, "");
    });
    return row;
  });
}

async function ingestSenateVotes(congress, limitVotes) {
  let offset = 0;
  const limit = 100;
  let total = Infinity;
  let voteCount = 0;

  while (offset < total) {
    const listUrl = `${GOVTRACK_API_BASE}/vote?congress=${congress}&chamber=senate&limit=${limit}&offset=${offset}`;
    const listData = await fetchJson(listUrl);
    total = listData.meta?.total_count ?? listData.objects.length;

    for (const v of listData.objects) {
      if (voteCount >= limitVotes) break;
      if (!v.link) continue;
      const numberMatch = v.link.match(/\/s(\d+)$/);
      if (!numberMatch) continue;
      const number = numberMatch[1];

      const voteResult = await pool.query(
        `INSERT INTO parliament_votes
           (country_code, chamber, external_id, question, bill_number, vote_date,
            result, yes_count, no_count, abstain_count, not_voting_count, source_url)
         VALUES ('us', 'upper', $1, $2, $3, $4, $5, $6, $7, 0, 0, $8)
         ON CONFLICT (country_code, chamber, external_id) DO UPDATE SET
           question = $2, bill_number = $3, vote_date = $4, result = $5,
           yes_count = $6, no_count = $7, source_url = $8, updated_at = now()
         RETURNING id`,
        [
          number,
          v.question || `Vote ${number}`,
          v.related_bill?.display_number || null,
          v.created ? v.created.slice(0, 10) : null,
          v.passed === true ? "Passed" : v.passed === false ? "Failed" : null,
          v.total_plus || 0,
          v.total_minus || 0,
          v.link,
        ]
      );
      const voteId = voteResult.rows[0].id;

      // Même principe que côté Chambre : on saute l'export CSV (un
      // téléchargement par vote) si ce scrutin est déjà entièrement
      // détaillé depuis un passage précédent.
      const alreadyDetailed = await pool.query(
        "SELECT 1 FROM parliament_member_votes WHERE vote_id = $1 LIMIT 1",
        [voteId]
      );
      if (alreadyDetailed.rows.length > 0) {
        voteCount++;
        continue;
      }

      // Positions individuelles — export CSV de la page du vote (l'endpoint
      // JSON vote_voter est actuellement hors service côté GovTrack).
      const csvText = await fetchText(`${v.link}/export/csv`);
      const rows = parseCsv(csvText);

      let abstain = 0, notVoting = 0;
      for (const row of rows) {
        // Les membres sont identifiés par un ID GovTrack interne ("person"),
        // pas par le bioguideId de Congress.gov — pas de correspondance
        // directe et fiable disponible ici. On rattache donc par nom+état,
        // fragile mais suffisant en pratique (peu d'homonymes au Sénat, 100
        // sièges). Un futur raffinement possible : importer aussi le
        // bioguideId via congress-legislators (GitHub) pour un lien exact.
        const cleanName = (row.name || "").replace(/^Sen\.\s*/, "").replace(/\s*\[.*?\]$/, "").trim();
        const lastName = cleanName.split(" ").pop();

        const memberResult = await pool.query(
          `SELECT id FROM parliament_members
           WHERE country_code = 'us' AND chamber = 'upper'
             AND state_or_region = $1 AND last_name ILIKE $2
           LIMIT 1`,
          [STATE_ABBR_TO_NAME[row.state] || row.state, `%${lastName}%`]
        );
        if (memberResult.rows.length === 0) continue;
        const memberId = memberResult.rows[0].id;

        const position = { Yea: "yes", Nay: "no", Present: "abstain", "Not Voting": "not_voting" }[row.vote] || "not_voting";
        if (position === "abstain") abstain++;
        else if (position === "not_voting") notVoting++;

        await pool.query(
          `INSERT INTO parliament_member_votes (vote_id, member_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (vote_id, member_id) DO UPDATE SET position = $3`,
          [voteId, memberId, position]
        );
      }
      await pool.query(
        "UPDATE parliament_votes SET abstain_count = $1, not_voting_count = $2 WHERE id = $3",
        [abstain, notVoting, voteId]
      );
      voteCount++;
    }
    offset += limit;
    if (voteCount >= limitVotes) break;
  }
  return voteCount;
}

// ---------------------------------------------------------------------
// Point d'entrée réutilisable — appelé par la route API pour le
// rafraîchissement mensuel programmé. La clé API est vérifiée ici (pas au
// chargement du module) pour ne pas faire planter le serveur entier au
// démarrage si elle manquait — seule cette route échouerait, proprement.
// ---------------------------------------------------------------------
export async function ingestUsCongress({ congress = 119, sessions = [1, 2], limitVotes = Infinity } = {}) {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("CONGRESS_GOV_API_KEY manquante dans l'environnement.");
  }

  const memberCounts = await ingestAllMembers(apiKey);

  // Un Congrès couvre toujours deux années civiles (session 1 = première
  // année du mandat, session 2 = seconde) — se limiter à la session 1
  // manquait tous les votes de l'année en cours dès que celle-ci
  // correspondait à la session 2 (bug découvert le 9 août 2026 : plus aucun
  // vote de la Chambre après le 16 décembre 2025 en production).
  let houseVoteCount = 0;
  for (const session of sessions) {
    houseVoteCount += await ingestHouseVotes(apiKey, congress, session, limitVotes);
  }

  const senateVoteCount = await ingestSenateVotes(congress, limitVotes);

  return {
    membersHouse: memberCounts.lower,
    membersSenate: memberCounts.upper,
    houseVotes: houseVoteCount,
    senateVotes: senateVoteCount,
  };
}

// ---------------------------------------------------------------------
// Usage en script autonome (inchangé) : node src/scripts/ingest-us-congress.js
// ---------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? true];
    })
  );
  const cliCongress = Number(args.congress || 119);
  const cliSessions = args.session ? [Number(args.session)] : [1, 2];
  const cliLimitVotes = args["limit-votes"] ? Number(args["limit-votes"]) : Infinity;

  console.log(`Ingestion Congrès US — ${cliCongress}e Congrès, session(s) ${cliSessions.join(", ")}`);
  if (cliLimitVotes !== Infinity) {
    console.log(`Mode test : limité à ${cliLimitVotes} votes par chambre.`);
  }

  ingestUsCongress({ congress: cliCongress, sessions: cliSessions, limitVotes: cliLimitVotes })
    .then((result) => {
      console.log(
        `Membres Chambre : ${result.membersHouse} — Sénat : ${result.membersSenate} importés/mis à jour.`
      );
      console.log(`Votes Chambre : ${result.houseVotes} importés/mis à jour.`);
      console.log(`Votes Sénat : ${result.senateVotes} importés/mis à jour.`);
      console.log("Terminé.");
    })
    .catch((err) => {
      console.error("Erreur d'ingestion :", err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
