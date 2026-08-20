import crypto from "node:crypto";
import webpush from "web-push";
import { pool } from "./db.js";
import { isValidScopeCode } from "./scopeCodes.js";

export const PUSH_LOCALES = ["fr", "en", "es", "it", "ru", "ja", "zh", "hi"];
export const PUSH_TOPICS = ["petition", "deputy_vote", "parliament_member_vote", "paysan", "debunk", "future_idea"];

const EVENT_TOPIC = {
  petition_published: "petition",
  paysan_published: "paysan",
  debunk_published: "debunk",
  future_idea_published: "future_idea",
  deputy_vote_recorded: "deputy_vote",
  parliament_member_vote_recorded: "parliament_member_vote",
};

const LABELS = {
  en: { petition: "New petition", paysan: "New article — We can all become farmers", debunk: "New fact-check", future_idea: "New idea for the future", deputy_vote: "New vote by a representative you follow", parliament_member_vote: "New vote by a representative you follow" },
  fr: { petition: "Nouvelle pétition", paysan: "Nouvel article — On devient tous paysans", debunk: "Nouveau débunk", future_idea: "Nouvelle idée pour le futur", deputy_vote: "Nouveau vote d’un député suivi", parliament_member_vote: "Nouveau vote d’un élu suivi" },
  es: { petition: "Nueva petición", paysan: "Nuevo artículo — Todos podemos ser campesinos", debunk: "Nueva verificación", future_idea: "Nueva idea para el futuro", deputy_vote: "Nueva votación de un representante seguido", parliament_member_vote: "Nueva votación de un representante seguido" },
  it: { petition: "Nuova petizione", paysan: "Nuovo articolo — Diventiamo tutti agricoltori", debunk: "Nuova verifica", future_idea: "Nuova idea per il futuro", deputy_vote: "Nuovo voto di un rappresentante seguito", parliament_member_vote: "Nuovo voto di un rappresentante seguito" },
  ru: { petition: "Новая петиция", paysan: "Новая статья об устойчивом сельском хозяйстве", debunk: "Новая проверка фактов", future_idea: "Новая идея для будущего", deputy_vote: "Новое голосование отслеживаемого депутата", parliament_member_vote: "Новое голосование отслеживаемого депутата" },
  ja: { petition: "新しい請願", paysan: "持続可能な農業の新着記事", debunk: "新しいファクトチェック", future_idea: "未来のための新しいアイデア", deputy_vote: "フォロー中の議員の新しい投票", parliament_member_vote: "フォロー中の議員の新しい投票" },
  zh: { petition: "新请愿", paysan: "可持续农业新文章", debunk: "新事实核查", future_idea: "面向未来的新想法", deputy_vote: "您关注的议员有新投票", parliament_member_vote: "您关注的议员有新投票" },
  hi: { petition: "नई याचिका", paysan: "सतत खेती पर नया लेख", debunk: "नई तथ्य-जाँच", future_idea: "भविष्य के लिए नया विचार", deputy_vote: "आपके द्वारा फ़ॉलो किए गए प्रतिनिधि का नया मतदान", parliament_member_vote: "आपके द्वारा फ़ॉलो किए गए प्रतिनिधि का नया मतदान" },
};

export function normalizePushLocale(value) {
  const locale = typeof value === "string" ? value.toLowerCase().split("-")[0] : "";
  return PUSH_LOCALES.includes(locale) ? locale : "en";
}

export function hashManageToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createManageToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function validatePreference(input) {
  if (!input || !PUSH_TOPICS.includes(input.topic)) return null;
  const targetValue = typeof input.targetValue === "string" ? input.targetValue.trim() : "";
  if (input.targetType === "scope_code" && ["petition", "paysan", "debunk", "future_idea"].includes(input.topic)) {
    const upper = targetValue.toUpperCase();
    return isValidScopeCode(upper) ? { topic: input.topic, targetType: "scope_code", targetValue: upper } : null;
  }
  if (input.targetType === "deputy_uid" && input.topic === "deputy_vote" && /^[A-Za-z0-9._:-]{1,100}$/.test(targetValue)) {
    return { topic: input.topic, targetType: "deputy_uid", targetValue };
  }
  if (input.targetType === "member_id" && input.topic === "parliament_member_vote" && /^\d+$/.test(targetValue)) {
    return { topic: input.topic, targetType: "member_id", targetValue };
  }
  return null;
}

export function configureWebPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

function localizedPath(locale, path) {
  const safePath = typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return locale === "fr" ? safePath : `/${locale}${safePath === "/" ? "" : safePath}`;
}

async function editorialContent(event, locale) {
  const source = {
    petition: { table: "petitions", title: "title", path: "/petitions" },
    paysan: { table: "paysan_resources", title: "title", path: `/paysans/${event.entity_id}` },
    debunk: { table: "debunk_entries", title: "myth", path: `/debunk/${event.entity_id}` },
    future_idea: { table: "future_ideas", title: "title", path: "/idees-enfants" },
  }[event.entity_type];
  if (!source) return null;

  // Le contenu source est français. Pour toute autre langue, le repli est
  // explicitement anglais, puis un libellé anglais générique — jamais le français.
  let body;
  if (locale === "fr") {
    const row = await pool.query(`SELECT ${source.title} AS value FROM ${source.table} WHERE slug = $1 AND published = true`, [event.entity_id]);
    body = row.rows[0]?.value;
  } else {
    const translated = await pool.query(
      `SELECT value FROM content_translations
       WHERE content_type = $1 AND content_id = $2 AND field_name = $3
         AND locale = ANY($4::text[])
       ORDER BY array_position($4::text[], locale) LIMIT 1`,
      [event.entity_type, event.entity_id, source.title, [locale, "en"]]
    );
    body = translated.rows[0]?.value;
  }
  return {
    title: (LABELS[locale] || LABELS.en)[EVENT_TOPIC[event.event_type]] || LABELS.en[event.entity_type],
    body: body || LABELS.en[EVENT_TOPIC[event.event_type]] || "New content on Pas de planète B",
    url: localizedPath(locale, source.path),
  };
}

async function voteContent(event, locale) {
  const topic = EVENT_TOPIC[event.event_type];
  const metadata = event.metadata || {};
  return {
    title: (LABELS[locale] || LABELS.en)[topic],
    body: metadata.title || metadata.member_name || LABELS.en[topic],
    url: localizedPath(locale, metadata.url || "/scrutins"),
  };
}

export async function buildPushPayload(event, localeInput) {
  const locale = normalizePushLocale(localeInput);
  const content = event.event_type.endsWith("_published")
    ? await editorialContent(event, locale)
    : await voteContent(event, locale);
  if (!content) return null;
  return {
    ...content,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `${event.event_type}:${event.entity_id}`,
  };
}

export { webpush, EVENT_TOPIC };
