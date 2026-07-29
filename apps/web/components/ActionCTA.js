import { useState } from "react";
import { useT } from "../lib/useT";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Bouton d'action + formulaire d'inscription à la newsletter éco-responsable.
// La personnalisation (ville/campagne, maison/appartement, enfants) sert à
// adapter les actions proposées par email — mais l'envoi réel des emails
// nécessite un service tiers à configurer séparément ; ce composant ne
// couvre que la collecte du formulaire.
export default function ActionCTA() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [areaType, setAreaType] = useState("");
  const [housingType, setHousingType] = useState("");
  const [hasChildren, setHasChildren] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!consent) {
      setErrorMessage(t("newsletter.consent_required"));
      return;
    }
    setStatus("sending");
    setErrorMessage("");
    fetch(`${API_URL}/api/newsletter/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        areaType: areaType || null,
        housingType: housingType || null,
        hasChildren: hasChildren === "oui",
      }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((data) => Promise.reject(new Error(data.error || "Erreur")));
        return res.json();
      })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err.message || t("newsletter.generic_error"));
      });
  }

  if (status === "done") {
    return (
      <div style={{ background: "#eaf3de", borderRadius: 8, padding: "1rem 1.25rem", margin: "1.5rem 0" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{t("newsletter.done_title")}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>{t("newsletter.done_body")}</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#1baf7a", borderRadius: 8, padding: "1.25rem", margin: "1.5rem 0", color: "white" }}>
      {!open ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t("newsletter.cta_title")}</p>
            <p style={{ margin: "4px 0 0", fontSize: 14 }}>{t("newsletter.cta_subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ background: "white", color: "#1baf7a", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}
          >
            {t("newsletter.cta_button")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ margin: "0 0 0.75rem", fontSize: 18, fontWeight: 600 }}>{t("newsletter.cta_title")}</p>

          <label style={{ display: "block", marginBottom: "0.5rem", fontSize: 14 }}>
            {t("newsletter.email_label")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.fr"
              style={{ display: "block", width: "100%", maxWidth: 320, padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "none" }}
            />
          </label>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", margin: "0.75rem 0", fontSize: 14 }}>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 13, marginBottom: 4 }}>{t("newsletter.area_legend")}</legend>
              <label style={{ marginRight: 12 }}>
                <input type="radio" name="areaType" value="ville" checked={areaType === "ville"} onChange={(e) => setAreaType(e.target.value)} /> {t("newsletter.area_city")}
              </label>
              <label>
                <input type="radio" name="areaType" value="campagne" checked={areaType === "campagne"} onChange={(e) => setAreaType(e.target.value)} /> {t("newsletter.area_country")}
              </label>
            </fieldset>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", margin: "0.75rem 0", fontSize: 14 }}>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 13, marginBottom: 4 }}>{t("newsletter.housing_legend")}</legend>
              <label style={{ marginRight: 12 }}>
                <input type="radio" name="housingType" value="maison" checked={housingType === "maison"} onChange={(e) => setHousingType(e.target.value)} /> {t("newsletter.housing_house")}
              </label>
              <label>
                <input type="radio" name="housingType" value="appartement" checked={housingType === "appartement"} onChange={(e) => setHousingType(e.target.value)} /> {t("newsletter.housing_apartment")}
              </label>
            </fieldset>
          </div>

          <div style={{ margin: "0.75rem 0", fontSize: 14 }}>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 13, marginBottom: 4 }}>{t("newsletter.children_legend")}</legend>
              <label style={{ marginRight: 12 }}>
                <input type="radio" name="hasChildren" value="oui" checked={hasChildren === "oui"} onChange={(e) => setHasChildren(e.target.value)} /> {t("newsletter.children_yes")}
              </label>
              <label>
                <input type="radio" name="hasChildren" value="non" checked={hasChildren === "non"} onChange={(e) => setHasChildren(e.target.value)} /> {t("newsletter.children_no")}
              </label>
            </fieldset>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, margin: "0.75rem 0" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
            <span>{t("newsletter.consent_label")}</span>
          </label>

          {errorMessage && <p role="alert" style={{ fontSize: 13, color: "#ffe9e9" }}>{errorMessage}</p>}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
            <button
              type="submit"
              disabled={status === "sending"}
              style={{ background: "white", color: "#1baf7a", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}
            >
              {status === "sending" ? t("newsletter.sending") : t("newsletter.cta_button")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: "transparent", color: "white", border: "1px solid white", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
            >
              {t("newsletter.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
