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

// Balises et attributs autorisés au collage — tout le reste est retiré.
// Objectif : empêcher qu'un copier-coller depuis Word/Google Docs/un site
// tiers n'injecte des styles en ligne (font-family, color, taille de
// police...) qui échapperaient à la feuille de style du site et créeraient
// des incohérences visuelles invisibles depuis l'éditeur d'admin lui-même
// (qui, lui, utilise la police du thème).
const ALLOWED_TAGS = new Set(["H2", "H3", "P", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "A", "BR"]);
const ALLOWED_ATTRS = { A: ["href"] };

// Nettoie récursivement un fragment DOM : supprime tout attribut non
// explicitement autorisé, et "déballe" (remplace par ses enfants) toute
// balise non autorisée plutôt que de perdre le texte qu'elle contient —
// un <span style="..."> collé devient simplement son texte, pas une perte
// de contenu.
function sanitizeNode(node) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    sanitizeNode(child);
    if (!ALLOWED_TAGS.has(child.tagName)) {
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      child.remove();
      continue;
    }
    const keep = ALLOWED_ATTRS[child.tagName] || [];
    for (const attr of Array.from(child.attributes)) {
      if (!keep.includes(attr.name)) child.removeAttribute(attr.name);
    }
  }
}

function sanitizeHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  sanitizeNode(container);
  return container.innerHTML;
}

export default function SimpleWysiwygEditor({ value, onChange }) {
  const editorRef = useRef(null);
  // undefined au départ (jamais égal à une chaîne) — force la synchronisation
  // au premier montage, contrairement à useRef(value) qui démarrait déjà
  // "égal" à la valeur initiale et empêchait tout affichage au chargement.
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

  // Intercepte le collage pour nettoyer le HTML avant insertion — sans ça,
  // un copier-coller depuis Word/Google Docs/un site tiers embarque souvent
  // ses propres styles en ligne (police, couleur, taille) qui écrasent
  // silencieusement l'apparence du site pour ce fragment de contenu.
  function handlePaste(e) {
    e.preventDefault();
    const rawHtml = e.clipboardData.getData("text/html");
    const cleaned = rawHtml ? sanitizeHtml(rawHtml) : (e.clipboardData.getData("text/plain") || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    document.execCommand("insertHTML", false, cleaned);
    handleInput();
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
        onPaste={handlePaste}
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
