import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "../lib/useT";
import { useApiFetch } from "../lib/useApiFetch";
import { useCountriesList } from "../lib/useCountriesList";
import { localizedCountryName } from "../lib/countryNames";
import { detectDefaultCountry } from "../lib/detectCountry";
import CountrySelect from "../components/CountrySelect";
import { IconCloud, IconBolt, IconDroplet, IconTree, IconPaw, IconSmog, IconThermometer, IconSearch, IconPlay, IconLandmark, IconScroll, IconCheck, IconScale, IconUsers, IconLeaf, IconHome, IconBulb } from "../components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const VERDICT_COLORS = { faux: "#d63e2a", trompeur: "#f4b400", confirme: "#1baf7a" };

function ObjectionCard({ entry, locale, t }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  function toggle() {
    if (!expanded && !detail && !loadingDetail) {
      setLoadingDetail(true);
      fetch(`${API_URL}/api/debunk/${entry.slug}?locale=${locale}`)
        .then((res) => (res.ok ? res.json() : null))
        .then(setDetail)
        .finally(() => setLoadingDetail(false));
    }
    setExpanded((v) => !v);
  }

  function verdictLabel(verdict) {
    if (verdict === "trompeur") return t("debunk.verdict_trompeur");
    if (verdict === "confirme") return t("debunk.verdict_confirme");
    return t("debunk.verdict_faux");
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        style={{
          width: "100%",
          textAlign: "left",
          background: "var(--color-carte)",
          border: "1px solid var(--color-bordure)",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          marginBottom: 8,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)" }}>« {entry.myth} »</span>
        <span style={{ fontSize: 16, color: "var(--color-texte-clair)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ background: "var(--color-fond)", borderRadius: 12, padding: "1rem 1.25rem", marginTop: 4, marginBottom: 8 }}>
          {loadingDetail && <p style={{ fontSize: 13 }}>{t("common.loading")}</p>}
          {detail?.entry && (
            <>
              <span
                style={{
                  display: "inline-block",
                  background: VERDICT_COLORS[detail.entry.verdict] || VERDICT_COLORS.faux,
                  color: detail.entry.verdict === "trompeur" ? "var(--color-texte)" : "white",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 20,
                  marginBottom: 8,
                }}
              >
                {verdictLabel(detail.entry.verdict).toUpperCase()}
              </span>
              <p style={{ fontSize: 13, color: "var(--color-texte)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: "8px 0" }}>
                {detail.entry.reality}
              </p>
              {detail.sources?.length > 0 && (
                <p style={{ margin: 0 }}>
                  <a href={detail.sources[0].url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--color-forest)" }}>
                    {t("decouverte.objections_see_sources")} ↗
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// --- Section 3 : calcul des 7 métriques à partir de
// /api/country-summary-latest — version allégée (une valeur par thème, pas
// l'historique complet) créée spécifiquement pour cette page, voir
// environmentalData.js. Chaque fonction renvoie une valeur numérique ou
// null si la donnée manque pour ce pays — la carte correspondante se
// masque simplement dans ce cas.

function computeCo2(s) {
  return s.co2?.emissions_per_capita ?? null;
}
function computeEnergie(s) {
  return s.electricity?.demand_per_capita_kwh ?? null;
}
function computeEau(s) {
  if (!s.water?.withdrawal_m3 || !s.co2?.population) return null;
  return s.water.withdrawal_m3 / s.co2.population;
}
function computeVegetation(s) {
  if (!s.vegetation?.tree_cover_loss_ha || !s.vegetation?.forest_area_ha) return null;
  return (s.vegetation.tree_cover_loss_ha / s.vegetation.forest_area_ha) * 100;
}
function computeEspeces(s) {
  if (!s.speciesThreatened) return null;
  const total = (s.speciesThreatened.mammals_threatened || 0) + (s.speciesThreatened.birds_threatened || 0) + (s.speciesThreatened.fish_threatened || 0);
  return total > 0 ? total : null;
}
function computePollution(s) {
  return s.pollution?.pm25_ug_m3 ?? null;
}
function computeTemperature(s) {
  return s.temperatures?.deviation_from_reference_c ?? null;
}

const THEMES = [
  { key: "co2", Icon: IconCloud, tint: "#378ADD", compute: computeCo2, unit: "t", decimals: 1, page: "/co2" },
  { key: "energie", Icon: IconBolt, tint: "#EF9F27", compute: computeEnergie, unit: "kWh", decimals: 0, page: "/energie" },
  { key: "eau", Icon: IconDroplet, tint: "#378ADD", compute: computeEau, unit: "m³", decimals: 0, page: "/eau" },
  { key: "vegetation", Icon: IconTree, tint: "#639922", compute: computeVegetation, unit: "%", decimals: 2, page: "/vegetation" },
  { key: "especes", Icon: IconPaw, tint: "#D85A30", compute: computeEspeces, unit: "", decimals: 0, page: "/especes" },
  { key: "pollution", Icon: IconSmog, tint: "#D85A30", compute: computePollution, unit: "µg/m³", decimals: 1, page: "/pollution" },
  { key: "temperatures", Icon: IconThermometer, tint: "#D85A30", compute: computeTemperature, unit: "°C", decimals: 2, isDeviation: true, page: "/temperatures" },
];

function formatValue(value, decimals) {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ComparisonCard({ theme, nameA, nameB, valueA, valueB, t }) {
  if (valueA === null && valueB === null) return null;

  if (theme.isDeviation) {
    return (
      <div style={{ background: "var(--color-carte)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <theme.Icon size={16} style={{ color: theme.tint }} />
          <span style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>{t(`decouverte.theme_${theme.key}`)}</span>
          <Link href={theme.page} prefetch={false} style={{ fontSize: 11, color: "var(--color-texte-clair)", textDecoration: "none" }} title={t("decouverte.theme_source_title")}>
            ⓘ
          </Link>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>{nameA}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>
              {valueA !== null ? `${valueA > 0 ? "+" : ""}${formatValue(valueA, theme.decimals)}${theme.unit}` : "—"}
            </div>
          </div>
          {nameB && (
            <div>
              <div style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>{nameB}</div>
              <div style={{ fontSize: 22, fontWeight: 500 }}>
                {valueB !== null ? `${valueB > 0 ? "+" : ""}${formatValue(valueB, theme.decimals)}${theme.unit}` : "—"}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const max = Math.max(valueA || 0, valueB || 0) || 1;
  const ratio = valueA && valueB ? (Math.max(valueA, valueB) / Math.min(valueA, valueB)).toFixed(1) : null;
  const higherName = valueA >= valueB ? nameA : nameB;
  const lowerName = valueA >= valueB ? nameB : nameA;

  return (
    <div style={{ background: "var(--color-carte)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <theme.Icon size={16} style={{ color: theme.tint }} />
        <span style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>{t(`decouverte.theme_${theme.key}`)}</span>
        <Link href={theme.page} prefetch={false} style={{ fontSize: 11, color: "var(--color-texte-clair)", textDecoration: "none" }} title={t("decouverte.theme_source_title")}>
          ⓘ
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--color-texte-clair)", width: 90, flexShrink: 0 }}>{nameA}</span>
        <div
          style={{
            flex: 1,
            height: 18,
            borderRadius: 4,
            background:
              valueA !== null
                ? `linear-gradient(to right, #1b5e20 ${(valueA / max) * 100}%, var(--color-fond) ${(valueA / max) * 100}%)`
                : "var(--color-fond)",
          }}
        />
        <span style={{ fontSize: 12, width: 65, textAlign: "right", flexShrink: 0 }}>
          {valueA !== null ? `${formatValue(valueA, theme.decimals)} ${theme.unit}` : "—"}
        </span>
      </div>
      {nameB && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "var(--color-texte-clair)", width: 90, flexShrink: 0 }}>{nameB}</span>
          <div
            style={{
              flex: 1,
              height: 18,
              borderRadius: 4,
              background:
                valueB !== null
                  ? `linear-gradient(to right, #639922 ${(valueB / max) * 100}%, var(--color-fond) ${(valueB / max) * 100}%)`
                  : "var(--color-fond)",
            }}
          />
          <span style={{ fontSize: 12, width: 65, textAlign: "right", flexShrink: 0 }}>
            {valueB !== null ? `${formatValue(valueB, theme.decimals)} ${theme.unit}` : "—"}
          </span>
        </div>
      )}

      {ratio && ratio !== "1.0" && (
        <p style={{ fontSize: 13, color: "var(--color-texte)", margin: "4px 0 0" }}>
          {t(`decouverte.theme_${theme.key}_note`, { more: higherName, less: lowerName, ratio })}
        </p>
      )}
      {theme.key === "especes" && (
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "6px 0 0" }}>{t("decouverte.especes_caveat")}</p>
      )}
    </div>
  );
}


// novice/sceptique plutôt que pour quelqu'un déjà sensibilisé au climat.
// Voir TODO.md, point 7, pour le contexte de ce chantier.
//
// Construite section par section (voir les commentaires ci-dessous) plutôt
// que d'un bloc — chaque section est testée et livrée séparément.
// Profilage guidé "Et maintenant ?" — remplace l'ancienne liste statique
// d'actions (identique pour tout le monde) par un petit parcours de
// questions débouchant sur une action personnalisée. Les questions
// conditionnelles (localisation, jardin, statut locatif) ne sont posées
// que si elles concernent vraiment le domaine choisi — objectif : jamais
// plus de questions que nécessaire (2 pour Alimentation/Consommation, 3
// pour Déplacements, 4 pour Logement).
const PROFILING_DOMAINS = ["deplacements", "alimentation", "logement", "consommation"];
const PROFILING_EFFORTS = ["petit", "changement", "projet"];

function resolveProfilingAction(domain, location, garden, ownership, effort) {
  if (domain === "deplacements") return `deplacements_${location}_${effort}`;
  if (domain === "alimentation") return `alimentation_${effort}`;
  if (domain === "consommation") return `consommation_${effort}`;
  if (domain === "logement") {
    if (effort === "petit") return "logement_petit";
    if (effort === "changement") return `logement_changement_${garden === "oui" ? "jardin" : "sansjardin"}`;
    return `logement_projet_${ownership}`;
  }
  return null;
}

function OptionButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "10px 14px",
        background: "var(--color-carte)",
        border: "1px solid var(--color-bordure)",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 14,
        color: "var(--color-texte)",
        marginBottom: 6,
        width: "100%",
      }}
    >
      {children}
    </button>
  );
}

function ProfilingQuiz({ t }) {
  const [domain, setDomain] = useState(null);
  const [location, setLocation] = useState(null);
  const [garden, setGarden] = useState(null);
  const [ownership, setOwnership] = useState(null);
  const [effort, setEffort] = useState(null);

  const conditionalDone =
    domain === "alimentation" || domain === "consommation"
      ? true
      : domain === "deplacements"
        ? location !== null
        : domain === "logement"
          ? garden !== null && ownership !== null
          : false;

  let phase = "domain";
  if (domain && !conditionalDone) {
    if (domain === "deplacements") phase = "location";
    else if (domain === "logement") phase = garden === null ? "garden" : "ownership";
  } else if (domain && conditionalDone && !effort) {
    phase = "effort";
  } else if (domain && conditionalDone && effort) {
    phase = "result";
  }

  function goBack() {
    if (phase === "location" || phase === "garden") setDomain(null);
    else if (phase === "ownership") setGarden(null);
    else if (phase === "effort") {
      if (domain === "deplacements") setLocation(null);
      else if (domain === "logement") setOwnership(null);
      else setDomain(null);
    } else if (phase === "result") setEffort(null);
  }

  function reset() {
    setDomain(null);
    setLocation(null);
    setGarden(null);
    setOwnership(null);
    setEffort(null);
  }

  const backLink = phase !== "domain" && (
    <button
      type="button"
      onClick={goBack}
      style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--color-texte-clair)", cursor: "pointer", marginBottom: 8 }}
    >
      {t("decouverte.profiling_back")}
    </button>
  );

  if (phase === "domain") {
    return (
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", marginBottom: 10 }}>{t("decouverte.profiling_q_domain")}</p>
        {PROFILING_DOMAINS.map((d) => (
          <OptionButton key={d} onClick={() => setDomain(d)}>
            {t(`decouverte.profiling_domain_${d}`)}
          </OptionButton>
        ))}
      </div>
    );
  }

  if (phase === "location") {
    return (
      <div>
        {backLink}
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", marginBottom: 10 }}>{t("decouverte.profiling_q_location")}</p>
        <OptionButton onClick={() => setLocation("ville")}>{t("decouverte.profiling_location_ville")}</OptionButton>
        <OptionButton onClick={() => setLocation("campagne")}>{t("decouverte.profiling_location_campagne")}</OptionButton>
      </div>
    );
  }

  if (phase === "garden") {
    return (
      <div>
        {backLink}
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", marginBottom: 10 }}>{t("decouverte.profiling_q_garden")}</p>
        <OptionButton onClick={() => setGarden("oui")}>{t("decouverte.profiling_garden_oui")}</OptionButton>
        <OptionButton onClick={() => setGarden("non")}>{t("decouverte.profiling_garden_non")}</OptionButton>
      </div>
    );
  }

  if (phase === "ownership") {
    return (
      <div>
        {backLink}
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", marginBottom: 10 }}>{t("decouverte.profiling_q_ownership")}</p>
        <OptionButton onClick={() => setOwnership("locataire")}>{t("decouverte.profiling_ownership_locataire")}</OptionButton>
        <OptionButton onClick={() => setOwnership("proprietaire")}>{t("decouverte.profiling_ownership_proprietaire")}</OptionButton>
      </div>
    );
  }

  if (phase === "effort") {
    return (
      <div>
        {backLink}
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", marginBottom: 10 }}>{t("decouverte.profiling_q_effort")}</p>
        {PROFILING_EFFORTS.map((e) => (
          <OptionButton key={e} onClick={() => setEffort(e)}>
            {t(`decouverte.profiling_effort_${e}`)}
          </OptionButton>
        ))}
      </div>
    );
  }

  // phase === "result"
  const actionKey = resolveProfilingAction(domain, location, garden, ownership, effort);
  return (
    <div>
      {backLink}
      <div style={{ background: "var(--color-carte-verte, #eaf3de)", borderRadius: 12, padding: "1.25rem" }}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("decouverte.profiling_result_title")}</p>
        <p style={{ fontSize: 15, color: "var(--color-texte)", margin: 0, lineHeight: 1.6 }}>{t(`decouverte.profiling_action_${actionKey}`)}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        style={{ marginTop: 10, background: "none", border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "var(--color-texte)" }}
      >
        {t("decouverte.profiling_reset")}
      </button>
    </div>
  );
}

const ENGAGER_TINTS = {
  teal: { bg: "#dcf2ee", color: "#0f6e56" },
  mauve: { bg: "#ece5f2", color: "#5c3d7a" },
  green: { bg: "#eaf3de", color: "#1b5e20" },
  blue: { bg: "#e3eef7", color: "#0b3c5d" },
};
const ENGAGER_CARDS = [
  { href: "/debunk", Icon: IconSearch, labelKey: "home.card_debunk_label", descKey: "home.card_debunk_desc", tint: "teal" },
  { href: "/interviews", Icon: IconPlay, labelKey: "home.card_interviews_label", descKey: "home.card_interviews_desc", tint: "mauve" },
  { href: "/paysans", Icon: IconTree, labelKey: "home.card_paysans_label", descKey: "home.card_paysans_desc", tint: "green" },
  { href: "/ressources", Icon: IconLandmark, labelKey: "home.card_ressources_label", descKey: "home.card_ressources_desc", tint: "blue" },
  { href: "/petitions", Icon: IconScroll, labelKey: "home.card_petitions_label", descKey: "home.card_petitions_desc", tint: "mauve" },
  { href: "/idees-enfants", Icon: IconCheck, labelKey: "home.card_futureideas_label", descKey: "home.card_futureideas_desc", tint: "blue" },
];

function EngagerCard({ href, Icon, label, desc, tint }) {
  const colors = ENGAGER_TINTS[tint] || ENGAGER_TINTS.green;
  return (
    <Link href={href} prefetch={false} style={{ display: "block", textDecoration: "none", color: "var(--color-texte)", background: "var(--color-carte)", border: "1px solid var(--color-bordure)", borderRadius: "var(--radius)", padding: "1rem" }}>
      <Icon
        size={18}
        style={{ display: "block", boxSizing: "border-box", padding: 9, borderRadius: 10, background: colors.bg, color: colors.color, marginBottom: 8 }}
      />
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>{desc}</p>
    </Link>
  );
}

// Classement du plus au moins polluant (rank 1 = le plus). Chiffres vérifiés
// et sourcés — voir la discussion en amont : le streaming n'a volontairement
// pas de chiffre unique (aucun consensus entre études, écarts jusqu'à x200),
// seul l'ordre de grandeur relatif aux autres postes est mis en avant, ce
// qui reste vrai quelle que soit l'étude retenue.
// Extrait l'ID d'une URL YouTube (formats watch?v=... ou youtu.be/...) —
// pas de dépendance externe pour un besoin aussi simple.
function extractYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? match[1] : null;
}

const RANKING_ITEMS = [
  { key: "avion", rank: 1 },
  { key: "voiture", rank: 2 },
  { key: "boeuf", rank: 3 },
  { key: "streaming", rank: 4 },
];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function RankingQuiz({ t }) {
  const [shuffled] = useState(() => shuffle(RANKING_ITEMS));
  const [userOrder, setUserOrder] = useState([]);
  const [revealed, setRevealed] = useState(false);

  function pick(item) {
    if (revealed || userOrder.includes(item.key)) return;
    const next = [...userOrder, item.key];
    setUserOrder(next);
    if (next.length === RANKING_ITEMS.length) setRevealed(true);
  }

  function unpick(key) {
    setUserOrder((prev) => prev.filter((k) => k !== key));
  }

  function reset() {
    setUserOrder([]);
    setRevealed(false);
  }

  const remaining = shuffled.filter((item) => !userOrder.includes(item.key));

  return (
    <div>
      {!revealed && (
        <>
          <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: 10 }}>
            {t("decouverte.ranking_intro")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: userOrder.length ? 16 : 0 }}>
            {remaining.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => pick(item)}
                style={{
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: "var(--color-carte)",
                  border: "1px solid var(--color-bordure)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--color-texte)",
                }}
              >
                {t(`decouverte.ranking_item_${item.key}`)}
              </button>
            ))}
          </div>
          {userOrder.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>
                {t("decouverte.ranking_your_order")}
              </p>
              {userOrder.map((key, i) => {
                const item = RANKING_ITEMS.find((r) => r.key === key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => unpick(key)}
                    title={t("decouverte.ranking_undo_hint")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 14px",
                      fontSize: 13,
                      color: "var(--color-texte-clair)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{i + 1}</span>
                    {t(`decouverte.ranking_item_${item.key}`)}
                    <span style={{ marginLeft: "auto", fontSize: 12 }}>✕</span>
                  </button>
                );
              })}
            </>
          )}
        </>
      )}

      {revealed && (
        <>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", marginBottom: 10 }}>
            {t("decouverte.ranking_correct_order")}
          </p>
          {RANKING_ITEMS.slice()
            .sort((a, b) => a.rank - b.rank)
            .map((item) => {
              const userPosition = userOrder.indexOf(item.key) + 1;
              const wasCorrect = userPosition === item.rank;
              return (
                <div
                  key={item.key}
                  style={{
                    background: "var(--color-carte)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.rank}</span>
                    <span style={{ fontSize: 14, flex: 1, color: "var(--color-texte)" }}>{t(`decouverte.ranking_item_${item.key}`)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-texte)" }}>{t(`decouverte.ranking_value_${item.key}`)}</span>
                    <span style={{ fontSize: 13 }}>{wasCorrect ? "✓" : "—"}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: "6px 0 0" }}>
                    {t(`decouverte.ranking_source_${item.key}`)}
                  </p>
                </div>
              );
            })}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 8, background: "none", border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "var(--color-texte)" }}
          >
            {t("decouverte.ranking_reset")}
          </button>
        </>
      )}
    </div>
  );
}

