import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";
import Link from "next/link";
import { useApiFetch } from "../../../lib/useApiFetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TRANSLATION_FIELDS = [
  { name: "title", label: "Titre", multiline: false },
  { name: "description", label: "Description", multiline: true },
];

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function AdminPetitionEditInner({ session }) {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);

  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [petitionUrl, setPetitionUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [status, setStatus] = useState("ongoing");
  const [imageUrl, setImageUrl] = useState("");
  const [published, setPublished] = useState(false);

  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");

  const { data: petitionData, loading, error: fetchError } = useApiFetch(
    editSlug ? `/api/admin/petitions/${editSlug}` : null,
    {
      headers: { Authorization: `Bearer ${session.sessionToken}` },
      errorMessage: "Entrée non trouvée",
    }
  );

  useEffect(() => {
    if (!petitionData) return;
    setSlug(petitionData.slug);
    setSlugTouched(true);
    setTitle(petitionData.title);
    setDescription(petitionData.description);
    setPetitionUrl(petitionData.petition_url);
    setSourceName(petitionData.source_name || "");
    setStatus(petitionData.status);
    setImageUrl(petitionData.image_url || "");
    setPublished(petitionData.published);
  }, [petitionData]);

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  function handleTitleChange(value) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSaveStatus("saving");
    setError(null);
    fetch(`${API_URL}/api/admin/petitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
      body: JSON.stringify({
        slug, title, description, petitionUrl, sourceName: sourceName || null,
        status, imageUrl: imageUrl || null, published,
      }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Erreur")));
        return res.json();
      })
      .then(() => {
        setSaveStatus("saved");
        setTimeout(() => router.push("/admin/petitions"), 800);
      })
      .catch((err) => {
        setError(err.message);
        setSaveStatus("idle");
      });
  }

  if (loading) return <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin/petitions">← Retour à la liste</Link>
      </p>
      <h1>{isEditing ? "Modifier la pétition" : "Nouvelle pétition"}</h1>

      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre</span>
          <input type="text" required value={title} onChange={(e) => handleTitleChange(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Slug</span>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            style={{ width: "100%", padding: "8px 10px" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</span>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Lien vers la pétition</span>
          <input type="url" required value={petitionUrl} onChange={(e) => setPetitionUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Plateforme (optionnel)</span>
          <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="ex : Change.org, Mes Opinions..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Statut de la pétition</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="ongoing">En cours</option>
            <option value="closed">Clôturée</option>
          </select>
        </label>

        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Image (optionnel, URL)</span>
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Publié</span>
        </label>

        <button type="submit" disabled={saveStatus === "saving"}>
          {saveStatus === "saving" ? "Enregistrement..." : saveStatus === "saved" ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </form>

      {isEditing && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: 16 }}>Traductions</h2>
          <ContentTranslationsEditor
            contentType="petition"
            contentId={isEditing ? slug : null}
            fields={TRANSLATION_FIELDS}
            baseValues={{ title, description }}
            sessionToken={session.sessionToken}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminPetitionEdit() {
  return <AdminAuthGate>{(session) => <AdminPetitionEditInner session={session} />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
