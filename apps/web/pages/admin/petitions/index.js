import { useState } from "react";
import Link from "next/link";
import AdminAuthGate from "../../../components/AdminAuthGate";
import Pagination from "../../../components/Pagination";
import ScrollableTable from "../../../components/ScrollableTable";
import { useApiFetch } from "../../../lib/useApiFetch";

const PAGE_SIZE = 20;
const STATUS_LABELS = { ongoing: "En cours", closed: "Clôturée" };

// Petit badge pour distinguer les entrées proposées via le formulaire
// public (en attente de relecture) de celles créées directement en admin.
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
      Proposé par le public
    </span>
  );
}

function AdminPetitionsListInner() {
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  const { data, loading, error: fetchError, setData } = useApiFetch("/api/admin/petitions", {
    credentials: "include",
  });
  const entries = data ?? [];
  const pendingEntries = entries.filter((e) => e.submitted_publicly && !e.published);
  const mainEntries = entries.filter((e) => !(e.submitted_publicly && !e.published));

  function reload() {
    fetch(`/api/admin/petitions`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((rows) => setData(rows))
      .catch((err) => setError(err.message));
  }

  function deleteEntry(entry) {
    if (!window.confirm(`Supprimer définitivement la pétition "${entry.title}" ? Cette action est irréversible.`)) return;
    fetch(`/api/admin/petitions/${entry.slug}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la suppression");
        return res.json();
      })
      .then(reload)
      .catch((err) => setError(err.message));
  }

  function togglePublished(entry) {
    fetch(`/api/admin/petitions/${entry.slug}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ published: !entry.published }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Échec de la mise à jour");
        return res.json();
      })
      .then(reload)
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: "0.5rem" }}>
        <Link href="/admin">← Retour à l&apos;administration</Link>
      </p>
      <h1>Administration — Pétitions</h1>
      <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Même jeton que pour les autres sections.</p>

      {loading && <p>Chargement...</p>}
      {(error || fetchError) && <p role="alert" style={{ color: "#d63e2a" }}>{error || fetchError}</p>}

      {!loading && !fetchError && (
        <>
          <p style={{ marginBottom: "0.75rem" }}>
            <Link href="/admin/petitions/edit">+ Nouvelle pétition</Link>
          </p>
          {mainEntries.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune pétition pour l&apos;instant.</p>
          ) : (
            <ScrollableTable>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut de la pétition</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}>Publication</th>
                    <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {mainEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => (
                    <tr key={e.slug}>
                      <td style={{ padding: 8 }}>
                        {e.title}
                      </td>
                      <td style={{ padding: 8 }}>{STATUS_LABELS[e.status] || e.status}</td>
                      <td style={{ padding: 8, fontSize: 13, color: e.published ? "#1baf7a" : "var(--color-texte-clair)" }}>
                        {e.published ? "Publié" : "Brouillon"}
                      </td>
                      <td style={{ padding: 8 }}>
                        <button type="button" onClick={() => togglePublished(e)} style={{ fontSize: 12, marginRight: 8 }}>
                          {e.published ? "Dépublier" : "Publier"}
                        </button>
                        <Link href={`/admin/petitions/edit?slug=${e.slug}`}>Modifier</Link>
                        <button
                          type="button"
                          onClick={() => deleteEntry(e)}
                          style={{ fontSize: 12, marginLeft: 8, color: "#d63e2a" }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          )}
          {mainEntries.length > PAGE_SIZE && (
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(mainEntries.length / PAGE_SIZE))} onChange={setPage} />
          )}

          <section style={{ marginTop: "2rem" }}>
            <h2 style={{ fontSize: 16 }}>Modération — propositions du public</h2>
            {pendingEntries.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-texte-clair)" }}>Aucune proposition en attente.</p>
            ) : (
              <ScrollableTable>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Titre</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}>Statut de la pétition</th>
                      <th scope="col" style={{ textAlign: "left", padding: 8 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEntries.map((e) => (
                      <tr key={e.slug}>
                        <td style={{ padding: 8 }}>{e.title}</td>
                        <td style={{ padding: 8 }}>{STATUS_LABELS[e.status] || e.status}</td>
                        <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                          <button type="button" onClick={() => togglePublished(e)} style={{ fontSize: 12, marginRight: 8 }}>
                            Publier
                          </button>
                          <Link href={`/admin/petitions/edit?slug=${e.slug}`} style={{ marginRight: 8 }}>Modifier</Link>
                          <button type="button" onClick={() => deleteEntry(e)} style={{ fontSize: 12, color: "#d63e2a" }}>
                            Rejeter
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function AdminPetitionsList() {
  return <AdminAuthGate>{() => <AdminPetitionsListInner />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
