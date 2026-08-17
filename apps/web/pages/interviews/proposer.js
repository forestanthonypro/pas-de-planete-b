import { useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import ScopeMultiSelect from "../../components/ScopeMultiSelect";
import { useT } from "../../lib/useT";
import { IconPlay } from "../../components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ProposerInterview() {
  const { locale } = useT();
  const [sourceUrl, setSourceUrl] = useState("");
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [contentType, setContentType] = useState("article");
  const [notes, setNotes] = useState("");
  const [scopeCodes, setScopeCodes] = useState([]);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    fetch(`${API_URL}/api/science-relays/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceUrl, suggestedTitle: suggestedTitle || null, contentType, notes: notes || null, scopeCodes, website,
      }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Erreur")));
        return res.json();
      })
      .then(() => setStatus("done"))
      .catch((err) => {
        setError(err.message);
        setStatus("idle");
      });
  }

  if (status === "done") {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 20 }}>Merci !</h2>
        <p>Cette proposition a bien été transmise à la rédaction, qui rédigera un résumé avant publication.</p>
        <p style={{ fontSize: 13 }}>
          <Link href="/interviews">← Retour au relais scientifique</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/interviews">← Retour au relais scientifique</Link>
      </p>
      <PageHeader Icon={IconPlay} tint="mauve" title="Proposer une interview, un article ou une vidéo">
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>
          Un contenu scientifique intéressant à relayer — c&apos;est nous qui rédigeons le résumé avant
          publication, jamais une reprise telle quelle de la source.
        </p>
      </PageHeader>

      <form onSubmit={handleSubmit}>
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label htmlFor="website-interview">Laisser vide</label>
          <input id="website-interview" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Lien vers la source</span>
          <input type="url" required value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre suggéré (optionnel)</span>
          <input type="text" value={suggestedTitle} onChange={(e) => setSuggestedTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Type de contenu</span>
          <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="article">Article</option>
            <option value="video">Vidéo</option>
            <option value="podcast">Podcast</option>
          </select>
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Contexte ou précisions (optionnel)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <div style={{ marginBottom: "1rem" }}>
          <ScopeMultiSelect
            value={scopeCodes}
            onChange={setScopeCodes}
            locale={locale}
            label="Pays ou zone concernée (optionnel)"
            placeholder="Rechercher un pays, un continent..."
          />
        </div>

        <button type="submit" disabled={status === "sending" || !sourceUrl.trim()}>
          {status === "sending" ? "Envoi..." : "Envoyer ma proposition"}
        </button>
      </form>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
