// N'expose le détail technique d'une erreur (message d'exception, parfois
// une requête SQL ou un chemin de fichier) qu'en dehors de la production —
// utile pour déboguer en local, mais ça n'a rien à faire dans une réponse
// visible par n'importe quel visiteur du site en ligne.
export function errorDetail(err) {
  return process.env.NODE_ENV === "production" ? undefined : err.message;
}
