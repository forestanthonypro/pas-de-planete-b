import sanitizeHtml from "sanitize-html";

// Nettoyeur HTML pour le contenu des pages légales (mentions légales,
// confidentialité), affiché via dangerouslySetInnerHTML côté front.
//
// Suite à un audit de sécurité externe (20 août 2026) : l'ancien nettoyeur
// artisanal (expressions régulières) vérifiait le protocole d'un lien sur
// la chaîne BRUTE, avant tout décodage d'entités HTML — un lien du type
// href="&#106;avascript:..." passait donc inaperçu, alors qu'un navigateur
// le décode et l'exécute normalement au clic. Démontré avec un vrai
// navigateur avant correction (voir test unitaire associé). sanitize-html
// est un vrai parseur HTML (pas des regex sur du texte), largement utilisé
// et maintenu, qui décode correctement les entités avant toute vérification.
//
// L'admin est protégé par TOTP — ce nettoyeur reste un filet de sécurité
// en plus du nettoyage déjà fait côté client au moment du collage
// (SimpleWysiwygEditor.js), pas la seule ligne de défense.
const OPTIONS = {
  allowedTags: ["h2", "h3", "p", "strong", "b", "em", "i", "ul", "ol", "li", "a", "br"],
  allowedAttributes: {
    // rel/target : pas fournis par l'admin, ajoutés automatiquement par
    // transformTags ci-dessous — doivent quand même figurer ici, sinon la
    // liste blanche d'attributs les retire après coup.
    a: ["href", "rel", "target"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  // Sans protocole du tout (lien relatif comme "/mentions-legales") reste
  // autorisé par défaut par la bibliothèque — cohérent avec l'usage réel
  // de ces pages (liens internes fréquents entre pages légales).
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function sanitizeLegalHtml(html) {
  if (!html || typeof html !== "string") return html;
  return sanitizeHtml(html, OPTIONS);
}
