import { useEffect, useMemo, useRef, useState } from "react";
import { localizedCountryName } from "../lib/countryNames";

// Retire les accents pour une recherche insensible aux accents (ex: "perou"
// trouve "Pérou", "cote d'ivoire" trouve "Côte d'Ivoire").
function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Sélecteur de pays avec champ de recherche et tri alphabétique — remplace un
// <select> simple, plus pratique dès qu'il y a une centaine de pays à
// parcourir. Accepte soit une liste de codes ISO3 (string[]), soit une liste
// d'objets {country_code, ...} (comme renvoyés par certains endpoints) : les
// deux formats coexistent encore selon les pages.
export default function CountrySelect({ countries, value, onChange, preferredLang, label = "Pays" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);

  const codes = useMemo(
    () => countries.map((c) => (typeof c === "string" ? c : c.country_code)),
    [countries]
  );

  const sorted = useMemo(() => {
    return [...codes].sort((a, b) =>
      localizedCountryName(a, preferredLang).localeCompare(localizedCountryName(b, preferredLang), preferredLang || "fr")
    );
  }, [codes, preferredLang]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = normalize(query.trim());
    return sorted.filter((c) => normalize(localizedCountryName(c, preferredLang)).includes(q));
  }, [sorted, query, preferredLang]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = localizedCountryName(value, preferredLang);

  function selectCountry(code) {
    onChange(code);
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
      if (filtered[highlighted]) selectCountry(filtered[highlighted]);
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
        placeholder="Rechercher un pays..."
        aria-label={`${label} — rechercher`}
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
            background: "white",
            border: "1px solid #ccc",
            borderRadius: 4,
            margin: 0,
            padding: 0,
            listStyle: "none",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.length === 0 && (
            <li style={{ padding: "6px 10px", color: "#999", fontSize: 13 }}>Aucun résultat</li>
          )}
          {filtered.map((code, i) => (
            <li
              key={code}
              role="option"
              aria-selected={code === value}
              onMouseDown={() => selectCountry(code)}
              style={{
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 14,
                background: i === highlighted ? "#f0f0f0" : code === value ? "#f7f7f7" : "white",
              }}
            >
              {localizedCountryName(code, preferredLang)}
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
