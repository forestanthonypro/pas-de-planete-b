import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";
import Link from "next/link";
import { slugify } from "../../../lib/slugify";
import { useApiFetch } from "../../../lib/useApiFetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TRANSLATION_FIELDS = [
  { name: "name", label: "Nom du lieu", multiline: false },
  { name: "description", label: "Description", multiline: true },
];

function AdminLocationEditInner({ session }) {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [published, setPublished] = useState(false);
  const [links, setLinks] = useState([{ label: "", url: "" }]);

  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  const { data: categoryRows } = useApiFetch("/api/resource-categories", {
    transform: (rows) => (Array.isArray(rows) ? rows : []),
  });
  const categories = categoryRows ?? [];

  const { data: locationData, loading, error: fetchError } = useApiFetch(
    editSlug ? `/api/admin/resource-locations/${editSlug}` : null,
    {
      headers: session ? { Authorization: `Bearer ${session.sessionToken}` } : undefined,
      errorMessage: "Entrée non trouvée",
    }
  );

  useEffect(() => {
    if (!locationData) return;
    setSlug(locationData.location.slug);
    setSlugTouched(true);
    setName(locationData.location.name);
    setDescription(locationData.location.description);
    setAddress(locationData.location.address || "");
    setLatitude(String(locationData.location.latitude));
    setLongitude(String(locationData.location.longitude));
    setCategoryId(locationData.location.category_id || "");
    setPublished(locationData.location.published);
    setLinks(locationData.links.length > 0 ? locationData.links : [{ label: "", url: "" }]);
  }, [locationData]);

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  function handleNameChange(value) {
    setName(value);
    if (!isEditing && !slugTouched) setSlug(slugify(value));
  }

  function updateLink(index, field, value) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeLink(index) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    fetch(`${API_URL}/api/admin/resource-locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}) },
      body: JSON.stringify({
        slug,
        name,
        description,
        address: address || null,
        latitude,
        longitude,
        categoryId: categoryId || null,
        published,
        links: links.filter((l) => l.label && l.url),
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
        <p>Lieu enregistré.</p>
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
      <h1>{isEditing ? "Modifier le lieu" : "Nouveau lieu"}</h1>

      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nom du lieu</span>
          <input type="text" required value={name} onChange={(e) => handleNameChange(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
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
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Adresse (optionnel, affichée sur la fiche)</span>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 140 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Latitude</span>
            <input type="number" step="any" required value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="ex : 45.1885" style={{ width: "100%", padding: "8px 10px" }} />
          </label>
          <label style={{ flex: 1, minWidth: 140 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Longitude</span>
            <input type="number" step="any" required value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="ex : 5.7245" style={{ width: "100%", padding: "8px 10px" }} />
          </label>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: 0, marginBottom: "0.75rem" }}>
          Astuce : trouve les coordonnées sur{" "}
          <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>{" "}
          (clic droit sur le lieu → « Afficher l&apos;adresse »).
        </p>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Catégorie</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {categories.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginTop: -8, marginBottom: "0.75rem" }}>
            Aucune catégorie créée — ajoutes-en depuis <Link href="/admin/ressources">la liste</Link>.
          </p>
        )}

        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Liens (site web, horaires, réseau social...)</p>
        {links.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input
              type="text"
              placeholder="Libellé (ex : Site web)"
              value={l.label}
              onChange={(e) => updateLink(i, "label", e.target.value)}
              style={{ flex: 1, padding: "6px 10px" }}
            />
            <input
              type="url"
              placeholder="https://..."
              value={l.url}
              onChange={(e) => updateLink(i, "url", e.target.value)}
              style={{ flex: 1, padding: "6px 10px" }}
            />
            <button type="button" onClick={() => removeLink(i)} disabled={links.length === 1}>
              Retirer
            </button>
          </div>
        ))}
        <button type="button" onClick={addLink} style={{ marginBottom: "1.5rem" }}>
          + Ajouter un lien
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", fontSize: 14 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publier (visible sur la carte publique)
        </label>

        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      <ContentTranslationsEditor
        contentType="resource_location"
        contentId={isEditing ? slug : null}
        fields={TRANSLATION_FIELDS}
        baseValues={{ name, description }}
        sessionToken={session.sessionToken}
      />
    </div>
  );
}

export default function AdminLocationEdit() {
  return <AdminAuthGate>{(session) => <AdminLocationEditInner session={session} />}</AdminAuthGate>;
}

export async function getServerSideProps() {
  return { props: {} };
}
