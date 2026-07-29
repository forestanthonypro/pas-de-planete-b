import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "pdpb-admin-token";

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminDebunkEdit() {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);

  const [token, setToken] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [myth, setMyth] = useState("");
  const [claimQuote, setClaimQuote] = useState("");
  const [reality, setReality] = useState("");
  const [category, setCategory] = useState("");
  const [verdict, setVerdict] = useState("faux");
  const [published, setPublished] = useState(false);
  const [sources, setSources] = useState([{ label: "", url: "" }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | saving | done

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!editSlug || !token) return;
    setLoading(true);
    fetch(`${API_URL}/api/admin/debunk/${editSlug}`, {
      headers: { "x-ingest-token": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Entrée non trouvée");
        return res.json();
      })
      .then((data) => {
        setSlug(data.entry.slug);
        setSlugTouched(true);
        setMyth(data.entry.myth);
        setClaimQuote(data.entry.claim_quote || "");
        setReality(data.entry.reality);
        setCategory(data.entry.category || "");
        setVerdict(data.entry.verdict || "faux");
        setPublished(data.entry.published);
        setSources(data.sources.length > 0 ? data.sources : [{ label: "", url: "" }]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [editSlug, token]);

  function handleMythChange(value) {
    setMyth(value);
    if (!isEditing && !slugTouched) setSlug(slugify(value));
  }

  function updateSource(index, field, value) {
    setSources((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addSource() {
    setSources((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeSource(index) {
    setSources((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);

    fetch(`${API_URL}/api/admin/debunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-token": token },
      body: JSON.stringify({
        slug,
        myth,
        claimQuote: claimQuote || null,
        reality,
        category: category || null,
        verdict,
        published,
        sources: sources.filter((s) => s.label && s.url),
      }),
    })
      .then((res) => {
        if (res.status === 401) throw new Error("Jeton invalide");
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
      <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
        <p>Entrée enregistrée.</p>
        <p>
          <Link href="/admin/debunk">← Retour à la liste</Link> ·{" "}
          <Link href={`/debunk/${slug}`}>Voir la page publique →</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin/debunk">← Retour à la liste</Link>
      </p>
      <h1>{isEditing ? "Modifier l'entrée" : "Nouvelle entrée"}</h1>

      {!token && (
        <p style={{ fontSize: 13, color: "#666" }}>
          Aucun jeton mémorisé — retourne d&apos;abord sur{" "}
          <Link href="/admin/debunk">la liste</Link> pour te connecter.
        </p>
      )}

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Titre / affirmation démontée
          </span>
          <input
            type="text"
            required
            value={myth}
            onChange={(e) => handleMythChange(e.target.value)}
            style={{ width: "100%", padding: "8px 10px" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Identifiant (slug) — utilisé dans l&apos;URL, non modifiable après création
          </span>
          <input
            type="text"
            required
            value={slug}
            disabled={isEditing}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            style={{ width: "100%", padding: "8px 10px", background: isEditing ? "#f0f0f0" : "white" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Citation exacte de l&apos;affirmation (optionnel)
          </span>
          <textarea
            value={claimQuote}
            onChange={(e) => setClaimQuote(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Ce qu&apos;il en est vraiment
          </span>
          <textarea
            required
            value={reality}
            onChange={(e) => setReality(e.target.value)}
            rows={8}
            style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }}
          />
        </label>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Catégorie</span>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="ex : Énergie, Climat, Biodiversité"
              style={{ width: "100%", padding: "8px 10px" }}
            />
          </label>

          <label style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Verdict</span>
            <select value={verdict} onChange={(e) => setVerdict(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
              <option value="faux">Faux</option>
              <option value="trompeur">Trompeur</option>
              <option value="confirme">Confirmé</option>
            </select>
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: 14 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publier (visible sur la page publique)
        </label>

        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Sources</p>
        {sources.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input
              type="text"
              placeholder="Libellé (ex : Loss et al. 2013, Nature Communications)"
              value={s.label}
              onChange={(e) => updateSource(i, "label", e.target.value)}
              style={{ flex: 1, padding: "6px 10px" }}
            />
            <input
              type="url"
              placeholder="https://..."
              value={s.url}
              onChange={(e) => updateSource(i, "url", e.target.value)}
              style={{ flex: 1, padding: "6px 10px" }}
            />
            <button type="button" onClick={() => removeSource(i)} disabled={sources.length === 1}>
              Retirer
            </button>
          </div>
        ))}
        <button type="button" onClick={addSource} style={{ marginBottom: "1.5rem" }}>
          + Ajouter une source
        </button>

        <div>
          <button type="submit" disabled={status === "saving" || !token}>
            {status === "saving" ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
