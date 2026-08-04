// Fonction unique de génération de slug, utilisée par toutes les pages
// d'édition admin (débunk, interviews, paysans, ressources, idées enfants)
// — remplace une copie identique qui était dupliquée dans chacune de ces
// pages plutôt que centralisée ici.
export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
