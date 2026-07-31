import { useEffect, useMemo, useRef, useState } from "react";
import { useIsNativeApp } from "../lib/platform";

// Retire les accents pour une recherche insensible aux accents.
function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Sélecteur générique avec deux rendus selon la plateforme :
// - Web : champ de recherche + liste filtrée, stylé comme le reste du site
//   (comportement historique de CountrySelect).
// - App mobile (Capacitor) : <select> HTML natif, pour profiter du picker
//   système d'Android/iOS plutôt que d'imposer un composant maison qui
//   détonnerait avec le reste de l'interface native.
//
// options: [{ value, label }]. allLabel (optionnel) ajoute une option
// "Tous" en tête de liste, avec value === "".
export default function SearchableSelect({
  options,
  value,
  onChange,
  label,
  placeholder,
  noResultsLabel = "Aucun résultat",
  allLabel,
}) {
  const isNativeApp = useIsNativeApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = normalize(query.trim());
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isNativeApp) {
    return (
      <label>
        {label}{" "}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {allLabel !== undefined && <option value="">{allLabel}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption ? selectedOption.label : allLabel || "";

  function select(val) {
    onChange(val);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) select(filtered[highlighted].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <label style={{ position: "relative", display: "inline-block" }} ref={containerRef}>
      {label}{" "}
      <input
        type="text"
        value={open ? query : selectedLabel}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlighted(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={label}
        style={{ padding: "4px 8px", minWidth: 180 }}
      />
      {open && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--color-fond)",
            border: "1px solid var(--color-bordure)",
            borderRadius: 4,
            margin: 0,
            padding: 0,
            listStyle: "none",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          {allLabel !== undefined && (
            <li
              role="option"
              aria-selected={value === ""}
              onMouseDown={() => select("")}
              style={{
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 14,
                color: "var(--color-texte)",
                background: value === "" ? "var(--color-carte)" : "var(--color-fond)",
              }}
            >
              {allLabel}
            </li>
          )}
          {filtered.length === 0 && (
            <li style={{ padding: "6px 10px", color: "var(--color-texte-clair)", fontSize: 13 }}>
              {noResultsLabel}
            </li>
          )}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={() => select(o.value)}
              style={{
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 14,
                color: "var(--color-texte)",
                background:
                  i === highlighted
                    ? "var(--color-carte-verte)"
                    : o.value === value
                    ? "var(--color-carte)"
                    : "var(--color-fond)",
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
