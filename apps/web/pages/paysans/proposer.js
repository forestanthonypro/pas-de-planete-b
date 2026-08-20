import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { IconTree } from "../../components/icons";
import { toYoutubeEmbedUrl, isYoutubeUrl } from "../../lib/youtube";
import ScopeMultiSelect from "../../components/ScopeMultiSelect";
import { useT } from "../../lib/useT";


export default function ProposerRessourcePaysanne() {
  const { locale } = useT();
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("video");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [website, setWebsite] = useState(""); // piège à bots, ne jamais afficher
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [error, setError] = useState(null);
  const [scopeCodes, setScopeCodes] = useState([]);

  useEffect(() => {
    fetch(`/api/paysan-categories?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [locale]);

  function handleSourceUrlChange(value) {
    setSourceUrl(value);
    if (contentType === "video" && isYoutubeUrl(value)) {
      const embed = toYoutubeEmbedUrl(value);
      if (embed) setEmbedUrl(embed);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    fetch(`/api/paysan-resources/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description, contentType, sourceUrl,
        sourceName: sourceName || null, embedUrl: embedUrl || null,
        categoryId: categoryId || null, website, scopeCodes,
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
      <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 22 }}>Merci !</h1>
        <p>Ta proposition a bien été reçue et sera examinée avant publication.</p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/paysans">← Retour à &quot;On devient tous paysans&quot;</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/paysans">← Retour à &quot;On devient tous paysans&quot;</Link>
      </p>
      <PageHeader Icon={IconTree} tint="green" title="Proposer une ressource">
        <p style={{ fontSize: 13, color: "var(--color-texte-clair)", margin: 0 }}>
          Un contenu (vidéo, article, podcast, document) qui t&apos;a aidé à cultiver, composter, ou apprendre — nous
          le relisons avant publication.
        </p>
      </PageHeader>

      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Piège à bots : champ invisible pour un humain (aria-hidden, hors
            écran), que les robots remplissent aveuglément. Ne jamais lui
            donner type="hidden" seul, certains bots l'ignorent — le
            positionnement hors-écran est plus efficace. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label htmlFor="website-paysan">Laisser vide</label>
          <input
            id="website-paysan"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titre</span>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>En quelques mots, pourquoi cette ressource ?</span>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Type de contenu</span>
          <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={{ padding: "8px 10px" }}>
            <option value="video">Vidéo</option>
            <option value="article">Article</option>
            <option value="podcast">Podcast</option>
            <option value="document">Document</option>
          </select>
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Lien vers la ressource</span>
          <input type="url" required value={sourceUrl} onChange={(e) => handleSourceUrlChange(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 10px" }} />
        </label>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nom de la source (optionnel)</span>
          <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="ex : Chaîne YouTube Permaculture" style={{ width: "100%", padding: "8px 10px" }} />
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

        <div style={{ marginBottom: "1rem" }}>
          <ScopeMultiSelect value={scopeCodes} onChange={setScopeCodes} locale={locale} label="Pays ou région concernés" placeholder="Rechercher un pays…" />
        </div>

        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Envoi..." : "Envoyer ma proposition"}
        </button>
      </form>
    </div>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
