import { useState } from "react";
import Link from "next/link";
import { useSobriety } from "../lib/SobrietyContext";

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
  const { sobriety } = useSobriety();
  return (
    <button
      type="button"
      onClick={onClick}
      style={
        sobriety
          ? {
              textAlign: "left",
              padding: "8px 0",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--color-bordure)",
              cursor: "pointer",
              fontSize: 14,
              color: "var(--color-forest)",
              textDecoration: "underline",
              marginBottom: 0,
              width: "100%",
            }
          : {
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
            }
      }
    >
      {children}
    </button>
  );
}

export default function ProfilingQuiz({ t }) {
  const { sobriety } = useSobriety();
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
      <div style={sobriety ? { padding: "0.75rem 0", borderBottom: "1px solid var(--color-bordure)" } : { background: "var(--color-carte-verte, #eaf3de)", borderRadius: 12, padding: "1.25rem" }}>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: "0 0 6px" }}>{t("decouverte.profiling_result_title")}</p>
        <p style={{ fontSize: 15, color: "var(--color-texte)", margin: 0, lineHeight: 1.6 }}>{t(`decouverte.profiling_action_${actionKey}`)}</p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 12 }}>
        <Link
          href="#plus-loin"
          style={
            sobriety
              ? { display: "inline-block", color: "var(--color-forest)", fontWeight: 600, fontSize: 14, textDecoration: "underline" }
              : { display: "inline-block", background: "var(--color-forest)", color: "white", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14 }
          }
        >
          {t("decouverte.profiling_more_hint")} ↓
        </Link>
        <button
          type="button"
          onClick={reset}
          style={
            sobriety
              ? { display: "block", background: "none", border: "none", padding: 0, fontSize: 13, cursor: "pointer", color: "var(--color-forest)", textDecoration: "underline" }
              : { background: "none", border: "1.5px solid var(--color-forest)", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", color: "var(--color-forest)", fontWeight: 600 }
          }
        >
          {t("decouverte.profiling_reset")}
        </button>
      </div>
    </div>
  );
}
