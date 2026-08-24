import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../../components/AdminAuthGate";
import Pagination from "../../../components/Pagination";
import ScrollableTable from "../../../components/ScrollableTable";
import ScopeBadges from "../../../components/ScopeBadges";

const PAGE_SIZE = 20;

function PublicSubmissionBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 600,
        color: "#a86b0a",
        background: "#fdf1d6",
        borderRadius: 10,
        padding: "2px 8px",
        marginLeft: 6,
        whiteSpace: "nowrap",
      }}
      title="Proposé via le formulaire public, en attente de relecture"
    >
      Proposition du public
    </span>
  );
}

function AdminFutureIdeasListInner() {
  const [ideas, setIdeas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [suggestions, setSuggestions] = useState([]);
  const [viewingSuggestionId, setViewingSuggestionId] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadIdeas();
    loadSuggestions();
  }, []);

  function loadSuggestions() {
    fetch(`/api/admin/future-idea-suggestions`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setSuggestions(Array.isArray(rows) ? rows : []))
      .catch(() => setSuggestions([]));
  }

  function updateSuggestionStatus(id, status) {
    fetch(`/api/admin/future-idea-suggestions/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadSuggestions())
      .catch((err) => setError(err.message));
  }

  function openSuggestion(s) {
    setViewingSuggestionId(viewingSuggestionId === s.id ? null : s.id);
    setEditText(s.text);
  }

  // Corriger le texte d'une proposition (fautes, mise en forme, contenu à
  // retirer) avant de la publier — même principe que les autres rubriques
  // (débunk, interviews, paysans, pétitions, ressources), qui permettent
  // déjà de modifier une proposition avant publication via leur page
  // d'édition complète.
  function saveSuggestionText(id) {
    if (!editText.trim()) return;
    setSavingEdit(true);
    fetch(`/api/admin/future-idea-suggestions/${id}/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text: editText.trim() }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => {
        setSavingEdit(false);
        loadSuggestions();
      })
      .catch((err) => {
        setSavingEdit(false);
        setError(err.message);
      });
  }


  function loadIdeas() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/future-ideas`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) throw new Error("Jeton invalide");
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((rows) => {
        setIdeas(Array.isArray(rows) ? rows : []);
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }



  function togglePublished(idea) {
    fetch(`/api/admin/future-ideas/${idea.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ published: !idea.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(() => loadIdeas())
      .catch((err) => setError(err.message));
  }

  function removeIdea(slug) {
    fetch(`/api/admin/future-ideas/${slug}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(() => loadIdeas())
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — Les enfants d&apos;aujourd&apos;hui et de demain</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Protégé par code d&apos;authentification à 6 chiffres.</p>


      {loading && <p>Chargement...</p>}
      {error && <p role="alert" style={{ color: "#d63e2a" }}>{error}</p>}

      {loaded && !error && (
        <>
          <p style={{ marginBottom: "0.75rem" }}>
            <Link href="/admin/idees-enfants/edit">+ Nouvelle idée</Link>
          </p>
          {ideas.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune idée pour l&apos;instant.</p>
          ) : (
            <ScrollableTable>
<table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                  <th scope="col" style={{ textAlign: "right", padding: 8 }}>J&apos;adhère</th>
                  <th scope="col" style={{ textAlign: "right", padding: 8 }}>À nuancer</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                  <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {ideas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((idea) => (
                  <tr key={idea.slug}>
                    <td style={{ padding: 8 }}>
                      {idea.title}
                      {idea.submitted_publicly && !idea.published && <PublicSubmissionBadge />}{" "}
                      {idea.scope_codes && idea.scope_codes.length > 0 && <ScopeBadges codes={idea.scope_codes} locale="fr" />}
                    </td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{idea.adhere_count}</td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{idea.nuance_count}</td>
                    <td style={{ padding: 8, fontSize: 13, color: idea.published ? "#1baf7a" : "var(--color-texte-clair)" }}>
                      {idea.published ? "Publiée" : "Brouillon"}
                    </td>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => togglePublished(idea)} style={{ fontSize: 12, marginRight: 8 }}>
                        {idea.published ? "Dépublier" : "Publier"}
                      </button>
                      <Link href={`/admin/idees-enfants/edit?slug=${idea.slug}`} style={{ marginRight: 8 }}>Modifier</Link>
                      <button type="button" onClick={() => removeIdea(idea.slug)} style={{ fontSize: 12, color: "#d63e2a" }}>Suppr.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</ScrollableTable>
          )}
          {ideas.length > PAGE_SIZE && (
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(ideas.length / PAGE_SIZE))} onChange={setPage} />
          )}
        </>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: 16 }}>Boîte à idées — modération</h2>
        {suggestions.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune suggestion pour l&apos;instant.</p>
        ) : (
          <ScrollableTable>
<table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>Texte</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut</th>
                <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <Fragment key={s.id}>
                  <tr key={s.id}>
                    <td style={{ padding: 8, fontSize: 13, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.text} {s.scope_codes && s.scope_codes.length > 0 && <ScopeBadges codes={s.scope_codes} locale="fr" />}
                    </td>
                    <td style={{ padding: 8, fontSize: 13 }}>
                      {{ pending: "En attente", published: "Publiée", draft: "Brouillon", rejected: "Rejetée" }[s.status] || s.status}
                    </td>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => openSuggestion(s)}
                        style={{ fontSize: 12, marginRight: 8 }}
                      >
                        {viewingSuggestionId === s.id ? "Masquer" : "Voir / Modifier"}
                      </button>
                      <select
                        value={s.status}
                        onChange={(e) => updateSuggestionStatus(s.id, e.target.value)}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      >
                        <option value="pending">En attente</option>
                        <option value="published">Publiée</option>
                        <option value="draft">Brouillon</option>
                        <option value="rejected">Rejetée</option>
                      </select>
                    </td>
                  </tr>
                  {viewingSuggestionId === s.id && (
                    <tr key={`${s.id}-detail`}>
                      <td colSpan={3} style={{ padding: "0 8px 12px" }}>
                        <div style={{ padding: "0.75rem 1rem", background: "var(--color-fond)", borderRadius: 8, border: "1px solid var(--color-bordure)" }}>
                          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 6px", color: "var(--color-texte-clair)" }}>
                            Texte (modifiable avant publication)
                          </p>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={4}
                            maxLength={2000}
                            style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit", marginBottom: 8 }}
                          />
                          <button
                            type="button"
                            onClick={() => saveSuggestionText(s.id)}
                            disabled={!editText.trim() || editText.trim() === s.text || savingEdit}
                            style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}
                          >
                            {savingEdit ? "Enregistrement..." : "Enregistrer les modifications"}
                          </button>
                          {s.submitter_email && (
                            <p style={{ fontSize: 13, margin: "0 0 6px" }}>
                              Email : <a href={`mailto:${s.submitter_email}`}>{s.submitter_email}</a>
                            </p>
                          )}
                          {s.submission_notes && (
                            <>
                              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 4px", color: "var(--color-texte-clair)" }}>
                                Notes du proposant
                              </p>
                              <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{s.submission_notes}</p>
                            </>
                          )}
                          {!s.submitter_email && !s.submission_notes && (
                            <p style={{ fontSize: 12, color: "var(--color-texte-clair)", margin: 0 }}>Aucune information complémentaire fournie.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
</ScrollableTable>
        )}
      </section>
    </div>
  );
}

export default function AdminFutureIdeasList() {
  return <AdminAuthGate>{() => <AdminFutureIdeasListInner />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
