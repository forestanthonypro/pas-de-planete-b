import { useState, useRef, useEffect } from "react";
import { getAllScopeOptions, scopeFlag, scopeLabel } from "../lib/scopes";

// Sélecteur pays/continent/monde à sélection multiple — utilisé à la fois
// dans les formulaires de proposition (choisir la portée d'un contenu) et
// dans les filtres des pages de liste (voir ScopeFilter, qui réutilise ce
// même composant). Recherche simple, résultats limités à 30 lignes à la
// fois pour rester léger (258 options au total, inutile de tout rendre
// d'un coup) — cohérent avec l'écoconception du site.
export default function ScopeMultiSelect({ value = [], onChange, locale, label, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const allOptions = getAllScopeOptions(locale);
  const filtered = (
    query ? allOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : allOptions
  ).slice(0, 30);

  function addScope(code) {
    if (!value.includes(code)) onChange([...value, code]);
    setQuery("");
  }

  function removeScope(code) {
    onChange(value.filter((c) => c !== code));
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-texte)", marginBottom: 6 }}>{label}</label>}

      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((code) => (
            <span
              key={code}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "var(--color-carte-verte, #eaf3de)",
                borderRadius: 16,
                padding: "4px 10px",
                fontSize: 13,
                color: "var(--color-texte)",
              }}
            >
              <span aria-hidden="true">{scopeFlag(code)}</span> {scopeLabel(code, locale)}
              <button
                type="button"
                onClick={() => removeScope(code)}
                aria-label={scopeLabel(code, locale)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1, color: "var(--color-texte-clair)" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: 14,
          borderRadius: 8,
          border: "1px solid var(--color-bordure)",
          background: "var(--color-fond)",
          color: "var(--color-texte)",
        }}
      />

      {open && (
        <ul
          style={{
            position: "absolute",
            // Leaflet place ses propres panneaux internes entre 200 et 700
            // de z-index (jusqu'à 1000 pour ses contrôles) — 10 ne suffit
            // pas dès que ce composant est utilisé au-dessus d'une carte
            // (ex. /ressources). 2000 reste largement au-dessus dans tous
            // les cas, sans effet sur les pages qui n'ont pas de carte.
            zIndex: 2000,
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--color-fond)",
            border: "1px solid var(--color-bordure)",
            borderRadius: 8,
            marginTop: 4,
            padding: 4,
            listStyle: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}
        >
          {filtered.length === 0 && (
            <li style={{ padding: 8, fontSize: 13, color: "var(--color-texte-clair)" }}>—</li>
          )}
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={() => addScope(o.value)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  background: value.includes(o.value) ? "var(--color-carte-verte, #eaf3de)" : "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  borderRadius: 6,
                  color: "var(--color-texte)",
                }}
              >
                <span aria-hidden="true">{o.flag}</span> {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
