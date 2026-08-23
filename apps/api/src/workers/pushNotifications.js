import { pool } from "../lib/db.js";
import { buildPushPayload, configureWebPush, EVENT_TOPIC, webpush } from "../lib/pushNotifications.js";
import { COUNTRY_TO_CONTINENT, CONTINENT_TO_COUNTRIES } from "../lib/countryContinents.js";

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 6;

function targetFor(event) {
  if (event.event_type === "deputy_vote_recorded") return { type: "deputy_uid", values: [event.metadata.deputy_uid] };
  if (event.event_type === "parliament_member_vote_recorded") return { type: "member_id", values: [String(event.metadata.member_id)] };
  // Pas de portée = pas de diffusion implicite. WORLD doit être choisi
  // explicitement par la rédaction pour une publication mondiale.
  return { type: "scope_code", values: event.scope_codes || [] };
}

// Complète la liste de portées d'un événement avec la hiérarchie
// géographique implicite, pour qu'un contenu marqué "EUR" atteigne aussi
// les abonnés d'un pays membre (ex. FRA) — et réciproquement, qu'un
// contenu marqué "FRA" atteigne un abonné qui a choisi "EUR" au sens
// large. Le cas WORLD (dans les deux sens) reste géré à part dans la
// requête SQL, il n'a pas de "pays membres" au sens de
// countryContinents.js.
function expandScopeHierarchy(scopeCodes) {
  const expanded = new Set(scopeCodes);
  for (const code of scopeCodes) {
    if (CONTINENT_TO_COUNTRIES[code]) {
      // Portée continent -> ajoute chaque pays membre (un abonné pays
      // matche alors directement).
      for (const country of CONTINENT_TO_COUNTRIES[code]) expanded.add(country);
    } else if (COUNTRY_TO_CONTINENT[code]) {
      // Portée pays -> ajoute son continent (un abonné continent matche
      // alors directement).
      expanded.add(COUNTRY_TO_CONTINENT[code]);
    }
  }
  return [...expanded];
}

async function expandEvent(event) {
  const topic = EVENT_TOPIC[event.event_type];
  const target = targetFor(event);
  if (!topic || target.values.length === 0) {
    await pool.query("UPDATE notification_events SET processed_at=now() WHERE id=$1::bigint", [event.id]);
    return;
  }
  const matchValues = target.type === "scope_code" ? expandScopeHierarchy(target.values) : target.values;
  await pool.query(
    `INSERT INTO push_deliveries (event_id, subscription_id)
     SELECT DISTINCT $1::bigint, p.subscription_id
     FROM push_preferences p
     JOIN push_subscriptions s ON s.id=p.subscription_id
     WHERE p.enabled=true AND s.revoked_at IS NULL
       AND p.topic=$2 AND p.target_type=$3
       AND (
         p.target_value=ANY($4::text[])
         OR ($3='scope_code' AND 'WORLD'=ANY($4::text[]))
         OR ($3='scope_code' AND p.target_value='WORLD')
       )
     ON CONFLICT DO NOTHING`,
    [event.id, topic, target.type, matchValues]
  );
  await pool.query("UPDATE notification_events SET processed_at=now() WHERE id=$1::bigint", [event.id]);
}

async function claimDeliveries() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT d.event_id, d.subscription_id, d.attempts,
              s.endpoint, s.p256dh, s.auth_secret, s.locale,
              e.event_type, e.entity_type, e.entity_id, e.scope_codes, e.metadata
       FROM push_deliveries d
       JOIN push_subscriptions s ON s.id=d.subscription_id
       JOIN notification_events e ON e.id=d.event_id
       WHERE d.status IN ('pending','retry') AND d.next_attempt_at <= now() AND s.revoked_at IS NULL
       ORDER BY d.next_attempt_at, d.event_id
       LIMIT $1 FOR UPDATE OF d SKIP LOCKED`,
      [BATCH_SIZE]
    );
    for (const row of result.rows) {
      await client.query(
        "UPDATE push_deliveries SET status='sending', attempts=attempts+1, updated_at=now() WHERE event_id=$1::bigint AND subscription_id=$2",
        [row.event_id, row.subscription_id]
      );
    }
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function sendDelivery(row) {
  const event = {
    id: row.event_id, event_type: row.event_type, entity_type: row.entity_type,
    entity_id: row.entity_id, scope_codes: row.scope_codes, metadata: row.metadata,
  };
  const payload = await buildPushPayload(event, row.locale);
  if (!payload) {
    await pool.query("UPDATE push_deliveries SET status='skipped', updated_at=now() WHERE event_id=$1::bigint AND subscription_id=$2", [row.event_id, row.subscription_id]);
    return;
  }
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_secret } },
      JSON.stringify(payload),
      { TTL: 86400, urgency: "normal" }
    );
    await pool.query(
      `UPDATE push_deliveries SET status='sent', sent_at=now(), last_error=NULL, updated_at=now()
       WHERE event_id=$1::bigint AND subscription_id=$2`,
      [row.event_id, row.subscription_id]
    );
    await pool.query("UPDATE push_subscriptions SET last_success_at=now() WHERE id=$1", [row.subscription_id]);
  } catch (error) {
    const status = Number(error.statusCode || 0);
    const expired = status === 404 || status === 410;
    const attempts = Number(row.attempts) + 1;
    const terminal = expired || (status >= 400 && status < 500 && status !== 429) || attempts >= MAX_ATTEMPTS;
    const nextDelayMinutes = Math.min(2 ** attempts, 60);
    await pool.query(
      `UPDATE push_deliveries SET status=$3, last_error=$4,
         next_attempt_at=now()+($5 || ' minutes')::interval, updated_at=now()
       WHERE event_id=$1::bigint AND subscription_id=$2`,
      [row.event_id, row.subscription_id, expired ? "expired" : terminal ? "failed" : "retry", String(error.message || "push failed").slice(0, 500), nextDelayMinutes]
    );
    if (expired) await pool.query("UPDATE push_subscriptions SET revoked_at=now() WHERE id=$1", [row.subscription_id]);
  }
}

export async function runPushCycle() {
  const pending = await pool.query(
    "SELECT * FROM notification_events WHERE processed_at IS NULL AND available_at <= now() ORDER BY id LIMIT $1",
    [BATCH_SIZE]
  );
  for (const event of pending.rows) await expandEvent(event);
  const deliveries = await claimDeliveries();
  for (const delivery of deliveries) await sendDelivery(delivery);
  return { events: pending.rowCount, deliveries: deliveries.length };
}

async function main() {
  if (!configureWebPush()) throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT sont requis");
  const once = process.argv.includes("--once");
  do {
    try {
      const result = await runPushCycle();
      if (result.events || result.deliveries) console.log("PUSH_WORKER", JSON.stringify(result));
    } catch (error) {
      console.error("PUSH_WORKER_ERROR", error.message);
    }
    if (!once) await new Promise((resolve) => setTimeout(resolve, 15000));
  } while (!once);
  await pool.end();
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
