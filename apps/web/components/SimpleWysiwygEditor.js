import { useEffect, useRef } from "react";

// Éditeur visuel simple basé sur contentEditable + document.execCommand —
// volontairement sans librairie externe (cohérent avec le reste du projet,
// qui évite les dépendances lourdes). Couvre les besoins d'une page de
// contenu légal : titres, paragraphes, gras, italique, liens, listes.
// Pour des cas plus avancés, l'onglet "Code" à côté reste disponible.
const BUTTONS = [
  { label: "Titre", command: "formatBlock", value: "H2" },
  { label: "Paragraphe", command: "formatBlock", value: "P" },
  { label: "Gras", command: "bold" },
  { label: "Italique", command: "italic" },
  { label: "Liste", command: "insertUnorderedList" },
];

export default function SimpleWysiwygEditor({ value, onChange }) {
  const editorRef = useRef(null);
  // undefined au dÃ©part (jamais Ã©gal Ã  une chaÃ®ne) â€” force la synchronisation
  // au premier montage, contrairement Ã  useRef(value) qui dÃ©marrait dÃ©jÃ 
  // "Ã©gal" Ã  la valeur initiale et empÃªchait tout affichage au chargement.
  const lastEmittedRef = useRef(undefined);

  // Ne synchronise le contenu externe dans l'éditeur que s'il ne vient pas
  // de l'éditeur lui-même (comparaison avec le dernier contenu qu'on a
  // nous-mêmes émis) — jamais à chaque frappe, pour ne pas faire sauter le
  // curseur pendant la saisie.
  useEffect(() => {
    if (editorRef.current && value !== lastEmittedRef.current) {
      editorRef.current.innerHTML = value || "";
      lastEmittedRef.current = value;
    }
  }, [value]);

  function handleInput() {
    const html = editorRef.current.innerHTML;
    lastEmittedRef.current = html;
    onChange(html);
  }

  function runCommand(command, value) {
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleInput();
  }

  function handleLink() {
    const url = window.prompt("Adresse du lien (https://...) :");
    if (url) runCommand("createLink", url);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
        {BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => runCommand(b.command, b.value)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-bordure)",
              background: "var(--color-fond)",
              color: "var(--color-texte)",
              cursor: "pointer",
            }}
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleLink}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--color-bordure)",
            background: "var(--color-fond)",
            color: "var(--color-texte)",
            cursor: "pointer",
          }}
        >
          Lien
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="pdpb-legal-content"
        style={{
          border: "1px solid var(--color-bordure)",
          borderRadius: 8,
          padding: "1rem 1.25rem",
          minHeight: 260,
          maxHeight: 420,
          overflowY: "auto",
          background: "var(--color-fond)",
          color: "var(--color-texte)",
        }}
        suppressContentEditableWarning
      />
    </div>
  );
}
