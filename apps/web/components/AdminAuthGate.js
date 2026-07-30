import { useEffect, useState } from "react";
import { getAdminSession, setAdminSession, clearAdminSession } from "../lib/adminAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Protège toute page d'administration derrière un code à 6 chiffres généré
// par une application d'authentification (Google Authenticator, Authy...).
// Remplace l'ancien jeton statique partagé — un code TOTP change toutes les
// 30 secondes et ne peut pas être « volé » une fois utilisé, contrairement à
// un mot de passe fixe.
export default function AdminAuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = pas encore vérifié
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setSession(getAdminSession());
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    fetch(`${API_URL}/api/admin/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Code invalide")));
        return res.json();
      })
      .then((data) => {
        setAdminSession(data.sessionToken, data.expiresAt);
        setSession({ sessionToken: data.sessionToken, expiresAt: data.expiresAt });
        setCode("");
        setVerifying(false);
      })
      .catch((err) => {
        setError(err.message);
        setVerifying(false);
      });
  }

  function handleLogout() {
    fetch(`${API_URL}/api/admin/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.sessionToken}` },
    }).catch(() => {});
    clearAdminSession();
    setSession(null);
  }

  if (session === undefined) return null; // évite un flash du formulaire au premier rendu

  if (!session) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 400, margin: "4rem auto" }}>
        <h1 style={{ fontSize: 20 }}>Accès administration</h1>
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>
          Entre le code à 6 chiffres généré par ton application d&apos;authentification
          (Google Authenticator, Authy...).
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            style={{ width: "100%", padding: "10px 12px", fontSize: 20, textAlign: "center", letterSpacing: "0.3em", marginBottom: "0.75rem" }}
          />
          <button type="submit" disabled={code.length !== 6 || verifying} style={{ width: "100%", padding: "10px" }}>
            {verifying ? "Vérification..." : "Se connecter"}
          </button>
          {error && <p role="alert" style={{ color: "#d63e2a", fontSize: 13, marginTop: "0.5rem" }}>{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.5rem 2rem 0" }}>
        <button type="button" onClick={handleLogout} style={{ fontSize: 12, color: "var(--color-texte-clair)" }}>
          Se déconnecter
        </button>
      </div>
      {children(session)}
    </div>
  );
}
