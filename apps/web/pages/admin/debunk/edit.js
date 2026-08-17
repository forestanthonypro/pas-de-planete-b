import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";
import ScopeMultiSelect from "../../../components/ScopeMultiSelect";
import Link from "next/link";
import { slugify } from "../../../lib/slugify";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TRANSLATION_FIELDS = [
  { name: "myth", label: "Titre / affirmation démontée", multiline: false },
  { name: "claim_quote", label: "Citation exacte de l'affirmation", multiline: true },
  { name: "reality", label: "Ce qu'il en est vraiment", multiline: true },
];

function AdminDebunkEditInner({ session }) {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [myth, setMyth] = useState("");
  const [claimQuote, setClaimQuote] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [reality, setReality] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [verdict, setVerdict] = useState("faux");
  const [published, setPublished] = useState(false);
  const [scopeCodes, setScopeCodes] = useState([]);
  const [sources, setSources] = useState([{ label: "", url: "" }]);
  const [submissionNotes, setSubmissionNotes] = useState(null);
  const [submitterEmail, setSubmitterEmail] = useState(null);
  const [submittedPublicly, setSubmittedPublicly] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | saving | done

  useEffect(() => {
    fetch(`${API_URL}/api/debunk-categories`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [session]);

  useEffect(() => {
    if (!editSlug) return;
    setLoading(true);
    fetch(`${API_URL}/api/admin/debunk/${editSlug}`, {
      headers: { ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
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
        setImageUrl(data.entry.image_url || "");
        setReality(data.entry.reality);
        setCategoryId(data.entry.category_id || "");
        setVerdict(data.entry.verdict || "faux");
        setPublished(data.entry.published);
        setScopeCodes(data.entry.scope_codes || []);
        setSubmissionNotes(data.entry.submission_notes || null);
        setSubmitterEmail(data.entry.submitter_email || null);
        setSubmittedPublicly(data.entry.submitted_publicly || false);
        setSources(data.sources.length > 0 ? data.sources : [{ label: "", url: "" }]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [editSlug, session]);

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

    fetch(`${API_URL}/api/admin/debunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({
        slug,
        myth,
        claimQuote: claimQuote || null,
        imageUrl: imageUrl || null,
        reality,
        categoryId: categoryId || null,
        verdict,
        published,
        scopeCodes,
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

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {submittedPublicly && (submissionNotes || submitterEmail) && (
        <div style={{ background: "#fff8e1", border: "1px solid #f4b400", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 6px", color: "#8a6d00" }}>
            Proposition d&apos;un visiteur — à vérifier avant publication
          </p>
          {submitterEmail && (
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>
              Email : <a href={`mailto:${submitterEmail}`}>{submitterEmail}</a>
            </p>
          )}
          {submissionNotes && <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{submissionNotes}</p>}
        </div>
      )}

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
            Image d&apos;illustration — URL (optionnel)
          </span>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", padding: "8px 10px" }}
          />
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              style={{ marginTop: 8, maxWidth: 240, maxHeight: 140, borderRadius: 8, objectFit: "cover" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}
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
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
        {categories.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: -8, marginBottom: "0.75rem" }}>
            Aucune catégorie créée — ajoutes-en depuis <Link href="/admin/debunk">la liste</Link>.
          </p>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: 14 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publier (visible sur la page publique)
        </label>

        <div style={{ marginBottom: "1rem" }}>
          <ScopeMultiSelect
            value={scopeCodes}
            onChange={setScopeCodes}
            locale="fr"
            label="Pays ou zone concernée (optionnel)"
            placeholder="Rechercher un pays, un continent..."
          />
        </div>

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
          <button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>

      <ContentTranslationsEditor
        contentType="debunk"
        contentId={isEditing ? slug : null}
        fields={TRANSLATION_FIELDS}
        baseValues={{ myth, claim_quote: claimQuote, reality }}
        sessionToken={session.sessionToken}
      />
    </div>
  );
}

export default function AdminDebunkEdit() {
  return <AdminAuthGate>{(session) => <AdminDebunkEditInner session={session} />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
