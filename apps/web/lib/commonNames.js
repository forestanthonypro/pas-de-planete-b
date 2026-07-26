// Formatte l'ensemble des noms communs disponibles (fr, en, es, de) plutôt que
// de n'afficher qu'une seule langue — utile tant que l'interface elle-même
// n'a pas encore de vrai sélecteur de langue.
const LANGUAGE_LABELS = { fr: "FR", en: "EN", es: "ES", de: "DE" };
const LANGUAGE_ORDER = ["fr", "en", "es", "de"];

export function formatCommonNames(commonNames) {
  if (!commonNames || Object.keys(commonNames).length === 0) {
    return null;
  }
  return LANGUAGE_ORDER.filter((lang) => commonNames[lang])
    .map((lang) => `${LANGUAGE_LABELS[lang]} : ${commonNames[lang]}`)
    .join(" · ");
}
