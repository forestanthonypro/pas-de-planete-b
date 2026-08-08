// Nettoyeur HTML léger pour le contenu des pages légales — volontairement
// basé sur des expressions régulières plutôt qu'une vraie librairie de
// parsing (jsdom, sanitize-html...), cohérent avec le choix du projet
// d'éviter les dépendances lourdes. Ce n'est PAS un parseur HTML complet :
// c'est un filet de sécurité en plus du nettoyage déjà fait côté client au
// moment du collage (SimpleWysiwygEditor.js) — l'admin est protégé par TOTP,
// donc l'objectif ici est surtout d'empêcher qu'un appel API direct (hors
// de l'éditeur) ne réintroduise des styles en ligne ou des balises
// dangereuses, pas de défendre contre un attaquant sophistiqué.

const ALLOWED_TAGS = new Set(["h2", "h3", "p", "strong", "b", "em", "i", "ul", "ol", "li", "a", "br"]);
// Tags dont on retire aussi tout le contenu (pas juste la balise) —
// dangereux ou inutiles dans ce contexte.
const STRIP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed"];

export function sanitizeLegalHtml(html) {
  if (!html || typeof html !== "string") return html;

  let out = html;

  for (const tag of STRIP_WITH_CONTENT) {
    out = out.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi"), "");
    out = out.replace(new RegExp(`<${tag}[^>]*/?>`, "gi"), "");
  }

  // Reconstruit chaque balise restante : la supprime si elle n'est pas dans
  // la liste blanche (en gardant le texte/les enfants), sinon ne conserve
  // que les attributs explicitement autorisés (seul href sur <a>).
  out = out.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (match, closing, tagRaw, attrs) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (closing) return `</${tag}>`;
    if (tag === "a") {
      const hrefMatch = attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i);
      const href = hrefMatch ? hrefMatch[1] : "";
      if (!href || /^\s*javascript:/i.test(href)) return "<a>";
      return `<a href="${href.replace(/"/g, "&quot;")}">`;
    }
    return `<${tag}>`;
  });

  return out;
}
