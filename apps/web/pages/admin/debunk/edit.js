import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminAuthGate from "../../../components/AdminAuthGate";
import ContentTranslationsEditor from "../../../components/ContentTranslationsEditor";
import ScopeMultiSelect from "../../../components/ScopeMultiSelect";
import DebunkContentWithCharts from "../../../components/DebunkContentWithCharts";
import ErrorBoundary from "../../../components/ErrorBoundary";
import Link from "next/link";
import { slugify } from "../../../lib/slugify";


const TRANSLATION_FIELDS = [
  { name: "myth", label: "Titre / affirmation démontée", multiline: false },
  { name: "claim_quote", label: "Citation exacte de l'affirmation", multiline: true },
  { name: "reality", label: "Ce qu'il en est vraiment", multiline: true },
  // autoTranslate: false — un JSON de graphiques envoyé tel quel à l'API
  // de traduction automatique casserait sa syntaxe (guillemets, clés
  // "type"/"labels"/"data" traduites comme si c'était de la prose). La
  // traduction reste possible, mais seulement collée manuellement langue
  // par langue (traduire les libellés affichés, garder data/colors tels
  // quels).
  { name: "charts", label: "Graphiques (JSON — coller la version traduite, pas d'auto-traduction)", multiline: true, autoTranslate: false },
];

function AdminDebunkEditInner() {
  const router = useRouter();
  const { slug: editSlug } = router.query;
  const isEditing = Boolean(editSlug);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [myth, setMyth] = useState("");
  const [claimQuote, setClaimQuote] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [reality, setReality] = useState("");
  const [chartsJson, setChartsJson] = useState("");
  const [chartsPreview, setChartsPreview] = useState(null);
  const [chartsError, setChartsError] = useState(null);
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
    fetch(`/api/debunk-categories`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!editSlug) return;
    setLoading(true);
    fetch(`/api/admin/debunk/${editSlug}`, {
      credentials: "include",
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
        if (data.entry.charts) {
          const formatted = JSON.stringify(data.entry.charts, null, 2);
          setChartsJson(formatted);
          setChartsPreview(data.entry.charts);
        }
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
  }, [editSlug]);

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

  function previewCharts() {
    if (!chartsJson.trim()) {
      setChartsPreview(null);
      setChartsError(null);
      return;
    }
    try {
      const parsed = JSON.parse(chartsJson);
      if (!Array.isArray(parsed)) {
        setChartsError("Le JSON doit être un tableau (même pour un seul graphique) : [ { ... } ]");
        setChartsPreview(null);
        return;
      }
      setChartsPreview(parsed);
      setChartsError(null);
    } catch (err) {
      setChartsError(`JSON invalide : ${err.message}`);
      setChartsPreview(null);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    let chartsToSend = null;
    if (chartsJson.trim()) {
      try {
        chartsToSend = JSON.parse(chartsJson);
        if (!Array.isArray(chartsToSend)) {
          setChartsError("Le JSON doit être un tableau (même pour un seul graphique) : [ { ... } ]");
          return;
        }
      } catch (err) {
        setChartsError(`JSON invalide : ${err.message}`);
        return;
      }
    }

    setStatus("saving");
    setError(null);

    fetch(`/api/admin/debunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
        charts: chartsToSend,
      }),
    })
      .then((res) => {
        if (res.status === 401) throw new Error("Jeton invalide");
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.detail ? `${d.error} — ${d.detail}` : d.error || "Erreur")));
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

        <div style={{ marginBottom: "1rem", border: "1px solid var(--color-bordure)", borderRadius: 8, padding: "0.75rem 1rem" }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Graphiques (optionnel)</p>
          <p style={{ fontSize: 12, color: "var(--color-texte-clair)", marginBottom: 8 }}>
            Collez une configuration JSON — jamais de code. Un tableau, même pour un seul graphique. Types
            possibles : <code>bar</code>, <code>bar-horizontal</code>, <code>line</code>, <code>pie</code>,{" "}
            <code>doughnut</code>. Par défaut, les graphiques s&apos;affichent à la fin du texte — pour en placer
            un au milieu, insérez <code>[[chart:0]]</code> (0 = premier graphique du tableau, 1 = deuxième...)
            directement dans le champ &laquo;&nbsp;Ce qu&apos;il en est vraiment&nbsp;&raquo; ci-dessus, à
            l&apos;endroit voulu.
          </p>
          <textarea
            value={chartsJson}
            onChange={(e) => setChartsJson(e.target.value)}
            placeholder={`[\n  {\n    "type": "bar",\n    "title": "Titre affiché",\n    "unit": "g CO2e/km",\n    "labels": ["Thermique", "Électrique"],\n    "datasets": [{ "data": [235, 63], "colors": ["#2a78d6", "#1baf7a"] }]\n  }\n]`}
            rows={8}
            style={{ width: "100%", padding: "8px 10px", fontFamily: "monospace", fontSize: 12 }}
          />
          <button type="button" onClick={previewCharts} style={{ fontSize: 12, marginTop: 6 }}>
            Valider et prévisualiser
          </button>
          {chartsError && (
            <p role="alert" style={{ color: "#d63e2a", fontSize: 12, marginTop: 6 }}>
              {chartsError}
            </p>
          )}
          {chartsPreview && (
            <div style={{ marginTop: 12, background: "#fff", padding: "0.75rem", borderRadius: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-texte-clair)", marginBottom: 8 }}>
                Aperçu — texte et graphiques tels qu&apos;affichés sur la page publique
              </p>
              <ErrorBoundary
                resetKey={chartsJson + reality}
                fallback={
                  <p style={{ color: "#d63e2a", fontSize: 12 }}>
                    Le JSON est syntaxiquement valide mais sa structure ne correspond pas à ce qu&apos;attend un
                    graphique (champ manquant, tableaux de tailles différentes...). Vérifiez le format ci-dessus —
                    l&apos;enregistrement final sera de toute façon revalidé et refusé s&apos;il reste incorrect.
                  </p>
                }
              >
                <DebunkContentWithCharts reality={reality} charts={chartsPreview} />
              </ErrorBoundary>
            </div>
          )}
        </div>

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
        baseValues={{ myth, claim_quote: claimQuote, reality, charts: chartsJson }}
      />
    </div>
  );
}

export default function AdminDebunkEdit() {
  return <AdminAuthGate>{() => <AdminDebunkEditInner />}</AdminAuthGate>;
}

export async function getStaticProps() {
  return { props: {} };
}
