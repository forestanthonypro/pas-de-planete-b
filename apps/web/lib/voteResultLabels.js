// Traduit les résultats de vote bruts renvoyés par Congress.gov/GovTrack
// (toujours en anglais à la source) — les valeurs possibles ne sont pas
// toutes documentées officiellement, celles ci-dessous couvrent ce qui a
// été observé en pratique (votes "classiques" + procéduraux comme
// l'élection du Speaker). Toute valeur non reconnue s'affiche telle quelle
// plutôt que de planter — mieux vaut un texte anglais visible qu'un champ
// vide.
const RESULT_KEYS = {
  Passed: "result_passed",
  Failed: "result_failed",
  "Agreed to": "result_agreed_to",
  Rejected: "result_rejected",
  "Elected Speaker Name": "result_elected_speaker",
};

export function translateVoteResult(result, t) {
  if (!result) return null;
  const key = RESULT_KEYS[result];
  return key ? t(`international.${key}`) : result;
}
