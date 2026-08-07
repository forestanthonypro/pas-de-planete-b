import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { IconLandmark } from "../../components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function LocationForm() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [links, setLinks] = useState([{ label: "", url: "" }]);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/resource-categories`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

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
    setStatus("sending");
    setError(null);
    fetch(`${API_URL}/api/resource-locations/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, description, address: address || null, latitude, longitude,
        categoryId: categoryId || null, links: links.filter((l) => l.label && l.url), website,
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
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <h2 style={{ fontSize: 20 }}>Merci !</h2>
        <p>Ce lieu a bien été reçu et sera examiné avant publication sur la carte.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label htmlFor="website-location">Laisser vide</label>
        <input id="website-location" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nom du lieu</span>
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</span>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Adresse (optionnel)</span>
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

      {categories.length > 0 && (
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Catégorie (optionnel)</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Liens (optionnel)</p>
      {links.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input type="text" placeholder="Libellé (ex : Site web)" value={l.label} onChange={(e) => updateLink(i, "label", e.target.value)} style={{ flex: 1, padding: "6px 10px" }} />
          <input type="url" placeholder="https://..." value={l.url} onChange={(e) => updateLink(i, "url", e.target.value)} style={{ flex: 1, padding: "6px 10px" }} />
          <button type="button" onClick={() => removeLink(i)} disabled={links.length === 1}>Retirer</button>
        </div>
      ))}
      <button type="button" onClick={addLink} style={{ marginBottom: "1.5rem" }}>+ Ajouter un lien</button>

      <div>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Envoi..." : "Envoyer ma proposition"}
        </button>
      </div>
    </form>
  );
}

function OnlineForm() {
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/resource-categories`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    fetch(`${API_URL}/api/resource-online/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, url, categoryId: categoryId || null, website }),
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
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <h2 style={{ fontSize: 20 }}>Merci !</h2>
        <p>Cette ressource a bien été reçue et sera examinée avant publication.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label htmlFor="website-online">Laisser vide</label>
        <input id="website-online" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre</span>
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</span>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>URL</span>
        <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
      </label>

      {categories.length > 0 && (
        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Catégorie (optionnel)</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 10px" }}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Envoi..." : "Envoyer ma proposition"}
      </button>
    </form>
  );
}

export default function ProposerRessource() {
  const [tab, setTab] = useState("location");

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/ressources">← Retour aux ressources</Link>
      </p>
      <PageHeader Icon={IconLandmark} tint="green" title="Proposer une ressource">
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>
          Un lieu près de chez toi, ou une plateforme en ligne utile — nous la relisons avant publication.
        </p>
      </PageHeader>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          onClick={() => setTab("location")}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: tab === "location" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: tab === "location" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)", fontWeight: tab === "location" ? 600 : 400, cursor: "pointer",
          }}
        >
          Un lieu
        </button>
        <button
          type="button"
          onClick={() => setTab("online")}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: tab === "online" ? "2px solid var(--color-forest)" : "1px solid var(--color-bordure)",
            background: tab === "online" ? "var(--color-carte-verte)" : "var(--color-fond)",
            color: "var(--color-texte)", fontWeight: tab === "online" ? 600 : 400, cursor: "pointer",
          }}
        >
          Une ressource en ligne
        </button>
      </div>

      {tab === "location" ? <LocationForm /> : <OnlineForm />}
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