const TOTAL_SECTIONS = 8;

// Ordre des id de <section> sur la page — sert à la fois à la jauge de
// progression (IntersectionObserver ci-dessous) et implicitement au
// numéro affiché par chaque SectionDivider.
const SECTION_IDS = ["accroche", "explication", "objections", "comparaisons", "quiz", "gains", "profilage", "plus-loin"];

function SectionProgressBar({ activeSection }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: "var(--color-fond)",
        borderBottom: "1px solid var(--color-bordure)",
        padding: "10px 0",
      }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 1.5rem", display: "flex", gap: 4 }}>
        {Array.from({ length: TOTAL_SECTIONS }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: n <= activeSection ? "var(--color-forest)" : "var(--color-bordure)",
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SectionDivider({ Icon, index, t }) {
  return (
    <div style={{ margin: "3rem 0 1.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 2, background: "var(--color-forest)", opacity: 0.35 }} />
        <span style={{ fontSize: 18, color: "var(--color-forest)", lineHeight: 1 }}>⌄</span>
        <div style={{ flex: 1, height: 2, background: "var(--color-forest)", opacity: 0.35 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={20} style={{ color: "var(--color-forest)" }} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-forest)" }}>
          {t("decouverte.section_progress", { current: index, total: TOTAL_SECTIONS })}
        </span>
      </div>
    </div>
  );
}

export default function DecouvertePage() {
  const { t, locale } = useT();

  // Jauge de progression (rubrique 1 à 8) — un IntersectionObserver plutôt
  // qu'un scroll listener classique, plus performant (pas de calcul à
  // chaque pixel défilé). La bande d'observation est réduite à une fine
  // ligne proche du haut de l'écran (rootMargin), donc une rubrique
  // "active" est celle qui vient de croiser cette ligne en défilant.
  const [activeSection, setActiveSection] = useState(1);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = SECTION_IDS.indexOf(entry.target.id);
            if (idx !== -1) setActiveSection(idx + 1);
          }
        });
      },
      { rootMargin: "-15% 0px -80% 0px" }
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const countries = useCountriesList("/api/co2/countries");
  const [countryA, setCountryA] = useState("FRA");
  const [countryADetected, setCountryADetected] = useState(false);
  const [countryB, setCountryB] = useState("USA");
  useEffect(() => {
    setCountryA(detectDefaultCountry());
    setCountryADetected(true);
  }, []);

  // N'attend pas seulement le montage pour lancer l'appel : attend que la
  // détection du pays (countryADetected) soit terminée. Sans ça, un
  // premier appel partait toujours avec "FRA" par défaut, puis un second
  // dès que la vraie détection corrigeait la valeur — un double appel pour
  // n'importe quel visiteur dont le pays détecté n'est pas la France, pas
  // seulement pour le robot de mesure EcoIndex (confirmé dans le
  // diagnostic détaillé du 15 août 2026 : countryA=FRA puis countryA=USA).
  const { data: bootstrap } = useApiFetch(
    countryADetected
      ? `/api/decouverte-bootstrap?countryA=${countryA}${countryB ? `&countryB=${countryB}` : ""}&locale=${locale}`
      : null,
    { deps: [countryA, countryB, locale, countryADetected] }
  );
  const worldBenchmarks = bootstrap?.worldBenchmarks ?? null;
  const objections = bootstrap?.objections ?? [];
  const videoId = extractYoutubeId(bootstrap?.videoUrl);
  const [videoOpen, setVideoOpen] = useState(false);
  const summaryA = bootstrap?.summaryA ?? null;
  const summaryB = bootstrap?.summaryB ?? null;
  const deviation = worldBenchmarks?.temperature_deviation_world?.value;

  const nameA = localizedCountryName(countryA, locale);
  const nameB = countryB ? localizedCountryName(countryB, locale) : null;

  return (
    <>
      <SectionProgressBar activeSection={activeSection} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "1.5rem" }}>
        {/* --- Section 1 : Accroche --- */}
        <section id="accroche" style={{ textAlign: "center", padding: "3rem 1rem 2.5rem" }}>
        <p style={{ fontSize: 16, fontWeight: 500, color: "var(--color-texte)", margin: "0 0 1.5rem" }}>
          {t("home.hero_punchline")}
        </p>

        {deviation !== null && deviation !== undefined ? (
          <>
            <div style={{ fontSize: 56, fontWeight: 500, color: "var(--color-forest)", lineHeight: 1 }}>
              {deviation > 0 ? "+" : ""}
              {deviation.toFixed(2)}°C
            </div>
            <p style={{ fontSize: 14, color: "var(--color-texte-clair)", margin: "6px 0 1.5rem" }}>
              {t("decouverte.hero_label")}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: "var(--color-texte-clair)", margin: "0 0 1.5rem" }}>{t("common.loading")}</p>
        )}

        <div
          style={{
            background: "var(--color-carte)",
            border: "1px solid var(--color-bordure)",
            borderRadius: 8,
            padding: "12px 16px",
            maxWidth: 420,
            margin: "0 auto 1.5rem",
          }}
        >
          <p style={{ fontSize: 14, color: "var(--color-texte)", margin: 0 }}>{t("decouverte.hero_question")}</p>
        </div>

        <button
          type="button"
          onClick={() => setVideoOpen((v) => !v)}
          style={{
            display: "inline-block",
            background: "var(--color-forest)",
            color: "white",
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {t("decouverte.hero_cta")} {videoOpen ? "↑" : "↓"}
        </button>

        {videoId && (
          <div
            style={{
              display: "grid",
              gridTemplateRows: videoOpen ? "1fr" : "0fr",
              transition: "grid-template-rows 0.4s ease",
              maxWidth: 640,
              margin: "1rem auto 0",
            }}
          >
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              {videoOpen && (
                <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={t("decouverte.hero_video_title")}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none", borderRadius: 8 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* --- Section 1bis : C'est quoi le changement climatique ? --- */}
      <section id="explication" style={{ padding: "1rem 0 2rem" }}>
        <SectionDivider Icon={IconBulb} index={2} t={t} />
        <h2 style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>{t("decouverte.explain_title")}</h2>
        <p style={{ fontSize: 14, color: "var(--color-texte)", lineHeight: 1.7, marginBottom: 10 }}>{t("decouverte.explain_p1")}</p>
        <p style={{ fontSize: 14, color: "var(--color-texte)", lineHeight: 1.7, marginBottom: 16 }}>{t("decouverte.explain_p2")}</p>

        <div style={{ background: "var(--color-carte)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", margin: "0 0 6px" }}>{t("decouverte.explain_example1_title")}</p>
          <p style={{ fontSize: 14, color: "var(--color-texte)", lineHeight: 1.7, margin: 0 }}>{t("decouverte.explain_example1_text")}</p>
        </div>

        <div style={{ background: "var(--color-carte)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", margin: "0 0 6px" }}>{t("decouverte.explain_example2_title")}</p>
          <p style={{ fontSize: 14, color: "var(--color-texte)", lineHeight: 1.7, margin: 0 }}>{t("decouverte.explain_example2_text")}</p>
        </div>

        <div style={{ background: "var(--color-carte)", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-texte)", margin: 0 }}>{t("decouverte.explain_nuance")}</p>
        </div>
      </section>

      {/* --- Section 2 : Objections --- */}
      {objections && objections.length > 0 && (
        <section id="objections" style={{ padding: "2rem 0" }}>
          <SectionDivider Icon={IconSearch} index={3} t={t} />
          <h2 style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>{t("decouverte.objections_title")}</h2>
          <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: "1.25rem" }}>
            {t("decouverte.objections_intro")}
          </p>
          {objections.map((entry) => (
            <ObjectionCard key={entry.slug} entry={entry} locale={locale} t={t} />
          ))}
        </section>
      )}
      {/* --- Section 3 : Comparaisons par thème --- */}
      <section id="comparaisons" style={{ padding: "2rem 0" }}>
        <SectionDivider Icon={IconScale} index={4} t={t} />
        <h2 style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>{t("decouverte.comparisons_title")}</h2>
        <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: "1rem" }}>
          {t("decouverte.comparisons_intro")}
        </p>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <CountrySelect countries={countries} value={countryA} onChange={setCountryA} preferredLang={locale} />
          <CountrySelect countries={countries} value={countryB} onChange={setCountryB} preferredLang={locale} />
        </div>

        {summaryA &&
          THEMES.map((theme) => (
            <ComparisonCard
              key={theme.key}
              theme={theme}
              nameA={nameA}
              nameB={nameB}
              valueA={theme.compute(summaryA)}
              valueB={summaryB ? theme.compute(summaryB) : null}
              t={t}
            />
          ))}
      </section>

      {/* --- Section 3bis : Quiz classement --- */}
      <section id="quiz" style={{ padding: "1rem 0 2rem" }}>
        <SectionDivider Icon={IconCheck} index={5} t={t} />
        <h2 style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>{t("decouverte.ranking_title")}</h2>
        <RankingQuiz t={t} />
      </section>

      {/* --- Section 6 : Ce qu'on y gagne --- */}
      <section id="gains" style={{ padding: "1rem 0 2rem" }}>
        <SectionDivider Icon={IconLeaf} index={6} t={t} />
        <h2 style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>{t("decouverte.gains_title")}</h2>
        <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: 10 }}>{t("decouverte.gains_intro")}</p>
        <ul style={{ fontSize: 14, color: "var(--color-texte)", lineHeight: 1.9, paddingLeft: 20 }}>
          <li>{t("decouverte.gains_1")}</li>
          <li>{t("decouverte.gains_2")}</li>
          <li>{t("decouverte.gains_3")}</li>
          <li>{t("decouverte.gains_4")}</li>
        </ul>
      </section>

      {/* --- Section 7 : Et maintenant ? (profilage guidé) --- */}
      <section id="profilage" style={{ padding: "1rem 0 2rem" }}>
        <SectionDivider Icon={IconUsers} index={7} t={t} />
        <h2 style={{ fontSize: 26, fontWeight: 600, color: "var(--color-texte)", margin: "0 0 6px" }}>
          {t("decouverte.action_title")}
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-texte-clair)", marginBottom: "1.25rem" }}>
          {t("decouverte.action_subtitle")}
        </p>

        <ProfilingQuiz t={t} />

        <div style={{ background: "var(--color-carte-verte, #eaf3de)", borderRadius: 12, padding: "1rem 1.25rem", marginTop: "1.25rem" }}>
          <p style={{ fontSize: 14, color: "var(--color-texte)", margin: 0 }}>{t("decouverte.action_closing")}</p>
        </div>
      </section>

      {/* --- Section 8 : Envie d'aller plus loin ? --- */}
      <section id="plus-loin" style={{ padding: "1rem 0 3rem" }}>
        <SectionDivider Icon={IconHome} index={8} t={t} />
        <h2 style={{ fontSize: 26, fontWeight: 600, color: "var(--color-texte)", margin: "0 0 6px" }}>
          {t("decouverte.more_title")}
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-texte)", marginBottom: "0.75rem" }}>
          {t("decouverte.action_more_intro")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {ENGAGER_CARDS.map((card) => (
            <EngagerCard key={card.href} href={card.href} Icon={card.Icon} label={t(card.labelKey)} desc={t(card.descKey)} tint={card.tint} />
          ))}
        </div>
      </section>
    </div>
    </>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
