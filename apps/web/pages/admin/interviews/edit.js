import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";
import Link from "next/link";
import { slugify } from "../../../lib/slugify";
import { toYoutubeEmbedUrl, isYoutubeUrl } from "../../../lib/youtube";
import { useApiFetch } from "../../../lib/useApiFetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TRANSLATION_FIELDS = [
  { name: "title", label: "Titre", multiline: false },
  { name: "scientist_field", label: "Domaine", multiline: false },
  { name: "description", label: "Résumé", multiline: true },
];

function AdminInterviewEditInner({ session }) {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scientistName, setScientistName] = useState("");
  const [scientistField, setScientistField] = useState("");
  const [contentType, setContentType] = useState("video");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [relatedDebunkSlug, setRelatedDebunkSlug] = useState("");
  const [published, setPublished] = useState(false);

  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  const { data: categoryRows } = useApiFetch("/api/interview-categories", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const categories = categoryRows ?? [];

  const { data: interviewData, loading, error: fetchError } = useApiFetch(
    editSlug ? `/api/admin/science-relays/${editSlug}` : null,
    {
      headers: session ? { Authorization: `Bearer ${session.sessionToken}` } : undefined,
      errorMessage: "Entrée non trouvée",
    }
  );

  useEffect(() => {
    if (!interviewData) return;
    setSlug(interviewData.slug);
    setSlugTouched(true);
    setTitle(interviewData.title);
    setDescription(interviewData.description);
    setScientistName(interviewData.scientist_name || "");
    setScientistField(interviewData.scientist_field || "");
    setContentType(interviewData.content_type);
    setSourceUrl(interviewData.source_url);
    setSourceName(interviewData.source_name || "");
    setEmbedUrl(interviewData.embed_url || "");
    setImageUrl(interviewData.image_url || "");
    setCategoryId(interviewData.category_id || "");
    setRelatedDebunkSlug(interviewData.related_debunk_slug || "");
    setPublished(interviewData.published);
  }, [interviewData]);

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  function handleTitleChange(value) {
    setTitle(value);
    if (!isEditing && !slugTouched) setSlug(slugify(value));
  }

  function handleSourceUrlChange(value) {
    setSourceUrl(value);
    if (contentType === "video" && isYoutubeUrl(value)) {
      const embed = toYoutubeEmbedUrl(value);
      if (embed) setEmbedUrl(embed);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    fetch(`${API_URL}/api/admin/science-relays`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({
        slug,
        title,
        description,
        scientistName: scientistName || null,
        scientistField: scientistField || null,
        contentType,
        sourceUrl,
        sourceName: sourceName || null,
        embedUrl: embedUrl || null,
        imageUrl: imageUrl || null,
        categoryId: categoryId || null,
        relatedDebunkSlug: relatedDebunkSlug || null,
        published,
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
          <Link href="/admin/interviews">← Retour à la liste</Link> ·{" "}
          <Link href={`/interviews/${slug}`}>Voir la page publique →</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin/interviews">← Retour à la liste</Link>
      </p>
      <h1>{isEditing ? "Modifier l'entrée" : "Nouvelle entrée"}</h1>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre</span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            style={{ width: "100%", padding: "8px 10px" }}
          />
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
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Résumé (notre propre texte, jamais une citation longue reprise telle quelle)
          </span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }}
          />
        </label>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nom du/de la scientifique</span>
            <input type="text" value={scientistName} onChange={(e) => setScientistName(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
          </label>
          <label style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Domaine</span>
            <input type="text" value={scientistField} onChange={(e) => setScientistField(e.target.value)} placeholder="ex : Climatologue" style={{ width: "100%", padding: "8px 10px" }} />
          </label>
        </div>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Type de contenu</span>
          <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={{ padding: "8px 10px" }}>
            <option value="video">Vidéo</option>
            <option value="article">Article</option>
            <option value="podcast">Podcast</option>
          </select>
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            URL de la source (colle l&apos;URL YouTube complète, la conversion est automatique)
          </span>
          <input
            type="url"
            required
            value={sourceUrl}
            onChange={(e) => handleSourceUrlChange(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", padding: "8px 10px" }}
          />
        </label>

        {contentType !== "article" && (
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              URL d&apos;intégration (auto-remplie pour YouTube, sinon colle le lien embed Spotify/Apple Podcasts)
            </span>
            <input
              type="url"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://www.youtube.com/embed/..."
              style={{ width: "100%", padding: "8px 10px" }}
            />
          </label>
        )}

        {contentType !== "video" && (
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Image de vignette (optionnel — les vidéos utilisent automatiquement leur miniature YouTube)
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
        )}

        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nom de la source</span>
            <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="ex : France Inter" style={{ width: "100%", padding: "8px 10px" }} />
          </label>
          <label style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Catégorie</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        {categories.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: -8, marginBottom: "0.75rem" }}>
            Aucune catégorie créée — ajoutes-en depuis <Link href="/admin/interviews">la liste</Link>.
          </p>
        )}

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Entrée Débunk liée (slug, optionnel)
          </span>
          <input type="text" value={relatedDebunkSlug} onChange={(e) => setRelatedDebunkSlug(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
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
        contentType="interview"
        contentId={isEditing ? slug : null}
        fields={TRANSLATION_FIELDS}
        baseValues={{ title, scientist_field: scientistField, description }}
        sessionToken={session.sessionToken}
      />
    </div>
  );
}

export default function AdminInterviewEdit() {
  return <AdminAuthGate>{(session) => <AdminInterviewEditInner session={session} />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
