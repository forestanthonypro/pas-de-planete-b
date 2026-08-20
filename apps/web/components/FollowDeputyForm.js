import { useState } from "react";
import { useT } from "../lib/useT";


// Formulaire compact d'inscription au suivi par email d'un député — double
// opt-in : l'inscription envoie un email de confirmation, rien n'est actif
// avant que la personne clique dessus.
export default function FollowDeputyForm({ acteurUid, deputyName }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");
    fetch(`/api/deputy-follows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, acteurUid }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((data) => Promise.reject(new Error(data.error || "Erreur")));
        return res.json();
      })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err.message || t("common.error_prefix"));
      });
  }

  if (status === "done") {
    return (
      <p style={{ fontSize: 13, color: "#1baf7a", fontWeight: 600, margin: "0.75rem 0" }}>
        Vérifie ta boîte mail pour confirmer le suivi de {deputyName}.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
        alignItems: "center",
        margin: "0.75rem 0",
        background: "var(--color-carte)",
        border: "1px solid var(--color-bordure)",
        borderRadius: 8,
        padding: "0.75rem",
      }}
    >
      <label style={{ fontSize: 13, flexBasis: "100%" }}>
        Recevoir un email quand {deputyName} vote sur un nouveau texte :
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="toi@exemple.fr"
        style={{ padding: "6px 10px", flex: "1 1 200px" }}
      />
      <button type="submit" disabled={status === "sending"} style={{ fontSize: 13, fontWeight: 600 }}>
        {status === "sending" ? "Envoi..." : "Suivre"}
      </button>
      {errorMessage && (
        <p role="alert" style={{ fontSize: 12, color: "#d63e2a", flexBasis: "100%", margin: 0 }}>
          {errorMessage}
        </p>
      )}
    </form>
  );
}
