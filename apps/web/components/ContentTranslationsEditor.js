import { useEffect, useState } from "react";
import { useApiFetch } from "../lib/useApiFetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const LANGUAGE_TABS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
];

// Éditeur de traductions générique et réutilisable pour le contenu géré en
// admin (débunk, puis interviews, paysans, ressources...). Le français
// reste toujours édité directement dans le formulaire principal — ce
// composant ne gère que les 7 autres langues, en overlay.
//
// fields: [{ name: "myth", label: "Titre / affirmation", multiline: false }, ...]
// Les valeurs françaises (baseValues) servent de repère visuel — un champ
// de traduction vide affiche le texte français en filigrane, pour que
// l'admin sache ce qu'il doit traduire sans avoir à jongler entre onglets.
export default function ContentTranslationsEditor({ contentType, contentId, fields, baseValues, sessionToken }) {
  const [lang, setLang] = useState("en");
  const [values, setValues] = useState({});
  const [initialValues, setInitialValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saved | error

  const { data: forLang, loading } = useApiFetch(
    contentId ? `/api/admin/content-translations/${contentType}/${contentId}` : null,
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
      transform: (rows) => {
        const result = {};
        for (const row of Array.isArray(rows) ? rows : []) {
          if (row.locale === lang) result[row.field_name] = row.value;
        }
        return result;
      },
      deps: [lang, sessionToken],
    }
  );

  useEffect(() => {
    if (!forLang) return;
    setValues(forLang);
    setInitialValues(forLang);
  }, [forLang]);

  function handleChange(fieldName, value) {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  }

  function handleSave() {
    setSaving(true);
    setStatus("idle");
    const toSave = fields.filter((f) => (values[f.name] || "") !== (initialValues[f.name] || ""));
    Promise.all(
      toSave.map((f) =>
        fetch(`${API_URL}/api/admin/content-translations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({
            contentType,
            contentId,
            fieldName: f.name,
            locale: lang,
            value: values[f.name] || "",
          }),
        }).then((res) => {
          if (!res.ok) throw new Error();
        })
      )
    )
      .then(() => {
        setInitialValues(values);
        setStatus("saved");
        setSaving(false);
      })
      .catch(() => {
        setStatus("error");
        setSaving(false);
      });
  }

  if (!contentId) {
    return (
      <p style={{ fontSize: 12, color: "var(--color-texte-clair)", fontStyle: "italic" }}>
        Enregistre d&apos;abord l&apos;entrée en français pour pouvoir ajouter ses traductions.
      </p>
    );
  }

  const hasChanges = fields.some((f) => (values[f.name] || "") !== (initialValues[f.name] || ""));

  return (
    <section
      style={{
        background: "var(--color-carte)",
        border: "1px solid var(--color-bordure)",
        borderRadius: 12,
        padding: "1.25rem",
        marginTop: "1.5rem",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>Traductions</p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {LANGUAGE_TABS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            style={{
              fontSize: 12,
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid var(--color-bordure)",
              background: lang === l.code ? "var(--color-carte-verte)" : "var(--color-fond)",
              color: "var(--color-texte)",
              fontWeight: lang === l.code ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: 13 }}>Chargement...</p>
      ) : (
        <>
          {fields.map((f) => (
            <label key={f.name} style={{ display: "block", marginBottom: "0.75rem" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.label}</span>
              {f.multiline ? (
                <textarea
                  value={values[f.name] || ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  placeholder={baseValues[f.name] || ""}
                  rows={f.name === "reality" ? 6 : 2}
                  style={{ width: "100%", padding: "8px 10px", fontFamily: "inherit" }}
                />
              ) : (
                <input
                  type="text"
                  value={values[f.name] || ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  placeholder={baseValues[f.name] || ""}
                  style={{ width: "100%", padding: "8px 10px" }}
                />
              )}
            </label>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={handleSave} disabled={saving || !hasChanges} style={{ fontSize: 13, fontWeight: 600 }}>
              {saving ? "Enregistrement..." : "Enregistrer cette langue"}
            </button>
            {status === "saved" && <span style={{ fontSize: 12, color: "#1baf7a" }}>Enregistré ✓</span>}
            {status === "error" && <span style={{ fontSize: 12, color: "#d63e2a" }}>Échec de l&apos;enregistrement</span>}
          </div>
        </>
      )}
    </section>
  );
}
