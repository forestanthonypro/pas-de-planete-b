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

function AdminCharterItemEditInner({ session }) {
  const router = useRouter();
  const { id: editId, sectionId: presetSectionId } = router.query;
  const isEditing = Boolean(editId);
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);

  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  const { data: sectionRows } = useApiFetch("/api/admin/charter-sections", {
    headers: session ? { Authorization: `Bearer ${session.sessionToken}` } : undefined,
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const sections = sectionRows ?? [];

  useEffect(() => {
    if (!isEditing && presetSectionId) setSectionId(String(presetSectionId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetSectionId]);

  const { data: itemData, loading, error: fetchError } = useApiFetch(
    editId ? `/api/admin/charter-items/${editId}` : null,
    {
      headers: session ? { Authorization: `Bearer ${session.sessionToken}` } : undefined,
      errorMessage: "Élément non trouvé",
    }
  );

  useEffect(() => {
    if (!itemData) return;
    setSectionId(String(itemData.section_id));
    setTitle(itemData.title);
    setDescription(itemData.description || "");
    setPublished(itemData.published);
  }, [itemData]);

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    fetch(`${API_URL}/api/admin/charter-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({
        id: isEditing ? editId : undefined,
        sectionId,
        title,
        description: description || null,
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
        <p>Élément enregistré.</p>
        <p>
          <Link href="/admin/charte">← Retour à la charte</Link> ·{" "}
          <Link href="/charte">Voir la page publique →</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin/charte">← Retour à la charte</Link>
      </p>
      <h1>{isEditing ? "Modifier l'élément" : "Nouvel élément"}</h1>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Section</span>
          <select required value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">— Choisir —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre</span>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description (optionnel)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: 14 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publier (visible sur la page publique)
        </label>

        <button type="submit" disabled={status === "saving" || !sectionId}>
          {status === "saving" ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      <ContentTranslationsEditor
        contentType="charter_item"
        contentId={isEditing ? String(editId) : null}
        fields={TRANSLATION_FIELDS}
        baseValues={{ title, description }}
        sessionToken={session.sessionToken}
      />
    </div>
  );
}

export default function AdminCharterItemEdit() {
  return <AdminAuthGate>{(session) => <AdminCharterItemEditInner session={session} />}</AdminAuthGate>;
}

export async function getServerSideProps() {
  return { props: {} };
}
