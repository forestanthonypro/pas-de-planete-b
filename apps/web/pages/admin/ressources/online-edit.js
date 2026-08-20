import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";
import ScopeMultiSelect from "../../../components/ScopeMultiSelect";
import Link from "next/link";
import { slugify } from "../../../lib/slugify";
import { useApiFetch } from "../../../lib/useApiFetch";


const TRANSLATION_FIELDS = [
  { name: "title", label: "Titre", multiline: false },
  { name: "description", label: "Description", multiline: true },
];

function AdminOnlineResourceEditInner() {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [published, setPublished] = useState(false);
  const [scopeCodes, setScopeCodes] = useState([]);
  const [submittedPublicly, setSubmittedPublicly] = useState(false);
  const [submitterEmail, setSubmitterEmail] = useState(null);
  const [submissionNotes, setSubmissionNotes] = useState(null);

  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  const { data: categoryRows } = useApiFetch("/api/resource-categories", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const categories = categoryRows ?? [];

  const { data: onlineData, loading, error: fetchError } = useApiFetch(
    editSlug ? `/api/admin/resource-online/${editSlug}` : null,
    {
      credentials: "include",
      errorMessage: "Entrée non trouvée",
    }
  );

  useEffect(() => {
    if (!onlineData) return;
    setSlug(onlineData.slug);
    setSlugTouched(true);
    setTitle(onlineData.title);
    setDescription(onlineData.description);
    setUrl(onlineData.url);
    setCategoryId(onlineData.category_id || "");
    setPublished(onlineData.published);
    setScopeCodes(onlineData.scope_codes || []);
    setSubmittedPublicly(onlineData.submitted_publicly || false);
    setSubmitterEmail(onlineData.submitter_email || null);
    setSubmissionNotes(onlineData.submission_notes || null);
  }, [onlineData]);

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  function handleTitleChange(value) {
    setTitle(value);
    if (!isEditing && !slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    fetch(`/api/admin/resource-online`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ slug, title, description, url, categoryId: categoryId || null, published, scopeCodes }),
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
        <p>Ressource enregistrée.</p>
        <p>
          <Link href="/admin/ressources">← Retour à la liste</Link> ·{" "}
          <Link href="/ressources">Voir la page publique →</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin/ressources">← Retour à la liste</Link>
      </p>
      <h1>{isEditing ? "Modifier la ressource" : "Nouvelle ressource en ligne"}</h1>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {submittedPublicly && !published && (
        <div style={{ background: "#fff8e1", border: "1px solid #f4b400", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <p style={{ fontSize: 13, color: "#8a6d00", margin: submitterEmail || submissionNotes ? "0 0 6px" : 0 }}>
            Proposition d&apos;un visiteur — à vérifier avant publication.
          </p>
          {submitterEmail && (
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>
              Email : <a href={`mailto:${submitterEmail}`}>{submitterEmail}</a>
            </p>
          )}
          {submissionNotes && <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{submissionNotes}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre</span>
          <input type="text" required value={title} onChange={(e) => handleTitleChange(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Identifiant (slug) — non modifiable après création
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
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</span>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>URL</span>
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Catégorie</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: 14 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publier (visible sur la page publique)
        </label>

        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      <ContentTranslationsEditor
        contentType="resource_online"
        contentId={isEditing ? slug : null}
        fields={TRANSLATION_FIELDS}
        baseValues={{ title, description }}
      />
    </div>
  );
}

export default function AdminOnlineResourceEdit() {
  return <AdminAuthGate>{() => <AdminOnlineResourceEditInner />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
