import { useEffect, useState } from "react";
import { useApiFetch } from "../lib/useApiFetch";


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
export default function ContentTranslationsEditor({ contentType, contentId, fields, baseValues }) {
  const [lang, setLang] = useState("en");
  const [values, setValues] = useState({});
  const [initialValues, setInitialValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saved | error
  const [translating, setTranslating] = useState(false); // false | "current" | "all"
  const [translateError, setTranslateError] = useState(null);

  const { data: forLang, loading } = useApiFetch(
    contentId ? `/api/admin/content-translations/${contentType}/${contentId}` : null,
    {
      credentials: "include",
      transform: (rows) => {
        const result = {};
        for (const row of Array.isArray(rows) ? rows : []) {
          if (row.locale === lang) result[row.field_name] = row.value;
        }
        return result;
      },
      deps: [lang],
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

  // Traduction automatique (Google Cloud Translation, voir apps/api/src/routes/translate.js).
  // Pré-remplit le brouillon pour relecture — n'enregistre jamais seule.
  function handleTranslateCurrent() {
    setTranslating("current");
    setTranslateError(null);
    const texts = {};
    fields.forEach((f) => {
      texts[f.name] = baseValues[f.name] || "";
    });
    fetch(`/api/admin/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ texts, targetLangs: [lang] }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Erreur")));
        return res.json();
      })
      .then((result) => {
        setValues((prev) => ({ ...prev, ...result[lang] }));
        setTranslating(false);
      })
      .catch((err) => {
        setTranslateError(err.message);
        setTranslating(false);
      });
  }

  // Traduit ET enregistre directement les 7 langues d'un coup (contrairement
  // au bouton ci-dessus, qui ne fait que pré-remplir la langue affichée pour
  // relecture) — l'architecture actuelle du composant ne garde en mémoire
  // que la langue sélectionnée à la fois, pas de brouillon multi-langues
  // possible sans enregistrer au fur et à mesure. Après coup, repasser sur
  // chaque onglet permet de relire et corriger normalement.
  function handleTranslateAll() {
    setTranslating("all");
    setTranslateError(null);
    const texts = {};
    fields.forEach((f) => {
      texts[f.name] = baseValues[f.name] || "";
    });
    const allLangs = LANGUAGE_TABS.map((l) => l.code);
    fetch(`/api/admin/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ texts, targetLangs: allLangs }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Erreur")));
        return res.json();
      })
      .then((result) =>
        Promise.all(
          allLangs.flatMap((l) =>
            fields.map((f) =>
              fetch(`/api/admin/content-translations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  contentType,
                  contentId,
                  fieldName: f.name,
                  locale: l,
                  value: result[l][f.name] || "",
                }),
              })
            )
          )
        ).then(() => result)
      )
      .then((result) => {
        // On a déjà le résultat traduit pour la langue actuellement
        // affichée : pas besoin de recharger depuis le serveur.
        setValues(result[lang]);
        setInitialValues(result[lang]);
        setTranslating(false);
        setStatus("saved");
      })
      .catch((err) => {
        setTranslateError(err.message);
        setTranslating(false);
      });
  }

  function handleSave() {
    setSaving(true);
    setStatus("idle");
    const toSave = fields.filter((f) => (values[f.name] || "") !== (initialValues[f.name] || ""));
    Promise.all(
      toSave.map((f) =>
        fetch(`/api/admin/content-translations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
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

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={handleTranslateCurrent} disabled={!!translating} style={{ fontSize: 12 }}>
          {translating === "current" ? "Traduction..." : `Traduire automatiquement (${LANGUAGE_TABS.find((l) => l.code === lang)?.label})`}
        </button>
        <button type="button" onClick={handleTranslateAll} disabled={!!translating} style={{ fontSize: 12 }}>
          {translating === "all" ? "Traduction des 7 langues..." : "Traduire et enregistrer dans les 7 langues"}
        </button>
        {translateError && <span style={{ fontSize: 12, color: "#d63e2a" }}>{translateError}</span>}
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
